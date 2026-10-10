
import SubscriptionPayment from "../models/SubscriptionPayment.js";
import { getRazorpay } from "../config/razorpay.js";

const fail = (message, statusCode = 409) =>
  Object.assign(new Error(message), { statusCode });

export const inspectSubscriptionOrders = async ({
  clinicId,
  subscription,
}) => {
  if (!clinicId || !subscription?._id) {
    throw fail("Invalid subscription inspection request", 400);
  }

  const records = await SubscriptionPayment.find({
    clinicId,
    subscriptionId: subscription._id,
    status: "created",
  }).sort({ createdAt: -1 });

  if (!records.length) {
    return {
      canChangeBillingCycle: true,
      requiresReview: false,
      orders: [],
    };
  }

  const razorpay = getRazorpay();
  const orders = [];

  for (const record of records) {
    const remote = await razorpay.orders.fetch(
      record.razorpayOrderId
    );

    if (
      remote.id !== record.razorpayOrderId ||
      remote.amount !== record.amount ||
      remote.currency !== record.currency ||
      String(remote.notes?.clinicId) !== String(clinicId) ||
      String(remote.notes?.subscriptionId) !==
        String(subscription._id) ||
      remote.notes?.plan !== record.plan ||
      remote.notes?.billingCycle !== record.billingCycle
    ) {
      throw fail(
        "Payment order mismatch. Contact support."
      );
    }

    if (
      !["created", "attempted", "paid"].includes(remote.status)
    ) {
      throw fail(
        "Unexpected Razorpay order status. Contact support."
      );
    }

    const response = await razorpay.orders.fetchPayments(
      record.razorpayOrderId
    );

    const payments = response?.items || [];

    const completeHistory =
      Number.isInteger(response?.count) &&
      response.count === payments.length &&
      payments.every(
        (payment) =>
          payment.order_id === record.razorpayOrderId
      );

    const hasSuccessfulOrPendingPayment =
      remote.status === "paid" ||
      !completeHistory ||
      payments.some(
        (payment) => payment.status !== "failed"
      );

    orders.push({
      orderId: record.razorpayOrderId,
      billingCycle: record.billingCycle,
      amount: record.amount,
      remoteStatus: remote.status,
      paymentAttempts: payments.length,
      hasSuccessfulOrPendingPayment,
      // An order with no successful payment may still
      // be payable later. It is NOT automatically cancelled.
      requiresRetirement: !hasSuccessfulOrPendingPayment,
    });
  }

  const requiresReview = orders.some(
    (order) => order.hasSuccessfulOrPendingPayment
  );

  return {
    // Switching remains blocked until outstanding orders
    // are safely retired by a separate backend operation.
    canChangeBillingCycle: false,
    requiresReview,
    orders,
  };
};
