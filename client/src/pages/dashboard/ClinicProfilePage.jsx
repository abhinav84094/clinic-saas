
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  Save,
} from "lucide-react";
import api from "../../services/api";



const TIMEZONE_OPTIONS = [
  { value: "Asia/Kolkata", label: "India (IST — UTC+05:30)" },
  { value: "Asia/Dubai", label: "UAE (GST — UTC+04:00)" },
  { value: "Asia/Kathmandu", label: "Nepal (NPT — UTC+05:45)" },
  { value: "Asia/Dhaka", label: "Bangladesh (BST — UTC+06:00)" },
  { value: "Asia/Colombo", label: "Sri Lanka (UTC+05:30)" },
  { value: "Asia/Singapore", label: "Singapore (SGT — UTC+08:00)" },
  { value: "Europe/London", label: "United Kingdom (London)" },
  { value: "America/New_York", label: "United States (Eastern Time)" },
  { value: "America/Los_Angeles", label: "United States (Pacific Time)" },
  { value: "Australia/Sydney", label: "Australia (Sydney)" },
];


const initialForm = {
  name: "",
  description: "",
  slug: "",
  phone: "",
  email: "",
  whatsapp: "",
  line1: "",
  line2: "",
  landmark: "",
  city: "",
  state: "",
  country: "",
  postalCode: "",
  timezone: "Asia/Kolkata",
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100";

function getError(error) {
  const issues = error.response?.data?.errors;

  if (Array.isArray(issues) && issues.length) {
    return issues
      .map((issue) =>
        `${issue.field || issue.path?.join(".") || "Field"}: ${issue.message}`
      )
      .join("; ");
  }

  return (
    error.response?.data?.message ||
    "Unable to save clinic details. Please try again."
  );
}

function mapClinic(clinic) {
  return {
    name: clinic.name || "",
    description: clinic.description || "",
    slug: clinic.slug || "",
    phone: clinic.contact?.phone || "",
    email: clinic.contact?.email || "",
    whatsapp: clinic.contact?.whatsapp || "",
    line1: clinic.address?.line1 || "",
    line2: clinic.address?.line2 || "",
    landmark: clinic.address?.landmark || "",
    city: clinic.address?.city || "",
    state: clinic.address?.state || "",
    country: clinic.address?.country || "",
    postalCode: clinic.address?.postalCode || "",
    timezone: clinic.timezone || "Asia/Kolkata",
  };
}

function Field({
  label,
  name,
  value,
  onChange,
  disabled,
  required = false,
  type = "text",
  maxLength = 200,
  placeholder = "",
}) {
  return (
    <label className="block min-w-0 text-sm font-medium text-slate-700">
      {label}
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        className={inputClass}
      />
    </label>
  );
}

export default function ClinicProfilePage() {
  const { clinicId } = useParams();
  const navigate = useNavigate();

  const [clinic, setClinic] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [original, setOriginal] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadClinic = useCallback(async () => {
    const response = await api.get(`/clinics/${clinicId}`);
    const data = response.data.clinic;
    const mapped = mapClinic(data);

    setClinic(data);
    setForm(mapped);
    setOriginal(mapped);
  }, [clinicId]);

  useEffect(() => {
    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");

      try {
        const response = await api.get(`/clinics/${clinicId}`);
        if (!active) return;

        const data = response.data.clinic;
        const mapped = mapClinic(data);

        setClinic(data);
        setForm(mapped);
        setOriginal(mapped);
      } catch (err) {
        if (active) setError(getError(err));
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();
    return () => { active = false; };
  }, [clinicId]);

  const canEdit =
    clinic?.status === "draft" ||
    clinic?.status === "active";

  const dirty = Object.keys(form).some(
    (key) => form[key] !== original[key]
  );

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  }

  function buildPayload() {
    const contact = {};
    const address = {};

    for (const key of ["phone", "email", "whatsapp"]) {
      if (form[key] !== original[key]) {
        // Optional email/phone fields must be omitted when empty.
        // The current API does not support clearing them with "".
        if (form[key].trim()) {
          contact[key] = form[key].trim();
        }
      }
    }

    for (const key of [
      "line1", "line2", "landmark",
      "city", "state", "country", "postalCode",
    ]) {
      if (form[key] !== original[key]) {
        address[key] = form[key].trim();
      }
    }

    const payload = {};

    if (form.name !== original.name) {
      payload.name = form.name.trim();
    }

    if (form.description !== original.description) {
      payload.description = form.description.trim();
    }

    if (form.timezone !== original.timezone) {
      payload.timezone = form.timezone.trim();
    }

    if (Object.keys(contact).length) {
      payload.contact = contact;
    }

    if (Object.keys(address).length) {
      payload.address = address;
    }

    return payload;
  }

  async function handleSave(event) {
    event.preventDefault();

    if (saving || !canEdit || !dirty) return;

    setError("");
    setSuccess("");

    if (form.name.trim().length < 2) {
      setError("Clinic name must contain at least 2 characters.");
      return;
    }

    if (
      ["phone", "whatsapp"].some(
        (key) =>
          form[key].trim() &&
          !/^\+?[0-9]{7,15}$/.test(form[key].trim())
      )
    ) {
      setError("Phone and WhatsApp must contain 7–15 digits.");
      return;
    }

    const payload = buildPayload();

    if (!Object.keys(payload).length) {
      setError(
        "No supported changes to save. Clearing contact fields is not yet supported."
      );
      return;
    }

    setSaving(true);

    try {
      await api.patch(`/clinics/${clinicId}`, payload);
      await loadClinic();

      setSuccess("Clinic profile updated successfully.");
    } catch (err) {
      setError(getError(err));
    } finally {
      setSaving(false);
    }
  }

  async function refresh() {
    if (dirty && !window.confirm("Discard unsaved changes?")) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await loadClinic();
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  }

  function backToDashboard() {
    if (dirty && !window.confirm("Discard unsaved changes?")) {
      return;
    }

    navigate(`/dashboard/clinic/${clinicId}`);
  }

  const field = (name, label, options = {}) => (
    <Field
      name={name}
      label={label}
      value={form[name]}
      onChange={handleChange}
      disabled={saving || !canEdit}
      {...options}
    />
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 p-12 text-slate-500">
        <LoaderCircle size={20} className="animate-spin" />
        Loading clinic profile...
      </div>
    );
  }

  if (!clinic) {
    return (
      <div role="alert" className="rounded-xl bg-red-50 p-5 text-red-700">
        {error || "Clinic not found."}
        <button type="button" onClick={refresh} className="ml-3 underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex items-center gap-2 text-blue-600">
            <Building2 size={22} />
            <span className="text-sm font-semibold">Clinic Management</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Clinic Profile
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Update your clinic's public information and contact details.
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}

      {!canEdit && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          Editing is disabled because this clinic is {clinic.status}.
        </p>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-bold">Basic Information</h2>
          <p className="mt-1 text-sm text-slate-500">
            These details may appear on your clinic website.
          </p>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {field("name", "Clinic Name", {
              required: true,
              maxLength: 150,
            })}

            <Field
              name="slug"
              label="Clinic Website URL (Read-only)"
              value={form.slug}
              disabled
            />

            <label className="sm:col-span-2 text-sm font-medium text-slate-700">
              Clinic Description
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                disabled={saving || !canEdit}
                maxLength={2000}
                rows={4}
                className={inputClass}
              />
            </label>

            
            <label className="block text-sm font-medium text-slate-700">
            Clinic Timezone

            <select
                name="timezone"
                value={form.timezone}
                onChange={handleChange}
                disabled={saving || !canEdit}
                required
                className={inputClass}
            >
                {!TIMEZONE_OPTIONS.some(
                (option) => option.value === form.timezone
                ) && (
                <option value={form.timezone}>
                    Current timezone ({form.timezone})
                </option>
                )}

                {TIMEZONE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
                ))}
            </select>

            <p className="mt-2 text-xs text-slate-500">
                Select the timezone where your clinic operates.
                Appointment timings will use this timezone.
            </p>
            </label>

          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-bold">Contact Information</h2>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {field("phone", "Contact Phone", {
              type: "tel",
              maxLength: 16,
            })}

            {field("whatsapp", "WhatsApp Number", {
              type: "tel",
              maxLength: 16,
            })}

            {field("email", "Contact Email", {
              type: "email",
              maxLength: 254,
            })}
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Changing existing contact values is supported.
            Clearing saved phone/email/WhatsApp values requires
            a backend update and is not enabled yet.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-bold">Clinic Address</h2>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              {field("line1", "Address Line 1")}
            </div>

            <div className="sm:col-span-2">
              {field("line2", "Address Line 2")}
            </div>

            {field("landmark", "Landmark")}
            {field("city", "City", { maxLength: 100 })}
            {field("state", "State", { maxLength: 100 })}
            {field("country", "Country", { maxLength: 100 })}
            {field("postalCode", "Postal Code", { maxLength: 20 })}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <button
            type="button"
            onClick={backToDashboard}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold"
          >
            <ArrowLeft size={17} />
            Back to Dashboard
          </button>

          <button
            type="submit"
            disabled={saving || !dirty || !canEdit}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? (
              <LoaderCircle size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
