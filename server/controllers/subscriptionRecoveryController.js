
import mongoose from "mongoose";

import ClinicSubscription from "../models/ClinicSubscription.js";
import SubscriptionPayment from "../models/SubscriptionPayment.js";

import { getRazorpay } from "../config/razorpay.js";
import { classifyRazorpayOrder } from "../services/subscriptionPaymentService.js";

const fail = (message, statusCode) =>
  Object.assign(new Error(message), { statusCode });

export const getPendingPaymentController = async (
  req,
  res,
  next
) => {
  try {
    const { clinicId } = req.params;

    if (!mongoose.isValidObjectId(clinicId)) {
      throw fail("Invalid clinic ID", 400);
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
      });
    }

    // Inspect all unresolved orders instead of only the latest 20.
    const records = await SubscriptionPayment.find({
      clinicId,
      subscriptionId: subscription._id,
      status: "created",
    })
      .sort({ createdAt: -1 })
      .lean();

    const razorpay = getRazorpay();

    let retryable = null;
    let unresolved = null;

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
        remote.notes?.billingCycle !== record.billingCycle ||
        record.billingCycle !== subscription.billingCycle ||
        record.plan !== subscription.plan ||
        record.amount !== subscription.priceSnapshot * 100
      ) {
        throw fail(
          "Payment history mismatch; contact support",
          409
        );
      }

      const state = await classifyRazorpayOrder(
        razorpay,
        remote
      );

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
      };

      if (state !== "retryable") {
        // Prefer a paid order over an unresolved attempt.
        if (state === "paid") {
          unresolved = payment;
          break;
        }

        if (!unresolved) {
          unresolved = payment;
        }
      } else if (!retryable) {
        retryable = payment;
      }
    }

    // A lock with no unresolved local order could mean that
    // Razorpay created an order before MongoDB saving failed.
    if (!unresolved && subscription.paymentOrderLock) {
      throw fail(
        "Payment setup needs support review before retrying",
        409
      );
    }

    return res.status(200).json({
      message: "Payment status retrieved",
      subscriptionStatus: subscription.status,
      payment: unresolved || retryable,
    });
  } catch (error) {
    next(error);
  }
};
