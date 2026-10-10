import mongoose from "mongoose";
import ClinicSubscription from "../models/ClinicSubscription.js";

// Read prices from environment variables
const readPrice = (key) => {
  const raw = process.env[key];

  if (!raw || !/^\d+$/.test(raw)) {
    throw new Error(
      `Invalid or missing environment variable: ${key}`
    );
  }

  const price = Number(raw);

  if (!Number.isSafeInteger(price)) {
    throw new Error(`Invalid price value: ${key}`);
  }

  return price;
};

// Subscription plan configuration
export const SUBSCRIPTION_PLANS = Object.freeze({
  basic: {
    prices: {
      monthly: readPrice("PLAN_BASIC_MONTHLY"),
      yearly: readPrice("PLAN_BASIC_YEARLY"),
    },
    limits: {
      monthly: 0,
      yearly: 0,
    },
  },

  starter: {
    prices: {
      monthly: readPrice("PLAN_STARTER_MONTHLY"),
      yearly: readPrice("PLAN_STARTER_YEARLY"),
    },
    limits: {
      monthly: 300,
      yearly: 3600,
    },
  },

  growth: {
    prices: {
      monthly: readPrice("PLAN_GROWTH_MONTHLY"),
      yearly: readPrice("PLAN_GROWTH_YEARLY"),
    },
    limits: {
      monthly: 500,
      yearly: 6000,
    },
  },

  unlimited: {
    prices: {
      monthly: readPrice("PLAN_UNLIMITED_MONTHLY"),
      yearly: readPrice("PLAN_UNLIMITED_YEARLY"),
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
  const config = SUBSCRIPTION_PLANS[plan];

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
