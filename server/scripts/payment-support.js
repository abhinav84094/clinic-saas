import "dotenv/config";
import mongoose from "mongoose";
import { inspectCheckout, resolveCheckout, resolvePayment } from "../services/subscriptionPaymentSupportService.js";
import { verifyOperatorPayment } from "../services/subscriptionPaymentService.js";

const [command, id, ...arguments_] = process.argv.slice(2);
const options = {};
const allowedOptions = new Set(["order", "payment", "operator", "reason", "action", "entitlement"]);
for (let index = 0; index < arguments_.length; index += 2) {
  if (!arguments_[index].startsWith("--") || !arguments_[index + 1]) throw new Error("Options must be --name value pairs");
  const name = arguments_[index].slice(2);
  if (!allowedOptions.has(name) || Object.hasOwn(options, name)) throw new Error(`Unknown or repeated option: ${name}`);
  options[name] = arguments_[index + 1];
}
if (!["inspect", "recover", "release-empty", "verify", "resolve"].includes(command) || !id) throw new Error("See docs/payment-support.md for usage");
try {
  await mongoose.connect(process.env.MONGO_URI);
  let result;
  if (command === "inspect") {
    const state = await inspectCheckout(id);
    result = {
      clinicId: id, status: state.subscription.status,
      lockAgeSeconds: state.subscription.paymentOrderLock ? Math.floor((Date.now() - new Date(state.subscription.paymentOrderLockedAt || state.subscription.updatedAt)) / 1000) : null,
      receipt: state.subscription.paymentOrderDraft?.receipt,
      remoteOrders: state.remoteOrders.map(order => ({ id: order.id, amount: order.amount, currency: order.currency, status: order.status })),
      payments: state.payments.map(payment => ({ orderId: payment.razorpayOrderId, paymentId: payment.razorpayPaymentId, purpose: payment.purpose, status: payment.status, financialReviewRequired: payment.financialReviewRequired, reviewReason: payment.reviewReason, supportHistory: payment.supportHistory })),
    };
  } else if (command === "verify") result = await verifyOperatorPayment({ orderId: id, paymentId: options.payment, operator: options.operator, reason: options.reason });
  else if (command === "resolve") result = await resolvePayment({ orderId: id, ...options });
  else result = await resolveCheckout({ clinicId: id, orderId: options.order, releaseEmpty: command === "release-empty", ...options });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
