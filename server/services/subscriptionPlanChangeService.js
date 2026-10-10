
import mongoose from "mongoose";
import crypto from "node:crypto";

import ClinicSubscription from "../models/ClinicSubscription.js";
import SubscriptionPayment from "../models/SubscriptionPayment.js";
import ClinicMembership from "../models/ClinicMembership.js";

import { getRazorpay } from "../config/razorpay.js";
import { getPlanConfig } from "./subscriptionService.js";
import {
  classifyRazorpayOrder,
  validateOrderIdentity,
} from "./subscriptionPaymentService.js";

const fail = (message, statusCode = 409) =>
  Object.assign(new Error(message), { statusCode });

const PLAN_RANK = {
  basic: 0,
  starter: 1,
  growth: 2,
  unlimited: 3,
};

const validateOwner = async (clinicId, userId) => {
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
    throw fail("Only clinic owners can manage plans", 403);
  }
};

const createPlanChangeOrder = async ({
  clinicId,
  userId,
  purpose,
  toPlan,
  billingCycle,
}) => {
  await validateOwner(clinicId, userId);

  if (!["upgrade", "renewal"].includes(purpose)) {
    throw fail("Invalid payment purpose", 400);
  }

  const token = crypto.randomUUID();

  const subscription = await ClinicSubscription.findOneAndUpdate(
    {
      clinicId,
      paymentOrderLock: null,
    },
    {
      $set: { paymentOrderLock: token },
    },
    { new: true }
  );

  if (!subscription) {
    throw fail("Subscription checkout is busy");
  }

  let releaseLock = true;

  try {
    const now = new Date();

    const active =
      subscription.status === "active" &&
      subscription.currentPeriodStart <= now &&
      subscription.currentPeriodEnd > now;

    const expired =
      subscription.status === "expired" ||
      (
        subscription.currentPeriodEnd &&
        subscription.currentPeriodEnd <= now
      );

    if (purpose === "upgrade") {
      if (!active) {
        throw fail("Only active clinics can upgrade");
      }

      if (
        !(toPlan in PLAN_RANK) ||
        PLAN_RANK[toPlan] <= PLAN_RANK[subscription.plan]
      ) {
        throw fail("Select a higher subscription plan", 400);
      }

      if (billingCycle !== subscription.billingCycle) {
        throw fail(
          "Billing cycle cannot change during upgrade",
          400
        );
      }
    }

    if (purpose === "renewal") {
      if (!expired || active) {
        throw fail("Subscription is not eligible for renewal");
      }

      if (toPlan !== "basic") {
        throw fail("Renewal must start with Basic", 400);
      }

      if (!["monthly", "yearly"].includes(billingCycle)) {
        throw fail("Invalid billing cycle", 400);
      }
    }

    const config = getPlanConfig(toPlan, billingCycle);
    const amount = config.price * 100;

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw fail("Invalid plan price", 500);
    }

    const razorpay = getRazorpay();

    // Inspect ALL unresolved orders for this subscription.
    const unresolved = await SubscriptionPayment.find({
      clinicId,
      subscriptionId: subscription._id,
      status: "created",
    }).sort({ createdAt: -1 });

    let reusable = null;

    for (const record of unresolved) {
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
          "Previous payment captured. Await activation."
        );
      }

      if (state === "pending") {
        throw fail(
          "Previous payment is still being processed."
        );
      }

      // Reuse only an identical retryable checkout.
      if (
        record.purpose === purpose &&
        record.plan === toPlan &&
        record.billingCycle === billingCycle &&
        record.amount === amount &&
        (
          purpose === "renewal" ||
          record.fromPlan === subscription.plan
        )
      ) {
        reusable ??= record;
      } else {
        // Different retryable orders must be resolved
        // before allowing a new plan selection.
        throw fail(
          "An older checkout must be resolved first."
        );
      }
    }

    if (reusable) {
      return {
        orderId: reusable.razorpayOrderId,
        amount: reusable.amount,
        currency: reusable.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        purpose,
      };
    }

    // If Razorpay succeeds but DB persistence is uncertain,
    // retain the lock for manual recovery.
    releaseLock = false;

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `plan_${subscription._id}_${Date.now()}`
        .slice(0, 40),
      notes: {
        clinicId: String(clinicId),
        subscriptionId: String(subscription._id),
        plan: toPlan,
        billingCycle,
        purpose,
      },
    });

    if (
      !order?.id ||
      order.amount !== amount ||
      order.currency !== "INR"
    ) {
      throw fail("Unexpected Razorpay order response", 502);
    }

    await SubscriptionPayment.create({
      clinicId,
      subscriptionId: subscription._id,
      purpose,
      fromPlan:
        purpose === "upgrade" ? subscription.plan : null,
      plan: toPlan,
      billingCycle,
      amount,
      currency: "INR",
      bookingLimitSnapshot: config.bookingLimit,
      razorpayOrderId: order.id,
      status: "created",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    releaseLock = true;

    return {
      orderId: order.id,
      amount,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      purpose,
    };
  } finally {
    if (releaseLock) {
      await ClinicSubscription.updateOne(
        {
          _id: subscription._id,
          paymentOrderLock: token,
        },
        { $set: { paymentOrderLock: null } }
      );
    }
  }
};

export const createUpgradeOrder = ({
  clinicId,
  userId,
  toPlan,
}) =>
  ClinicSubscription.findOne({ clinicId }).then(
    (subscription) => {
      if (!subscription) {
        throw fail("Subscription not found", 404);
      }

      return createPlanChangeOrder({
        clinicId,
        userId,
        purpose: "upgrade",
        toPlan,
        billingCycle: subscription.billingCycle,
      });
    }
  );

export const createRenewalOrder = ({
  clinicId,
  userId,
  billingCycle,
}) =>
  createPlanChangeOrder({
    clinicId,
    userId,
    purpose: "renewal",
    toPlan: "basic",
    billingCycle,
  });
