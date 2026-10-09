
import mongoose from "mongoose";
import crypto from "node:crypto";

import ClinicSubscription from "../models/ClinicSubscription.js";
import SubscriptionPayment from "../models/SubscriptionPayment.js";
import ClinicMembership from "../models/ClinicMembership.js";

import { getRazorpay } from "../config/razorpay.js";
import { getPlanConfig } from "./subscriptionService.js";

const fail = (message, statusCode) =>
  Object.assign(new Error(message), { statusCode });

const valid = (clinicId, userId) => {
  if (
    !mongoose.isValidObjectId(clinicId) ||
    !mongoose.isValidObjectId(userId)
  ) {
    throw fail("Invalid clinic or user ID", 400);
  }
};

const requireOwner = async (clinicId, userId) => {
  const membership = await ClinicMembership.exists({
    clinicId,
    userId,
    role: "owner",
    status: "active",
  });

  if (!membership) {
    throw fail(
      "Only clinic owners can manage subscription payments",
      403
    );
  }
};

const validateOrder = (remote, record, subscription) => {
  if (
    remote.id !== record.razorpayOrderId ||
    remote.amount !== record.amount ||
    remote.currency !== record.currency ||
    String(remote.notes?.clinicId) !== String(record.clinicId) ||
    String(remote.notes?.subscriptionId) !==
      String(record.subscriptionId) ||
    remote.notes?.plan !== record.plan ||
    remote.notes?.billingCycle !== record.billingCycle ||
    subscription.plan !== record.plan ||
    subscription.billingCycle !== record.billingCycle ||
    subscription.priceSnapshot * 100 !== record.amount
  ) {
    throw fail("Payment order mismatch; contact support", 409);
  }
};

// A Razorpay order can be retried only when all recorded
// payment attempts are failed and history is complete.
export const classifyRazorpayOrder = async (razorpay, remote) => {
  if (remote.status === "paid") return "paid";

  if (!["created", "attempted"].includes(remote.status)) {
    throw fail("Unexpected Razorpay order status", 409);
  }

  const response = await razorpay.orders.fetchPayments(remote.id);
  const items = response.items || [];

  // Incomplete pagination, authorized, captured or pending:
  // do not allow another payment.
  if (
    !Number.isInteger(response.count) ||
    response.count !== items.length
  ) {
    return "pending";
  }

  if (items.some((p) => p.order_id !== remote.id)) {
    return "pending";
  }

  if (items.some((p) => p.status !== "failed")) {
    return "pending";
  }

  return "retryable";
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
        throw fail("Payment record not found", 404);
      }

      const subscription = await ClinicSubscription.findOne({
        _id: payment.subscriptionId,
        clinicId,
      }).session(session);

      if (!subscription) {
        throw fail("Subscription not found", 404);
      }

      if (payment.status === "paid") {
        if (
          payment.razorpayPaymentId !== razorpayPaymentId ||
          subscription.status !== "active"
        ) {
          throw fail("Payment state conflict", 409);
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
        throw fail("Subscription payment state conflict", 409);
      }

      const start = new Date();

      const days =
        subscription.billingCycle === "monthly" ? 30 : 365;

      const end = new Date(
        start.getTime() + days * 86400000
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

export const createSubscriptionPaymentOrder = async ({
  clinicId,
  userId,
}) => {
  valid(clinicId, userId);
  await requireOwner(clinicId, userId);

  const token = crypto.randomUUID();

  const subscription =
    await ClinicSubscription.findOneAndUpdate(
      {
        clinicId,
        status: "pending",
        plan: "basic",
        $or: [
          { paymentOrderLock: null },
          { paymentOrderLock: { $exists: false } },
        ],
      },
      {
        $set: {
          paymentOrderLock: token,
        },
      },
      {
        returnDocument: "after",
      }
    );

  if (!subscription) {
    throw fail(
      "Subscription checkout is busy or not eligible",
      409
    );
  }

  // Keep the lock if Razorpay order creation or
  // MongoDB persistence has an uncertain outcome.
  let releaseLock = true;

  try {
    const config = getPlanConfig(
      subscription.plan,
      subscription.billingCycle
    );

    const amount = subscription.priceSnapshot * 100;

    if (
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      subscription.priceSnapshot !== config.price
    ) {
      throw fail("Invalid subscription payment amount", 500);
    }

    const razorpay = getRazorpay();

    const payments = await SubscriptionPayment.find({
      clinicId,
      subscriptionId: subscription._id,
      status: "created",
    }).sort({ createdAt: -1 });

    // Check every unresolved local order.
    for (const record of payments) {
      const remote = await razorpay.orders.fetch(
        record.razorpayOrderId
      );

      validateOrder(remote, record, subscription);

      const state = await classifyRazorpayOrder(
        razorpay,
        remote
      );

      if (state === "paid") {
        throw fail(
          "Previous payment received. Awaiting activation.",
          409
        );
      }

      if (state === "pending") {
        throw fail(
          "Previous payment still being confirmed. Do not pay again.",
          409
        );
      }
    }

    // Reuse the existing order instead of creating another.
    if (payments.length) {
      const record = payments[0];

      return {
        orderId: record.razorpayOrderId,
        amount: record.amount,
        currency: record.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      };
    }

    // A timeout after this point can mean that Razorpay
    // created an order but our server never received its ID.
    releaseLock = false;

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `sub_${subscription._id}_${Date.now()}`
        .slice(0, 40),
      notes: {
        clinicId: String(clinicId),
        subscriptionId: String(subscription._id),
        plan: subscription.plan,
        billingCycle: subscription.billingCycle,
      },
    });

    if (
      !order?.id ||
      order.amount !== amount ||
      order.currency !== "INR"
    ) {
      throw fail(
        "Unexpected Razorpay order response; contact support",
        502
      );
    }

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

    releaseLock = true;

    return {
      orderId: order.id,
      amount,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
    };
  } finally {
    if (releaseLock) {
      await ClinicSubscription.updateOne(
        {
          _id: subscription._id,
          paymentOrderLock: token,
        },
        {
          $set: {
            paymentOrderLock: null,
          },
        }
      );
    }
  }
};

export const verifySubscriptionPayment = async ({
  clinicId,
  userId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) => {
  valid(clinicId, userId);

  if (
    ![
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    ].every((x) => typeof x === "string" && x)
  ) {
    throw fail("Invalid payment verification details", 400);
  }

  await requireOwner(clinicId, userId);

  const record = await SubscriptionPayment.findOne({
    clinicId,
    razorpayOrderId,
  });

  if (!record) {
    throw fail("Payment order not found", 404);
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;

  if (!secret) {
    throw fail("Payment configuration missing", 500);
  }

  if (!/^[a-fA-F0-9]{64}$/.test(razorpaySignature)) {
    throw fail("Invalid payment signature", 400);
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest();

  const received = Buffer.from(razorpaySignature, "hex");

  if (!crypto.timingSafeEqual(received, expected)) {
    throw fail("Invalid payment signature", 400);
  }

  const razorpay = getRazorpay();

  const [remotePayment, remoteOrder] = await Promise.all([
    razorpay.payments.fetch(razorpayPaymentId),
    razorpay.orders.fetch(razorpayOrderId),
  ]);

  const subscription = await ClinicSubscription.findOne({
    _id: record.subscriptionId,
    clinicId,
  });

  if (!subscription) {
    throw fail("Subscription not found", 404);
  }

  validateOrder(remoteOrder, record, subscription);

  if (
    remotePayment.id !== razorpayPaymentId ||
    remotePayment.order_id !== razorpayOrderId ||
    remotePayment.status !== "captured" ||
    remotePayment.amount !== record.amount ||
    remotePayment.currency !== record.currency ||
    remoteOrder.status !== "paid"
  ) {
    throw fail("Payment has not been captured", 409);
  }

  return activateCapturedSubscriptionPayment({
    clinicId,
    paymentRecord: record,
    razorpayPaymentId,
  });
};

const reconcileRecord = async (
  record,
  subscription,
  razorpay
) => {
  const remoteOrder = await razorpay.orders.fetch(
    record.razorpayOrderId
  );

  validateOrder(remoteOrder, record, subscription);

  if (remoteOrder.status !== "paid") {
    throw fail("Payment not yet captured", 409);
  }

  const list = await razorpay.orders.fetchPayments(
    record.razorpayOrderId
  );

  if (
    !Number.isInteger(list.count) ||
    list.count !== (list.items || []).length
  ) {
    throw fail("Incomplete payment history", 409);
  }

  const captured = list.items.filter(
    (p) =>
      p.status === "captured" &&
      p.order_id === record.razorpayOrderId &&
      p.amount === record.amount &&
      p.currency === record.currency
  );

  if (captured.length !== 1) {
    throw fail(
      "Captured payment needs support review",
      409
    );
  }

  const payment = await razorpay.payments.fetch(
    captured[0].id
  );

  if (
    payment.id !== captured[0].id ||
    payment.order_id !== record.razorpayOrderId ||
    payment.status !== "captured" ||
    payment.amount !== record.amount ||
    payment.currency !== record.currency
  ) {
    throw fail(
      "Captured payment verification failed",
      409
    );
  }

  return activateCapturedSubscriptionPayment({
    clinicId: record.clinicId,
    paymentRecord: record,
    razorpayPaymentId: payment.id,
  });
};

export const reconcileSubscriptionPayment = async ({
  clinicId,
  userId,
  razorpayOrderId,
}) => {
  valid(clinicId, userId);

  if (
    typeof razorpayOrderId !== "string" ||
    !razorpayOrderId.startsWith("order_")
  ) {
    throw fail("Invalid reconciliation details", 400);
  }

  await requireOwner(clinicId, userId);

  const record = await SubscriptionPayment.findOne({
    clinicId,
    razorpayOrderId,
  });

  if (!record) {
    throw fail("Payment order not found", 404);
  }

  const subscription = await ClinicSubscription.findOne({
    _id: record.subscriptionId,
    clinicId,
  });

  if (!subscription) {
    throw fail("Subscription not found", 404);
  }

  return reconcileRecord(
    record,
    subscription,
    getRazorpay()
  );
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
    throw fail("Invalid webhook payment details", 400);
  }

  const record = await SubscriptionPayment.findOne({
    razorpayOrderId,
  });

  if (!record) {
    return {
      ignored: true,
      reason: "Unknown subscription payment order",
    };
  }

  const subscription = await ClinicSubscription.findOne({
    _id: record.subscriptionId,
    clinicId: record.clinicId,
  });

  if (!subscription) {
    throw fail("Subscription not found", 404);
  }

  const razorpay = getRazorpay();

  const [remotePayment, remoteOrder] = await Promise.all([
    razorpay.payments.fetch(razorpayPaymentId),
    razorpay.orders.fetch(razorpayOrderId),
  ]);

  validateOrder(remoteOrder, record, subscription);

  if (
    remotePayment.id !== razorpayPaymentId ||
    remotePayment.order_id !== razorpayOrderId ||
    remotePayment.status !== "captured" ||
    remotePayment.amount !== record.amount ||
    remotePayment.currency !== record.currency ||
    remoteOrder.status !== "paid"
  ) {
    throw fail("Webhook payment verification failed", 409);
  }

  return activateCapturedSubscriptionPayment({
    clinicId: record.clinicId,
    paymentRecord: record,
    razorpayPaymentId,
  });
};
