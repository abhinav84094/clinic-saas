
import mongoose from "mongoose";

import ClinicMembership from "../models/ClinicMembership.js";
import ClinicSubscription from "../models/ClinicSubscription.js";
import SubscriptionPayment from "../models/SubscriptionPayment.js";

import { getRazorpay } from "../config/razorpay.js";
import {
  classifyRazorpayOrder,
  validateOrderIdentity,
} from "../services/subscriptionPaymentService.js";

const fail = (message, statusCode = 409) =>
  Object.assign(new Error(message), { statusCode });

const ONE_HOUR_MS = 60 * 60 * 1000;

const getExpiry = (record) => {
  if (record.expiresAt) {
    return new Date(record.expiresAt);
  }

  return new Date(
    new Date(record.createdAt).getTime() + ONE_HOUR_MS
  );
};

export const getPendingPaymentController = async (
  req,
  res,
  next
) => {
  try {
    const { clinicId } = req.params;
    const userId = req.user?._id || req.user?.id;

    if (
      !mongoose.isValidObjectId(clinicId) ||
      !mongoose.isValidObjectId(userId)
    ) {
      throw fail("Invalid clinic or user ID", 400);
    }

    const owner = await ClinicMembership.exists({
      clinicId,
      userId,
      role: "owner",
      status: "active",
    });

    if (!owner) {
      throw fail(
        "Only clinic owners can view subscription payments",
        403
      );
    }

    const subscription = await ClinicSubscription.findOne({
      clinicId,
    }).lean();

    if (!subscription) {
      throw fail("Subscription not found", 404);
    }

    if (subscription.status === "active") {
      return res.status(200).json({
        message: "Subscription is already active",
        subscriptionStatus: "active",
        payment: null,
        canChangeBillingCycle: false,
        requiresReview: false,
      });
    }

    if (subscription.status !== "pending") {
      throw fail(
        "Subscription is not eligible for checkout"
      );
    }

    // Never report checkout as switchable while an
    // order-creation or billing-update lock exists.
    if (subscription.paymentOrderLock) {
      throw fail(
        "Payment setup is being processed or needs support review"
      );
    }

    const reviewRecord = await SubscriptionPayment.exists({
      clinicId,
      subscriptionId: subscription._id,
      status: "review_required",
    });

    if (reviewRecord) {
      return res.status(200).json({
        message: "A payment requires support review",
        subscriptionStatus: subscription.status,
        payment: null,
        canChangeBillingCycle: false,
        requiresReview: true,
      });
    }

    const paidRecord = await SubscriptionPayment.exists({
      clinicId,
      subscriptionId: subscription._id,
      status: "paid",
    });

    if (paidRecord) {
      throw fail(
        "A previous payment needs reconciliation before checkout"
      );
    }

    const records = await SubscriptionPayment.find({
      clinicId,
      subscriptionId: subscription._id,
      status: "created",
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!records.length) {
      return res.status(200).json({
        message: "No pending checkout",
        subscriptionStatus: subscription.status,
        payment: null,
        canChangeBillingCycle: true,
        requiresReview: false,
      });
    }

    const razorpay = getRazorpay();

    let retryable = null;
    let unresolved = null;
    let allExpiredAndRetryable = true;

    for (const record of records) {
      const remote = await razorpay.orders.fetch(
        record.razorpayOrderId
      );

      validateOrderIdentity(remote, record);

      if (
        record.plan !== subscription.plan ||
        record.billingCycle !== subscription.billingCycle ||
        record.amount !==
          subscription.priceSnapshot * 100
      ) {
        throw fail(
          "Payment history does not match current subscription"
        );
      }

      const state = await classifyRazorpayOrder(
        razorpay,
        remote
      );

      const expiresAt = getExpiry(record);

      const expired =
        Number.isFinite(expiresAt.getTime()) &&
        Date.now() >= expiresAt.getTime();

      if (state !== "retryable" || !expired) {
        allExpiredAndRetryable = false;
      }

      const payment = {
        orderId: record.razorpayOrderId,
        amount: record.amount,
        currency: record.currency,
        billingCycle: record.billingCycle,
        orderStatus:
          state === "retryable"
            ? "created"
            : state === "paid"
              ? "paid"
              : "attempted",
        createdAt: record.createdAt,
        expiresAt,
        expired,
      };

      if (state === "paid") {
        unresolved = payment;
        break;
      }

      if (state === "pending") {
        if (!unresolved) {
          unresolved = payment;
        }
      } else if (!retryable) {
        retryable = payment;
      }
    }

    return res.status(200).json({
      message: "Payment status retrieved",
      subscriptionStatus: subscription.status,
      payment: unresolved || retryable,
      canChangeBillingCycle:
        !unresolved && allExpiredAndRetryable,
      requiresReview: false,
    });
  } catch (error) {
    next(error);
  }
};
