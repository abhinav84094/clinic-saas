
import mongoose from "mongoose";
import crypto from "node:crypto";

import ClinicSubscription from "../models/ClinicSubscription.js";
import SubscriptionPayment from "../models/SubscriptionPayment.js";
import ClinicMembership from "../models/ClinicMembership.js";

import { getRazorpay } from "../config/razorpay.js";
import { getPlanConfig, toPaise } from "./subscriptionService.js";

import { calculateUpgradeQuota } from "./subscriptionQuotaService.js";




const fail = (message, statusCode = 409) =>
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
  const owner = await ClinicMembership.exists({
    clinicId,
    userId,
    role: "owner",
    status: "active",
  });

  if (!owner) {
    throw fail("Only clinic owners can manage payments", 403);
  }
};

export const validateOrderIdentity = (remote, record) => {
  const purpose = record.purpose || "registration";

  if (
    remote.id !== record.razorpayOrderId ||
    remote.amount !== record.amount ||
    remote.currency !== record.currency ||
    String(remote.notes?.clinicId) !== String(record.clinicId) ||
    String(remote.notes?.subscriptionId) !==
      String(record.subscriptionId) ||
    remote.notes?.plan !== record.plan ||
    remote.notes?.billingCycle !== record.billingCycle ||
    (
      (purpose !== "registration" || remote.notes?.purpose != null) &&
      remote.notes?.purpose !== purpose
    )
  ) {
    throw fail("Razorpay order identity mismatch");
  }
};

export const classifyRazorpayOrder = async (razorpay, remote) => {
  if (remote.status === "paid") return "paid";

  if (!["created", "attempted"].includes(remote.status)) {
    throw fail("Unexpected Razorpay order status");
  }

  const response = await razorpay.orders.fetchPayments(remote.id);
  const items = response.items || [];

  if (
    !Number.isInteger(response.count) ||
    response.count !== items.length ||
    items.some(
      (payment) =>
        payment.order_id !== remote.id ||
        payment.status !== "failed"
    )
  ) {
    return "pending";
  }

  return "retryable";
};


const processCapturedPayment = async ({
  record,
  razorpayPaymentId,
}) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const payment = await SubscriptionPayment.findById(
        record._id
      ).session(session);

      if (!payment) {
        throw fail("Payment record not found", 404);
      }

      const subscription = await ClinicSubscription.findOne({
        _id: payment.subscriptionId,
        clinicId: payment.clinicId,
      }).session(session);

      if (!subscription) {
        throw fail("Subscription not found", 404);
      }

      if (payment.financialReviewRequired) {
        result = {paymentId: payment._id, status: "review_required", requiresReview: true};
        return;
      }
      // Already processed: never grant quota twice.
      if (payment.status === "paid") {
        if (payment.razorpayPaymentId !== razorpayPaymentId) {
          throw fail("Payment identity conflict");
        }

        result = {
          paymentId: payment._id,
          subscriptionId: subscription._id,
          status: subscription.status,
          plan: subscription.plan,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          alreadyProcessed: true,
        };
        return;
      }

      if (payment.status === "review_required") {
        if (payment.razorpayPaymentId !== razorpayPaymentId) {
          throw fail("Payment review conflict");
        }

        result = {
          paymentId: payment._id,
          status: "review_required",
          requiresReview: true,
          alreadyProcessed: true,
        };
        return;
      }

      if (
        !["created", "abandoned", "superseded"].includes(
          payment.status
        )
      ) {
        throw fail("Payment state conflict");
      }

      const now = new Date();
      const purpose = payment.purpose || "registration";

      const config = getPlanConfig(
        payment.plan,
        payment.billingCycle
      );

      const active =
        subscription.status === "active" &&
        subscription.currentPeriodStart != null &&
        subscription.currentPeriodStart <= now &&
        subscription.currentPeriodEnd > now;

      const expired =
        ["active", "expired", "past_due"].includes(
          subscription.status
        ) &&
        subscription.currentPeriodEnd != null &&
        subscription.currentPeriodEnd <= now;

      const planRank = {
        basic: 0,
        starter: 1,
        growth: 2,
        unlimited: 3,
      };

      const validPrice =
        Number.isSafeInteger(payment.amount) &&
        payment.amount > 0;

      const sourcePeriodMatches =
        payment.sourcePeriodEnd != null &&
        subscription.currentPeriodEnd != null &&
        new Date(payment.sourcePeriodEnd).getTime() ===
          new Date(subscription.currentPeriodEnd).getTime();

      let eligible = false;
      let newBookingLimit = config.bookingLimit;

      // REGISTRATION: only pending Basic.
      if (purpose === "registration") {
        eligible =
          payment.status === "created" &&
          payment.plan === "basic" &&
          subscription.status === "pending" &&
          subscription.plan === "basic" &&
          subscription.billingCycle === payment.billingCycle &&
          toPaise(subscription.priceSnapshot) === payment.amount;
      }

      // UPGRADE: active, unexpired, higher plan.
      if (purpose === "upgrade") {
        eligible =
          payment.status === "created" &&
          active &&
          sourcePeriodMatches &&
          subscription.plan === payment.fromPlan &&
          subscription.billingCycle === (payment.fromBillingCycle || payment.billingCycle) &&
          planRank[payment.plan] > planRank[subscription.plan] &&
          (payment.bookingLimitSnapshot === null ? payment.plan === "unlimited" : Number.isSafeInteger(payment.bookingLimitSnapshot) && payment.bookingLimitSnapshot >= 0 && payment.plan !== "unlimited");

        if (eligible) {
          newBookingLimit = calculateUpgradeQuota({
            subscription,
            toPlan: payment.plan,
            bookingLimit: payment.bookingLimitSnapshot,
          });
        }
      }

      // RENEWAL: expired clinic returns to Basic.
      if (purpose === "renewal") {
        eligible =
          payment.status === "created" &&
          expired &&
          sourcePeriodMatches &&
          payment.plan === "basic" &&
          payment.fromPlan === subscription.plan &&
          payment.bookingLimitSnapshot === 0;

        newBookingLimit = 0;
      }

      if (!eligible || !validPrice) {
        payment.status = "review_required";
        payment.razorpayPaymentId = razorpayPaymentId;
        payment.paidAt = now;
        payment.reviewRequiredAt = now;
        payment.reviewReason =
          "Captured payment cannot safely activate the selected subscription";

        await payment.save({ session });

        result = {
          paymentId: payment._id,
          status: "review_required",
          requiresReview: true,
        };
        return;
      }

      const days =
        payment.billingCycle === "monthly" ? 30 : 365;

      // Validity starts when the captured payment is verified and recorded.
      const end = new Date(now.getTime() + days * 86400000);

      payment.status = "paid";
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.paidAt = now;

      subscription.plan = payment.plan;
      subscription.billingCycle = payment.billingCycle;
      subscription.priceSnapshot = payment.amount / 100;
      const bookingsUsed = purpose === "upgrade" ? subscription.bookingsUsed : 0;
      subscription.bookingLimit = newBookingLimit === null ? null : newBookingLimit + bookingsUsed;
      subscription.bookingsUsed = bookingsUsed;
      subscription.status = "active";
      subscription.currentPeriodStart = now;
      subscription.currentPeriodEnd = end;

      await payment.save({ session });
      await subscription.save({ session });

      result = {
        paymentId: payment._id,
        subscriptionId: subscription._id,
        status: "active",
        purpose,
        plan: subscription.plan,
        billingCycle: subscription.billingCycle,
        bookingLimit: subscription.bookingLimit,
        bookingsUsed: subscription.bookingsUsed,
        currentPeriodStart: now,
        currentPeriodEnd: end,
        alreadyProcessed: false,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
};



const verifyCapturedPayment = async ({
  record,
  razorpayPaymentId,
  razorpay,
}) => {
  const [remotePayment, remoteOrder] = await Promise.all([
    razorpay.payments.fetch(razorpayPaymentId),
    razorpay.orders.fetch(record.razorpayOrderId),
  ]);

  validateOrderIdentity(remoteOrder, record);

  if (
    remotePayment.id !== razorpayPaymentId ||
    remotePayment.order_id !== record.razorpayOrderId ||
    remotePayment.status !== "captured" ||
    remotePayment.amount !== record.amount ||
    remotePayment.currency !== record.currency ||
    remoteOrder.status !== "paid"
  ) {
    throw fail("Payment has not been captured");
  }

  return processCapturedPayment({
    record,
    razorpayPaymentId,
  });
};

// Validate local payment data before creating an external order. Only a definite
// Razorpay rejection may release the lock; timeouts can leave an unknown order.
const createRemoteOrder = async (razorpay, options, onRejected, subscription, token, draft) => {
  try {
    const saved = await ClinicSubscription.updateOne(
      { _id: subscription._id, paymentOrderLock: token },
      { $set: { paymentOrderDraft: { ...draft, receipt: options.receipt }, paymentOrderLockedAt: new Date() } }
    );
    if (saved.matchedCount !== 1) throw fail("Checkout lock changed");
  } catch (error) {
    onRejected();
    throw error;
  }
  try {
    return await razorpay.orders.create(options);
  } catch (error) {
    if ([400, 401, 403, 404, 422, 429].includes(error.statusCode)) {
      onRejected();
    }
    throw error;
  }
};

const validatePaymentDraft = async (fields) => {
  await new SubscriptionPayment({
    ...fields,
    razorpayOrderId: "pending_validation",
    currency: "INR",
    status: "created",
  }).validate();
  return fields;
};

export const createSubscriptionPaymentOrder = async ({
  clinicId,
  userId,
}) => {
  valid(clinicId, userId);
  await requireOwner(clinicId, userId);
  await recoverCheckout(clinicId);
  const token = crypto.randomUUID();

  const subscription = await ClinicSubscription.findOneAndUpdate(
    {
      clinicId,
      status: "pending",
      plan: "basic",
      paymentOrderLock: null,
    },
    { $set: { paymentOrderLock: token, paymentOrderLockedAt: new Date() } },
    { returnDocument: 'after' }
  );

  if (!subscription) {
    throw fail("Subscription checkout is busy or not eligible");
  }

  let releaseLock = true;

  try {
    getPlanConfig(subscription.plan, subscription.billingCycle);

    const amount = toPaise(subscription.priceSnapshot);

    if (
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      throw fail("Invalid subscription amount", 500);
    }

    const razorpay = getRazorpay();

    const records = await SubscriptionPayment.find({
      clinicId,
      subscriptionId: subscription._id,
      status: "created",
    }).sort({ createdAt: -1 });

    for (const record of records) {
      const remote = await razorpay.orders.fetch(
        record.razorpayOrderId
      );

      validateOrderIdentity(remote, record);

      if (
        record.plan !== subscription.plan ||
        record.billingCycle !== subscription.billingCycle ||
        record.amount !== amount
      ) {
        throw fail("Unresolved payment order mismatch");
      }

      const state = await classifyRazorpayOrder(
        razorpay,
        remote
      );

      if (state === "paid") {
        throw fail("Previous payment received. Await activation.");
      }

      if (state === "pending") {
        throw fail("Previous payment is still being confirmed.");
      }
    }

    if (records.length) {
      const record = records[0];

      return {
        orderId: record.razorpayOrderId,
        amount: record.amount,
        currency: record.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      };
    }

    // If Razorpay creation succeeds but DB persistence fails,
    // keep the lock for manual reconciliation.
    const draft = await validatePaymentDraft({
      clinicId,
      subscriptionId: subscription._id,
      purpose: "registration",
      plan: subscription.plan,
      billingCycle: subscription.billingCycle,
      amount,
    });
    releaseLock = false;

    const order = await createRemoteOrder(razorpay, {
      amount,
      currency: "INR",
      receipt: `sub_${subscription._id}_${Date.now()}`.slice(
        0,
        40
      ),
      notes: {
        clinicId: String(clinicId),
        subscriptionId: String(subscription._id),
        plan: subscription.plan,
        billingCycle: subscription.billingCycle,
        purpose: "registration",
      },
    }, () => { releaseLock = true; }, subscription, token, draft);

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
      purpose :"registration",
      plan: subscription.plan,
      billingCycle: subscription.billingCycle,
      amount,
      currency: "INR",
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
    };
  } finally {
    if (releaseLock) {
      await ClinicSubscription.updateOne(
        {
          _id: subscription._id,
          paymentOrderLock: token,
        },
        { $set: { paymentOrderLock: null, paymentOrderLockedAt: null, paymentOrderDraft: null } }
      );
    }
  }
};


export const createPlanChangeOrder = async ({
  clinicId,
  userId,
  purpose,
  toPlan,
  billingCycle,
}) => {
  valid(clinicId, userId);
  await requireOwner(clinicId, userId);

  if (!["upgrade", "renewal"].includes(purpose)) {
    throw fail("Invalid payment purpose", 400);
  }

  await recoverCheckout(clinicId);
  const token = crypto.randomUUID();

  const subscription = await ClinicSubscription.findOneAndUpdate(
    {
      clinicId,
      paymentOrderLock: null,
    },
    {
      $set: { paymentOrderLock: token, paymentOrderLockedAt: new Date() },
    },
    { returnDocument: 'after' }
  );

  if (!subscription) {
    throw fail("Subscription checkout busy or unavailable");
  }

  let releaseLock = true;

  try {
    const now = new Date();

    const active =
      subscription.status === "active" &&
      subscription.currentPeriodStart != null &&
      subscription.currentPeriodStart <= now &&
      subscription.currentPeriodEnd > now;

    const expired =
      ["active", "expired", "past_due"].includes(
        subscription.status
      ) &&
      subscription.currentPeriodEnd != null &&
      subscription.currentPeriodEnd <= now;

    const planRank = {
      basic: 0,
      starter: 1,
      growth: 2,
      unlimited: 3,
    };

    if (purpose === "upgrade") {
      if (
        !active ||
        !Object.hasOwn(planRank, toPlan) ||
        planRank[toPlan] <= planRank[subscription.plan]
      ) {
        throw fail(
          "Active subscription and a higher plan required"
        );
      }

      billingCycle ??= subscription.billingCycle;
      if (!["monthly", "yearly"].includes(billingCycle)) {
        throw fail("Invalid billing cycle", 400);
      }
    }

    if (purpose === "renewal") {
      if (!expired) {
        throw fail("Only expired clinics can renew");
      }

      if (!["monthly", "yearly"].includes(billingCycle)) {
        throw fail("Invalid billing cycle", 400);
      }

      // Renewal must always start with Basic.
      toPlan = "basic";
    }

    const config = getPlanConfig(toPlan, billingCycle);
    const amount = toPaise(config.price);

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw fail("Invalid plan price", 500);
    }

    const razorpay = getRazorpay();

    // Do not start another checkout when a captured
    // payment requires manual review.
    const needsReview = await SubscriptionPayment.exists({
      clinicId,
      subscriptionId: subscription._id,
      $or: [{status: "review_required"}, {financialReviewRequired: true}],
    });

    if (needsReview) {
      throw fail(
        "A previous payment requires support review"
      );
    }
    
    const records = await SubscriptionPayment.find({
      clinicId,
      subscriptionId: subscription._id,
      status: {
        $in: ["created", "abandoned", "superseded"],
      },
    }).sort({ createdAt: -1 });

    let reusable = null;

    for (const record of records) {
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
          "Previous payment captured. Reconcile it first."
        );
      }

      if (state === "pending") {
        throw fail(
          "Previous checkout is still being confirmed."
        );
      }

      const samePeriod =
        record.sourcePeriodEnd != null &&
        new Date(record.sourcePeriodEnd).getTime() ===
          new Date(subscription.currentPeriodEnd).getTime();

      const sameOrder =
        record.purpose === purpose &&
        record.plan === toPlan &&
        record.billingCycle === billingCycle &&
        Number.isSafeInteger(record.amount) && record.amount > 0 &&
        record.fromPlan === subscription.plan &&
        samePeriod;

      if (!sameOrder) {
        if (record.status === "created") {
          record.status = "superseded";
          record.supersededAt = new Date();
          await record.save();
        }
        continue; // Old orders remain auditable; late captures require review.
      }
      if (record.status !== "created") continue;

      reusable ??= record;
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

    // A network timeout during Razorpay creation may
    // leave an unknown remote order. Preserve the lock.
    const draft = await validatePaymentDraft({
      clinicId,
      subscriptionId: subscription._id,
      purpose,
      fromPlan: subscription.plan,
      fromBillingCycle: subscription.billingCycle,
      sourcePeriodEnd: subscription.currentPeriodEnd,
      plan: toPlan,
      billingCycle,
      amount,
      bookingLimitSnapshot: config.bookingLimit,
    });
    releaseLock = false;

    const order = await createRemoteOrder(razorpay, {
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
    }, () => { releaseLock = true; }, subscription, token, draft);

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
      fromPlan: subscription.plan,
      fromBillingCycle: subscription.billingCycle,
      sourcePeriodEnd: subscription.currentPeriodEnd,
      plan: toPlan,
      billingCycle,
      amount,
      currency: "INR",
      bookingLimitSnapshot: config.bookingLimit,
      razorpayOrderId: order.id,
      status: "created",
      expiresAt: new Date(Date.now() + 3600000),
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
        {
          $set: { paymentOrderLock: null },
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
  await requireOwner(clinicId, userId);

  if (
    ![razorpayOrderId, razorpayPaymentId].every(
      (value) => typeof value === "string" && value
    ) ||
    typeof razorpaySignature !== "string" ||
    !/^[a-fA-F0-9]{64}$/.test(razorpaySignature)
  ) {
    throw fail("Invalid payment verification details", 400);
  }

  await recoverCheckout(clinicId);
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

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest();

  const received = Buffer.from(razorpaySignature, "hex");

  if (!crypto.timingSafeEqual(expected, received)) {
    throw fail("Invalid payment signature", 400);
  }

  return verifyCapturedPayment({
    record,
    razorpayPaymentId,
    razorpay: getRazorpay(),
  });
};

export const reconcileSubscriptionPayment = async ({
  clinicId,
  userId,
  razorpayOrderId,
}) => {
  valid(clinicId, userId);
  await requireOwner(clinicId, userId);

  if (
    typeof razorpayOrderId !== "string" ||
    !razorpayOrderId.startsWith("order_")
  ) {
    throw fail("Invalid reconciliation details", 400);
  }

  await recoverCheckout(clinicId);
  const record = await SubscriptionPayment.findOne({
    clinicId,
    razorpayOrderId,
  });

  if (!record) {
    throw fail("Payment order not found", 404);
  }

  const razorpay = getRazorpay();
  const remote = await razorpay.orders.fetch(razorpayOrderId);

  validateOrderIdentity(remote, record);

  if (remote.status !== "paid") {
    throw fail("Payment not yet captured");
  }

  const list = await razorpay.orders.fetchPayments(
    razorpayOrderId
  );

  if (
    !Number.isInteger(list.count) ||
    list.count !== (list.items || []).length
  ) {
    throw fail("Incomplete payment history");
  }

  const captured = list.items.filter(
    (payment) =>
      payment.status === "captured" &&
      payment.order_id === razorpayOrderId &&
      payment.amount === record.amount &&
      payment.currency === record.currency
  );

  if (captured.length !== 1) {
    throw fail("Captured payment requires support review");
  }

  return verifyCapturedPayment({
    record,
    razorpayPaymentId: captured[0].id,
    razorpay,
  });
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
    const remote = await getRazorpay().orders.fetch(razorpayOrderId);
    if (!remote.notes?.subscriptionId || !remote.notes?.clinicId) return { ignored: true };
    await recoverCheckout(remote.notes.clinicId, remote);
    const recovered = await SubscriptionPayment.findOne({ razorpayOrderId });
    if (!recovered) throw fail("Subscription order requires reconciliation", 503);
    return verifyCapturedPayment({ record: recovered, razorpayPaymentId, razorpay: getRazorpay() });
  }

  return verifyCapturedPayment({
    record,
    razorpayPaymentId,
    razorpay: getRazorpay(),
  });
};

// The durable draft is written before the external call. Recovery only restores
// the exact receipt and amount; it never expires an uncertain external operation.
export const recoverCheckout = async (clinicId, knownOrder = null) => {
  const subscription = await ClinicSubscription.findOne({ clinicId });
  if (!subscription?.paymentOrderLock) return false;
  const lockedAt = subscription.paymentOrderLockedAt || subscription.updatedAt;
  if (!knownOrder && Date.now() - new Date(lockedAt).getTime() < 120000) return false;
  const draft = subscription.paymentOrderDraft;
  if (!draft) {
    // New timestamped locks cannot have called Razorpay without first saving a
    // draft. A crash before that write is safe to release; legacy locks are not.
    if (!subscription.paymentOrderLockedAt) return false;
    const result = await ClinicSubscription.updateOne({
      _id: subscription._id, paymentOrderLock: subscription.paymentOrderLock,
      paymentOrderLockedAt: subscription.paymentOrderLockedAt, paymentOrderDraft: null,
    }, {$set:{paymentOrderLock:null, paymentOrderLockedAt:null}});
    return result.modifiedCount === 1;
  }
  const response = knownOrder ? { items: [knownOrder] } :
    await getRazorpay().orders.all({ receipt: draft.receipt, count: 2 });
  const orders = response.items || [];
  if (orders.length !== 1 || orders[0].receipt !== draft.receipt) {
    throw fail("Checkout outcome is uncertain. Retry verification or contact support.", 503);
  }
  const remote = orders[0];
  const fields = { ...draft, razorpayOrderId: remote.id, currency: "INR", status: "created" };
  delete fields.receipt;
  validateOrderIdentity(remote, fields);
  await new SubscriptionPayment(fields).validate();
  await mongoose.connection.transaction(async (session) => {
    const current = await ClinicSubscription.findOne({
      _id: subscription._id, paymentOrderLock: subscription.paymentOrderLock,
      "paymentOrderDraft.receipt": draft.receipt,
    }).session(session);
    if (!current) return;
    const existing = await SubscriptionPayment.findOne({razorpayOrderId: remote.id}).session(session);
    if (existing) validateOrderIdentity(remote, existing);
    else await SubscriptionPayment.create([{
      ...fields, createdAt: new Date(remote.created_at * 1000),
      expiresAt: new Date(remote.created_at * 1000 + 3600000),
    }], { session });
    current.paymentOrderLock = null;
    current.paymentOrderLockedAt = null;
    current.paymentOrderDraft = null;
    await current.save({ session });
  });
  return true;
};

// Record financial exceptions for operator review. Refund/access decisions remain
// explicit business policy; never revoke a newer subscription for an old payment.
export const processSubscriptionFinancialEvent = async ({paymentId, event}) => {
  if (typeof paymentId !== "string" || !paymentId.startsWith("pay_")) throw fail("Invalid financial event", 400);
  const remote = await getRazorpay().payments.fetch(paymentId);
  const record = await SubscriptionPayment.findOne({razorpayOrderId: remote.order_id});
  if (!record) {
    const order = await getRazorpay().orders.fetch(remote.order_id);
    if (order.notes?.subscriptionId) throw fail("Financial event needs order reconciliation", 503);
    return {ignored: true};
  }
  if (remote.amount !== record.amount || remote.currency !== record.currency ||
      (record.razorpayPaymentId && record.razorpayPaymentId !== paymentId)) throw fail("Financial event identity mismatch");
  await SubscriptionPayment.updateOne({_id:record._id}, {$set:{
    financialReviewRequired:true, reviewRequiredAt:new Date(),
    reviewReason:`Financial event requires operator decision: ${event}`,
  }});
  return {requiresReview:true};
};
