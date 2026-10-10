import { fieldErrorsFrom } from "../utils/formErrors";
import InlineError from "../components/shared/InlineError";
import ClinicSetupProgress from "../components/shared/ClinicSetupProgress";

import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  ArrowRight,
  Building2,
  LoaderCircle,
} from "lucide-react";

import api from "../services/api";

const initialForm = {
  name: "",
  slug: "",
  description: "",
  phone: "",
  email: "",
  line1: "",
  city: "",
  state: "",
  postalCode: "",
  billingCycle: "monthly",
};

const inputClass =
  "mt-2 min-h-12 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 dark:disabled:bg-slate-800";

export default function ClinicSetupPage() {
  const { clinicId } = useParams();
  const navigate = useNavigate();

  const editing = Boolean(clinicId);

  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [status, setStatus] = useState("draft");

  useEffect(() => {
    if (!clinicId) return;

    let active = true;

    async function loadClinic() {
      try {
        const { data } = await api.get(
          `/clinics/${clinicId}`
        );

        if (!active) return;

        const clinic = data.clinic;

        setStatus(clinic.status);

        setForm({
          name: clinic.name || "",
          slug: clinic.slug || "",
          description: clinic.description || "",
          phone: clinic.contact?.phone || "",
          email: clinic.contact?.email || "",
          line1: clinic.address?.line1 || "",
          city: clinic.address?.city || "",
          state: clinic.address?.state || "",
          postalCode:
            clinic.address?.postalCode || "",
          billingCycle: "monthly",
        });
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.message ||
              "Unable to load clinic details."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadClinic();

    return () => {
      active = false;
    };
  }, [clinicId]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setFieldErrors(previous => ({ ...previous, [name]: "" }));
    setError("");
  }

  function buildPayload() {
    return {
      name: form.name.trim(),
      description: form.description.trim(),
      contact: {
        phone: form.phone.trim(),
        ...(form.email.trim()
          ? { email: form.email.trim() }
          : {}),
      },
      address: {
        line1: form.line1.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        postalCode: form.postalCode.trim(),
      },
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (saving) return;

    setFieldErrors({});
    setSaving(true);
    setError("");

    try {
      let savedClinicId = clinicId;

      if (editing) {
        await api.patch(
          `/clinics/${clinicId}`,
          buildPayload()
        );
      } else {
        const { data } = await api.post(
          "/clinics",
          {
            ...buildPayload(),
            slug: form.slug.trim().toLowerCase(),
            billingCycle: form.billingCycle,
          }
        );

        savedClinicId =
          data.clinic._id || data.clinic.id;
      }

      navigate(
        `/clinics/${savedClinicId}/doctors/setup`,
        { replace: true }
      );
    } catch (err) {
      const errors = fieldErrorsFrom(err, Object.keys(initialForm));
      setFieldErrors(errors);
      const issues = err.response?.data?.errors || [];
      const allMapped = issues.length > 0 && issues.every(issue => {
        const path = issue.field || issue.path;
        return errors[(Array.isArray(path) ? path : String(path || "").split(".")).at(-1)];
      });
      setError(allMapped ? "" : err.response?.data?.message || "Unable to save clinic details.");
    } finally {
      setSaving(false);
    }
  }

  const fields = [
    ["name", "Clinic Name", "text", true],
    ["slug", "Clinic Website URL", "text", true],
    ["phone", "Contact Phone", "tel", true],
    ["email", "Contact Email", "email", false],
    ["line1", "Street Address", "text", false],
    ["city", "City", "text", true],
    ["state", "State", "text", true],
    ["postalCode", "Postal Code", "text", false],
  ];

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center gap-2 text-slate-600 dark:text-slate-300">
        <LoaderCircle
          className="animate-spin"
          size={20}
        />
        Loading clinic...
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-slate-50 dark:bg-slate-950 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        {status === "draft" && <ClinicSetupProgress step={1} clinicId={clinicId} />}

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-8">
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-3 text-blue-600 dark:text-blue-300">
                <Building2 size={23} />
              </span>
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Clinic Details
            </h1>

            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Enter your clinic information.
              Next, you'll add the doctors who
              work at your clinic.
            </p>
          </div>

          {status !== "draft" && (
            <div className="mb-5 rounded-xl bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-800 dark:text-amber-300">
              This clinic is currently{" "}
              <strong>{status}</strong>.
              This onboarding form is intended
              for clinic drafts.
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="grid gap-4 sm:grid-cols-2"
          >
            {fields.map(
              ([name, label, type, required]) => (
                <label
                  key={name}
                  className="block min-w-0 text-sm font-medium text-slate-700 dark:text-slate-200"
                >
                  {label}{required && <span className="text-red-500" aria-hidden="true"> *</span>}{!required && <span className="font-normal text-slate-400"> (optional)</span>}

                  <input
                    id={`clinic-${name}`}
                    aria-invalid={Boolean(fieldErrors[name])}
                    aria-describedby={fieldErrors[name] ? `clinic-${name}-error` : undefined}
                    name={name}
                    type={type}
                    value={form[name]}
                    onChange={handleChange}
                    autoComplete={({ name: "organization", email: "email", phone: "tel", line1: "street-address", city: "address-level2", state: "address-level1", postalCode: "postal-code" })[name] || "off"}
                    required={required}
                    disabled={
                      saving ||
                      status !== "draft" ||
                      (editing && name === "slug")
                    }
                    maxLength={
                      name === "slug" ? 80 : 200
                    }
                    placeholder={
                      ({ name: "City Care Clinic", slug: "city-care-clinic", phone: "Clinic contact number", email: "hello@yourclinic.com", line1: "Building, street and area", city: "City", state: "State", postalCode: "Postal code" })[name]
                    }
                    className={`${inputClass} ${fieldErrors[name] ? "border-red-400 focus:border-red-500" : ""}`}
                  />
                  <InlineError id={`clinic-${name}-error`} message={fieldErrors[name]} />
                  {name === "slug" && <span className="mt-2 block text-xs font-normal leading-5 text-slate-500 dark:text-slate-400">Choose a unique name using lowercase letters, numbers and hyphens. Your website address cannot be changed after creation.</span>}
                </label>
              )
            )}

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
              Clinic Description <span className="font-normal text-slate-400">(optional)</span>

              <textarea
                aria-invalid={Boolean(fieldErrors.description)}
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={4}
                maxLength={2000}
                disabled={saving || status !== "draft"}
                className={`${inputClass} resize-y`}
              />
              <InlineError message={fieldErrors.description} />
            </label>

            {!editing && (
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
                Billing Preference

                <select
                  name="billingCycle"
                  value={form.billingCycle}
                  onChange={handleChange}
                  disabled={saving}
                  className={inputClass}
                >
                  <option value="monthly">
                    Monthly
                  </option>

                  <option value="yearly">
                    Yearly
                  </option>
                </select>

                <InlineError message={fieldErrors.billingCycle} />
                <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
                  No payment is collected at
                  this step.
                </span>
              </label>
            )}

            <InlineError message={error} className="sm:col-span-2" />

            {status === "draft" && (
              <button
                type="submit"
                disabled={saving}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700 disabled:opacity-60 sm:col-span-2"
              >
                {saving ? (
                  <>
                    <LoaderCircle
                      size={18}
                      className="animate-spin"
                    />
                    Saving...
                  </>
                ) : (
                  <>
                    Save & Continue to Doctors
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            )}

            {status !== "draft" && editing && (
              <Link
                to={`/dashboard/clinic/${clinicId}`}
                className="text-center font-semibold text-blue-600 dark:text-blue-300 sm:col-span-2"
              >
                Return to Dashboard
              </Link>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}
