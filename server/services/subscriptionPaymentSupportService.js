import mongoose from "mongoose";
import ClinicSubscription from "../models/ClinicSubscription.js";
import SubscriptionPayment from "../models/SubscriptionPayment.js";
import SubscriptionCheckoutArchive from "../models/SubscriptionCheckoutArchive.js";
import { getRazorpay } from "../config/razorpay.js";
import { clearedCheckoutLock, findOrdersByReceipt } from "./subscriptionCheckoutPolicy.js";
import { activateReviewedPayment, validateOrderIdentity } from "./subscriptionPaymentService.js";

const fail = message => Object.assign(new Error(message), { statusCode: 409 });
const audit = (operator, reason, action, previousStatus, entitlement) => {
  if (!operator?.trim() || !reason?.trim()) throw fail("Operator and a support ticket/reason are required");
  return { operator: operator.trim(), reason: reason.trim(), action, previousStatus, entitlement, at: new Date() };
};

export async function inspectCheckout(clinicId) {
  if (!mongoose.isValidObjectId(clinicId)) throw fail("Invalid clinic ID");
  const subscription = await ClinicSubscription.findOne({ clinicId }).lean();
  if (!subscription) throw fail("Subscription not found");
  const draft = subscription.paymentOrderDraft;
  return {
    subscription,
    remoteOrders: draft ? await findOrdersByReceipt(getRazorpay(), draft.receipt) : [],
    payments: await SubscriptionPayment.find({ subscriptionId: subscription._id }).sort({ createdAt: -1 }).lean(),
  };
}

export async function resolveCheckout({ clinicId, orderId, releaseEmpty = false, operator, reason }) {
  const entry = audit(operator, reason, "recover-order", "created", "unchanged");
  const { subscription, remoteOrders } = await inspectCheckout(clinicId);
  const draft = subscription.paymentOrderDraft;
  if (!subscription.paymentOrderLock || !draft) throw fail("No durable uncertain checkout draft; legacy orders need explicit historical validation");
  const age = Date.now() - new Date(subscription.paymentOrderLockedAt || subscription.updatedAt).getTime();
  if (!Number.isFinite(age) || age < (releaseEmpty ? 600000 : 120000)) throw fail("Checkout is too recent; wait for the active request/provider to finish");
  const selected = remoteOrders.find(order => order.id === orderId);
  if (releaseEmpty ? remoteOrders.length !== 0 : !selected) throw fail("Receipt results do not match this recovery decision");
  const fields = remoteOrders.map(remote => {
    const payment = { ...draft, razorpayOrderId: remote.id, currency: "INR", status: remote.id === orderId ? "created" : "superseded", createdAt: new Date(remote.created_at * 1000), expiresAt: new Date(remote.created_at * 1000 + 3600000), supportHistory: [entry] };
    delete payment.receipt;
    validateOrderIdentity(remote, payment);
    return payment;
  });
  for (const payment of fields) await new SubscriptionPayment(payment).validate();
  await mongoose.connection.transaction(async session => {
    const current = await ClinicSubscription.findOne({ _id: subscription._id, paymentOrderLock: subscription.paymentOrderLock, "paymentOrderDraft.receipt": draft.receipt }).session(session);
    if (!current) throw fail("Checkout changed during recovery");
    // Archive before unlocking: even a late, previously invisible remote order can
    // be recovered and sent to review by the webhook without granting twice.
    await SubscriptionCheckoutArchive.create([{ clinicId, subscriptionId: current._id, receipt: draft.receipt, draft, operator: entry.operator, reason: entry.reason }], { session });
    for (const payment of fields) {
      const existing = await SubscriptionPayment.findOne({ razorpayOrderId: payment.razorpayOrderId }).session(session);
      if (existing) {
        validateOrderIdentity(remoteOrders.find(remote => remote.id === payment.razorpayOrderId), existing);
      } else await SubscriptionPayment.create([payment], { session });
    }
    Object.assign(current, clearedCheckoutLock);
    await current.save({ session });
  });
  return { recoveredOrderIds: fields.map(payment => payment.razorpayOrderId), releasedEmpty: releaseEmpty };
}

export async function resolvePayment({ orderId, action, entitlement, operator, reason }) {
  const entry = audit(operator, reason, action, null, entitlement);
  if (!["activate", "retain", "refund", "dispute-lost"].includes(action)) throw fail("Unknown support decision");
  const record = await SubscriptionPayment.findOne({ razorpayOrderId: orderId });
  if (!record?.razorpayPaymentId) throw fail("Reconcile the captured payment first");
  if (action === "activate") return activateReviewedPayment({ record, operator: entry.operator, reason: entry.reason });
  if (!["retain", "revoke"].includes(entitlement)) throw fail("Choose retain or revoke entitlement explicitly");
  if (!record.financialReviewRequired && record.status !== "review_required") throw fail("No unresolved support review");
  const razorpay = getRazorpay();
  const [remote, order] = await Promise.all([razorpay.payments.fetch(record.razorpayPaymentId), razorpay.orders.fetch(orderId)]);
  validateOrderIdentity(order, record);
  if (remote.id !== record.razorpayPaymentId || remote.order_id !== orderId || remote.amount !== record.amount || remote.currency !== record.currency) throw fail("Payment identity mismatch");
  // Check every known dispute using current provider state, not event arrival order.
  const disputeIds = [...new Set(record.financialEventKeys.filter(key => key.startsWith("disp_")).map(key => key.split(":")[0]))];
  const disputes = await Promise.all(disputeIds.map(id => razorpay.disputes.fetch(id)));
  if (disputes.some(dispute => dispute.payment_id !== remote.id || !["won", "lost", "closed"].includes(dispute.status))) throw fail("Dispute is still open or its identity is inconsistent");
  const lost = disputes.some(dispute => dispute.status === "lost");
  const fullyRefunded = remote.status === "refunded" && remote.amount_refunded === record.amount;
  if (action === "refund" && !fullyRefunded) throw fail("Complete the full refund in Razorpay first; pending/partial refunds cannot close a captured-payment review");
  if (action === "dispute-lost" && !lost) throw fail("Razorpay has not confirmed a lost dispute");
  if (action === "retain" && (lost || fullyRefunded || remote.status !== "captured" || entitlement !== "retain" || record.status !== "paid")) throw fail("Retain requires an activated payment and no full refund/lost dispute");
  const previousEventKeys = [...record.financialEventKeys];
  await mongoose.connection.transaction(async session => {
    const payment = await SubscriptionPayment.findById(record._id).session(session);
    if (!payment || payment.status !== record.status || JSON.stringify(payment.financialEventKeys) !== JSON.stringify(previousEventKeys) || payment.financialReviewRequired !== record.financialReviewRequired) throw fail("Payment review changed; inspect it again");
    const subscription = await ClinicSubscription.findById(payment.subscriptionId).session(session);
    if (!subscription) throw fail("Subscription not found");
    // Older payments must never revoke an entitlement granted by a newer payment.
    const ownsPeriod = subscription.activePaymentId
      ? String(subscription.activePaymentId) === String(payment._id)
      : payment.status === "paid" && payment.paidAt && subscription.currentPeriodStart && new Date(payment.paidAt).getTime() === new Date(subscription.currentPeriodStart).getTime() && subscription.plan === payment.plan && subscription.billingCycle === payment.billingCycle;
    if (entitlement === "revoke" && ownsPeriod) {
      subscription.status = "cancelled";
      await subscription.save({ session });
    }
    entry.previousStatus = payment.status;
    payment.supportHistory.push(entry);
    payment.financialReviewRequired = false;
    payment.resolvedRefundAmount = remote.amount_refunded || 0;
    payment.reviewRequiredAt = null;
    payment.reviewReason = null;
    if (action === "refund") { payment.status = "refunded"; payment.refundedAt = new Date(); }
    if (action === "dispute-lost") payment.status = "failed";
    await payment.save({ session });
  });
  return { resolved: true, action, entitlement };
}
