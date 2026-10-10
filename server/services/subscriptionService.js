import "dotenv/config";
import mongoose from "mongoose";
import ClinicSubscription from "../models/ClinicSubscription.js";


// Subscription plan configuration

export const parsePlanPrice = (value, fallback, key) => {
  const raw = value === undefined ? String(fallback) : String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw) || !Number.isSafeInteger(Math.round(Number(raw) * 100)) || Number(raw) <= 0) {
    throw new Error(`Invalid ${key}: use a positive price with at most two decimal places`);
  }
  return Number(raw);
};

export const toPaise = (price) => {
  const amount = Math.round(price * 100);
  if (!Number.isFinite(price) || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Invalid payment amount");
  }
  return amount;
};

export const SUBSCRIPTION_PLANS = Object.freeze({
  basic: {
    prices: {
      monthly: parsePlanPrice(process.env.PLAN_BASIC_MONTHLY, 49, "PLAN_BASIC_MONTHLY"),
      yearly: parsePlanPrice(process.env.PLAN_BASIC_YEARLY, 499, "PLAN_BASIC_YEARLY"),
    },
    limits: {
      monthly: 0,
      yearly: 0,
    },
  },

  starter: {
    prices: {
      monthly: parsePlanPrice(process.env.PLAN_STARTER_MONTHLY, 199, "PLAN_STARTER_MONTHLY"),
      yearly: parsePlanPrice(process.env.PLAN_STARTER_YEARLY, 1999, "PLAN_STARTER_YEARLY"),
    },
    limits: {
      monthly: 300,
      yearly: 3600,
    },
  },

  growth: {
    prices: {
      monthly: parsePlanPrice(process.env.PLAN_GROWTH_MONTHLY, 299, "PLAN_GROWTH_MONTHLY"),
      yearly: parsePlanPrice(process.env.PLAN_GROWTH_YEARLY, 2999, "PLAN_GROWTH_YEARLY"),
    },
    limits: {
      monthly: 500,
      yearly: 6000,
    },
  },

  unlimited: {
    prices: {
      monthly: parsePlanPrice(process.env.PLAN_UNLIMITED_MONTHLY, 599, "PLAN_UNLIMITED_MONTHLY"),
      yearly: parsePlanPrice(process.env.PLAN_UNLIMITED_YEARLY, 5999, "PLAN_UNLIMITED_YEARLY"),
    },
    limits: {
      monthly: null,
      yearly: null,
    },
  },
});

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Get configuration for a selected plan and billing cycle
export const getPlanConfig = (plan, billingCycle) => {
  const config = Object.hasOwn(SUBSCRIPTION_PLANS, plan) ? SUBSCRIPTION_PLANS[plan] : null;

  if (!config || !["monthly", "yearly"].includes(billingCycle)) {
    throw createError("Invalid subscription plan", 400);
  }

  return {
    plan,
    billingCycle,
    price: config.prices[billingCycle],
    bookingLimit: config.limits[billingCycle],
  };
};

// Verify that clinic can create an online booking hold
export const checkBookingEntitlement = async (
  clinicId,
  { session = null } = {}
) => {
  const now = new Date();

  let query = ClinicSubscription.findOne({
    clinicId,
    status: "active",
    currentPeriodStart: { $lte: now },
    currentPeriodEnd: { $gt: now },
  });

  if (session) {
    query = query.session(session);
  }

  const subscription = await query;

  if (!subscription) {
    throw createError(
      "Active clinic subscription required",
      403
    );
  }

  const config = getPlanConfig(
    subscription.plan,
    subscription.billingCycle
  );

  // Basic plan cannot accept online bookings
  if (config.bookingLimit === 0) {
    throw createError(
      "Online booking is not included in this plan",
      403
    );
  }

  // Verify stored quota matches subscription configuration
  if (
    subscription.bookingLimit !== null &&
    (
      !Number.isSafeInteger(subscription.bookingLimit) ||
      subscription.bookingLimit < config.bookingLimit
    )
  ) {
    throw createError(
      "Invalid subscription booking limit",
      500
    );
  }

  if (
    config.bookingLimit !== null &&
    subscription.bookingLimit === null
  ) {
    throw createError(
      "Invalid unlimited booking entitlement",
      500
    );
  }

  // null means unlimited bookings
  if (
    config.bookingLimit !== null &&
    subscription.bookingsUsed >= subscription.bookingLimit
  ) {
    throw createError(
      "Subscription booking limit reached",
      403
    );
  }

  return subscription;
};



export const initializeClinicSubscription = async ({
  clinicId,
  billingCycle,
  session,
}) => {
  if (!session) {
    throw new Error(
      "Subscription initialization requires a database session"
    );
  }

  if (!mongoose.isValidObjectId(clinicId)) {
    throw createError("Invalid clinic ID", 400);
  }

  if (!["monthly", "yearly"].includes(billingCycle)) {
    throw createError("Invalid billing cycle", 400);
  }

  // Registration always starts with the Basic plan.
  const config = getPlanConfig("basic", billingCycle);

  const [subscription] = await ClinicSubscription.create(
    [
      {
        clinicId,
        plan: "basic",
        billingCycle,
        status: "pending",
        currentPeriodStart: null,
        currentPeriodEnd: null,
        bookingLimit: config.bookingLimit,
        bookingsUsed: 0,
        priceSnapshot: config.price,
      },
    ],
    { session }
  );

  return subscription;
};
