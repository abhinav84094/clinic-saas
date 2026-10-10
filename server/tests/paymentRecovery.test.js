import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import ClinicSubscription from "../models/ClinicSubscription.js";
import ClinicMembership from "../models/ClinicMembership.js";
import Clinic from "../models/Clinic.js";
import SubscriptionPayment from "../models/SubscriptionPayment.js";
import SubscriptionCheckoutArchive from "../models/SubscriptionCheckoutArchive.js";
import { getRazorpay } from "../config/razorpay.js";
import { getPlanConfig, toPaise } from "../services/subscriptionService.js";
import { canReuseQuote, findOrdersByReceipt } from "../services/subscriptionCheckoutPolicy.js";
import { createPlanChangeOrder, processSubscriptionWebhook, processSubscriptionFinancialEvent, restoreArchivedCheckout, activateReviewedPayment, verifyOperatorPayment } from "../services/subscriptionPaymentService.js";
import { resolveCheckout, resolvePayment } from "../services/subscriptionPaymentSupportService.js";
import { getPendingPaymentController } from "../controllers/subscriptionRecoveryController.js";
import { updateSubscriptionBillingCycle } from "../services/subscriptionSetupService.js";

// No live MongoDB/Razorpay calls: all persistence/provider operations are mocked.
process.env.RAZORPAY_KEY_ID = "rzp_test_unit";
process.env.RAZORPAY_KEY_SECRET = "unit-test-secret";
const razorpay = getRazorpay();
const query = value => ({
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  session() { return this; }, sort() { return this; }, lean() { return this; },
});

function fixture(t, { status = "created", purpose = "upgrade", plan = "starter" } = {}) {
  const now = Date.now();
  const subscription = new ClinicSubscription({
    clinicId: new mongoose.Types.ObjectId(), plan: "basic", status: "active", billingCycle: "monthly", priceSnapshot: 49,
    currentPeriodStart: new Date(now - 86400000), currentPeriodEnd: new Date(now + 86400000), bookingLimit: 0, bookingsUsed: 0,
  });
  const payment = new SubscriptionPayment({
    clinicId: subscription.clinicId, subscriptionId: subscription._id, purpose, plan, billingCycle: "monthly", fromPlan: "basic", fromBillingCycle: "monthly",
    sourcePeriodEnd: subscription.currentPeriodEnd, bookingLimitSnapshot: getPlanConfig(plan, "monthly").bookingLimit,
    amount: toPaise(getPlanConfig(plan, "monthly").price), currency: "INR", razorpayOrderId: "order_unit", status,
    razorpayPaymentId: status === "created" || status === "superseded" ? null : "pay_unit", paidAt: status === "review_required" || status === "paid" ? new Date(now - 60000) : null,
    createdAt: new Date(now), expiresAt: new Date(now + 3600000),
  });
  const remoteOrder = { id: payment.razorpayOrderId, amount: payment.amount, currency: "INR", status: "created", receipt: "unit-receipt", created_at: Math.floor(now / 1000), notes: { clinicId: String(subscription.clinicId), subscriptionId: String(subscription._id), purpose, plan, billingCycle: "monthly" } };
  const remotePayment = { id: "pay_unit", order_id: remoteOrder.id, amount: payment.amount, currency: "INR", status: "captured", amount_refunded: 0 };
  t.mock.method(mongoose.connection, "transaction", async callback => callback({}));
  t.mock.method(mongoose, "startSession", async () => ({ withTransaction: async callback => callback(), endSession: async () => {} }));
  t.mock.method(subscription, "save", async () => subscription);
  t.mock.method(payment, "save", async () => payment);
  t.mock.method(ClinicMembership, "exists", async () => true);
  t.mock.method(ClinicSubscription, "findOne", () => query(subscription));
  t.mock.method(ClinicSubscription, "findById", () => query(subscription));
  t.mock.method(ClinicSubscription, "findOneAndUpdate", async (_filter, update) => { Object.assign(subscription, update.$set); return subscription; });
  t.mock.method(ClinicSubscription, "updateOne", async (filter, update) => {
    if (filter.paymentOrderLock && filter.paymentOrderLock !== subscription.paymentOrderLock) return { matchedCount: 0, modifiedCount: 0 };
    Object.assign(subscription, update.$set); return { matchedCount: 1, modifiedCount: 1 };
  });
  t.mock.method(SubscriptionPayment, "exists", async () => false);
  t.mock.method(SubscriptionPayment, "find", () => query([payment]));
  t.mock.method(SubscriptionPayment, "findOne", () => query(payment));
  t.mock.method(SubscriptionPayment, "findById", () => query(payment));
  t.mock.method(SubscriptionPayment, "create", async fields => Array.isArray(fields) ? fields.map(value => new SubscriptionPayment(value)) : new SubscriptionPayment(fields));
  t.mock.method(SubscriptionPayment, "updateOne", async (filter, update) => {
    if (filter.financialEventKeys?.$ne && payment.financialEventKeys.includes(filter.financialEventKeys.$ne)) return { modifiedCount: 0 };
    Object.assign(payment, update.$set || {});
    if (update.$addToSet?.financialEventKeys) payment.financialEventKeys.addToSet(update.$addToSet.financialEventKeys);
    return { modifiedCount: 1 };
  });
  t.mock.method(SubscriptionCheckoutArchive, "findOne", () => query(null));
  t.mock.method(SubscriptionCheckoutArchive, "exists", () => query(null));
  t.mock.method(SubscriptionCheckoutArchive, "create", async value => value);
  t.mock.method(SubscriptionCheckoutArchive, "updateOne", async () => ({ modifiedCount: 1 }));
  t.mock.method(razorpay.orders, "fetch", async () => remoteOrder);
  t.mock.method(razorpay.orders, "all", async () => ({ count: 0, items: [] }));
  t.mock.method(razorpay.orders, "fetchPayments", async () => ({ count: 0, items: [] }));
  t.mock.method(razorpay.orders, "create", async options => ({ ...options, id: "order_new", status: "created", created_at: Math.floor(now / 1000) }));
  t.mock.method(razorpay.payments, "fetch", async () => remotePayment);
  t.mock.method(razorpay.disputes, "fetch", async id => ({ id, payment_id: "pay_unit", status: "won" }));
  t.mock.method(razorpay.refunds, "fetch", async id => ({ id, payment_id: "pay_unit", status: "processed" }));
  return { subscription, payment, remoteOrder, remotePayment, args: { clinicId: String(subscription.clinicId), userId: String(new mongoose.Types.ObjectId()), purpose, toPlan: plan, billingCycle: "monthly" } };
}

test("quote honors its original price until expiry, then requires the configured amount", () => {
  assert.equal(canReuseQuote({ amount: 100, expiresAt: new Date(2000) }, 200, 1999), true);
  assert.equal(canReuseQuote({ amount: 100, expiresAt: new Date(2000) }, 200, 2000), false);
  assert.equal(canReuseQuote({ amount: 100, expiresAt: new Date(2000) }, 100, 3000), true);
  assert.equal(canReuseQuote({ amount: NaN, expiresAt: new Date(2000) }, 100, 1000), false);
});

test("receipt recovery skips partial matches and scans subsequent pages", async () => {
  const calls = [];
  const provider = { orders: { all: async options => {
    calls.push(options);
    return options.skip === 0 ? { count: 100, items: Array.from({ length: 100 }, (_, index) => ({ id: `partial${index}`, receipt: "prefix_exact" })) } : { count: 1, items: [{ id: "correct", receipt: "exact" }] };
  } } };
  assert.deepEqual(await findOrdersByReceipt(provider, "exact"), [{ id: "correct", receipt: "exact" }]);
  assert.deepEqual(calls.map(call => call.skip), [0, 100]);
});

test("receipt recovery refuses incomplete provider history", async () => {
  await assert.rejects(findOrdersByReceipt({ orders: { all: async () => ({ count: 2, items: [] }) } }, "exact"), /Incomplete/);
});

test("reusing a valid upgrade quote clears draft and timestamp with its lock", async t => {
  const f = fixture(t);
  f.subscription.paymentOrderDraft = { receipt: "stale" };
  const result = await createPlanChangeOrder(f.args);
  assert.equal(result.orderId, "order_unit");
  assert.equal(f.subscription.paymentOrderLock, null);
  assert.equal(f.subscription.paymentOrderDraft, null);
  assert.equal(f.subscription.paymentOrderLockedAt, null);
});

test("an expired changed-price quote is superseded and a unique fresh quote persisted", async t => {
  const f = fixture(t);
  f.payment.amount -= 100;
  f.remoteOrder.amount = f.payment.amount;
  f.payment.expiresAt = new Date(Date.now() - 1);
  SubscriptionPayment.findOne.mock.mockImplementation(() => query(null));
  const result = await createPlanChangeOrder(f.args);
  assert.equal(f.payment.status, "superseded");
  assert.equal(result.amount, toPaise(getPlanConfig("starter", "monthly").price));
  const receipt = razorpay.orders.create.mock.calls[0].arguments[0].receipt;
  assert.equal(receipt.length, 40);
  assert.match(receipt, /^chg_[a-f0-9-]+$/);
  assert.equal(f.subscription.paymentOrderDraft, null);
});

test("definite provider rejection releases every lock field", async t => {
  const f = fixture(t);
  SubscriptionPayment.find.mock.mockImplementation(() => query([]));
  razorpay.orders.create.mock.mockImplementation(async () => { throw Object.assign(new Error("Rejected"), { statusCode: 400 }); });
  await assert.rejects(createPlanChangeOrder(f.args), /Rejected/);
  assert.equal(f.subscription.paymentOrderLock, null);
  assert.equal(f.subscription.paymentOrderDraft, null);
  assert.equal(f.subscription.paymentOrderLockedAt, null);
});

test("a provider timeout preserves a recoverable draft and lock", async t => {
  const f = fixture(t);
  SubscriptionPayment.find.mock.mockImplementation(() => query([]));
  razorpay.orders.create.mock.mockImplementation(async () => { throw new Error("Timeout"); });
  await assert.rejects(createPlanChangeOrder(f.args), /Timeout/);
  assert.ok(f.subscription.paymentOrderLock);
  assert.ok(f.subscription.paymentOrderDraft.receipt);
  assert.ok(f.subscription.paymentOrderLockedAt);
});

test("DB failure after provider creation preserves the checkout draft", async t => {
  const f = fixture(t);
  SubscriptionPayment.find.mock.mockImplementation(() => query([]));
  SubscriptionPayment.findOne.mock.mockImplementation(() => query(null));
  SubscriptionPayment.create.mock.mockImplementation(async () => { throw new Error("Database unavailable"); });
  await assert.rejects(createPlanChangeOrder(f.args), /Database unavailable/);
  assert.ok(f.subscription.paymentOrderLock);
  assert.ok(f.subscription.paymentOrderDraft.receipt);
});

test("authorized payment history blocks a new order", async t => {
  const f = fixture(t);
  razorpay.orders.fetchPayments.mock.mockImplementation(async () => ({ count: 1, items: [{ order_id: "order_unit", status: "authorized" }] }));
  await assert.rejects(createPlanChangeOrder(f.args), /still being confirmed/);
  assert.equal(razorpay.orders.create.mock.callCount(), 0);
});

test("late capture of a superseded order enters review without changing entitlement", async t => {
  const f = fixture(t, { status: "superseded" });
  f.remoteOrder.status = "paid";
  const previousEnd = f.subscription.currentPeriodEnd.getTime();
  const result = await processSubscriptionWebhook({ razorpayOrderId: "order_unit", razorpayPaymentId: "pay_unit" });
  assert.equal(result.requiresReview, true);
  assert.equal(f.payment.status, "review_required");
  assert.equal(f.subscription.plan, "basic");
  assert.equal(f.subscription.currentPeriodEnd.getTime(), previousEnd);
});

test("normal capture honors its saved price and duplicate capture grants only once", async t => {
  const f = fixture(t);
  f.payment.amount -= 100;
  f.remoteOrder.amount = f.remotePayment.amount = f.payment.amount;
  f.remoteOrder.status = "paid";
  const first = await processSubscriptionWebhook({ razorpayOrderId: "order_unit", razorpayPaymentId: "pay_unit" });
  const end = f.subscription.currentPeriodEnd.getTime();
  const second = await processSubscriptionWebhook({ razorpayOrderId: "order_unit", razorpayPaymentId: "pay_unit" });
  assert.equal(first.alreadyProcessed, false);
  assert.equal(second.alreadyProcessed, true);
  assert.equal(f.subscription.priceSnapshot, f.payment.amount / 100);
  assert.equal(end - f.payment.paidAt.getTime(), 30 * 86400000);
  assert.equal(f.subscription.currentPeriodEnd.getTime(), end);
  assert.equal(String(f.subscription.activePaymentId), String(f.payment._id));
});

test("support activation preserves the recorded payment date and audits its decision", async t => {
  const f = fixture(t, { status: "review_required" });
  f.remoteOrder.status = "paid";
  const paidAt = f.payment.paidAt.getTime();
  const result = await activateReviewedPayment({ record: f.payment, operator: "support", reason: "ticket-1" });
  assert.equal(result.status, "active");
  assert.equal(f.subscription.currentPeriodStart.getTime(), paidAt);
  assert.equal(f.subscription.currentPeriodEnd.getTime(), paidAt + 30 * 86400000);
  assert.equal(f.payment.supportHistory[0].action, "activate");
});

test("support activation cannot overwrite a newer subscription period", async t => {
  const f = fixture(t, { status: "review_required" });
  f.remoteOrder.status = "paid";
  f.subscription.currentPeriodEnd = new Date(Date.now() + 10 * 86400000);
  const result = await activateReviewedPayment({ record: f.payment, operator: "support", reason: "ticket-1" });
  assert.equal(result.requiresReview, true);
  assert.equal(f.subscription.plan, "basic");
});

test("duplicate and out-of-order dispute events do not reopen resolved review", async t => {
  const f = fixture(t, { status: "paid" });
  await processSubscriptionFinancialEvent({ paymentId: "pay_unit", event: "payment.dispute.won", entityId: "disp_unit" });
  f.payment.financialReviewRequired = false;
  const result = await processSubscriptionFinancialEvent({ paymentId: "pay_unit", event: "payment.dispute.created", entityId: "disp_unit" });
  assert.equal(result.requiresReview, false);
  assert.equal(f.payment.financialReviewRequired, false);
  assert.deepEqual([...f.payment.financialEventKeys], ["disp_unit:won"]);
});

test("processed refund received twice creates only one review event", async t => {
  const f = fixture(t, { status: "paid" });
  await processSubscriptionFinancialEvent({ paymentId: "pay_unit", event: "refund.processed", entityId: "rfnd_unit" });
  f.payment.financialReviewRequired = false;
  await processSubscriptionFinancialEvent({ paymentId: "pay_unit", event: "refund.processed", entityId: "rfnd_unit" });
  assert.equal(f.payment.financialReviewRequired, false);
});

test("an archived late order is restored as superseded with its original identity", async t => {
  const f = fixture(t);
  SubscriptionCheckoutArchive.findOne.mock.mockImplementation(() => query({ draft: { ...f.payment.toObject(), receipt: "unit-receipt" }, createdAt: new Date() }));
  await restoreArchivedCheckout(f.remoteOrder);
  assert.equal(SubscriptionPayment.create.mock.calls[0].arguments[0].status, "superseded");
  assert.equal(SubscriptionPayment.create.mock.calls[0].arguments[0].amount, f.payment.amount);
});

test("retiring an empty timeout archives its draft before releasing the lock", async t => {
  const f = fixture(t);
  f.subscription.paymentOrderLock = "lock-unit";
  f.subscription.paymentOrderLockedAt = new Date(Date.now() - 601000);
  f.subscription.paymentOrderDraft = { ...f.payment.toObject(), receipt: "unit-receipt" };
  const result = await resolveCheckout({ clinicId: f.args.clinicId, releaseEmpty: true, operator: "support", reason: "ticket-1" });
  assert.equal(result.releasedEmpty, true);
  assert.equal(SubscriptionCheckoutArchive.create.mock.callCount(), 1);
  assert.equal(f.subscription.paymentOrderLock, null);
  assert.equal(f.subscription.paymentOrderDraft, null);
});

test("empty recovery refuses a recent request or a matching remote order", async t => {
  const f = fixture(t);
  f.subscription.paymentOrderLock = "lock-unit";
  f.subscription.paymentOrderLockedAt = new Date();
  f.subscription.paymentOrderDraft = { ...f.payment.toObject(), receipt: "unit-receipt" };
  const args = { clinicId: f.args.clinicId, releaseEmpty: true, operator: "support", reason: "ticket-1" };
  await assert.rejects(resolveCheckout(args), /too recent/);
  f.subscription.paymentOrderLockedAt = new Date(Date.now() - 601000);
  razorpay.orders.all.mock.mockImplementation(async () => ({ count: 1, items: [f.remoteOrder] }));
  await assert.rejects(resolveCheckout(args), /do not match/);
  assert.equal(SubscriptionCheckoutArchive.create.mock.callCount(), 0);
});

test("refund resolution never revokes a newer purchase", async t => {
  const f = fixture(t, { status: "paid" });
  f.payment.financialReviewRequired = true;
  f.subscription.activePaymentId = new mongoose.Types.ObjectId();
  f.remotePayment.status = "refunded";
  f.remotePayment.amount_refunded = f.payment.amount;
  await resolvePayment({ orderId: "order_unit", action: "refund", entitlement: "revoke", operator: "support", reason: "ticket-1" });
  assert.equal(f.subscription.status, "active");
  assert.equal(f.payment.status, "refunded");
  assert.equal(f.payment.supportHistory.length, 1);
});

test("refund resolution revokes only the subscription owned by that payment", async t => {
  const f = fixture(t, { status: "paid" });
  f.payment.financialReviewRequired = true;
  f.subscription.activePaymentId = f.payment._id;
  f.remotePayment.status = "refunded";
  f.remotePayment.amount_refunded = f.payment.amount;
  await resolvePayment({ orderId: "order_unit", action: "refund", entitlement: "revoke", operator: "support", reason: "ticket-1" });
  assert.equal(f.subscription.status, "cancelled");
  assert.equal(f.payment.financialReviewRequired, false);
});

test("refund resolution rejects partial refunds and pending disputes", async t => {
  const f = fixture(t, { status: "paid" });
  f.payment.financialReviewRequired = true;
  f.remotePayment.amount_refunded = 100;
  const args = { orderId: "order_unit", action: "refund", entitlement: "revoke", operator: "support", reason: "ticket-1" };
  await assert.rejects(resolvePayment(args), /full refund/);
  f.payment.financialEventKeys.push("disp_unit:open");
  razorpay.disputes.fetch.mock.mockImplementation(async () => ({ payment_id: "pay_unit", status: "open" }));
  await assert.rejects(resolvePayment(args), /still open/);
});

test("an expired renewal can retrieve its existing checkout after page refresh", async t => {
  const f = fixture(t, { purpose: "renewal", plan: "basic" });
  f.subscription.status = "expired";
  f.subscription.currentPeriodEnd = new Date(Date.now() - 1);
  let response;
  let error;
  const res = { status: () => res, json: value => { response = value; } };
  await getPendingPaymentController({ params: { clinicId: f.args.clinicId }, user: { _id: f.args.userId }, query: { purpose: "renewal" } }, res, value => { error = value; });
  assert.equal(error, undefined);
  assert.equal(response.payment.orderId, "order_unit");
  assert.equal(response.payment.purpose, "renewal");
  assert.equal(response.payment.orderStatus, "created");
});

test("registration cycle switches immediately when no payment is in progress and clears metadata", async t => {
  const f = fixture(t, { purpose: "registration", plan: "basic" });
  f.subscription.status = "pending";
  f.subscription.currentPeriodStart = f.subscription.currentPeriodEnd = null;
  t.mock.method(Clinic, "findOne", () => query({ status: "draft" }));
  t.mock.method(Clinic, "exists", () => query(true));
  t.mock.method(SubscriptionPayment, "updateMany", async () => { f.payment.status = "superseded"; return { modifiedCount: 1 }; });
  const result = await updateSubscriptionBillingCycle({ clinicId: f.args.clinicId, userId: f.args.userId, billingCycle: "yearly" });
  assert.equal(result.billingCycle, "yearly");
  assert.equal(f.payment.status, "superseded");
  assert.equal(f.subscription.paymentOrderLockedAt, null);
  assert.equal(f.subscription.paymentOrderDraft, null);
});

test("registration cycle change remains blocked by an authorized payment", async t => {
  const f = fixture(t, { purpose: "registration", plan: "basic" });
  f.subscription.status = "pending";
  f.subscription.currentPeriodStart = f.subscription.currentPeriodEnd = null;
  t.mock.method(Clinic, "findOne", () => query({ status: "draft" }));
  razorpay.orders.fetchPayments.mock.mockImplementation(async () => ({ count: 1, items: [{ order_id: "order_unit", status: "authorized" }] }));
  await assert.rejects(updateSubscriptionBillingCycle({ clinicId: f.args.clinicId, userId: f.args.userId, billingCycle: "yearly" }), /pending confirmation/);
  assert.equal(f.subscription.billingCycle, "monthly");
  assert.equal(f.subscription.paymentOrderLock, null);
});

test("yearly upgrade uses its purchased snapshot, preserves bookings and grants 365 days", async t => {
  const f = fixture(t, { plan: "growth" });
  f.subscription.plan = "starter";
  f.subscription.bookingLimit = 300;
  f.subscription.bookingsUsed = 50;
  f.payment.fromPlan = "starter";
  f.payment.billingCycle = "yearly";
  f.payment.bookingLimitSnapshot = 6000;
  f.payment.amount = toPaise(getPlanConfig("growth", "yearly").price);
  f.remoteOrder.notes.billingCycle = "yearly";
  f.remoteOrder.amount = f.remotePayment.amount = f.payment.amount;
  f.remoteOrder.status = "paid";
  await processSubscriptionWebhook({ razorpayOrderId: "order_unit", razorpayPaymentId: "pay_unit" });
  assert.equal(f.subscription.billingCycle, "yearly");
  assert.equal(f.subscription.bookingsUsed, 50);
  assert.equal(f.subscription.bookingLimit, 6300);
  assert.equal(f.subscription.currentPeriodEnd.getTime() - f.payment.paidAt.getTime(), 365 * 86400000);
});

test("failed support activation does not move the original payment date", async t => {
  const f = fixture(t, { status: "review_required" });
  f.remoteOrder.status = "paid";
  f.subscription.currentPeriodEnd = new Date(Date.now() + 10 * 86400000);
  const original = f.payment.paidAt.getTime();
  await activateReviewedPayment({ record: f.payment, operator: "support", reason: "ticket-1" });
  assert.equal(f.payment.paidAt.getTime(), original);
});

test("partial refund explicitly retained by support is not reopened by capture redelivery", async t => {
  const f = fixture(t, { status: "paid" });
  f.remoteOrder.status = "paid";
  f.remotePayment.amount_refunded = 100;
  f.payment.financialReviewRequired = true;
  await resolvePayment({ orderId: "order_unit", action: "retain", entitlement: "retain", operator: "support", reason: "approved partial goodwill refund" });
  const result = await processSubscriptionWebhook({ razorpayOrderId: "order_unit", razorpayPaymentId: "pay_unit" });
  assert.equal(result.alreadyProcessed, true);
  assert.equal(f.payment.financialReviewRequired, false);
});

test("multiple exact receipt matches are all persisted before unlocking", async t => {
  const f = fixture(t);
  f.subscription.paymentOrderLock = "lock-unit";
  f.subscription.paymentOrderLockedAt = new Date(Date.now() - 121000);
  f.subscription.paymentOrderDraft = { ...f.payment.toObject(), receipt: "unit-receipt" };
  const extra = { ...f.remoteOrder, id: "order_extra" };
  razorpay.orders.all.mock.mockImplementation(async () => ({ count: 2, items: [f.remoteOrder, extra] }));
  SubscriptionPayment.findOne.mock.mockImplementation(() => query(null));
  await resolveCheckout({ clinicId: f.args.clinicId, orderId: "order_unit", operator: "support", reason: "ticket-1" });
  const persisted = SubscriptionPayment.create.mock.calls.map(call => call.arguments[0][0]);
  assert.deepEqual(persisted.map(payment => [payment.razorpayOrderId, payment.status]), [["order_unit", "created"], ["order_extra", "superseded"]]);
  assert.equal(f.subscription.paymentOrderLock, null);
  assert.equal(SubscriptionCheckoutArchive.create.mock.callCount(), 1);
});

test("refund decision and a later captured webhook remain idempotent", async t => {
  const f = fixture(t, { status: "paid" });
  f.payment.financialReviewRequired = true;
  f.subscription.activePaymentId = f.payment._id;
  f.remotePayment.status = "refunded";
  f.remotePayment.amount_refunded = f.payment.amount;
  f.remoteOrder.status = "paid";
  await resolvePayment({ orderId: "order_unit", action: "refund", entitlement: "revoke", operator: "support", reason: "ticket-1" });
  const result = await processSubscriptionWebhook({ razorpayOrderId: "order_unit", razorpayPaymentId: "pay_unit" });
  assert.equal(result.alreadyProcessed, true);
  assert.equal(result.status, "refunded");
  assert.equal(f.subscription.status, "cancelled");
  assert.equal(f.payment.financialReviewRequired, false);
});

test("concurrent checkout attempts create just one provider order", async t => {
  const f = fixture(t);
  SubscriptionPayment.find.mock.mockImplementation(() => query([]));
  SubscriptionPayment.findOne.mock.mockImplementation(() => query(null));
  ClinicSubscription.findOneAndUpdate.mock.mockImplementation(async (_filter, update) => {
    if (f.subscription.paymentOrderLock) return null;
    Object.assign(f.subscription, update.$set);
    return f.subscription;
  });
  let finish;
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  razorpay.orders.create.mock.mockImplementation(async options => {
    started();
    await new Promise(resolve => { finish = resolve; });
    return { ...options, id: "order_new", status: "created", created_at: Math.floor(Date.now() / 1000) };
  });
  const first = createPlanChangeOrder(f.args);
  await ready;
  await assert.rejects(createPlanChangeOrder(f.args), /busy/);
  finish();
  await first;
  assert.equal(razorpay.orders.create.mock.callCount(), 1);
});

test("a very late creation response cannot release or replace a newer checkout lock", async t => {
  const f = fixture(t);
  SubscriptionPayment.find.mock.mockImplementation(() => query([]));
  SubscriptionPayment.findOne.mock.mockImplementation(() => query(null));
  SubscriptionCheckoutArchive.exists.mock.mockImplementation(() => query(true));
  ClinicSubscription.findOne.mock.mockImplementation(filter => query(filter.paymentOrderLock && filter.paymentOrderLock !== f.subscription.paymentOrderLock ? null : f.subscription));
  razorpay.orders.create.mock.mockImplementation(async options => {
    f.subscription.paymentOrderLock = "newer-checkout";
    return { ...options, id: "order_late", status: "created", created_at: Math.floor(Date.now() / 1000) };
  });
  await assert.rejects(createPlanChangeOrder(f.args), /retired/);
  assert.equal(f.subscription.paymentOrderLock, "newer-checkout");
  assert.equal(SubscriptionPayment.create.mock.calls[0].arguments[0][0].status, "superseded");
});

test("operator can verify an exact captured payment without relying on incomplete history", async t => {
  const f = fixture(t);
  f.remoteOrder.status = "paid";
  razorpay.orders.fetchPayments.mock.mockImplementation(async () => ({ count: 100, items: [] }));
  const result = await verifyOperatorPayment({ orderId: "order_unit", paymentId: "pay_unit", operator: "support", reason: "ticket-1: checked provider payment" });
  assert.equal(result.status, "active");
  assert.equal(razorpay.orders.fetchPayments.mock.callCount(), 0);
  assert.equal(SubscriptionPayment.updateOne.mock.calls.at(-1).arguments[1].$push.supportHistory.action, "verify");
});
