export const CHECKOUT_WINDOW_MS = 3600000;
export const checkoutExpiry = record => new Date(
  record.expiresAt || new Date(record.createdAt).getTime() + CHECKOUT_WINDOW_MS
);

// Existing captured orders always retain their signed/local price snapshot.
// Initiating an old-price checkout is allowed only during its original quote window.
export const canReuseQuote = (record, currentAmount, now = Date.now()) =>
  Number.isSafeInteger(record.amount) && record.amount > 0 &&
  (record.amount === currentAmount || checkoutExpiry(record).getTime() > now);

export const clearedCheckoutLock = Object.freeze({
  paymentOrderLock: null, paymentOrderLockedAt: null, paymentOrderDraft: null,
});

// Razorpay's receipt filter can return partial matches. Paginate and compare exactly.
export async function findOrdersByReceipt(razorpay, receipt) {
  if (typeof receipt !== "string" || !receipt || receipt.length > 40) {
    throw new Error("Invalid checkout receipt");
  }
  const matches = new Map();
  for (let skip = 0; skip < 10000; skip += 100) {
    const response = await razorpay.orders.all({ receipt, count: 100, skip });
    if (!Array.isArray(response.items) || response.count !== response.items.length) {
      throw new Error("Incomplete Razorpay order history");
    }
    for (const order of response.items) {
      if (order.receipt === receipt) matches.set(order.id, order);
    }
    if (response.items.length < 100) return [...matches.values()];
  }
  throw new Error("Razorpay order history exceeds recovery limit; contact support");
}
