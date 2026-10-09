
import mongoose from "mongoose";

import ClinicSubscription from "../models/ClinicSubscription.js";
import SubscriptionPayment from "../models/SubscriptionPayment.js";
import ClinicMembership from "../models/ClinicMembership.js";

import { getRazorpay } from "../config/razorpay.js";
import { getPlanConfig } from "./subscriptionService.js";

import crypto from "node:crypto";


const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const createSubscriptionPaymentOrder = async ({
  clinicId,
  userId,
}) => {
  if (
    !mongoose.isValidObjectId(clinicId) ||
    !mongoose.isValidObjectId(userId)
  ) {
    throw createError("Invalid clinic or user ID", 400);
  }

  // Only clinic owners can purchase subscriptions.
  const membership = await ClinicMembership.findOne({
    clinicId,
    userId,
    role: "owner",
    status: "active",
  });

  if (!membership) {
    throw createError(
      "Only the clinic owner can purchase a subscription",
      403
    );
  }

  const subscription = await ClinicSubscription.findOne({
    clinicId,
  });

  if (!subscription) {
    throw createError("Subscription not found", 404);
  }

  // For now, support only first-time Basic registration payment.
  if (
    subscription.status !== "pending" ||
    subscription.plan !== "basic"
  ) {
    throw createError(
      "Subscription is not eligible for registration payment",
      409
    );
  }

  const config = getPlanConfig(
    subscription.plan,
    subscription.billingCycle
  );

  // INR to paise.
  const amount = subscription.priceSnapshot * 100;

  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    subscription.priceSnapshot !== config.price
  ) {
    throw createError(
      "Invalid subscription payment amount",
      500
    );
  }

  // Reuse an existing recent unpaid order.
  const existingPayment = await SubscriptionPayment.findOne({
    clinicId,
    subscriptionId: subscription._id,
    status: "created",
    createdAt: {
      $gte: new Date(Date.now() - 10 * 60 * 1000),
    },
  }).sort({ createdAt: -1 });

  if (existingPayment) {
    const razorpay = getRazorpay();

    const remoteOrder = await razorpay.orders.fetch(
        existingPayment.razorpayOrderId
    );

    if (
        remoteOrder.status === "created" &&
        remoteOrder.amount === amount &&
        remoteOrder.currency === "INR"
    ) {
        return {
        orderId: existingPayment.razorpayOrderId,
        amount: existingPayment.amount,
        currency: existingPayment.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        };
    }

    if (
        remoteOrder.status === "paid" ||
        remoteOrder.status === "attempted"
    ) {
        throw createError(
        "Previous payment order requires reconciliation before retrying",
        409
        );
    }

    throw createError("Unexpected Razorpay order status", 409);
    }

  let order;

  const razorpay = getRazorpay();

    try {
    order = await razorpay.orders.create({
        amount,
        currency: "INR",
        receipt: `sub_${subscription._id}_${Date.now()}`.slice(0, 40),
        notes: {
        clinicId: String(clinicId),
        subscriptionId: String(subscription._id),
        plan: subscription.plan,
        billingCycle: subscription.billingCycle,
        },
    });
    } catch (error) {
    console.error("RAZORPAY ORDER ERROR:", {
        statusCode: error.statusCode,
        description: error.error?.description,
        message: error.message,
    });

    throw error;
    }


//   const order = await razorpay.orders.create({
//     amount,
//     currency: "INR",
//     receipt: `sub_${subscription._id}_${Date.now()}`.slice(0, 40),
//     notes: {
//       clinicId: String(clinicId),
//       subscriptionId: String(subscription._id),
//       plan: subscription.plan,
//       billingCycle: subscription.billingCycle,
//     },
//   });

  // Save order before returning it to the frontend.
  await SubscriptionPayment.create({
    clinicId,
    subscriptionId: subscription._id,
    plan: subscription.plan,
    billingCycle: subscription.billingCycle,
    amount,
    currency: "INR",
    razorpayOrderId: order.id,
    status: "created",
  });

  return {
    orderId: order.id,
    amount,
    currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
  };
};



export const verifySubscriptionPayment = async ({
  clinicId,
  userId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) => {
  if (
    !mongoose.isValidObjectId(clinicId) ||
    !mongoose.isValidObjectId(userId)
  ) {
    throw createError("Invalid clinic or user ID", 400);
  }

  if (
    !razorpayOrderId ||
    !razorpayPaymentId ||
    !razorpaySignature ||
    typeof razorpayOrderId !== "string" ||
    typeof razorpayPaymentId !== "string" ||
    typeof razorpaySignature !== "string"
  ) {
    throw createError("Invalid payment verification details", 400);
  }

  const membership = await ClinicMembership.findOne({
    clinicId,
    userId,
    role: "owner",
    status: "active",
  });

  if (!membership) {
    throw createError("Only clinic owners can verify payments", 403);
  }

  const paymentRecord = await SubscriptionPayment.findOne({
    clinicId,
    razorpayOrderId,
  });

  if (!paymentRecord) {
    throw createError("Payment order not found", 404);
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;

  if (!secret) {
    throw createError("Payment configuration is missing", 500);
  }

  // Verify Razorpay Checkout signature.
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  const received = Buffer.from(razorpaySignature, "hex");
  const expected = Buffer.from(expectedSignature, "hex");

  if (
    received.length !== expected.length ||
    !crypto.timingSafeEqual(received, expected)
  ) {
    throw createError("Invalid payment signature", 400);
  }

  const razorpay = getRazorpay();

  // Never trust payment status supplied by frontend.
  const [remotePayment, remoteOrder] = await Promise.all([
    razorpay.payments.fetch(razorpayPaymentId),
    razorpay.orders.fetch(razorpayOrderId),
  ]);

  if (
    remotePayment.id !== razorpayPaymentId ||
    remotePayment.order_id !== razorpayOrderId ||
    remotePayment.status !== "captured" ||
    remotePayment.amount !== paymentRecord.amount ||
    remotePayment.currency !== paymentRecord.currency ||
    remoteOrder.id !== razorpayOrderId ||
    remoteOrder.amount !== paymentRecord.amount ||
    remoteOrder.currency !== paymentRecord.currency ||
    remoteOrder.status !== "paid"
  ) {
    throw createError("Payment has not been successfully captured", 409);
  }

    return activateCapturedSubscriptionPayment({
        clinicId,
        paymentRecord,
        razorpayPaymentId,
    });
};




const activateCapturedSubscriptionPayment = async ({
  clinicId,
  paymentRecord,
  razorpayPaymentId,
}) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const payment = await SubscriptionPayment.findOne({
        _id: paymentRecord._id,
        clinicId,
        razorpayOrderId: paymentRecord.razorpayOrderId,
      }).session(session);

      if (!payment) {
        throw createError("Payment record not found", 404);
      }

      const subscription = await ClinicSubscription.findOne({
        _id: payment.subscriptionId,
        clinicId,
      }).session(session);

      if (!subscription) {
        throw createError("Subscription not found", 404);
      }

      // Never activate a subscription twice.
      if (payment.status === "paid") {
        if (
          payment.razorpayPaymentId !== razorpayPaymentId ||
          subscription.status !== "active"
        ) {
          throw createError("Payment state conflict", 409);
        }

        result = {
          paymentId: payment._id,
          subscriptionId: subscription._id,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          alreadyProcessed: true,
        };

        return;
      }

      if (
        payment.status !== "created" ||
        subscription.status !== "pending" ||
        subscription.plan !== payment.plan ||
        subscription.billingCycle !== payment.billingCycle ||
        subscription.priceSnapshot * 100 !== payment.amount
      ) {
        throw createError("Subscription payment state conflict", 409);
      }

      const start = new Date();

      const durationDays =
        subscription.billingCycle === "monthly" ? 30 : 365;

      const end = new Date(
        start.getTime() + durationDays * 24 * 60 * 60 * 1000
      );

      payment.status = "paid";
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.paidAt = start;

      subscription.status = "active";
      subscription.currentPeriodStart = start;
      subscription.currentPeriodEnd = end;
      subscription.bookingsUsed = 0;

      await payment.save({ session });
      await subscription.save({ session });

      result = {
        paymentId: payment._id,
        subscriptionId: subscription._id,
        status: subscription.status,
        currentPeriodStart: start,
        currentPeriodEnd: end,
        alreadyProcessed: false,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
};



// Recover a payment captured by Razorpay when the original
// Checkout verification failed before database activation.
export const reconcileSubscriptionPayment = async ({
  clinicId,
  userId,
  razorpayOrderId,
}) => {
  if (
    !mongoose.isValidObjectId(clinicId) ||
    !mongoose.isValidObjectId(userId) ||
    typeof razorpayOrderId !== "string" ||
    !razorpayOrderId.startsWith("order_")
  ) {
    throw createError("Invalid reconciliation details", 400);
  }

  const membership = await ClinicMembership.findOne({
    clinicId,
    userId,
    role: "owner",
    status: "active",
  });

  if (!membership) {
    throw createError("Only clinic owners can reconcile payments", 403);
  }

  const paymentRecord = await SubscriptionPayment.findOne({
    clinicId,
    razorpayOrderId,
  });

  if (!paymentRecord) {
    throw createError("Payment order not found", 404);
  }

  const subscription = await ClinicSubscription.findOne({
    _id: paymentRecord.subscriptionId,
    clinicId,
  });

  if (!subscription) {
    throw createError("Subscription not found", 404);
  }

  const razorpay = getRazorpay();

  const remoteOrder = await razorpay.orders.fetch(razorpayOrderId);

  if (
    remoteOrder.id !== razorpayOrderId ||
    remoteOrder.status !== "paid" ||
    remoteOrder.amount !== paymentRecord.amount ||
    remoteOrder.currency !== "INR" ||
    String(remoteOrder.notes?.clinicId) !== String(clinicId) ||
    String(remoteOrder.notes?.subscriptionId) !==
      String(subscription._id) ||
    remoteOrder.notes?.plan !== paymentRecord.plan ||
    remoteOrder.notes?.billingCycle !== paymentRecord.billingCycle ||
    subscription.plan !== paymentRecord.plan ||
    subscription.billingCycle !== paymentRecord.billingCycle ||
    subscription.priceSnapshot * 100 !== paymentRecord.amount
  ) {
    throw createError("Razorpay order verification failed", 409);
  }

  // Fetch payments associated with this exact order.
  const paymentList = await razorpay.orders.fetchPayments(
    razorpayOrderId
  );

  const capturedPayments = (paymentList.items || []).filter(
    (payment) =>
      payment.status === "captured" &&
      payment.order_id === razorpayOrderId &&
      payment.amount === paymentRecord.amount &&
      payment.currency === paymentRecord.currency
  );

  if (capturedPayments.length !== 1) {
    throw createError(
      "Expected exactly one captured payment for this order",
      409
    );
  }

  const capturedPayment = capturedPayments[0];

  // Independently fetch the selected payment before activation.
  const remotePayment = await razorpay.payments.fetch(
    capturedPayment.id
  );

  if (
    remotePayment.id !== capturedPayment.id ||
    remotePayment.order_id !== razorpayOrderId ||
    remotePayment.status !== "captured" ||
    remotePayment.amount !== paymentRecord.amount ||
    remotePayment.currency !== paymentRecord.currency
  ) {
    throw createError("Captured payment verification failed", 409);
  }

  return activateCapturedSubscriptionPayment({
    clinicId,
    paymentRecord,
    razorpayPaymentId: remotePayment.id,
  });
};



export const processSubscriptionWebhook = async ({
  razorpayOrderId,
  razorpayPaymentId,
}) => {
  if (
    typeof razorpayOrderId !== "string" ||
    !razorpayOrderId.startsWith("order_") ||
    typeof razorpayPaymentId !== "string" ||
    !razorpayPaymentId.startsWith("pay_")
  ) {
    throw createError("Invalid webhook payment details", 400);
  }

  // Find the subscription payment using the Razorpay order ID.
  const paymentRecord = await SubscriptionPayment.findOne({
    razorpayOrderId,
  });

  // This webhook might belong to another payment product.
  // Do not process unrelated payments.
  if (!paymentRecord) {
    return {
      ignored: true,
      reason: "Unknown subscription payment order",
    };
  }

  const subscription = await ClinicSubscription.findOne({
    _id: paymentRecord.subscriptionId,
    clinicId: paymentRecord.clinicId,
  });

  if (!subscription) {
    throw createError("Subscription not found", 404);
  }

  const razorpay = getRazorpay();

  // Independently verify payment and order with Razorpay.
  const [remotePayment, remoteOrder] = await Promise.all([
    razorpay.payments.fetch(razorpayPaymentId),
    razorpay.orders.fetch(razorpayOrderId),
  ]);

  if (
    remotePayment.id !== razorpayPaymentId ||
    remotePayment.order_id !== razorpayOrderId ||
    remotePayment.status !== "captured" ||
    remotePayment.amount !== paymentRecord.amount ||
    remotePayment.currency !== paymentRecord.currency ||
    remoteOrder.id !== razorpayOrderId ||
    remoteOrder.status !== "paid" ||
    remoteOrder.amount !== paymentRecord.amount ||
    remoteOrder.currency !== paymentRecord.currency ||
    String(remoteOrder.notes?.clinicId) !==
      String(paymentRecord.clinicId) ||
    String(remoteOrder.notes?.subscriptionId) !==
      String(subscription._id) ||
    remoteOrder.notes?.plan !== paymentRecord.plan ||
    remoteOrder.notes?.billingCycle !== paymentRecord.billingCycle ||
    subscription.plan !== paymentRecord.plan ||
    subscription.billingCycle !== paymentRecord.billingCycle ||
    subscription.priceSnapshot * 100 !== paymentRecord.amount
  ) {
    throw createError("Webhook payment verification failed", 409);
  }

  return activateCapturedSubscriptionPayment({
    clinicId: paymentRecord.clinicId,
    paymentRecord,
    razorpayPaymentId,
  });
};
