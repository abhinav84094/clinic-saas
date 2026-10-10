import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import ClinicSubscription from "../models/ClinicSubscription.js";
import SubscriptionPayment from "../models/SubscriptionPayment.js";
import {getRazorpay} from "../config/razorpay.js";
import {processSubscriptionWebhook, recoverCheckout, processSubscriptionFinancialEvent} from "../services/subscriptionPaymentService.js";
process.env.RAZORPAY_KEY_ID = "rzp_test_mock";
process.env.RAZORPAY_KEY_SECRET = "mock";
const query = value => ({session: async () => value});

test("captured upgrade honors paid snapshot, selected cycle, time and quota; duplicates do not grant twice", async t => {
  const start = new Date(Date.now()-86400000);
  const oldEnd = new Date(Date.now()+86400000*10);
  const clinicId = new mongoose.Types.ObjectId();
  const subscriptionId = new mongoose.Types.ObjectId();
  const payment = {
    _id:new mongoose.Types.ObjectId(), clinicId, subscriptionId,
    purpose:"upgrade",plan:"growth",fromPlan:"starter",fromBillingCycle:"monthly",
    billingCycle:"yearly",amount:12345,currency:"INR",bookingLimitSnapshot:6000,
    sourcePeriodEnd:oldEnd,status:"created",razorpayOrderId:"order_mock",save:async()=>{},
  };
  const subscription = {_id:subscriptionId,clinicId,plan:"starter",status:"active",billingCycle:"monthly",currentPeriodStart:start,currentPeriodEnd:oldEnd,bookingLimit:300,bookingsUsed:100,save:async()=>{}};
  const remote = {id:"order_mock",amount:12345,currency:"INR",status:"paid",notes:{clinicId:String(clinicId),subscriptionId:String(subscriptionId),plan:"growth",billingCycle:"yearly",purpose:"upgrade"}};
  t.mock.method(SubscriptionPayment,"findOne",async()=>payment);
  t.mock.method(SubscriptionPayment,"findById",()=>query(payment));
  t.mock.method(ClinicSubscription,"findOne",()=>query(subscription));
  let transactionUnavailable = true;
  t.mock.method(mongoose,"startSession",async()=>({withTransaction:async fn=>{
    if (transactionUnavailable) throw new Error("transaction temporarily unavailable");
    return fn();
  },endSession:async()=>{}}));
  t.mock.method(getRazorpay().orders,"fetch",async()=>remote);
  t.mock.method(getRazorpay().payments,"fetch",async()=>({id:"pay_mock",order_id:"order_mock",status:"captured",amount:12345,currency:"INR"}));
  await assert.rejects(processSubscriptionWebhook({razorpayOrderId:"order_mock",razorpayPaymentId:"pay_mock"}), /temporarily unavailable/);
  assert.equal(payment.status,"created");
  transactionUnavailable = false;
  const first = await processSubscriptionWebhook({razorpayOrderId:"order_mock",razorpayPaymentId:"pay_mock"});
  assert.equal(first.status,"active");
  assert.equal(subscription.priceSnapshot,123.45);
  assert.equal(subscription.billingCycle,"yearly");
  assert.equal(subscription.bookingsUsed,100);
  assert.equal(subscription.bookingLimit-subscription.bookingsUsed,6200);
  assert.equal(subscription.currentPeriodStart.getTime(),payment.paidAt.getTime());
  assert.equal(subscription.currentPeriodEnd.getTime(),payment.paidAt.getTime()+365*86400000);
  const end = subscription.currentPeriodEnd.getTime();
  const second = await processSubscriptionWebhook({razorpayOrderId:"order_mock",razorpayPaymentId:"pay_mock"});
  assert.equal(second.alreadyProcessed,true);
  assert.equal(subscription.currentPeriodEnd.getTime(),end);
});

test("uncertain checkout with no remote match stays locked",async t=>{
  const subscription={paymentOrderLock:"token",paymentOrderLockedAt:new Date(0),paymentOrderDraft:{receipt:"receipt"}};
  t.mock.method(ClinicSubscription,"findOne",async()=>subscription);
  t.mock.method(getRazorpay().orders,"all",async()=>({items:[]}));
  await assert.rejects(recoverCheckout(new mongoose.Types.ObjectId()),/uncertain/);
  assert.equal(subscription.paymentOrderLock,"token");
});

test("refund event records financial review without revoking another subscription", async t=>{
  const record={_id:new mongoose.Types.ObjectId(),amount:4900,currency:"INR",razorpayPaymentId:"pay_mock"};
  let update;
  t.mock.method(getRazorpay().payments,"fetch",async()=>({order_id:"order_mock",amount:4900,currency:"INR"}));
  t.mock.method(SubscriptionPayment,"findOne",async()=>record);
  t.mock.method(SubscriptionPayment,"updateOne",async(_q,value)=>{update=value.$set;});
  const result=await processSubscriptionFinancialEvent({paymentId:"pay_mock",event:"refund.processed"});
  assert.equal(result.requiresReview,true);
  assert.equal(update.financialReviewRequired,true);
  assert.match(update.reviewReason,/refund.processed/);
});
