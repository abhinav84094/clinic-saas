
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ExternalLink,
  Globe2,
  LoaderCircle,
  Monitor,
  Palette,
  RefreshCw,
  Smartphone,
  X,
} from "lucide-react";

import api from "../../services/api";
import ClinicTemplateRenderer from "../../components/clinic/ClinicTemplateRenderer";
import { availableTemplates } from "../../components/clinic/templates/templateRegistry";
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

  return Math.max(0, Math.ceil((end - now) / 86400000));
};

const templateDesigns = {
  A: {
    background: "bg-slate-50",
    header: "bg-blue-600",
    accent: "bg-blue-200",
    text: "bg-slate-300",
  },
  B: {
    background: "bg-teal-50",
    header: "bg-teal-600",
    accent: "bg-teal-200",
    text: "bg-teal-300",
  },
  C: {
    background: "bg-[#15242c]",
    header: "bg-[#d9b88a]",
    accent: "bg-[#304650]",
    text: "bg-slate-500",
  },
};

function TemplateThumbnail({ templateId }) {
  const design = templateDesigns[templateId] || templateDesigns.A;
  const isDark = templateId === "C";

  return (
    <div
      className={`h-36 overflow-hidden rounded-xl border ${
        isDark ? "border-slate-700" : "border-slate-200"
      } ${design.background}`}
    >
      <div
        className={`flex h-8 items-center justify-between px-3 ${
          isDark ? "bg-[#15242c]" : "bg-white"
        }`}
      >
        <div className="flex items-center gap-1.5">
          <div className={`h-4 w-4 rounded-full ${design.header}`} />
          <div
            className={`h-1.5 w-12 rounded ${
              isDark ? "bg-white/70" : "bg-slate-500"
            }`}
          />
        </div>

        <div className="flex gap-1.5">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className={`h-1 w-5 rounded ${
                isDark ? "bg-white/40" : "bg-slate-300"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-3 px-3 py-4">
        <div className="flex-1 space-y-2">
          <div className={`h-2 w-full rounded ${design.header}`} />
          <div
            className={`h-2 w-3/4 rounded ${design.header} opacity-70`}
          />
          <div className={`h-1 w-full rounded ${design.text}`} />
          <div className={`h-1 w-4/5 rounded ${design.text}`} />
          <div className={`mt-3 h-4 w-16 rounded ${design.header}`} />
        </div>

        <div
          className={`flex h-16 w-2/5 items-center justify-center rounded-lg ${design.accent}`}
        >
          <Globe2
            size={25}
            className={
              isDark
                ? "text-[#d9b88a]"
                : templateId === "B"
                  ? "text-teal-700"
                  : "text-blue-600"
            }
          />
        </div>
      </div>

      <div className="flex gap-2 px-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className={`h-7 flex-1 rounded-md ${
              isDark
                ? "border border-white/20 bg-white/10"
                : "border border-slate-200 bg-white"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

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

  const [selectedTemplate, setSelectedTemplate] = useState("A");
  const [savedTemplate, setSavedTemplate] = useState("A");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState("");
  const [templateSuccess, setTemplateSuccess] = useState("");
  const [confirmTemplateChange, setConfirmTemplateChange] =
    useState(false);

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

      const loadedClinic = clinicResponse.data.clinic;
      const templateId = loadedClinic.website?.templateId || "A";

      setClinic(loadedClinic);
      setSelectedTemplate(templateId);
      setSavedTemplate(templateId);
      setTemplateError("");
      setTemplateSuccess("");
      setConfirmTemplateChange(false);

      setDoctors(doctorsResponse.data.doctors || []);
      setServices(servicesResponse.data.services || []);
      setOfferings(offeringsResponse.data.offerings || []);

      try {
        const response = await api.get(`${base}/subscription`);

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

  const canChangeTemplate =
    clinic && ["draft", "active"].includes(clinic.status);

  const hasUnsavedTemplate = selectedTemplate !== savedTemplate;

  const savedTemplateName =
    availableTemplates.find((t) => t.id === savedTemplate)?.name ||
    "Classic Care";

  const selectedTemplateName =
    availableTemplates.find((t) => t.id === selectedTemplate)?.name ||
    "Classic Care";

  async function saveTemplate() {
    if (
      !canChangeTemplate ||
      savingTemplate ||
      !hasUnsavedTemplate ||
      !availableTemplates.some((t) => t.id === selectedTemplate)
    ) {
      return;
    }

    setSavingTemplate(true);
    setTemplateError("");
    setTemplateSuccess("");

    try {
      const { data } = await api.patch(base, {
        website: {
          templateId: selectedTemplate,
        },
      });

      const updatedClinic = data.clinic;
      const updatedTemplateId =
        updatedClinic?.website?.templateId;

      if (updatedTemplateId !== selectedTemplate) {
        throw new Error(
          "Server did not confirm the selected template."
        );
      }

      setClinic(updatedClinic);
      setSavedTemplate(updatedTemplateId);

      setTemplateSuccess(
        clinic.status === "active"
          ? "Your live website template has been updated successfully."
          : "Website template saved successfully."
      );
    } catch (err) {
      setTemplateError(
        err.response?.data?.message ||
          err.message ||
          "Unable to update website template."
      );
    } finally {
      setSavingTemplate(false);
      setConfirmTemplateChange(false);
    }
  }

  function handleTemplateSave() {
    if (
      !canChangeTemplate ||
      !hasUnsavedTemplate ||
      savingTemplate
    ) {
      return;
    }

    if (clinic.status === "active") {
      setConfirmTemplateChange(true);
    } else {
      saveTemplate();
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
        <LoaderCircle className="animate-spin" size={20} />
        Loading website management...
      </div>
    );
  }

  if (error || !clinic) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-800 dark:bg-red-950/40">
        <p
          role="alert"
          className="text-sm text-red-700 dark:text-red-300"
        >
          {error || "Clinic information unavailable."}
        </p>

        <button
          type="button"
          onClick={() => load(true)}
          className="mt-3 text-sm font-semibold text-red-700 underline dark:text-red-300"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">
            Website Management
          </h1>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Manage, customize and preview your clinic's website.
          </p>
        </div>

        <button
          type="button"
          disabled={refreshing || savingTemplate}
          onClick={() => load()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-950"
        >
          <RefreshCw
            size={16}
            className={refreshing ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {/* Website Information */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
              <Globe2 size={23} />
            </div>

            <div>
              <h2 className="font-bold text-slate-900 dark:text-slate-100">
                {clinic.name}
              </h2>

              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {clinic.slug
                  ? `${clinic.slug}.prakashsaas.com`
                  : "Website URL unavailable"}
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
              websiteLive
                ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                : expired
                  ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
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

        <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 dark:border-slate-800">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Selected Template
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {savedTemplateName}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Website Status
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
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
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            View Live Website
            <ExternalLink size={16} />
          </a>
        )}
      </section>

      {/* Subscription */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Subscription
        </h2>

        {subscription ? (
          <>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Current Plan
                </p>

                <p className="mt-1 text-sm font-semibold capitalize">
                  {subscription.plan}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Billing Cycle
                </p>

                <p className="mt-1 text-sm font-semibold capitalize">
                  {subscription.billingCycle || "Unavailable"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Expiry Date
                </p>

                <p className="mt-1 text-sm font-semibold">
                  {formatDate(subscription.currentPeriodEnd)}
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Subscription Validity
              </p>

              <p
                className={`mt-1 text-2xl font-bold ${
                  expired
                    ? "text-red-600 dark:text-red-300"
                    : expiringSoon
                      ? "text-amber-600 dark:text-amber-300"
                      : "text-slate-900 dark:text-slate-100"
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
                <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
                  <AlertTriangle
                    size={19}
                    className="shrink-0 text-amber-600 dark:text-amber-300"
                  />

                  <p className="text-sm text-amber-900 dark:text-amber-300">
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
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/40">
                  <p className="text-sm text-red-700 dark:text-red-300">
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
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            {subscriptionError ||
              "Subscription information unavailable."}
          </p>
        )}
      </section>

      {/* Template Selection */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Palette size={21} className="text-blue-600" />

              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Website Template
              </h2>
            </div>

            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Choose a design for your clinic website.
              Your doctors, services and clinic information
              will remain unchanged.
            </p>
          </div>

          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            {savedTemplateName} · Current
          </span>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {availableTemplates.map((template) => {
            const selected = selectedTemplate === template.id;
            const current = savedTemplate === template.id;

            return (
              <button
                key={template.id}
                type="button"
                aria-pressed={selected}
                disabled={!canChangeTemplate || savingTemplate}
                onClick={() => {
                  setSelectedTemplate(template.id);
                  setTemplateError("");
                  setTemplateSuccess("");
                }}
                className={`rounded-2xl border-2 p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60 ${
                  selected
                    ? "border-blue-600 bg-blue-50 shadow-sm dark:bg-blue-950/30"
                    : "border-slate-200 bg-white hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900"
                }`}
              >
                <TemplateThumbnail templateId={template.id} />

                <div className="mt-4 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 dark:text-white">
                      {template.name}
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {template.description}
                    </p>
                  </div>

                  {selected && (
                    <Check
                      size={20}
                      className="shrink-0 text-blue-600"
                    />
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {current && (
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      Current
                    </span>
                  )}

                  {selected && !current && (
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      Previewing
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {hasUnsavedTemplate && (
          <p className="mt-5 text-sm text-amber-700 dark:text-amber-300">
            You're previewing {selectedTemplateName}.
            Your website still uses {savedTemplateName}
            until you save.
          </p>
        )}

        {!canChangeTemplate && (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Template changes are unavailable for this clinic's
            current status.
          </p>
        )}

        {templateError && (
          <p
            role="alert"
            className="mt-4 text-sm text-red-600 dark:text-red-400"
          >
            {templateError}
          </p>
        )}

        {templateSuccess && (
          <p
            role="status"
            className="mt-4 text-sm text-green-700 dark:text-green-300"
          >
            {templateSuccess}
          </p>
        )}

        <button
          type="button"
          onClick={handleTemplateSave}
          disabled={
            !canChangeTemplate ||
            !hasUnsavedTemplate ||
            savingTemplate ||
            refreshing
          }
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {savingTemplate ? (
            <>
              <LoaderCircle size={17} className="animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check size={17} />
              Save Selected Template
            </>
          )}
        </button>
      </section>

      {/* Website Preview */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Website Preview
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Preview how your website looks on different devices.
            </p>

            <p className="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-300">
              Previewing: {selectedTemplateName}
            </p>
          </div>

          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-950">
            <button
              type="button"
              aria-pressed={device === "desktop"}
              onClick={() => setDevice("desktop")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                device === "desktop"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 dark:text-slate-300"
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
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              <Smartphone size={16} />
              Mobile
            </button>
          </div>
        </div>

        <div className="mt-5 overflow-auto rounded-2xl bg-slate-100 p-2 sm:p-5 dark:bg-slate-800">
          <div
            className={`mx-auto overflow-hidden rounded-xl bg-white shadow-lg transition-all ${
              device === "mobile"
                ? "max-w-[390px]"
                : "max-w-full"
            }`}
          >
            <ClinicTemplateRenderer
              templateId={selectedTemplate}
              clinic={clinic}
              doctors={doctors}
              services={visibleServices}
              preview
            />
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          This is a preview. Changes to doctors, services,
          and clinic details are managed from their respective
          dashboard sections.
        </p>
      </section>

      {/* Live Template Change Confirmation */}
      {confirmTemplateChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-template-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-4">
              <h2
                id="change-template-title"
                className="text-xl font-bold text-slate-900 dark:text-white"
              >
                Change Live Website Template?
              </h2>

              <button
                type="button"
                aria-label="Close"
                disabled={savingTemplate}
                onClick={() => setConfirmTemplateChange(false)}
                className="text-slate-500 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Your published clinic website will switch from{" "}
              <strong>{savedTemplateName}</strong> to{" "}
              <strong>{selectedTemplateName}</strong>.
            </p>

            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Your clinic details, doctors, services and existing
              appointments will remain unchanged.
            </p>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={savingTemplate}
                onClick={() => setConfirmTemplateChange(false)}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold dark:border-slate-700 dark:text-white"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={savingTemplate}
                onClick={saveTemplate}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {savingTemplate && (
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                  />
                )}
                Confirm & Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
