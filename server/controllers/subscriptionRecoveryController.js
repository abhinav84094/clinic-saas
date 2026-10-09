
import mongoose from "mongoose";

import ClinicSubscription from "../models/ClinicSubscription.js";
import SubscriptionPayment from "../models/SubscriptionPayment.js";

import { getRazorpay } from "../config/razorpay.js";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const getPendingPaymentController = async (
  req,
  res,
  next
) => {
  try {
    const { clinicId } = req.params;

    if (!mongoose.isValidObjectId(clinicId)) {
      throw createError("Invalid clinic ID", 400);
    }

    const subscription = await ClinicSubscription.findOne({
      clinicId,
    }).lean();

    if (!subscription) {
      throw createError("Subscription not found", 404);
    }

    if (subscription.status === "active") {
      return res.status(200).json({
        message: "Subscription is already active",
        subscriptionStatus: "active",
        payment: null,
      });
    }

    const payments = await SubscriptionPayment.find({
      clinicId,
      subscriptionId: subscription._id,
      status: "created",
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    if (payments.length === 0) {
      return res.status(200).json({
        message: "No unresolved payment order found",
        subscriptionStatus: subscription.status,
        payment: null,
      });
    }

    const razorpay = getRazorpay();

    // Fail closed: if an earlier order cannot be checked,
    // do not tell the user it is safe to pay again.
    let unresolvedPayment = null;

    for (const payment of payments) {
      const remoteOrder = await razorpay.orders.fetch(
        payment.razorpayOrderId
      );

      if (
        remoteOrder.id !== payment.razorpayOrderId ||
        remoteOrder.amount !== payment.amount ||
        remoteOrder.currency !== payment.currency
      ) {
        throw createError(
          "Payment order data mismatch. Contact support.",
          409
        );
      }

      if (
        !["created", "attempted", "paid"].includes(
          remoteOrder.status
        )
      ) {
        throw createError(
          "Unexpected payment order status",
          409
        );
      }

      // An attempted or paid order must be investigated.
      // A created order is also retained because it may
      // still be used for checkout.
      if (!unresolvedPayment) {
        unresolvedPayment = {
          orderId: payment.razorpayOrderId,
          amount: payment.amount,
          currency: payment.currency,
          billingCycle: payment.billingCycle,
          orderStatus: remoteOrder.status,
          createdAt: payment.createdAt,
        };
      }

      if (remoteOrder.status !== "created") {
        unresolvedPayment = {
          orderId: payment.razorpayOrderId,
          amount: payment.amount,
          currency: payment.currency,
          billingCycle: payment.billingCycle,
          orderStatus: remoteOrder.status,
          createdAt: payment.createdAt,
        };

        break;
      }
    }

    return res.status(200).json({
      message: "Payment order status retrieved",
      subscriptionStatus: subscription.status,
      payment: unresolvedPayment,
    });
  } catch (error) {
    next(error);
  }
};
