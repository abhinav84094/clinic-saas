
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Building2,
  CalendarDays,
  CreditCard,
  ExternalLink,
  Globe2,
  LoaderCircle,
  Pencil,
  Stethoscope,
  X,
} from "lucide-react";

import api from "../services/api";

const errorMessage = (error) =>
  error.response?.data?.message ||
  error.message ||
  "Something went wrong. Please try again.";

const requirementLabels = {
  clinic_name: "Clinic name is missing",
  clinic_slug: "Clinic website URL is missing",
  contact_phone: "Clinic phone number is missing",
  address_city: "Clinic city is missing",
  address_state: "Clinic state is missing",
  active_doctor: "At least one active doctor is required",
  active_subscription: "An active subscription is required",
};

const formatDate = (value) => {
  if (!value) return "Not available";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatPrice = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);

function Section({ icon: Icon, title, editTo, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-blue-50 p-3 text-blue-600">
            <Icon size={20} />
          </span>
          <h2 className="text-lg font-bold text-slate-900">
            {title}
          </h2>
        </div>

        {editTo && (
          <Link
            to={editTo}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            <Pencil size={15} />
            Edit
          </Link>
        )}
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}

function Detail({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">
        {value || "Not provided"}
      </p>
    </div>
  );
}

export default function ReviewPublishPage() {
  const { clinicId } = useParams();
  const navigate = useNavigate();
  const base = `/clinics/${clinicId}`;

  const [clinic, setClinic] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [readiness, setReadiness] = useState(null);

  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        clinicRes,
        doctorsRes,
        servicesRes,
        subscriptionRes,
        readinessRes,
      ] = await Promise.all([
        api.get(base),
        api.get(`${base}/doctors?includeInactive=true`),
        api.get(`${base}/services?includeInactive=true`),
        api.get(`${base}/subscription`),
        api.get(`${base}/publishing-readiness`),
      ]);

      setClinic(clinicRes.data.clinic);
      setDoctors(doctorsRes.data.doctors || []);
      setServices(servicesRes.data.services || []);
      setSubscription(subscriptionRes.data.subscription);
      setReadiness(readinessRes.data.readiness);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeDoctors = doctors.filter(
    (doctor) => doctor.isActive === true
  );

  const activeServices = services.filter(
    (service) => service.isActive === true
  );

  const missing = readiness?.missingRequirements || [];
  const canPublish =
    readiness?.canPublish === true &&
    clinic?.status === "draft" &&
    !publishing;

  const publicPath = clinic?.slug
    ? `/c/${clinic.slug}`
    : null;

  async function handlePublish() {
    if (!canPublish) return;

    setPublishing(true);
    setConfirmOpen(false);
    setError("");

    try {
      // Refresh readiness before submitting.
      const { data } = await api.get(
        `${base}/publishing-readiness`
      );

      setReadiness(data.readiness);

      if (!data.readiness?.canPublish) {
        throw new Error(
          "Clinic is no longer ready to publish. Review the checklist."
        );
      }

      const response = await api.post(`${base}/publish`);

      if (response.data.clinic?.status !== "active") {
        throw new Error(
          "The server did not confirm publication."
        );
      }

      setClinic((previous) => ({
        ...previous,
        ...response.data.clinic,
      }));

      setSuccess(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center gap-3 text-slate-600">
        <LoaderCircle
          className="animate-spin"
          size={20}
        />
        Loading final review...
      </main>
    );
  }

  if (!clinic || !subscription || !readiness) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <div
          role="alert"
          className="rounded-xl bg-red-50 p-5 text-red-700"
        >
          {error || "Unable to load clinic review."}
        </div>
        <button
          onClick={loadData}
          className="mt-4 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white"
        >
          Try Again
        </button>
      </main>
    );
  }

  const published =
    success || clinic.status === "active";

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <Link
          to={`${base}/subscription/setup`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600"
        >
          <ArrowLeft size={17} />
          Back to Subscription
        </Link>

        <div className="mt-7">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
            Step 6 of 6
          </p>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-full rounded-full bg-blue-600" />
          </div>

          <h1 className="mt-6 text-3xl font-extrabold text-slate-900">
            Review & Publish
          </h1>

          <p className="mt-2 text-slate-600">
            Review your clinic information before making
            your website publicly available.
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

        {published && (
          <div
            role="status"
            className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-6"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2
                size={28}
                className="text-emerald-600"
              />
              <h2 className="text-xl font-bold text-emerald-900">
                Your Clinic Website Is Live!
              </h2>
            </div>

            <p className="mt-3 text-sm text-emerald-800">
              Your clinic has been published successfully.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              {publicPath && (
                <Link
                  to={publicPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white"
                >
                  Visit Website
                  <ExternalLink size={16} />
                </Link>
              )}

              <button
                type="button"
                onClick={() =>
                  navigate(`/dashboard/clinic/${clinicId}`)
                }
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-5 py-3 text-sm font-semibold text-emerald-800"
              >
                Go to Dashboard
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <Section
              icon={Building2}
              title="Clinic Details"
              editTo={
                published ? null : `${base}/setup`
              }
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <Detail
                  label="Clinic Name"
                  value={clinic.name}
                />
                <Detail
                  label="Phone"
                  value={clinic.contact?.phone}
                />
                <Detail
                  label="Email"
                  value={clinic.contact?.email}
                />
                <Detail
                  label="City"
                  value={clinic.address?.city}
                />
                <Detail
                  label="State"
                  value={clinic.address?.state}
                />
                <Detail
                  label="Website Slug"
                  value={clinic.slug}
                />
              </div>

              {clinic.description && (
                <p className="mt-5 text-sm leading-6 text-slate-600">
                  {clinic.description}
                </p>
              )}
            </Section>

            <Section
              icon={Stethoscope}
              title={`Doctors (${activeDoctors.length})`}
              editTo={
                published
                  ? null
                  : `${base}/doctors/setup`
              }
            >
              {activeDoctors.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No active doctors added.
                </p>
              ) : (
                <div className="space-y-3">
                  {activeDoctors.map((doctor) => (
                    <div
                      key={doctor._id || doctor.id}
                      className="rounded-xl border border-slate-100 p-4"
                    >
                      <p className="font-semibold text-slate-900">
                        {doctor.name}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {doctor.specialization ||
                          "Specialization not provided"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section
              icon={CalendarDays}
              title={`Services (${activeServices.length})`}
              editTo={
                published
                  ? null
                  : `${base}/services/setup`
              }
            >
              {activeServices.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No active services added.
                </p>
              ) : (
                <div className="space-y-3">
                  {activeServices.map((service) => (
                    <div
                      key={service._id || service.id}
                      className="rounded-xl border border-slate-100 p-4"
                    >
                      <p className="font-semibold text-slate-900">
                        {service.name}
                      </p>
                      {service.description && (
                        <p className="mt-1 text-sm text-slate-500">
                          {service.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section
              icon={Globe2}
              title="Website"
              editTo={
                published
                  ? null
                  : `${base}/website/setup`
              }
            >
              <p className="text-sm text-slate-600">
                Your clinic will use the predefined
                responsive website template.
              </p>

              {publicPath && (
                <p className="mt-3 break-all rounded-xl bg-slate-50 p-3 font-mono text-sm text-blue-700">
                  {window.location.origin}
                  {publicPath}
                </p>
              )}
            </Section>
          </div>

          <aside className="space-y-6">
            <Section
              icon={CreditCard}
              title="Subscription"
            >
              <div className="space-y-4">
                <Detail
                  label="Plan"
                  value={subscription.plan?.toUpperCase()}
                />

                <Detail
                  label="Billing"
                  value={
                    subscription.billingCycle === "yearly"
                      ? "Yearly"
                      : "Monthly"
                  }
                />

                <Detail
                  label="Amount"
                  value={formatPrice(subscription.price)}
                />

                <Detail
                  label="Status"
                  value={subscription.status}
                />

                {subscription.currentPeriodEnd && (
                  <Detail
                    label="Current Period Ends"
                    value={formatDate(
                      subscription.currentPeriodEnd
                    )}
                  />
                )}
              </div>
            </Section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-bold text-slate-900">
                Publishing Checklist
              </h2>

              <div className="mt-5 flex items-center gap-3">
                {missing.length === 0 ? (
                  <CheckCircle2
                    className="text-emerald-600"
                    size={22}
                  />
                ) : (
                  <AlertCircle
                    className="text-amber-600"
                    size={22}
                  />
                )}

                <p className="text-sm font-semibold">
                  {missing.length === 0
                    ? "All requirements satisfied"
                    : `${missing.length} requirement(s) missing`}
                </p>
              </div>

              {missing.length > 0 && (
                <ul className="mt-4 space-y-3">
                  {missing.map((requirement) => (
                    <li
                      key={requirement}
                      className="flex items-start gap-2 text-sm text-amber-800"
                    >
                      <AlertCircle
                        size={16}
                        className="mt-0.5 shrink-0"
                      />
                      {requirementLabels[requirement] ||
                        requirement}
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                onClick={loadData}
                disabled={publishing}
                className="mt-5 text-sm font-semibold text-blue-600 hover:underline"
              >
                Refresh Checklist
              </button>

              {!published && (
                <button
                  type="button"
                  disabled={!canPublish}
                  onClick={() => setConfirmOpen(true)}
                  className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {publishing ? (
                    <LoaderCircle
                      size={18}
                      className="animate-spin"
                    />
                  ) : (
                    <Globe2 size={18} />
                  )}
                  Publish Website
                </button>
              )}

              {!published && !canPublish && (
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Publishing becomes available once
                  the backend confirms all requirements.
                </p>
              )}
            </section>
          </aside>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="publish-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <h2
                id="publish-title"
                className="text-xl font-bold text-slate-900"
              >
                Publish Clinic Website?
              </h2>

              <button
                type="button"
                aria-label="Close"
                onClick={() => setConfirmOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-600">
              Your clinic information, doctors, and
              services will become publicly visible.
              Are you ready to publish?
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-xl border border-slate-200 px-5 py-3 font-semibold"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={publishing}
                onClick={handlePublish}
                className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
              >
                Confirm & Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
