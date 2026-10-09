
import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  ArrowLeft,
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
  "mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100";

export default function ClinicSetupPage() {
  const { clinicId } = useParams();
  const navigate = useNavigate();

  const editing = Boolean(clinicId);

  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
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
      const validationErrors =
        err.response?.data?.errors
          ?.map(
            (item) =>
              `${item.field}: ${item.message}`
          )
          .join("; ");

      setError(
        validationErrors ||
          err.response?.data?.message ||
          "Unable to save clinic details."
      );
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
      <main className="flex min-h-dvh items-center justify-center gap-2 text-slate-600">
        <LoaderCircle
          className="animate-spin"
          size={20}
        />
        Loading clinic...
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          to="/my-clinics"
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-blue-600"
        >
          <ArrowLeft size={17} />
          My Clinics
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="rounded-xl bg-blue-50 p-3 text-blue-600">
                <Building2 size={23} />
              </span>

              <span className="text-xs font-semibold text-blue-600">
                STEP 1 OF 6
              </span>
            </div>

            <div className="mb-5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-1/6 rounded-full bg-blue-600" />
            </div>

            <h1 className="text-2xl font-bold text-slate-900">
              Clinic Details
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Enter your clinic information.
              Next, you'll add the doctors who
              work at your clinic.
            </p>
          </div>

          {status !== "draft" && (
            <div className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
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
                  className="block min-w-0 text-sm font-medium text-slate-700"
                >
                  {label}

                  <input
                    name={name}
                    type={type}
                    value={form[name]}
                    onChange={handleChange}
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
                      name === "slug"
                        ? "city-care-clinic"
                        : ""
                    }
                    className={inputClass}
                  />
                </label>
              )
            )}

            <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
              Clinic Description

              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={4}
                maxLength={2000}
                disabled={saving || status !== "draft"}
                className={`${inputClass} resize-y`}
              />
            </label>

            {!editing && (
              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
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

                <span className="mt-1 block text-xs font-normal text-slate-500">
                  No payment is collected at
                  this step.
                </span>
              </label>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:col-span-2"
              >
                {error}
              </p>
            )}

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
                    Save & Continue
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            )}

            {status !== "draft" && editing && (
              <Link
                to={`/dashboard/clinic/${clinicId}`}
                className="text-center font-semibold text-blue-600 sm:col-span-2"
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
