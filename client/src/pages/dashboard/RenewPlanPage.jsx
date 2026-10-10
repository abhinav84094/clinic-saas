
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  CreditCard,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";

import api from "../../services/api";
import { openSubscriptionCheckout } from "../../services/subscriptionCheckout";

const DAY_MS = 86400000;

const formatDate = (value) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatMoney = (amount) => {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return null;
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

const getDaysLeft = (value, now) => {
  if (!value) return null;

  const end = new Date(value).getTime();
  if (!Number.isFinite(end)) return null;

  return Math.max(0, Math.ceil((end - now) / DAY_MS));
};

export default function RenewPlanPage() {
  const { clinicId } = useParams();

  const [clinic, setClinic] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [cycle, setCycle] = useState("monthly");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState(null);
  const busy = useRef(false);
  const [now, setNow] = useState(() => Date.now());

  const base = `/dashboard/clinic/${clinicId}`;
  const apiBase = `/clinics/${clinicId}`;

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [clinicResponse, subscriptionResponse] =
          await Promise.all([
            api.get(apiBase),
            api.get(`${apiBase}/subscription`),
          ]);

        if (!active) return;

        setClinic(clinicResponse.data.clinic);

        const current =
          subscriptionResponse.data.subscription;

        setSubscription(current);
        const status = await api.get(`${apiBase}/subscription/pending-payment?purpose=renewal`);
        if (!active) return;
        setRecovery(status.data);
        setCycle(
          (status.data.payment?.billingCycle || current?.billingCycle) === "yearly"
            ? "yearly"
            : "monthly"
        );
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.message ||
              "Unable to load renewal details."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [clinicId, apiBase]);

  const [paying, setPaying] = useState(false);
  const [notice, setNotice] = useState("");
  async function refreshPayment() {
    const [status, current] = await Promise.all([
      api.get(`${apiBase}/subscription/pending-payment?purpose=renewal`),
      api.get(`${apiBase}/subscription`),
    ]);
    setRecovery(status.data);
    setSubscription(current.data.subscription);
    if (status.data.payment?.purpose === "renewal") setCycle(status.data.payment.billingCycle);
    return current.data.subscription;
  }

  async function paymentAction(action) {
    if (busy.current) return;
    busy.current = true;
    setPaying(true);
    setError("");
    try {
      if (action === "refresh") {
        await refreshPayment();
        return;
      }
      const result = action === "verify"
        ? (await api.post(`${apiBase}/subscription/reconcile-payment`, {
            razorpay_order_id: recovery.payment.orderId,
          })).data
        : await openSubscriptionCheckout(apiBase, "renewal", { billingCycle: cycle }, {
            onOrder: order => setRecovery({ payment: { ...order, billingCycle: cycle, purpose: "renewal", orderStatus: "created" } }),
          });
      if (!result.success || result.subscription?.status !== "active") throw new Error("Payment requires support review");
      await refreshPayment();
      setNotice("Subscription renewed successfully.");
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      try { await refreshPayment(); }
      catch { setRecovery(previous => ({ ...previous, processing: true })); }
    } finally {
      busy.current = false;
      setPaying(false);
    }
  }

  const remaining = getDaysLeft(
    subscription?.currentPeriodEnd,
    now
  );

  const expiry = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).getTime()
    : NaN;

  const expired =
    clinic?.status === "expired" ||
    (Number.isFinite(expiry) && expiry <= now);

  const canRenew = expired;

  const durationDays = cycle === "yearly" ? 365 : 30;

  // The renewal backend will supply the actual price.
  // priceSnapshot is only the previously stored price.
  const currentPrice =
    formatMoney(subscription?.price);
  const configuredPrice = subscription?.plans?.basic?.prices?.[cycle];
  const existingQuote = recovery?.payment;
  const quotedPrice = existingQuote?.purpose === "renewal" && existingQuote.billingCycle === cycle &&
    (!existingQuote.expired || existingQuote.amount === Math.round(configuredPrice * 100))
    ? existingQuote.amount / 100 : configuredPrice;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
        <LoaderCircle size={20} className="animate-spin" />
        Loading renewal details...
      </div>
    );
  }

  if (!clinic || !subscription) {
    return (
      <div className="space-y-4">
        <Link
          to={base}
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-300"
        >
          <ArrowLeft size={17} />
          Back to Dashboard
        </Link>

        <div
          role="alert"
          className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-5 text-sm text-red-700 dark:text-red-300"
        >
          {error || "Renewal details are unavailable."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to={`${base}/website`}
        className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-300"
      >
        <ArrowLeft size={17} />
        Back to Website Management
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">
          Renew Subscription
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Renew {clinic.name} with the Basic plan.
        </p>
      </div>

      {!canRenew && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 p-4">
          <CalendarDays
            size={20}
            className="shrink-0 text-blue-600 dark:text-blue-300"
          />
          <div>
            <p className="font-semibold text-blue-900 dark:text-blue-300">
              Your subscription is still active
            </p>
            <p className="mt-1 text-sm text-blue-800 dark:text-blue-300">
              Renewal becomes available after your subscription expires.
            </p>
          </div>
        </div>
      )}

      {expired && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-4">
          <AlertTriangle
            size={20}
            className="shrink-0 text-red-600 dark:text-red-300"
          />
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300">
              Subscription expired
            </p>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">
              Your clinic website requires renewal
              before it can be reactivated.
            </p>
          </div>
        </div>
      )}

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
      {(recovery?.processing || recovery?.requiresReview || recovery?.payment) && (
        <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-800 dark:bg-blue-950/40">
          <p>{recovery.requiresReview ? "A payment needs support review. Please contact support before paying again." : recovery.processing ? "Payment confirmation is being recovered. Refresh its status before paying again." : `Existing ${recovery.payment.purpose} order: ${recovery.payment.orderId} (${formatMoney(recovery.payment.amount / 100)}). Check it before starting another payment.`}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={paying} onClick={() => paymentAction("refresh")} className="rounded-lg border px-4 py-2 disabled:opacity-50">Refresh Payment Status</button>
            {recovery.payment && !recovery.requiresReview && <button type="button" disabled={paying} onClick={() => paymentAction("verify")} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">Verify Existing Payment</button>}
          </div>
        </div>
      )}
      {!recovery && <button type="button" disabled={paying} onClick={() => paymentAction("refresh")} className="rounded-lg border px-4 py-2">Retry Payment Status</button>}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-3 text-blue-600 dark:text-blue-300">
              <CreditCard size={23} />
            </div>
            <div>
              <h2 className="text-xl font-bold capitalize text-slate-900 dark:text-slate-100">
                Basic Renewal Plan
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Start a new Basic subscription after expiry
              </p>
            </div>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            {["monthly", "yearly"].map((option) => {
              const selected = cycle === option;

              return (
                <button
                  key={option}
                  type="button"
                  disabled={!canRenew || paying || recovery?.processing || recovery?.requiresReview}
                  aria-pressed={selected}
                  onClick={() => setCycle(option)}
                  className={`rounded-2xl border-2 p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    selected
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40"
                      : "border-slate-200 dark:border-slate-700 hover:border-blue-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold capitalize text-slate-900 dark:text-slate-100">
                      {option}
                    </span>
                    {selected && (
                      <Check
                        size={19}
                        className="text-blue-600 dark:text-blue-300"
                      />
                    )}
                  </div>

                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {option === "monthly"
                      ? "30-day subscription period"
                      : "365-day subscription period"}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-7 border-t border-slate-100 dark:border-slate-800 pt-6">
            <h3 className="font-bold text-slate-900 dark:text-slate-100">
              Renewal Details
            </h3>

            <div className="mt-4 space-y-4 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500 dark:text-slate-400">
                  Current Plan
                </span>
                <span className="font-semibold capitalize">
                  {subscription.plan}
                </span>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-slate-500 dark:text-slate-400">
                  Current Expiry
                </span>
                <span className="font-semibold">
                  {formatDate(subscription.currentPeriodEnd)}
                </span>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-slate-500 dark:text-slate-400">
                  Renewal Duration
                </span>
                <span className="font-semibold">
                  {durationDays} days
                </span>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-slate-500 dark:text-slate-400">
                  Days Remaining
                </span>
                <span className="font-semibold">
                  {expired
                    ? "Expired"
                    : remaining === null
                      ? "Unavailable"
                      : `${remaining} days`}
                </span>
              </div>
            </div>

            <p className="mt-6 rounded-xl bg-blue-50 dark:bg-blue-950/40 p-4 text-sm leading-6 text-blue-900 dark:text-blue-300">
              Renewal is available after expiry and starts a new Basic
              subscription period after verified payment.
            </p>
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Renewal Summary
          </h2>

          <div className="mt-6 space-y-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500 dark:text-slate-400">
                Plan
              </span>
              <span className="font-semibold capitalize">
                Basic
              </span>
            </div>

            <div className="flex justify-between gap-3">
              <span className="text-slate-500 dark:text-slate-400">
                Billing Cycle
              </span>
              <span className="font-semibold capitalize">
                {cycle}
              </span>
            </div>

            <div className="flex justify-between gap-3">
              <span className="text-slate-500 dark:text-slate-400">
                Previous Stored Price
              </span>
              <span className="font-semibold">
                {currentPrice || "Unavailable"}
              </span>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-5">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Total Payable
            </p>
            <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {formatMoney(quotedPrice) || "Calculated at checkout"}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Your quote keeps its price for one hour. If an older
              quote's price changed, checkout refreshes it before payment.
            </p>
          </div>

          <button
            type="button"
            disabled={!expired || paying || !recovery || recovery.processing || recovery.requiresReview || (recovery.payment && recovery.payment.orderStatus !== "created")}
            onClick={() => paymentAction("checkout")}
            className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white disabled:opacity-50"
          >
            {paying ? <LoaderCircle size={18} className="animate-spin" /> : <CreditCard size={18} />}
            {recovery?.payment?.purpose === "renewal" && recovery.payment.orderStatus === "created" ? "Resume / Update Checkout" : "Continue to Payment"}
          </button>

          <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
            {notice || "Renewal is available after the subscription expires."}
          </p>

          <div className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
            <ShieldCheck
              size={18}
              className="shrink-0"
            />
            Payment will be processed securely through
            Razorpay.
          </div>
        </aside>
      </div>
    </div>
  );
}
