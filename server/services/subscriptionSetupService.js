
import mongoose from "mongoose";
import crypto from "node:crypto";

import Clinic from "../models/Clinic.js";
import ClinicMembership from "../models/ClinicMembership.js";
import ClinicSubscription from "../models/ClinicSubscription.js";
import SubscriptionPayment from "../models/SubscriptionPayment.js";

import { getRazorpay } from "../config/razorpay.js";
import { getPlanConfig } from "./subscriptionService.js";
import {
  classifyRazorpayOrder,
  validateOrderIdentity,
} from "./subscriptionPaymentService.js";

const fail = (message, statusCode = 409) =>
  Object.assign(new Error(message), { statusCode });

const ONE_HOUR_MS = 60 * 60 * 1000;

const validateIds = (clinicId, userId) => {
  if (
    !mongoose.isValidObjectId(clinicId) ||
    !mongoose.isValidObjectId(userId)
  ) {
    throw fail("Invalid clinic or user ID", 400);
  }
};

const requireOwner = async (clinicId, userId) => {
  const owner = await ClinicMembership.exists({
    clinicId,
    userId,
    role: "owner",
    status: "active",
  });

  if (!owner) {
    throw fail("Only clinic owners can change billing", 403);
  }
};

const formatSubscription = (subscription) => ({
  id: subscription._id,
  clinicId: subscription.clinicId,
  plan: subscription.plan,
  billingCycle: subscription.billingCycle,
  status: subscription.status,
  price: subscription.priceSnapshot,
  currency: "INR",
  bookingLimit: subscription.bookingLimit,
  currentPeriodStart: subscription.currentPeriodStart,
  currentPeriodEnd: subscription.currentPeriodEnd,
});

const getExpiry = (record) => {
  if (record.expiresAt) {
    return new Date(record.expiresAt);
  }

  return new Date(
    new Date(record.createdAt).getTime() + ONE_HOUR_MS
  );
};

export const getClinicSubscriptionSetup = async ({
  clinicId,
  userId,
}) => {
  validateIds(clinicId, userId);
  await requireOwner(clinicId, userId);

  const subscription = await ClinicSubscription.findOne({
    clinicId,
  });

  if (!subscription) {
    throw fail("Subscription not found", 404);
  }

  return formatSubscription(subscription);
};

export const updateSubscriptionBillingCycle = async ({
  clinicId,
  userId,
  billingCycle,
}) => {
  validateIds(clinicId, userId);

  if (!["monthly", "yearly"].includes(billingCycle)) {
    throw fail("Invalid billing cycle", 400);
  }

  await requireOwner(clinicId, userId);

  const clinic = await Clinic.findOne({
    _id: clinicId,
    status: "draft",
  });

  if (!clinic) {
    throw fail(
      "Only draft clinics can change registration billing",
      409
    );
  }

  const token = crypto.randomUUID();

  // Same lock used by payment order creation.
  const subscription = await ClinicSubscription.findOneAndUpdate(
    {
      clinicId,
      status: "pending",
      plan: "basic",
      paymentOrderLock: null,
    },
    {
      $set: {
        paymentOrderLock: token,
      },
    },
    { new: true }
  );

  if (!subscription) {
    throw fail("Subscription checkout is busy or not eligible");
  }

  try {
    if (subscription.billingCycle === billingCycle) {
      return formatSubscription(subscription);
    }

    // Any paid or review-required record must be resolved
    // before switching billing cycles.
    const needsReview = await SubscriptionPayment.exists({
      clinicId,
      subscriptionId: subscription._id,
      status: { $in: ["paid", "review_required"] },
    });

    if (needsReview) {
      throw fail(
        "A previous payment needs reconciliation or review"
      );
    }

    const createdOrders = await SubscriptionPayment.find({
      clinicId,
      subscriptionId: subscription._id,
      status: "created",
    }).sort({ createdAt: -1 });

    const razorpay = getRazorpay();

    // Inspect every current order before superseding.
    for (const record of createdOrders) {
      const expiresAt = getExpiry(record);

      if (
        !Number.isFinite(expiresAt.getTime()) ||
        Date.now() < expiresAt.getTime()
      ) {
        throw fail(
          "Please wait until the existing checkout's 1-hour window ends"
        );
      }

      const remote = await razorpay.orders.fetch(
        record.razorpayOrderId
      );

      validateOrderIdentity(remote, record);

      const state = await classifyRazorpayOrder(
        razorpay,
        remote
      );

      if (state === "paid") {
        throw fail(
          "A previous payment was received. Reconcile it first."
        );
      }

      if (state !== "retryable") {
        throw fail(
          "A previous payment is still pending confirmation"
        );
      }
    }

    const config = getPlanConfig("basic", billingCycle);
    const session = await mongoose.startSession();

    try {
      let updated;

      await session.withTransaction(async () => {
        // Recheck current state inside the transaction.
        const current = await ClinicSubscription.findOne({
          _id: subscription._id,
          clinicId,
          status: "pending",
          plan: "basic",
          billingCycle: subscription.billingCycle,
          paymentOrderLock: token,
        }).session(session);

        if (!current) {
          throw fail(
            "Subscription changed. Refresh and try again."
          );
        }

        const draft = await Clinic.exists({
          _id: clinicId,
          status: "draft",
        }).session(session);

        if (!draft) {
          throw fail("Clinic is no longer in draft status");
        }

        const payments = await SubscriptionPayment.find({
          clinicId,
          subscriptionId: current._id,
        }).session(session);

        if (
          payments.some((payment) =>
            ["paid", "review_required"].includes(payment.status)
          )
        ) {
          throw fail("A previous payment requires review");
        }

        const currentCreated = payments.filter(
          (payment) => payment.status === "created"
        );

        // Detect new or changed orders after Razorpay inspection.
        if (
          currentCreated.length !== createdOrders.length ||
          currentCreated.some(
            (payment) =>
              !createdOrders.some(
                (record) =>
                  String(record._id) === String(payment._id)
              )
          )
        ) {
          throw fail(
            "Payment history changed. Refresh and try again."
          );
        }

        const now = new Date();

        // Preserve every old Razorpay order for auditing.
        if (currentCreated.length) {
          const result = await SubscriptionPayment.updateMany(
            {
              _id: { $in: currentCreated.map((p) => p._id) },
              status: "created",
            },
            {
              $set: {
                status: "superseded",
                supersededAt: now,
              },
            },
            { session, runValidators: true }
          );

          if (result.modifiedCount !== currentCreated.length) {
            throw fail(
              "Payment state changed. Refresh and try again."
            );
          }
        }

        current.billingCycle = billingCycle;
        current.priceSnapshot = config.price;
        current.bookingLimit = config.bookingLimit;

        await current.save({ session });

        updated = current;
      });

      return formatSubscription(updated);
    } finally {
      await session.endSession();
    }
  } finally {
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
};
