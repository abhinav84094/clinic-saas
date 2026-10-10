import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import ClinicSubscription from "../models/ClinicSubscription.js";
import ClinicMembership from "../models/ClinicMembership.js";
import SubscriptionPayment from "../models/SubscriptionPayment.js";
import { getRazorpay } from "../config/razorpay.js";
import { createSubscriptionPaymentOrder } from "../services/subscriptionPaymentService.js";

process.env.RAZORPAY_KEY_ID = "rzp_test_mock";
process.env.RAZORPAY_KEY_SECRET = "mock";
const clinicId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
const subscriptionId = new mongoose.Types.ObjectId();

for (const scenario of ["rejection", "timeout", "database failure", "invalid draft", "success"]) {
  test(scenario, async (t) => {
    let released = false;
    let remoteCalls = 0;
    const subscription = {_id: subscriptionId, plan: "basic", billingCycle: "monthly", priceSnapshot: 49};
    t.mock.method(ClinicMembership, "exists", async () => true);
    t.mock.method(ClinicSubscription, "findOneAndUpdate", async () => subscription);
    t.mock.method(ClinicSubscription, "findOne", async () => null);
    t.mock.method(ClinicSubscription, "updateOne", async (_filter, update) => {
      if (update.$set.paymentOrderLock === null) released = true;
      return {matchedCount: 1};
    });
    t.mock.method(SubscriptionPayment, "find", () => ({sort: async () => []}));
    t.mock.method(SubscriptionPayment, "create", async () => {
      if (scenario === "database failure") throw new Error("database unavailable");
    });
    if (scenario === "invalid draft") {
      t.mock.method(SubscriptionPayment.prototype, "validate", async () => {throw new Error("invalid payment data");});
    }
    t.mock.method(getRazorpay().orders, "create", async () => {
      remoteCalls++;
      if (scenario === "rejection") throw {statusCode: 400, error: {description: "rejected"}};
      if (scenario === "timeout") throw new Error("network timeout");
      return {id: "order_mock", amount: 4900, currency: "INR"};
    });
    const operation = createSubscriptionPaymentOrder({clinicId, userId});
    if (scenario === "success") assert.equal((await operation).orderId, "order_mock");
    else await assert.rejects(operation);
    assert.equal(released, ["rejection", "invalid draft", "success"].includes(scenario));
    assert.equal(remoteCalls, scenario === "invalid draft" ? 0 : 1);
  });
}
