
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

import api from "../services/api";

const getError = (error) =>
  error.response?.data?.message ||
  error.message ||
  "Something went wrong. Please try again.";

const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const SCRIPT_URL =
  "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }

    let script = document.querySelector(
      `script[src="${SCRIPT_URL}"]`
    );

    if (!script) {
      script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      document.body.appendChild(script);
    }

    script.addEventListener(
      "load",
      () => resolve(),
      { once: true }
    );

    script.addEventListener(
      "error",
      () => reject(new Error("Unable to load Razorpay.")),
      { once: true }
    );

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
  const [recovering, setRecovering] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingOrderId, setPendingOrderId] = useState("");
  const [requiresRecovery, setRequiresRecovery] = useState(false);

  const paymentLock = useRef(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);

      try {
        const [clinicResponse, subscriptionResponse] =
          await Promise.all([
            api.get(base),
            api.get(`${base}/subscription`),
          ]);

        if (!active) return;

        setClinic(clinicResponse.data.clinic);
        setSubscription(
          subscriptionResponse.data.subscription
        );
      } catch (err) {
        if (active) setError(getError(err));
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [base]);

  const isActive = subscription?.status === "active";

  const canPay =
    clinic?.status === "draft" &&
    subscription?.status === "pending";

  const busy = saving || paying || recovering;

  async function refreshSubscription() {
    const { data } = await api.get(
      `${base}/subscription`
    );

    setSubscription(data.subscription);
    return data.subscription;
  }

  async function selectCycle(billingCycle) {
    if (
      busy ||
      !canPay ||
      pendingOrderId ||
      subscription.billingCycle === billingCycle
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const { data } = await api.patch(
        `${base}/subscription/billing-cycle`,
        { billingCycle }
      );

      setSubscription(data.subscription);
      setNotice("Billing cycle updated successfully.");
    } catch (err) {
      setError(getError(err));
    } finally {
      setSaving(false);
    }
  }

  async function recoverPayment() {
    if (!pendingOrderId || busy) return;

    setRecovering(true);
    setError("");
    setNotice("");

    try {
      const { data } = await api.post(
        `${base}/subscription/reconcile-payment`,
        {
          razorpay_order_id: pendingOrderId,
        }
      );

      if (
        data.success !== true ||
        data.subscription?.status !== "active"
      ) {
        throw new Error(
          "Subscription activation was not confirmed."
        );
      }

      await refreshSubscription();

      setRequiresRecovery(false);
      setPendingOrderId("");

      navigate(`${base}/review`, {
        replace: true,
      });
    } catch (err) {
      setRequiresRecovery(true);

      setError(
        "We could not confirm a captured payment yet. " +
        "If money was deducted, do not pay again. " +
        "Keep your order reference and contact support " +
        "if the issue continues. " +
        getError(err)
      );
    } finally {
      setRecovering(false);
    }
  }

  async function startPayment() {
    if (
      paymentLock.current ||
      busy ||
      !canPay ||
      requiresRecovery
    ) {
      return;
    }

    paymentLock.current = true;
    setPaying(true);
    setError("");
    setNotice("");

    let checkoutOpened = false;

    try {
      await loadRazorpayScript();

      const { data } = await api.post(
        `${base}/subscription/payment-order`
      );

      const order = data.order;

      if (
        !order?.orderId ||
        !order?.keyId ||
        !Number.isSafeInteger(order.amount) ||
        order.amount <= 0 ||
        order.currency !== "INR"
      ) {
        throw new Error(
          "Invalid payment order received from server."
        );
      }

      setPendingOrderId(order.orderId);

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,

        name: clinic?.name || "Clinic Subscription",

        description: `Basic Plan — ${
          subscription.billingCycle === "yearly"
            ? "Yearly"
            : "Monthly"
        }`,

        theme: {
          color: "#2563EB",
        },

        modal: {
          confirm_close: true,

          ondismiss: () => {
            if (paymentLock.current) {
              paymentLock.current = false;
              setPaying(false);

              setNotice(
                "Checkout closed. If you completed a " +
                "payment, check its status before retrying."
              );
            }
          },
        },

        handler: async (response) => {
          try {
            const verification = await api.post(
              `${base}/subscription/verify-payment`,
              {
                razorpay_order_id:
                  response.razorpay_order_id,
                razorpay_payment_id:
                  response.razorpay_payment_id,
                razorpay_signature:
                  response.razorpay_signature,
              }
            );

            if (
              verification.data.success !== true ||
              verification.data.subscription?.status !==
                "active"
            ) {
              throw new Error(
                "Payment verification did not confirm activation."
              );
            }

            setRequiresRecovery(false);
            setPendingOrderId("");

            navigate(`${base}/review`, {
              replace: true,
            });
          } catch (err) {
            setRequiresRecovery(true);

            setError(
              "Payment may have been captured, but " +
              "subscription activation is not confirmed. " +
              "Do not pay again. Use Check Payment Status. " +
              getError(err)
            );
          } finally {
            paymentLock.current = false;
            setPaying(false);
          }
        },
      });

      checkout.on("payment.failed", (response) => {
        setRequiresRecovery(true);

        setError(
          (response.error?.description ||
            "Payment could not be completed.") +
            " Check the payment status before retrying."
        );
      });

      checkout.open();
      checkoutOpened = true;
    } catch (err) {
      setError(getError(err));
    } finally {
      if (!checkoutOpened) {
        paymentLock.current = false;
        setPaying(false);
      }
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center gap-3 text-slate-600">
        <LoaderCircle
          size={20}
          className="animate-spin"
        />
        Loading subscription...
      </main>
    );
  }

  if (!clinic || !subscription) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-5 text-red-700"
        >
          {error || "Subscription could not be loaded."}
        </p>
      </main>
    );
  }

  const yearly = subscription.billingCycle === "yearly";

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <Link
          to={`${base}/website/setup`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600"
        >
          <ArrowLeft size={17} />
          Back to Website Preview
        </Link>

        <div className="mt-7">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
            Step 5 of 6
          </p>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-5/6 rounded-full bg-blue-600" />
          </div>

          <h1 className="mt-6 text-3xl font-extrabold text-slate-900">
            Choose Your Billing Cycle
          </h1>

          <p className="mt-2 text-slate-600">
            Activate the Basic subscription for{" "}
            <strong>{clinic.name}</strong>.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800"
          >
            {notice}
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                <CreditCard size={23} />
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Basic Plan
                </h2>

                <p className="text-sm text-slate-500">
                  One plan, flexible billing
                </p>
              </div>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {["monthly", "yearly"].map((cycle) => {
                const selected =
                  subscription.billingCycle === cycle;

                return (
                  <button
                    key={cycle}
                    type="button"
                    disabled={
                      !canPay ||
                      busy ||
                      Boolean(pendingOrderId)
                    }
                    onClick={() => selectCycle(cycle)}
                    aria-pressed={selected}
                    className={`rounded-2xl border-2 p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      selected
                        ? "border-blue-600 bg-blue-50"
                        : "border-slate-200 hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold capitalize">
                        {cycle}
                      </span>

                      {selected && (
                        <Check
                          size={19}
                          className="text-blue-600"
                        />
                      )}
                    </div>

                    <p className="mt-2 text-xs text-slate-500">
                      {cycle === "monthly"
                        ? "30-day subscription period"
                        : "365-day subscription period"}
                    </p>
                  </button>
                );
              })}
            </div>

            {saving && (
              <p className="mt-4 flex items-center gap-2 text-sm text-blue-600">
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                />
                Updating billing cycle...
              </p>
            )}

            <div className="mt-8 border-t border-slate-100 pt-6">
              <h3 className="font-bold text-slate-900">
                What's included
              </h3>

              <div className="mt-4 space-y-4">
                {[
                  "Public clinic website",
                  "Clinic and doctor profiles",
                  "Services and consultation details",
                  "Clinic contact and location information",
                ].map((feature) => (
                  <div
                    key={feature}
                    className="flex items-start gap-3 text-sm text-slate-700"
                  >
                    <Check
                      size={18}
                      className="shrink-0 text-blue-600"
                    />
                    {feature}
                  </div>
                ))}
              </div>

              <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                Online appointment bookings are not
                included in the Basic plan.
              </p>
            </div>
          </section>

          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-lg font-bold text-slate-900">
              Order Summary
            </h2>

            <div className="mt-6 flex justify-between gap-4 text-sm">
              <span className="text-slate-600">
                Basic · {yearly ? "Yearly" : "Monthly"}
              </span>

              <span className="font-semibold">
                {money(subscription.price)}
              </span>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold">
                  Total payable
                </span>

                <span className="text-2xl font-extrabold">
                  {money(subscription.price)}
                </span>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                The final payment amount is confirmed
                by your backend before checkout.
              </p>
            </div>

            {isActive ? (
              <button
                type="button"
                onClick={() => navigate(`${base}/review`)}
                className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white"
              >
                Continue to Review
                <ArrowRight size={18} />
              </button>
            ) : (
              <button
                type="button"
                disabled={
                  !canPay ||
                  busy ||
                  requiresRecovery ||
                  !Number.isFinite(subscription.price) ||
                  subscription.price <= 0
                }
                onClick={startPayment}
                className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {paying ? (
                  <>
                    <LoaderCircle
                      size={18}
                      className="animate-spin"
                    />
                    Processing...
                  </>
                ) : (
                  <>
                    <LockKeyhole size={18} />
                    Pay Securely
                  </>
                )}
              </button>
            )}

            {pendingOrderId && !isActive && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 text-amber-900">
                  <AlertTriangle size={18} />

                  <p className="text-sm font-semibold">
                    Payment Status
                  </p>
                </div>

                <p className="mt-2 break-all text-xs text-amber-800">
                  Order: {pendingOrderId}
                </p>

                <p className="mt-2 text-xs leading-5 text-amber-800">
                  If money was deducted but your
                  subscription is still pending, check
                  the order status before trying again.
                </p>

                <button
                  type="button"
                  disabled={busy}
                  onClick={recoverPayment}
                  className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-900 disabled:opacity-50"
                >
                  {recovering ? (
                    <LoaderCircle
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <RefreshCw size={16} />
                  )}

                  Check Payment Status
                </button>
              </div>
            )}

            <div className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-500">
              <ShieldCheck
                size={18}
                className="shrink-0"
              />

              Payment is processed by Razorpay.
              Subscription activation requires
              server-side verification.
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
