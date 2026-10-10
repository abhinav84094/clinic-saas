import test from "node:test";
import assert from "node:assert/strict";
import { parsePlanPrice, toPaise, getPlanConfig } from "../services/subscriptionService.js";
import { calculateUpgradeQuota } from "../services/subscriptionQuotaService.js";

test("prices reject malformed comments, zero, negative and fractional paise", () => {
  for (const value of ["199 //300", "", "0", "-1", "NaN", "1.001", "Infinity"]) {
    assert.throws(() => parsePlanPrice(value, 199, "PLAN_TEST"));
  }
  assert.equal(parsePlanPrice(undefined, 199, "PLAN_TEST"), 199);
  assert.equal(toPaise(parsePlanPrice("19.99", 199, "PLAN_TEST")), 1999);
  assert.equal(toPaise(0.29), 29);
});

test("all configured prices and cycles are payable", () => {
  for (const plan of ["basic", "starter", "growth", "unlimited"]) {
    for (const cycle of ["monthly", "yearly"]) assert.ok(toPaise(getPlanConfig(plan, cycle).price) > 0);
  }
  assert.throws(() => getPlanConfig("toString", "monthly"));
});

test("upgrade carries remaining quota and honors the purchased snapshot", () => {
  assert.equal(calculateUpgradeQuota({subscription:{billingCycle:"monthly",bookingLimit:300,bookingsUsed:100},toPlan:"growth",bookingLimit:6000}),6200);
  assert.equal(calculateUpgradeQuota({subscription:{billingCycle:"monthly",bookingLimit:300,bookingsUsed:100},toPlan:"unlimited",bookingLimit:null}),null);
});
