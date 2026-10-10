
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  ArrowRight,
  Building2,
  CalendarClock,
  Globe2,
  LoaderCircle,
  LogOut,
  Plus,
} from "lucide-react";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const DAY_MS = 86400000;

function getSubscriptionState(clinic, subscription, now) {
  const isDraft = clinic.status === "draft";
  const isSuspended = clinic.status === "suspended";
  const isArchived = clinic.status === "archived";

  if (isDraft || isSuspended || isArchived) {
    return {
      isDraft,
      isSuspended,
      isArchived,
      expired: false,
      expiringSoon: false,
      daysLeft: null,
    };
  }

  const end = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).getTime()
    : NaN;

  const hasValidEnd = Number.isFinite(end);

  const daysLeft = hasValidEnd
    ? Math.max(0, Math.ceil((end - now) / DAY_MS))
    : null;

  const expired =
    clinic.status === "expired" ||
    (hasValidEnd && end <= now);

  const expiringSoon =
    !expired &&
    subscription?.status === "active" &&
    daysLeft !== null &&
    daysLeft <= 7;

  return {
    isDraft,
    isSuspended,
    isArchived,
    expired,
    expiringSoon,
    daysLeft,
  };
}

export default function MyClinicsPage() {
  const { user, logout } = useAuth();

  const [clinics, setClinics] = useState([]);
  const [subscriptions, setSubscriptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let alive = true;

    async function loadClinics() {
      setLoading(true);
      setError("");

      try {
        const { data } = await api.get(
          "/clinics/my-clinics"
        );

        if (!alive) return;

        const clinicList = data.clinics || [];
        setClinics(clinicList);

        const results = await Promise.all(
          clinicList.map(async (clinic) => {
            if (
              clinic.status === "draft" ||
              clinic.status === "suspended" ||
              clinic.status === "archived"
            ) {
              return [String(clinic.id), null];
            }

            try {
              const response = await api.get(
                `/clinics/${clinic.id}/subscription`
              );

              return [
                String(clinic.id),
                {
                  data: response.data.subscription || null,
                  error: false,
                },
              ];
            } catch {
              return [
                String(clinic.id),
                {
                  data: null,
                  error: true,
                },
              ];
            }
          })
        );

        if (alive) {
          setSubscriptions(Object.fromEntries(results));
          setNow(Date.now());
        }
      } catch (err) {
        if (alive) {
          setError(
            err.response?.data?.message ||
              "Unable to load clinics."
          );
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadClinics();

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setError("");

    try {
      await logout();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Logout failed."
      );
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              My Clinics
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Welcome, {user?.name || "Owner"}.
              Choose a clinic or create a new one.
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            {loggingOut ? (
              <LoaderCircle
                size={17}
                className="animate-spin"
              />
            ) : (
              <LogOut size={17} />
            )}
            Logout
          </button>
        </header>

        {error && (
          <p
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <LoaderCircle
              size={18}
              className="animate-spin"
            />
            Loading your clinics...
          </p>
        ) : (
          <>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Your Clinics
              {clinics.length > 0 && (
                <span className="ml-2 text-slate-400">
                  ({clinics.length})
                </span>
              )}
            </h2>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {clinics.map((clinic) => {
                const clinicId = String(clinic.id);

                const subscriptionResult =
                  subscriptions[clinicId];

                const subscription =
                  subscriptionResult?.data || null;

                const subscriptionFailed =
                  subscriptionResult?.error === true;

                const state = getSubscriptionState(
                  clinic,
                  subscription,
                  now
                );

                const isDraft = state.isDraft;
                const isActive =
                  clinic.status === "active";

                const isExpired = state.expired;
                const expiringSoon = state.expiringSoon;

                const subscriptionKnown =
                  Boolean(subscription) ||
                  clinic.status === "expired";

                const canManage =
                  isActive &&
                  !isExpired &&
                  subscriptionKnown &&
                  !subscriptionFailed;

                const canRenew =
                  (isExpired || expiringSoon) &&
                  !state.isSuspended &&
                  !state.isArchived &&
                  !subscriptionFailed;

                const dashboardUrl =
                  `/dashboard/clinic/${clinicId}`;

                const renewalUrl =
                  `${dashboardUrl}/renew`;

                return (
                  <article
                    key={clinicId}
                    className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="mb-4 flex h-20 items-center justify-center rounded-xl bg-blue-50">
                      {clinic.branding?.logoUrl ? (
                        <img
                          src={clinic.branding.logoUrl}
                          alt={`${clinic.name} logo`}
                          className="max-h-16 max-w-full object-contain"
                        />
                      ) : (
                        <Building2
                          size={36}
                          className="text-blue-600"
                        />
                      )}
                    </div>

                    <h3 className="break-words text-lg font-semibold text-slate-900">
                      {clinic.name}
                    </h3>

                    <p className="mt-1 break-all text-xs text-slate-500">
                      /{clinic.slug}
                    </p>

                    <span
                      className={`mt-3 w-fit rounded-full px-3 py-1 text-xs font-medium ${
                        isExpired
                          ? "bg-red-50 text-red-700"
                          : isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {isExpired
                        ? "Expired"
                        : isActive
                          ? "Published"
                          : isDraft
                            ? "Draft"
                            : clinic.status}
                    </span>

                    {expiringSoon && (
                      <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                        <CalendarClock
                          size={16}
                          className="shrink-0"
                        />
                        <span>
                          Subscription expires in{" "}
                          <strong>
                            {state.daysLeft}{" "}
                            {state.daysLeft === 1
                              ? "day"
                              : "days"}
                          </strong>
                          . Renew to avoid interruption.
                        </span>
                      </div>
                    )}

                    {isExpired && (
                      <p className="mt-4 text-xs leading-5 text-red-600">
                        Your subscription has expired.
                        Renew to restore clinic access.
                      </p>
                    )}

                    {subscriptionFailed && isActive && (
                      <p className="mt-4 text-xs text-amber-700">
                        Unable to verify subscription status.
                        Please refresh the page.
                      </p>
                    )}

                    <div className="mt-auto space-y-2 pt-5">
                      {isDraft && (
                        <Link
                          to={`/clinics/${clinicId}/setup`}
                          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          Continue Setup
                          <ArrowRight size={17} />
                        </Link>
                      )}

                      {canManage && (
                        <Link
                          to={dashboardUrl}
                          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          Manage Clinic
                          <ArrowRight size={17} />
                        </Link>
                      )}

                      {canRenew && (
                        <Link
                          to={renewalUrl}
                          className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white ${
                            isExpired
                              ? "bg-blue-600 hover:bg-blue-700"
                              : "bg-slate-900 hover:bg-slate-800"
                          }`}
                        >
                          Renew Plan
                          <ArrowRight size={17} />
                        </Link>
                      )}
                    </div>
                  </article>
                );
              })}

              <Link
                to="/clinics/new"
                className="flex min-h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-white p-6 text-center transition hover:border-blue-500 hover:bg-blue-50"
              >
                <span className="mb-4 rounded-full bg-blue-50 p-4 text-blue-600">
                  <Plus size={28} />
                </span>

                <span className="text-lg font-semibold text-slate-900">
                  Publish Your Clinic Online
                </span>

                <span className="mt-2 text-sm text-slate-500">
                  Create a professional online presence
                  for your clinic.
                </span>

                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-600">
                  Get Started
                  <ArrowRight size={16} />
                </span>
              </Link>
            </div>

            {clinics.length === 0 && (
              <p className="mt-5 flex items-center gap-2 text-sm text-slate-500">
                <Globe2 size={17} />
                You haven't added a clinic yet.
                Start with the card above.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
