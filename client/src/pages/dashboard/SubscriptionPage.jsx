
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

import api from "../../services/api";

const PLAN_ORDER = ["basic", "starter", "growth", "unlimited"];

const PLAN_INFO = {
  basic: { name: "Basic" }, starter: { name: "Starter" },
  growth: { name: "Growth" }, unlimited: { name: "Unlimited" },
};

const formatMoney = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const formatDate = (value) => {
  if (!value) return "Unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
};

const getError = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  "Something went wrong. Please try again.";

const SCRIPT_URL =
  "https://checkout.razorpay.com/v1/checkout.js";

let razorpayScriptPromise;

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();

  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;

      script.onload = () => {
        if (window.Razorpay) resolve();
        else reject(new Error("Razorpay failed to initialize."));
      };

      script.onerror = () =>
        reject(new Error("Unable to load Razorpay checkout."));

      document.body.appendChild(script);
    }).catch((error) => {
      razorpayScriptPromise = null;
      throw error;
    });
  }

  return razorpayScriptPromise;
}

export default function SubscriptionPage() {
  const { clinicId } = useParams();
  const base = `/clinics/${clinicId}`;

  const [subscription, setSubscription] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [plans, setPlans] = useState({});
  const [clinic, setClinic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingOrderId, setPendingOrderId] = useState("");
  const [billingCycle, setBillingCycle] = useState("yearly");

  const paymentLock = useRef(false);
  const mounted = useRef(false);

  // Persist only the order ID, never payment credentials.
  const storageKey = `clinic-upgrade-order-${clinicId}`;

  const refresh = useCallback(async () => {
    const [clinicRes, subscriptionRes] = await Promise.all([
      api.get(base),
      api.get(`${base}/subscription`),
    ]);

    if (mounted.current) {
      setNow(Date.now());
      setClinic(clinicRes.data.clinic);
      setSubscription(subscriptionRes.data.subscription);
      setPlans(subscriptionRes.data.subscription.plans || {});
      const pending = subscriptionRes.data.subscription.pendingPayment;
      setPendingOrderId(pending?.orderId || "");
    }

    return subscriptionRes.data.subscription;
  }, [base]);

  useEffect(() => {
    mounted.current = true;

    Promise.resolve().then(() => {
      if (!mounted.current) return;
      setLoading(true);
      setError("");
      setPendingOrderId(sessionStorage.getItem(storageKey) || "");
      return refresh();
    })
      .catch((err) => {
        if (mounted.current) setError(getError(err));
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });

    return () => {
      mounted.current = false;
    };
  }, [refresh, storageKey]);

  const start = new Date(
    subscription?.currentPeriodStart || ""
  ).getTime();
  const end = new Date(
    subscription?.currentPeriodEnd || ""
  ).getTime();

  const active =
    subscription?.status === "active" &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start <= now &&
    end > now;

  const expired =
    subscription?.status === "expired" ||
    (Number.isFinite(end) && end <= now);

  const currentRank = PLAN_ORDER.indexOf(subscription?.plan);

  const upgradePlans = PLAN_ORDER.filter(
    (_, index) => index > currentRank
  );

  const rememberOrder = (id) => {
    sessionStorage.setItem(storageKey, id);
    if (mounted.current) setPendingOrderId(id);
  };

  const clearOrder = () => {
    sessionStorage.removeItem(storageKey);
    if (mounted.current) setPendingOrderId("");
  };

  async function reconcilePayment(orderId) {
    if (!orderId || paymentLock.current) return;

    paymentLock.current = true;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const { data } = await api.post(
        `${base}/subscription/reconcile-payment`,
        { razorpay_order_id: orderId }
      );

      if (data?.subscription?.requiresReview) {
        setError(
          "Payment captured, but subscription activation requires support review."
        );
        return;
      }

      if (data?.success && data?.subscription?.status === "active") {
        clearOrder();
        await refresh();
        setSelectedPlan("");
        setNotice("Subscription updated successfully.");
      } else {
        setNotice(
          "Payment confirmation is still pending. Do not make another payment."
        );
      }
    } catch (err) {
      setError(getError(err));
      setNotice(
        "If you already paid, do not pay again. Retry payment verification or contact support."
      );
    } finally {
      paymentLock.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function startUpgrade() {
    if (
      paymentLock.current ||
      !active ||
      !selectedPlan
    ) {
      return;
    }

    paymentLock.current = true;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      // Recheck eligibility before creating a payment order.
      const current = await refresh();

      const currentStart = new Date(
        current?.currentPeriodStart || ""
      ).getTime();
      const currentEnd = new Date(
        current?.currentPeriodEnd || ""
      ).getTime();

      if (
        current?.status !== "active" ||
        !Number.isFinite(currentStart) ||
        currentStart > Date.now() ||
        !Number.isFinite(currentEnd) ||
        currentEnd <= Date.now() ||
        PLAN_ORDER.indexOf(selectedPlan) <=
          PLAN_ORDER.indexOf(current.plan)
      ) {
        throw new Error(
          "Subscription eligibility changed. Refresh and try again."
        );
      }

      await loadRazorpay();

      const { data } = await api.post(
        `${base}/subscription/upgrade-order`,
        { toPlan: selectedPlan, billingCycle }
      );

      const order = data?.order;

      if (
        !order?.orderId ||
        !order?.keyId ||
        !Number.isSafeInteger(order.amount) ||
        order.amount <= 0 ||
        order.currency !== "INR"
      ) {
        throw new Error("Invalid payment order received.");
      }

      rememberOrder(order.orderId);

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: clinic?.name || "Prakash SaaS",
        description: `${selectedPlan} plan upgrade`,
        theme: { color: "#2563eb" },

        handler: async (payment) => {
          if (mounted.current) setBusy(true);

          try {
            const response = await api.post(
              `${base}/subscription/verify-payment`,
              {
                razorpay_order_id: payment.razorpay_order_id,
                razorpay_payment_id: payment.razorpay_payment_id,
                razorpay_signature: payment.razorpay_signature,
              }
            );

            if (
              response.data?.success &&
              response.data?.subscription?.status === "active"
            ) {
              clearOrder();
              await refresh();
              setSelectedPlan("");
              setError("");
              setNotice("Plan upgraded successfully.");
            } else {
              setNotice(
                "Payment requires confirmation. Do not pay again."
              );
            }
          } catch (err) {
            setError(getError(err));
            setNotice(
              "Payment status is uncertain. Use Verify Existing Payment before trying another checkout."
            );
          } finally {
            paymentLock.current = false;
            if (mounted.current) setBusy(false);
          }
        },

        modal: {
          ondismiss: () => {
            paymentLock.current = false;
            if (mounted.current) {
              setBusy(false);
              setNotice(
                "Checkout closed. Verify the existing order before attempting another payment."
              );
            }
          },
        },
      });

      checkout.on("payment.failed", () => {
        paymentLock.current = false;
        if (mounted.current) {
          setBusy(false);
          setError(
            "Payment failed or was interrupted. Check the existing order status before trying again."
          );
        }
      });

      checkout.open();
    } catch (err) {
      paymentLock.current = false;
      if (mounted.current) {
        setBusy(false);
        setError(getError(err));
      }
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
        <LoaderCircle size={20} className="animate-spin" />
        Loading subscription...
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-5 text-red-700 dark:text-red-300">
        {error || "Subscription unavailable."}
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            refresh()
              .catch((err) => setError(getError(err)))
              .finally(() => setLoading(false));
          }}
          className="ml-3 font-semibold underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const currentPlan =
    PLAN_INFO[subscription.plan] || PLAN_INFO.basic;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">
            Subscription
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Manage your clinic subscription and upgrades.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refresh().catch((err) => setError(getError(err)))}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle size={18} className="shrink-0" />
          {error}
        </div>
      )}

      {notice && (
        <div role="status" className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 p-4 text-sm text-blue-800 dark:text-blue-300">
          {notice}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-3 text-blue-600 dark:text-blue-300">
              <CreditCard size={23} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Current Subscription
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Your current billing details
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Current Plan</p>
              <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
                {currentPlan.name}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Status</p>
              <p className={`mt-1 font-bold capitalize ${
                active ? "text-green-600 dark:text-green-300" : "text-amber-600 dark:text-amber-300"
              }`}>
                {expired ? "Expired" : subscription.status}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Billing Cycle</p>
              <p className="mt-1 font-semibold capitalize text-slate-900 dark:text-slate-100">
                {subscription.billingCycle}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Current Price</p>
              <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                {formatMoney(subscription.price)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Valid From</p>
              <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                {formatDate(subscription.currentPeriodStart)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Expires On</p>
              <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                {formatDate(subscription.currentPeriodEnd)}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="font-bold text-slate-900 dark:text-slate-100">
            Booking Allowance
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Included in your current billing period
          </p>

          <p className="mt-6 text-3xl font-bold text-slate-900 dark:text-slate-100">
            {subscription.bookingLimit == null
              ? "Unlimited"
              : subscription.bookingLimit.toLocaleString("en-IN")}
          </p>

          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Booking limit for the current period
          </p>

          <div className="mt-6 flex items-start gap-2 border-t border-slate-100 dark:border-slate-800 pt-5 text-xs text-slate-500 dark:text-slate-400">
            <CalendarClock size={17} className="shrink-0" />
            Quota resets according to your billing period and plan rules.
          </div>
        </section>
      </div>

      {pendingOrderId && (
        <section className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-5">
          <h2 className="font-bold text-amber-900 dark:text-amber-300">
            Existing Payment Order
          </h2>
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
            An earlier checkout exists. Verify it if you paid, or select the same plan and cycle to resume checkout.
            {subscription.pendingPayment && ` Existing order: ${subscription.pendingPayment.plan}, ${subscription.pendingPayment.billingCycle}, ${formatMoney(subscription.pendingPayment.amount / 100)}.`}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => reconcilePayment(pendingOrderId)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy && <LoaderCircle size={17} className="animate-spin" />}
            Verify Existing Payment
          </button>
        </section>
      )}

      {active && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-3 text-blue-600 dark:text-blue-300">
              <ArrowUpRight size={23} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Upgrade Your Plan
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Select a higher plan for your clinic.
                Choose the billing cycle for your new plan.
              </p>
            </div>
          </div>

          {upgradePlans.length === 0 ? (
            <div className="mt-6 flex items-center gap-2 rounded-xl bg-green-50 dark:bg-green-950/40 p-4 text-sm font-medium text-green-700 dark:text-green-300">
              <CheckCircle2 size={19} />
              You are already on the highest plan.
            </div>
          ) : (
            <>
              <div className="mb-6 flex justify-center">
                <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1">
                  {["monthly", "yearly"].map((cycle) => (
                    <button
                      key={cycle}
                      type="button"
                      onClick={() => {
                        setBillingCycle(cycle);
                        setSelectedPlan("");
                      }}
                      disabled={busy}
                      className={`rounded-lg px-6 py-2.5 text-sm font-semibold capitalize transition ${
                        billingCycle === cycle
                          ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 hover:dark:text-slate-100"
                      }`}
                    >
                      {cycle}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upgradePlans.map((planId) => {
                  const plan = PLAN_INFO[planId];
                  const selected = selectedPlan === planId;

                  return (
                    <button
                      key={planId}
                      type="button"
                      disabled={busy}
                      onClick={() => setSelectedPlan(planId)}
                      className={`rounded-2xl border-2 p-5 text-left transition disabled:opacity-60 ${
                        selected
                          ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40"
                          : "border-slate-200 dark:border-slate-700 hover:border-blue-200 hover:dark:border-blue-800"
                      }`}
                    >
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        {plan.name}
                      </p>
                      <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {formatMoney(plans[planId]?.prices?.[billingCycle])}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        / {billingCycle === "yearly" ? "year" : "month"}
                      </p>
                      <p className="mt-4 text-xs text-slate-600 dark:text-slate-300">
                        {plans[planId]?.limits?.[billingCycle] === null
                          ? "Unlimited bookings"
                          : `${plans[planId]?.limits?.[billingCycle] ?? 0} base bookings`}
                      </p>
                      {selected && (
                        <p className="mt-3 text-xs font-semibold text-blue-700 dark:text-blue-300">
                          Selected
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>

              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                Prices come from the server. Upgrade validity starts from the
                verified payment date: 30 days for monthly, 365 days for yearly.
                Remaining bookings carry forward.
              </p>

              <button
                type="button"
                onClick={startUpgrade}
                disabled={!selectedPlan || busy || !plans[selectedPlan]}
                className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <LoaderCircle size={19} className="animate-spin" />
                ) : (
                  <CreditCard size={19} />
                )}
                Continue to Secure Payment
              </button>

              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <ShieldCheck size={17} />
                Payments are securely processed through Razorpay.
              </div>
            </>
          )}
        </section>
      )}

      {!active && (
        <section className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-5 text-sm text-amber-900 dark:text-amber-300">
          Plan upgrades are only available while your subscription
          is active. Expired subscriptions must use the existing
          renewal flow.
        </section>
      )}
    </div>
  );
}
