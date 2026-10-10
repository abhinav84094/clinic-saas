import "dotenv/config";
import mongoose from "mongoose";
import ClinicSubscription from "../models/ClinicSubscription.js";
import SubscriptionPayment from "../models/SubscriptionPayment.js";
import { getRazorpay } from "../config/razorpay.js";
import { validateOrderIdentity } from "../services/subscriptionPaymentService.js";

// Explicit order ID required: never unlock an uncertain order without preserving it.
const orderId = process.argv[2];
if (!/^order_[A-Za-z0-9]+$/.test(orderId || "")) {
  throw new Error("Usage: node scripts/recover-registration-order.js <order_id>");
}
try {
  await mongoose.connect(process.env.MONGO_URI);
  const remote = await getRazorpay().orders.fetch(orderId);
  const subscription = await ClinicSubscription.findById(remote.notes?.subscriptionId);
  if (!subscription || !subscription.paymentOrderLock ||
      subscription.status !== "pending" || subscription.plan !== "basic" ||
      (remote.notes?.purpose && remote.notes.purpose !== "registration") ||
      !["created", "attempted", "paid"].includes(remote.status) ||
      Date.now() - subscription.updatedAt.getTime() < 120000) {
    throw new Error("Order is not eligible for recovery or checkout is still running");
  }
  const fields = {
    clinicId: subscription.clinicId,
    subscriptionId: subscription._id,
    purpose: "registration",
    plan: subscription.plan,
    billingCycle: subscription.billingCycle,
    amount: subscription.priceSnapshot * 100,
    currency: "INR",
    razorpayOrderId: remote.id,
    status: "created",
    createdAt: new Date(remote.created_at * 1000),
    expiresAt: new Date(remote.created_at * 1000 + 3600000),
  };
  validateOrderIdentity(remote, fields);
  await new SubscriptionPayment(fields).validate();
  await mongoose.connection.transaction(async (session) => {
    const current = await ClinicSubscription.findOne({
      _id: subscription._id,
      paymentOrderLock: subscription.paymentOrderLock,
      updatedAt: subscription.updatedAt,
    }).session(session);
    if (!current) throw new Error("Subscription changed during recovery");
    const records = await SubscriptionPayment.find({subscriptionId: current._id}).session(session);
    if (records.some(record => record.razorpayOrderId !== remote.id)) {
      throw new Error("Other payment records exist; manual reconciliation required");
    }
    if (!records.length) await SubscriptionPayment.create([fields], {session});
    current.paymentOrderLock = null;
    await current.save({session});
  });
  console.log("Payment record restored and checkout unlocked. Existing order will be reused.");
} finally {
  await mongoose.disconnect();
}
