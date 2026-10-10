
import mongoose from "mongoose";

import ClinicMembership from "../models/ClinicMembership.js";
import ClinicSubscription from "../models/ClinicSubscription.js";
import SubscriptionPayment from "../models/SubscriptionPayment.js";

import { getRazorpay } from "../config/razorpay.js";
import {
  classifyRazorpayOrder,
  recoverCheckout,
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

    const purpose = req.query?.purpose;
    if (purpose && !["registration", "upgrade", "renewal"].includes(purpose)) throw fail("Invalid payment purpose", 400);
    await recoverCheckout(clinicId);
    const subscription = await ClinicSubscription.findOne({
      clinicId,
    }).lean();

    if (!subscription) {
      throw fail("Subscription not found", 404);
    }

    // Never report checkout as switchable while an
    // order-creation or billing-update lock exists.
    if (subscription.paymentOrderLock) {
      return res.status(200).json({
        subscriptionStatus: subscription.status, payment: null,
        canChangeBillingCycle: false, processing: true,
        requiresReview: !subscription.paymentOrderDraft &&
          Date.now() - new Date(subscription.paymentOrderLockedAt || subscription.updatedAt).getTime() >= 120000,
        message: "Payment setup is being processed. Refresh to check recovery.",
      });
    }

    const reviewRecord = await SubscriptionPayment.exists({
      clinicId,
      subscriptionId: subscription._id,
      $or: [{status:"review_required"}, {financialReviewRequired:true}],
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

    const records = await SubscriptionPayment.find({
      clinicId,
      subscriptionId: subscription._id,
      status: { $in: ["created", "abandoned", "superseded"] },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!records.length) {
      return res.status(200).json({
        message: "No pending checkout",
        subscriptionStatus: subscription.status,
        payment: null,
        canChangeBillingCycle: subscription.status === "pending",
        requiresReview: false,
      });
    }

    const razorpay = getRazorpay();

    let retryable = null;
    let unresolved = null;
    let allRetryable = true;

    for (const record of records) {
      const remote = await razorpay.orders.fetch(
        record.razorpayOrderId
      );

      validateOrderIdentity(remote, record);

      const state = await classifyRazorpayOrder(
        razorpay,
        remote
      );

      const expiresAt = getExpiry(record);

      const expired =
        Number.isFinite(expiresAt.getTime()) &&
        Date.now() >= expiresAt.getTime();

      if (state !== "retryable") {
        allRetryable = false;
      }

      const payment = {
        orderId: record.razorpayOrderId,
        purpose: record.purpose,
        plan: record.plan,
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
      } else if (!retryable && record.status === "created" && (!purpose || record.purpose === purpose)) {
        retryable = payment;
      }
    }

    return res.status(200).json({
      message: "Payment status retrieved",
      subscriptionStatus: subscription.status,
      payment: unresolved || retryable,
      canChangeBillingCycle:
        subscription.status === "pending" && !unresolved && allRetryable,
      requiresReview: false,
    });
  } catch (error) {
    next(error);
  }
};
