
import mongoose from "mongoose";

import Clinic from "../models/Clinic.js";
import ClinicMembership from "../models/ClinicMembership.js";
import ClinicSubscription from "../models/ClinicSubscription.js";
import SubscriptionPayment from "../models/SubscriptionPayment.js";

import { getPlanConfig } from "./subscriptionService.js";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const validateIds = (clinicId, userId) => {
  if (
    !mongoose.isValidObjectId(clinicId) ||
    !mongoose.isValidObjectId(userId)
  ) {
    throw createError("Invalid clinic or user ID", 400);
  }
};

const requireOwner = async (clinicId, userId) => {
  const membership = await ClinicMembership.findOne({
    clinicId,
    userId,
    role: "owner",
    status: "active",
  });

  if (!membership) {
    throw createError(
      "Only the clinic owner can manage the subscription",
      403
    );
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
    throw createError("Subscription not found", 404);
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
    throw createError("Invalid billing cycle", 400);
  }

  await requireOwner(clinicId, userId);

  const clinic = await Clinic.findOne({
    _id: clinicId,
    status: "draft",
  });

  if (!clinic) {
    throw createError(
      "Only draft clinics can change their registration billing cycle",
      409
    );
  }

  // Reserve the subscription atomically.
  // Payment creation uses this same lock.
  const token = new mongoose.Types.ObjectId().toString();

  const subscription = await ClinicSubscription.findOneAndUpdate(
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
    throw createError(
      "Subscription payment setup is busy or not eligible",
      409
    );
  }

  try {
    if (subscription.billingCycle === billingCycle) {
      return formatSubscription(subscription);
    }

    // Conservative policy:
    // Do not change billing cycle once a payment order exists.
    // A separate cancellation/reconciliation workflow is required.
    const existingOrder = await SubscriptionPayment.exists({
      clinicId,
      subscriptionId: subscription._id,
    });

    if (existingOrder) {
      throw createError(
        "A payment order already exists. Contact support to change billing cycle.",
        409
      );
    }

    const config = getPlanConfig("basic", billingCycle);

    const updated = await ClinicSubscription.findOneAndUpdate(
      {
        _id: subscription._id,
        paymentOrderLock: token,
        status: "pending",
        billingCycle: subscription.billingCycle,
      },
      {
        $set: {
          billingCycle,
          priceSnapshot: config.price,
          bookingLimit: config.bookingLimit,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updated) {
      throw createError(
        "Subscription changed. Refresh and try again.",
        409
      );
    }

    return formatSubscription(updated);
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
