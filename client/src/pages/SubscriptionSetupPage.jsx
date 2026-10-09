import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Check, CreditCard, LoaderCircle,
  LockKeyhole, ShieldCheck, AlertTriangle,
} from "lucide-react";
import api from "../services/api";

const getError = (error) => error?.response?.data?.message || error?.message || "Something went wrong. Please try again.";
const money = (amount) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
}).format(amount);

const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    let script = document.querySelector(`script[src="${RAZORPAY_SCRIPT}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = RAZORPAY_SCRIPT;
      script.async = true;
      document.body.appendChild(script);
    }
    const onLoad = () => window.Razorpay ? resolve() : reject(new Error("Razorpay failed to initialize."));
    const onError = () => reject(new Error("Unable to load Razorpay."));
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (window.Razorpay) resolve();
  });
}

export default function SubscriptionSetupPage() {
  const { clinicId } = useParams();
  const navigate = useNavigate();
  const base = `/clinics/${clinicId}`;
  const [clinic, setClinic] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [checking, setChecking] = useState(false);
  const [needsResolution, setNeedsResolution] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const paymentLock = useRef(false);
  const mounted = useRef(true);
  const checkLock = useRef(false);

  const refreshSubscription = useCallback(async () => {
    const { data } = await api.get(`${base}/subscription`);
    if (mounted.current) setSubscription(data.subscription);
    return data.subscription;
  }, [base]);

  // Reconciliation verifies the order directly with Razorpay on the server.
  // A 409 can mean no captured payment YET; never treat it as proof of failure.
  const reconcile = useCallback(async (id) => {
    const { data } = await api.post(`${base}/subscription/reconcile-payment`, {
      razorpay_order_id: id,
    });
    return data?.success === true && data?.subscription?.status === "active";
  }, [base]);

  const checkExistingPayment = useCallback(async () => {
    if (checkLock.current) return;
    checkLock.current = true;
    if (mounted.current) setChecking(true);
    try {
      const current = await refreshSubscription();
      if (current?.status === "active") {
        if (mounted.current) navigate(`${base}/review`, { replace: true });
        return;
      }
      const { data } = await api.get(`${base}/subscription/pending-payment`);
      if (!mounted.current) return;
      const payment = data?.payment;
      if (!payment?.orderId) {
        setOrderId("");
        setNeedsResolution(false);
        setNotice("");
        return;
      }
      setOrderId(payment.orderId);
      if (payment.orderStatus === "created") {
        // Razorpay has no recorded attempt; the server may reuse this order.
        setNeedsResolution(false);
        setNotice("An earlier checkout was found. You can continue using the same order.");
        return;
      }
      setNeedsResolution(true);
      setNotice("We're confirming your earlier payment automatically. Please don't pay again.");
      try {
        if (await reconcile(payment.orderId)) {
          if (mounted.current) navigate(`${base}/review`, { replace: true });
        }
      } catch (err) {
        if (mounted.current) setNotice("Payment confirmation is still pending. Please wait; do not make another payment.");
      }
    } catch (err) {
      if (mounted.current) {
        setNeedsResolution(true); // Fail closed if payment history cannot be checked.
        setError(`Unable to safely confirm payment status. ${getError(err)}`);
      }
    } finally {
      checkLock.current = false;
      if (mounted.current) setChecking(false);
    }
  }, [base, navigate, reconcile, refreshSubscription]);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    (async () => {
      try {
        const [clinicResponse, subscriptionResponse] = await Promise.all([
          api.get(base), api.get(`${base}/subscription`),
        ]);
        if (cancelled) return;
        setClinic(clinicResponse.data.clinic);
        setSubscription(subscriptionResponse.data.subscription);
        if (subscriptionResponse.data.subscription?.status === "pending") {
          await checkExistingPayment();
        }
      } catch (err) {
        if (!cancelled) setError(getError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; mounted.current = false; };
  }, [base, checkExistingPayment]);

  // Background retry while the page remains open. The webhook must also work
  // independently when the browser is closed.
  useEffect(() => {
    if (!needsResolution || subscription?.status === "active") return;
    const timer = window.setInterval(() => { void checkExistingPayment(); }, 12000);
    return () => window.clearInterval(timer);
  }, [needsResolution, subscription?.status, checkExistingPayment]);

  const isActive = subscription?.status === "active";
  const canPay = clinic?.status === "draft" && subscription?.status === "pending";
  const busy = saving || paying || checking;

  async function selectCycle(billingCycle) {
    if (busy || needsResolution || orderId || !canPay || subscription.billingCycle === billingCycle) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const { data } = await api.patch(`${base}/subscription/billing-cycle`, { billingCycle });
      setSubscription(data.subscription);
      setNotice("Billing cycle updated successfully.");
    } catch (err) { setError(getError(err)); }
    finally { setSaving(false); }
  }

  async function startPayment() {
    if (paymentLock.current || busy || needsResolution || !canPay) return;
    paymentLock.current = true;
    setPaying(true); setError(""); setNotice("");
    let checkoutOpened = false;
    try {
      // Recheck server state immediately before opening a new checkout.
      const current = await refreshSubscription();
      if (current?.status !== "pending") {
        if (current?.status === "active") navigate(`${base}/review`, { replace: true });
        return;
      }
      const pending = await api.get(`${base}/subscription/pending-payment`);
      if (pending.data?.payment?.orderStatus === "attempted" || pending.data?.payment?.orderStatus === "paid") {
        setNeedsResolution(true);
        setOrderId(pending.data.payment.orderId);
        setNotice("Your earlier payment is being confirmed automatically. Do not pay again.");
        return;
      }
      await loadRazorpayScript();
      const { data } = await api.post(`${base}/subscription/payment-order`);
      const order = data.order;
      if (!order?.orderId || !order?.keyId || !Number.isSafeInteger(order.amount) || order.amount <= 0 || order.currency !== "INR") {
        throw new Error("Invalid payment order received from server.");
      }
      setOrderId(order.orderId);
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: clinic?.name || "Clinic Subscription",
        description: `Basic Plan — ${current.billingCycle === "yearly" ? "Yearly" : "Monthly"}`,
        theme: { color: "#2563EB" },
        modal: {
          confirm_close: true,
          ondismiss: () => {
            paymentLock.current = false;
            setPaying(false);
            void checkExistingPayment();
          },
        },
        handler: async (response) => {
          setChecking(true);
          setNotice("Confirming your payment securely...");
          try {
            const verification = await api.post(`${base}/subscription/verify-payment`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            if (verification.data?.success !== true || verification.data?.subscription?.status !== "active") {
              throw new Error("Payment activation has not been confirmed.");
            }
            navigate(`${base}/review`, { replace: true });
          } catch (err) {
            setNeedsResolution(true);
            setNotice("Payment received or attempted. We're verifying its status automatically. Do not pay again.");
            try {
              if (await reconcile(order.orderId)) navigate(`${base}/review`, { replace: true });
            } catch (_) {
              // Background checks and webhook will continue; never charge again automatically.
            }
          } finally {
            paymentLock.current = false;
            if (mounted.current) { setPaying(false); setChecking(false); }
          }
        },
      });
      checkout.on("payment.failed", () => {
        setNeedsResolution(true);
        setNotice("The payment attempt wasn't completed. We're checking its final status automatically.");
        void checkExistingPayment();
      });
      checkout.open();
      checkoutOpened = true;
    } catch (err) {
      setError(getError(err));
    } finally {
      if (!checkoutOpened) { paymentLock.current = false; setPaying(false); }
    }
  }

  if (loading) return (
    <main className="flex min-h-dvh items-center justify-center gap-3 text-slate-600">
      <LoaderCircle size={20} className="animate-spin" /> Loading subscription...
    </main>
  );
  if (!clinic || !subscription) return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <p role="alert" className="rounded-xl bg-red-50 p-5 text-red-700">{error || "Subscription could not be loaded."}</p>
    </main>
  );

  const yearly = subscription.billingCycle === "yearly";
  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <Link to={`${base}/website/setup`} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600">
          <ArrowLeft size={17} /> Back to Website Preview
        </Link>
        <div className="mt-7">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Step 5 of 6</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full w-5/6 rounded-full bg-blue-600" /></div>
          <h1 className="mt-6 text-3xl font-extrabold text-slate-900">Choose Your Billing Cycle</h1>
          <p className="mt-2 text-slate-600">Activate the Basic subscription for <strong>{clinic.name}</strong>.</p>
        </div>
        {error && <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {notice && <div role="status" className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{notice}</div>}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-600"><CreditCard size={23} /></div>
              <div><h2 className="text-xl font-bold">Basic Plan</h2><p className="text-sm text-slate-500">One plan, flexible billing</p></div>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {["monthly", "yearly"].map((cycle) => {
                const selected = subscription.billingCycle === cycle;
                return (
                  <button key={cycle} type="button" disabled={!canPay || busy || Boolean(orderId) || needsResolution}
                    onClick={() => selectCycle(cycle)} aria-pressed={selected}
                    className={`rounded-2xl border-2 p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${selected ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:border-blue-300"}`}>
                    <div className="flex items-center justify-between"><span className="font-bold capitalize">{cycle}</span>{selected && <Check size={19} className="text-blue-600" />}</div>
                    <p className="mt-2 text-xs text-slate-500">{cycle === "monthly" ? "30-day subscription period" : "365-day subscription period"}</p>
                  </button>
                );
              })}
            </div>
            {saving && <p className="mt-4 flex items-center gap-2 text-sm text-blue-600"><LoaderCircle size={16} className="animate-spin" /> Updating billing cycle...</p>}
            <div className="mt-8 border-t border-slate-100 pt-6">
              <h3 className="font-bold text-slate-900">What's included</h3>
              <div className="mt-4 space-y-4">
                {["Public clinic website", "Clinic and doctor profiles", "Services and consultation details", "Clinic contact and location information"].map((feature) => (
                  <div key={feature} className="flex items-start gap-3 text-sm text-slate-700"><Check size={18} className="shrink-0 text-blue-600" />{feature}</div>
                ))}
              </div>
              <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Online appointment bookings are not included in the Basic plan.</p>
            </div>
          </section>
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-lg font-bold">Order Summary</h2>
            <div className="mt-6 flex justify-between gap-4 text-sm"><span className="text-slate-600">Basic · {yearly ? "Yearly" : "Monthly"}</span><span className="font-semibold">{money(subscription.price)}</span></div>
            <div className="mt-6 border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between gap-4"><span className="font-semibold">Total payable</span><span className="text-2xl font-extrabold">{money(subscription.price)}</span></div>
              <p className="mt-2 text-xs text-slate-500">Amount confirmed by your server before Razorpay Checkout.</p>
            </div>
            {isActive ? (
              <button type="button" onClick={() => navigate(`${base}/review`)} className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white">Continue to Review <ArrowRight size={18} /></button>
            ) : (
              <button type="button" disabled={!canPay || busy || needsResolution || !Number.isFinite(subscription.price) || subscription.price <= 0}
                onClick={startPayment} className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? <><LoaderCircle size={18} className="animate-spin" />{checking ? "Confirming payment..." : "Processing..."}</> : <><LockKeyhole size={18} /> Pay Securely</>}
              </button>
            )}
            {needsResolution && !isActive && (
              <div role="status" className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {checking ? <LoaderCircle size={18} className="shrink-0 animate-spin" /> : <AlertTriangle size={18} className="shrink-0" />}
                <div><strong>Payment confirmation pending</strong><p className="mt-1">We're checking automatically. Please don't start another payment. If this persists, contact support.</p></div>
              </div>
            )}
            <div className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck size={18} className="shrink-0" />Payment is processed by Razorpay. Subscription activation requires server-side verification.</div>
          </aside>
        </div>
      </div>
    </main>
  );
}
