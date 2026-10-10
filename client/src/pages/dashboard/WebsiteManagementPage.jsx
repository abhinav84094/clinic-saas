
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Globe2,
  LoaderCircle,
  Monitor,
  RefreshCw,
  Smartphone,
} from "lucide-react";

import api from "../../services/api";
import ClinicWebsiteTemplate from "../../components/clinic/ClinicWebsiteTemplate";
import { getClinicPublicUrl } from "../../utils/clinicDomain";

const idOf = (value) =>
  String(value?._id || value?.id || value || "");

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

const daysRemaining = (endDate, now) => {
  if (!endDate) return null;

  const end = new Date(endDate).getTime();
  if (!Number.isFinite(end)) return null;

  return Math.max(
    0,
    Math.ceil((end - now) / 86400000)
  );
};

export default function WebsiteManagementPage() {
  const { clinicId } = useParams();

  const [clinic, setClinic] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [offerings, setOfferings] = useState([]);

  const [device, setDevice] = useState("desktop");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [subscriptionError, setSubscriptionError] = useState("");
  const [now, setNow] = useState(Date.now());

  const base = `/clinics/${clinicId}`;

  const load = async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);

    setError("");
    setSubscriptionError("");

    try {
      const [
        clinicResponse,
        doctorsResponse,
        servicesResponse,
        offeringsResponse,
      ] = await Promise.all([
        api.get(base),
        api.get(`${base}/doctors?includeInactive=true`),
        api.get(`${base}/services?includeInactive=true`),
        api.get(`${base}/doctor-services?includeInactive=true`),
      ]);

      setClinic(clinicResponse.data.clinic);
      setDoctors(doctorsResponse.data.doctors || []);
      setServices(servicesResponse.data.services || []);
      setOfferings(offeringsResponse.data.offerings || []);

      try {
        const response = await api.get(
          `${base}/subscription`
        );
        setSubscription(response.data.subscription || null);
      } catch (err) {
        setSubscription(null);
        setSubscriptionError(
          err.response?.data?.message ||
            "Unable to load subscription information."
        );
      }

      setNow(Date.now());
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load website management."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(true);

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => clearInterval(interval);
  }, [clinicId]);

  const remaining = daysRemaining(
    subscription?.currentPeriodEnd,
    now
  );

  const start = subscription?.currentPeriodStart
    ? new Date(subscription.currentPeriodStart).getTime()
    : NaN;

  const end = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).getTime()
    : NaN;

  const validSubscription =
    subscription?.status === "active" &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start <= now &&
    end > now;

  const expired =
    clinic?.status === "expired" ||
    (Number.isFinite(end) && end <= now);

  const websiteLive =
    clinic?.status === "active" && validSubscription;

  const expiringSoon =
    validSubscription &&
    remaining !== null &&
    remaining <= 7;

  const canRenew = expiringSoon || expired;

  const publicUrl =
    websiteLive && clinic?.slug
      ? getClinicPublicUrl(clinic.slug)
      : null;

  const visibleServices = services
    .filter((service) => service.isActive !== false)
    .map((service) => ({
      ...service,
      doctors: offerings
        .filter(
          (offering) =>
            offering.isActive !== false &&
            idOf(offering.serviceId) === idOf(service) &&
            doctors.some(
              (doctor) =>
                doctor.isActive !== false &&
                idOf(doctor) === idOf(offering.doctorId)
            )
        )
        .map((offering) => ({
          offeringId: idOf(offering),
          doctorId: idOf(offering.doctorId),
          name:
            doctors.find(
              (doctor) =>
                idOf(doctor) === idOf(offering.doctorId)
            )?.name || "Doctor",
          fee: offering.fee,
          durationMinutes: offering.durationMinutes,
        })),
    }))
    .filter((service) => service.doctors.length > 0);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-3 text-slate-500">
        <LoaderCircle className="animate-spin" size={20} />
        Loading website management...
      </div>
    );
  }

  if (error || !clinic) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <p role="alert" className="text-sm text-red-700">
          {error || "Clinic information unavailable."}
        </p>
        <button
          type="button"
          onClick={() => load(true)}
          className="mt-3 text-sm font-semibold text-red-700 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Website Management
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Manage and preview your clinic's website.
          </p>
        </div>

        <button
          type="button"
          disabled={refreshing}
          onClick={() => load()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={refreshing ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {/* Website information */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Globe2 size={23} />
            </div>

            <div>
              <h2 className="font-bold text-slate-900">
                {clinic.name}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {clinic.slug
                  ? `${clinic.slug}.prakashsaas.com`
                  : "Website URL unavailable"}
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
              websiteLive
                ? "bg-green-50 text-green-700"
                : expired
                  ? "bg-red-50 text-red-700"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {websiteLive && <CheckCircle2 size={14} />}
            {websiteLive
              ? "Live"
              : expired
                ? "Expired"
                : "Not Live"}
          </span>
        </div>

        <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <div>
            <p className="text-xs text-slate-500">
              Selected Template
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              Template A
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500">
              Website Status
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {websiteLive
                ? "Published"
                : expired
                  ? "Offline"
                  : "Not Published"}
            </p>
          </div>
        </div>

        {publicUrl && (
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            View Live Website
            <ExternalLink size={16} />
          </a>
        )}
      </section>

      {/* Subscription */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">
          Subscription
        </h2>

        {subscription ? (
          <>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">
                  Current Plan
                </p>
                <p className="mt-1 text-sm font-semibold capitalize">
                  {subscription.plan}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Billing Cycle
                </p>
                <p className="mt-1 text-sm font-semibold capitalize">
                  {subscription.billingCycle || "Unavailable"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Expiry Date
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {formatDate(subscription.currentPeriodEnd)}
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-5">
              <p className="text-xs font-medium text-slate-500">
                Subscription Validity
              </p>

              <p
                className={`mt-1 text-2xl font-bold ${
                  expired
                    ? "text-red-600"
                    : expiringSoon
                      ? "text-amber-600"
                      : "text-slate-900"
                }`}
              >
                {expired
                  ? "Expired"
                  : remaining === null
                    ? "Not available"
                    : `${remaining} ${
                        remaining === 1 ? "day" : "days"
                      } remaining`}
              </p>

              {expiringSoon && (
                <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <AlertTriangle
                    size={19}
                    className="shrink-0 text-amber-600"
                  />
                  <p className="text-sm text-amber-900">
                    Your clinic website will be suspended in{" "}
                    <strong>
                      {remaining}{" "}
                      {remaining === 1 ? "day" : "days"}
                    </strong>
                    . Renew now to avoid interruption.
                  </p>
                </div>
              )}

              {expired && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm text-red-700">
                    Your subscription has expired.
                    Renew your plan to restore your website.
                  </p>
                </div>
              )}

              {canRenew && (
                <Link
                  to={`/dashboard/clinic/${clinicId}/renew`}
                  className="mt-4 inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Renew Plan
                </Link>
              )}
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            {subscriptionError ||
              "Subscription information unavailable."}
          </p>
        )}
      </section>

      {/* Template */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Website Template
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Your website currently uses Template A.
            </p>
          </div>

          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            Template A · Selected
          </span>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Additional templates and template switching
          will be available later.
        </p>
      </section>

      {/* Preview */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Website Preview
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Preview how your website looks on different devices.
            </p>
          </div>

          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              aria-pressed={device === "desktop"}
              onClick={() => setDevice("desktop")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                device === "desktop"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600"
              }`}
            >
              <Monitor size={16} />
              Desktop
            </button>

            <button
              type="button"
              aria-pressed={device === "mobile"}
              onClick={() => setDevice("mobile")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                device === "mobile"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600"
              }`}
            >
              <Smartphone size={16} />
              Mobile
            </button>
          </div>
        </div>

        <div className="mt-5 overflow-auto rounded-2xl bg-slate-100 p-2 sm:p-5">
          <div
            className={`mx-auto overflow-hidden rounded-xl bg-white shadow-lg transition-all ${
              device === "mobile"
                ? "max-w-[390px]"
                : "max-w-full"
            }`}
          >
            <ClinicWebsiteTemplate
              clinic={clinic}
              doctors={doctors}
              services={visibleServices}
              preview
            />
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          This is a preview. Changes to doctors, services,
          and clinic details are managed from their respective
          dashboard sections.
        </p>
      </section>
    </div>
  );
}
