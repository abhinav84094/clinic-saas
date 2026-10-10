import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import ClinicSubscription from "../models/ClinicSubscription.js";
import ClinicMembership from "../models/ClinicMembership.js";
import SubscriptionPayment from "../models/SubscriptionPayment.js";
import {getRazorpay} from "../config/razorpay.js";
import {createPlanChangeOrder, classifyRazorpayOrder, recoverCheckout} from "../services/subscriptionPaymentService.js";
import {getPlanConfig,toPaise} from "../services/subscriptionService.js";
process.env.RAZORPAY_KEY_ID="rzp_test_mock";
process.env.RAZORPAY_KEY_SECRET="mock";

test("upgrade charges requested yearly cycle and persists recovery draft before external call",async t=>{
 const clinicId=new mongoose.Types.ObjectId(),userId=new mongoose.Types.ObjectId();
 const subscription={_id:new mongoose.Types.ObjectId(),plan:"basic",status:"active",billingCycle:"monthly",currentPeriodStart:new Date(Date.now()-1000),currentPeriodEnd:new Date(Date.now()+86400000)};
 let draft, stored;
 t.mock.method(ClinicMembership,"exists",async()=>true);
 t.mock.method(ClinicSubscription,"findOne",async()=>null);
 t.mock.method(ClinicSubscription,"findOneAndUpdate",async()=>subscription);
 t.mock.method(ClinicSubscription,"updateOne",async(_q,u)=>{if(u.$set.paymentOrderDraft) draft=u.$set.paymentOrderDraft;return {matchedCount:1};});
 t.mock.method(SubscriptionPayment,"exists",async()=>false);
 t.mock.method(SubscriptionPayment,"find",()=>({sort:async()=>[]}));
 t.mock.method(SubscriptionPayment,"create",async fields=>{stored=fields;});
 t.mock.method(getRazorpay().orders,"create",async options=>{
   assert.equal(draft.billingCycle,"yearly");
   assert.equal(draft.fromBillingCycle,"monthly");
   assert.equal(draft.receipt,options.receipt);
   return {id:"order_mock",amount:options.amount,currency:"INR"};
 });
 const order=await createPlanChangeOrder({clinicId,userId,purpose:"upgrade",toPlan:"starter",billingCycle:"yearly"});
 assert.equal(order.amount,toPaise(getPlanConfig("starter","yearly").price));
 assert.equal(stored.billingCycle,"yearly");
});

test("failed-only orders can retry; authorized or incomplete history blocks duplicate checkout",async t=>{
 for(const [response,expected] of [[{count:0,items:[]},"retryable"],[{count:1,items:[{order_id:"order_mock",status:"failed"}]},"retryable"],[{count:1,items:[{order_id:"order_mock",status:"authorized"}]},"pending"],[{count:2,items:[]},"pending"]]) {
   t.mock.method(getRazorpay().orders,"fetchPayments",async()=>response);
   assert.equal(await classifyRazorpayOrder(getRazorpay(),{id:"order_mock",status:"attempted"}),expected);
 }
});

test("stale checkout restores exact remote order and clears lock transactionally",async t=>{
 const clinicId=new mongoose.Types.ObjectId(),subscriptionId=new mongoose.Types.ObjectId();
 const subscription={_id:subscriptionId,paymentOrderLock:"token",paymentOrderLockedAt:new Date(0),paymentOrderDraft:{clinicId,subscriptionId,purpose:"registration",plan:"basic",billingCycle:"monthly",amount:4900,receipt:"receipt"},save:async()=>{}};
 const remote={id:"order_mock",receipt:"receipt",amount:4900,currency:"INR",created_at:1,notes:{clinicId:String(clinicId),subscriptionId:String(subscriptionId),plan:"basic",billingCycle:"monthly"}};
 let created;
 t.mock.method(ClinicSubscription,"findOne",q=>q._id?{session:async()=>subscription}:Promise.resolve(subscription));
 t.mock.method(getRazorpay().orders,"all",async()=>({items:[remote]}));
 t.mock.method(mongoose.connection,"transaction",async fn=>fn({}));
 t.mock.method(SubscriptionPayment,"findOne",()=>({session:async()=>null}));
 t.mock.method(SubscriptionPayment,"create",async fields=>{created=fields[0];});
 assert.equal(await recoverCheckout(clinicId),true);
 assert.equal(created.razorpayOrderId,"order_mock");
 assert.equal(created.purpose,"registration");
 assert.equal(subscription.paymentOrderLock,null);
 assert.equal(subscription.paymentOrderDraft,null);
});

test("stale new lock before remote request is released but legacy uncertain lock is retained", async t=>{
 let subscription={_id:new mongoose.Types.ObjectId(),paymentOrderLock:"token",paymentOrderLockedAt:new Date(0),paymentOrderDraft:null};
 let released=false;
 t.mock.method(ClinicSubscription,"findOne",async()=>subscription);
 t.mock.method(ClinicSubscription,"updateOne",async()=>{released=true;return {modifiedCount:1};});
 assert.equal(await recoverCheckout(new mongoose.Types.ObjectId()),true);
 assert.equal(released,true);
 released=false;
 subscription={paymentOrderLock:"legacy",updatedAt:new Date(0)};
 assert.equal(await recoverCheckout(new mongoose.Types.ObjectId()),false);
 assert.equal(released,false);
});
