import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../src/services/subscriptionCheckout.js", import.meta.url), "utf8");
function checkoutFixture(post) {
  let checkout;
  const context = vm.createContext({ api: { post }, window: { Razorpay: class {
    constructor(options) { this.options = options; checkout = this; }
    on(name, callback) { this[name] = callback; }
    open() {}
  } }, document: {} });
  // Replace only the module import/export boundary; exercise the actual service.
  vm.runInContext(source.replace('import api from "./api";', '').replace('export async function', 'async function') + '\nglobalThis.openCheckout = openSubscriptionCheckout;', context);
  return { start: context.openCheckout, checkout: () => checkout };
}
const order = { orderId: "order_unit", keyId: "rzp_test_unit", amount: 4900, currency: "INR" };
const activated = { success: true, subscription: { status: "active" } };

test("closing checkout exposes the saved order so the page can recover it", async () => {
  const f = checkoutFixture(async () => ({ data: { order } }));
  let saved;
  const result = f.start("/clinics/unit", "renewal", { billingCycle: "monthly" }, { onOrder: value => { saved = value; } });
  await new Promise(resolve => setImmediate(resolve));
  const rejection = assert.rejects(result, /Check your existing payment/);
  f.checkout().options.modal.ondismiss();
  await rejection;
  assert.equal(saved.orderId, "order_unit");
});

test("modal dismissal during verification waits for activation", async () => {
  let complete;
  const f = checkoutFixture(async url => url.endsWith("renewal-order") ? { data: { order } } : await new Promise(resolve => { complete = resolve; }));
  const result = f.start("/clinics/unit", "renewal", {});
  await new Promise(resolve => setImmediate(resolve));
  const verification = f.checkout().options.handler({ razorpay_order_id: "order_unit" });
  f.checkout().options.modal.ondismiss();
  complete({ data: activated });
  await verification;
  assert.equal((await result).success, true);
});

test("failed verification reconciles the saved order before reporting failure", async () => {
  const requests = [];
  const f = checkoutFixture(async (url, body) => {
    requests.push({ url, body });
    if (url.endsWith("renewal-order")) return { data: { order } };
    if (url.endsWith("verify-payment")) throw new Error("Network timeout");
    return { data: activated };
  });
  const result = f.start("/clinics/unit", "renewal", {});
  await new Promise(resolve => setImmediate(resolve));
  await f.checkout().options.handler({ razorpay_order_id: "order_unit" });
  assert.equal((await result).success, true);
  assert.equal(requests[2].body.razorpay_order_id, "order_unit");
});

test("failed payment dismissal keeps an actionable error for safe retry", async () => {
  const f = checkoutFixture(async () => ({ data: { order } }));
  const result = f.start("/clinics/unit", "renewal", {});
  await new Promise(resolve => setImmediate(resolve));
  const rejection = assert.rejects(result, /Bank declined/);
  f.checkout()["payment.failed"]({ error: { description: "Bank declined" } });
  f.checkout().options.modal.ondismiss();
  await rejection;
});
