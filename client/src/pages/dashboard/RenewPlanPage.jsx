
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import api from "../../services/api";

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
    maximumFractionDigits: 0,
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
  const [now, setNow] = useState(Date.now());

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
        setCycle(
          current?.billingCycle === "yearly"
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
  }, [clinicId]);

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

  const canRenew =
    expired ||
    (subscription?.status === "active" &&
      remaining !== null &&
      remaining <= 7);

  const durationDays = cycle === "yearly" ? 365 : 30;

  // The renewal backend will supply the actual price.
  // priceSnapshot is only the previously stored price.
  const currentPrice =
    formatMoney(subscription?.price);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-3 text-slate-500">
        <LoaderCircle size={20} className="animate-spin" />
        Loading renewal details...
      </div>
    );
  }

  if (error || !clinic || !subscription) {
    return (
      <div className="space-y-4">
        <Link
          to={base}
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600"
        >
          <ArrowLeft size={17} />
          Back to Dashboard
        </Link>

        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
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
        className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600"
      >
        <ArrowLeft size={17} />
        Back to Website Management
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          Renew Subscription
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Renew the existing plan for {clinic.name}.
        </p>
      </div>

      {!canRenew && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <CalendarDays
            size={20}
            className="shrink-0 text-blue-600"
          />
          <div>
            <p className="font-semibold text-blue-900">
              Your subscription is still active
            </p>
            <p className="mt-1 text-sm text-blue-800">
              Renewal becomes available during the final
              7 days of your subscription.
            </p>
          </div>
        </div>
      )}

      {expired && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle
            size={20}
            className="shrink-0 text-red-600"
          />
          <div>
            <p className="font-semibold text-red-800">
              Subscription expired
            </p>
            <p className="mt-1 text-sm text-red-700">
              Your clinic website requires renewal
              before it can be reactivated.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <CreditCard size={23} />
            </div>
            <div>
              <h2 className="text-xl font-bold capitalize text-slate-900">
                {subscription.plan} Plan
              </h2>
              <p className="text-sm text-slate-500">
                Continue with your existing plan
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
                  disabled={!canRenew}
                  aria-pressed={selected}
                  onClick={() => setCycle(option)}
                  className={`rounded-2xl border-2 p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    selected
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 hover:border-blue-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold capitalize text-slate-900">
                      {option}
                    </span>
                    {selected && (
                      <Check
                        size={19}
                        className="text-blue-600"
                      />
                    )}
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    {option === "monthly"
                      ? "30-day subscription period"
                      : "365-day subscription period"}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-7 border-t border-slate-100 pt-6">
            <h3 className="font-bold text-slate-900">
              Renewal Details
            </h3>

            <div className="mt-4 space-y-4 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">
                  Current Plan
                </span>
                <span className="font-semibold capitalize">
                  {subscription.plan}
                </span>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-slate-500">
                  Current Expiry
                </span>
                <span className="font-semibold">
                  {formatDate(subscription.currentPeriodEnd)}
                </span>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-slate-500">
                  Renewal Duration
                </span>
                <span className="font-semibold">
                  {durationDays} days
                </span>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-slate-500">
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

            <p className="mt-6 rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">
              If you renew before expiry, your unused
              subscription days will be preserved.
              The backend will calculate the new expiry
              date after verified payment.
            </p>
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-bold text-slate-900">
            Renewal Summary
          </h2>

          <div className="mt-6 space-y-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">
                Plan
              </span>
              <span className="font-semibold capitalize">
                {subscription.plan}
              </span>
            </div>

            <div className="flex justify-between gap-3">
              <span className="text-slate-500">
                Billing Cycle
              </span>
              <span className="font-semibold capitalize">
                {cycle}
              </span>
            </div>

            <div className="flex justify-between gap-3">
              <span className="text-slate-500">
                Previous Stored Price
              </span>
              <span className="font-semibold">
                {currentPrice || "Unavailable"}
              </span>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <p className="text-sm text-slate-500">
              Total Payable
            </p>
            <p className="mt-2 text-2xl font-extrabold text-slate-900">
              Calculated at checkout
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Final pricing must come from the backend
              for the selected plan and billing cycle.
            </p>
          </div>

          <button
            type="button"
            disabled
            className="mt-7 flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white opacity-50"
          >
            <LockKeyhole size={18} />
            Continue to Payment
          </button>

          <p className="mt-3 text-center text-xs text-slate-500">
            Secure renewal checkout is being prepared.
          </p>

          <div className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-500">
            <ShieldCheck
              size={18}
              className="shrink-0"
            />
            Payment will be processed securely through
            Razorpay after backend renewal support is ready.
          </div>
        </aside>
      </div>
    </div>
  );
}
