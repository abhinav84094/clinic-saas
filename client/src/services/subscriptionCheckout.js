import api from "./api";

let scriptPromise;
export async function openSubscriptionCheckout(base, purpose, options, { onOrder } = {}) {
  if (!window.Razorpay) {
    scriptPromise ??= new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => window.Razorpay ? resolve() : reject(new Error("Checkout initialization failed"));
      script.onerror = () => reject(new Error("Unable to load payment checkout"));
      document.body.appendChild(script);
    }).catch(error => { scriptPromise = null; throw error; });
    await scriptPromise;
  }
  const {data} = await api.post(`${base}/subscription/${purpose}-order`, options);
  const order = data.order;
  if (!order?.orderId || !order?.keyId || !Number.isSafeInteger(order.amount) || order.amount <= 0 || order.currency !== "INR") {
    throw new Error("Invalid checkout order");
  }
  onOrder?.(order);
  return new Promise((resolve, reject) => {
    let failure;
    let verifying = false;
    const checkout = new window.Razorpay({
      key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency,
      name: "Clinic Subscription", description: purpose === "renewal" ? "Basic plan renewal" : "Subscription upgrade",
      modal: { ondismiss: () => { if (!verifying) reject(failure || new Error("Checkout closed. Check your existing payment before retrying.")); } },
      handler: async payment => {
        verifying = true;
        try {
          const result = await api.post(`${base}/subscription/verify-payment`, payment);
          resolve(result.data);
        } catch (error) {
          try {
            const result = await api.post(`${base}/subscription/reconcile-payment`, {razorpay_order_id: order.orderId});
            resolve(result.data);
          } catch { reject(error); }
        }
      },
    });
    checkout.on("payment.failed", event => { failure = new Error(event.error?.description || "Payment failed. You can retry the same checkout."); });
    checkout.open();
  });
}
