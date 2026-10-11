import { fieldErrorsFrom } from "../utils/formErrors";
import InlineError from "../components/shared/InlineError";
import ClinicSetupProgress from "../components/shared/ClinicSetupProgress";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { normalizeSlug, suggestSlug, validateSlug } from "../../../shared/slug.js";
import { getClinicPublicUrl } from "../utils/clinicDomain";

const takenMessage = "This website address is already in use. Please choose another one.";
const fieldOrder = ["name", "slug", "phone", "email", "line1", "city", "state", "postalCode", "description", "billingCycle"];

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
  "mt-2 min-h-12 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 scroll-mt-28 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 dark:disabled:bg-slate-800";

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
  const manualSlug = useRef(false);
  const inputs = useRef({});
  const [focusRequest, setFocusRequest] = useState(null);
  const handledFocus = useRef(null);
  const [availability, setAvailability] = useState({});
  const [availabilityAttempt, setAvailabilityAttempt] = useState(0);
  const slugValidation = validateSlug(form.slug);
  const slug = slugValidation.slug;
  const publicUrl = slugValidation.valid ? getClinicPublicUrl(slug) : null;
  const currentAvailability = availability.slug === slug ? availability : {};
  const slugFeedback = !editing && form.slug ? (
    !slugValidation.valid ? slugValidation.reason :
    currentAvailability.state === "available" ? "This website address is available." :
    currentAvailability.state === "taken" ? takenMessage :
    currentAvailability.state === "error" ? "Unable to check availability right now. Please try again." :
    currentAvailability.state === "invalid" ? currentAvailability.message :
    "Checking website address..."
  ) : "";
  const slugError = fieldErrors.slug || (!editing && form.slug && (
    !slugValidation.valid ? slugValidation.reason :
    currentAvailability.state === "taken" ? takenMessage :
    currentAvailability.state === "invalid" ? currentAvailability.message : ""
  ));

  useEffect(() => {
    if (editing || !validateSlug(slug).valid) return;
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/clinics/slug-availability", {
          params: { slug }, signal: controller.signal,
        });
        if (active) setAvailability({ slug, state: data.slug === slug && data.available === true ? "available" : data.slug === slug && data.available === false ? "taken" : "error" });
      } catch (err) {
        if (active) setAvailability({ slug, state: err.response?.status === 400 ? "invalid" : "error", message: err.response?.data?.message });
      }
    }, 400);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [slug, editing, availabilityAttempt]);

  useLayoutEffect(() => {
    if (!focusRequest || saving || handledFocus.current === focusRequest) return;
    handledFocus.current = focusRequest;
    const input = inputs.current[focusRequest.name];
    if (input && !input.disabled) {
      // On touch screens focus the field container to avoid opening the keyboard.
      const target = window.matchMedia("(pointer: coarse)").matches ? input.parentElement : input;
      if (target !== input) target.tabIndex = -1;
      target.focus({ preventScroll: true });
      input.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }
  }, [focusRequest, saving]);

  function showErrors(errors) {
    setFieldErrors(errors);
    setFocusRequest({ name: fieldOrder.find(name => errors[name] && !inputs.current[name]?.disabled) });
  }

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

    if (name === "slug") manualSlug.current = true;
    const generate = name === "name" && !editing && !manualSlug.current;
    const nextSlug = name === "slug" ? normalizeSlug(value) : generate ? suggestSlug(value) : slug;
    if (nextSlug !== slug) setAvailability({});
    setForm((previous) => ({
      ...previous,
      [name]: value,
      ...(generate ? { slug: suggestSlug(value) } : {}),
    }));
    if (generate) setFieldErrors(previous => ({ ...previous, slug: "" }));

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

    const errors = {};
    for (const name of fieldOrder) {
      const input = inputs.current[name];
      if (input && !input.disabled && !input.validity.valid) errors[name] = input.validationMessage;
    }
    if (!editing && !slugValidation.valid) errors.slug = slugValidation.reason;
    if (!editing && currentAvailability.state === "taken") errors.slug = takenMessage;
    if (!editing && currentAvailability.state === "invalid") errors.slug = currentAvailability.message;
    if (Object.keys(errors).length) { showErrors(errors); return; }

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
            slug: normalizeSlug(form.slug),
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
      if (!editing && err.response?.status === 409) {
        errors.slug = takenMessage;
        setAvailability({ slug, state: "taken" });
      }
      showErrors(errors);
      const issues = err.response?.data?.errors || [];
      const allMapped = issues.length > 0 && issues.every(issue => {
        const path = issue.field || issue.path;
        return errors[(Array.isArray(path) ? path : String(path || "").split(".")).at(-1)];
      });
      setError(allMapped || errors.slug ? "" : err.response?.data?.message || "Unable to save clinic details.");
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
            noValidate
            onSubmit={handleSubmit}
            className="grid gap-6 sm:grid-cols-2"
          >
            {fields.map(
              ([name, label, type, required]) => (
                <div
                  key={name}
                  className={`block min-w-0 text-sm font-semibold text-slate-800 dark:text-slate-200 focus-visible:outline-2 focus-visible:outline-red-500 ${name === "slug" ? "sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5" : ""}`}
                >
                  {name === "slug" && <>
                    <h2 className="text-base font-semibold">Your Clinic Website Address</h2>
                    <p id="clinic-slug-help" className="mt-2 mb-4 text-sm font-normal leading-6 text-slate-600 dark:text-slate-300">Your clinic will have its own public website where patients can explore your services and book appointments.</p>
                  </>}
                  <label htmlFor={`clinic-${name}`}>{name === "slug" ? "Website address" : label}{required && <span className="text-red-500" aria-hidden="true"> *</span>}{!required && <span className="font-normal text-slate-500 dark:text-slate-400"> (optional)</span>}</label>

                  <input
                    ref={element => { inputs.current[name] = element; }}
                    id={`clinic-${name}`}
                    aria-invalid={Boolean(name === "slug" ? slugError : fieldErrors[name])}
                    aria-describedby={name === "slug" ? `clinic-slug-help clinic-slug-feedback${slugError ? " clinic-slug-error" : ""}` : fieldErrors[name] ? `clinic-${name}-error` : undefined}
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
                    className={`${inputClass} ${(name === "slug" ? slugError : fieldErrors[name]) ? "border-red-500 dark:border-red-400 focus:border-red-500 focus:ring-red-200" : ""}`}
                  />
                  <InlineError id={`clinic-${name}-error`} message={name === "slug" ? slugError : fieldErrors[name]} />
                  {name === "slug" && <>
                    <div id="clinic-slug-feedback" role="status" aria-live="polite" className={`mt-2 text-sm font-normal ${currentAvailability.state === "available" ? "text-emerald-700 dark:text-emerald-300" : "text-slate-600 dark:text-slate-300"}`}>
                      {!slugError && slugFeedback}
                    </div>
                    {!editing && currentAvailability.state === "error" && <button type="button" disabled={saving} onClick={() => { setAvailability({}); setAvailabilityAttempt(value => value + 1); }} className="mt-2 text-sm font-semibold text-blue-600 underline dark:text-blue-300">Try again</button>}
                    {!editing && <button type="button" disabled={saving || !suggestSlug(form.name)} onClick={() => {
                      manualSlug.current = false;
                      setForm(previous => ({ ...previous, slug: suggestSlug(previous.name) }));
                      setAvailability({});
                      setAvailabilityAttempt(value => value + 1);
                      setFieldErrors(previous => ({ ...previous, slug: "" }));
                    }} className="mt-2 block text-sm font-semibold text-blue-600 underline disabled:opacity-50 dark:text-blue-300">Use clinic name</button>}
                    <div className="mt-4 rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
                      <p className="text-sm font-semibold">Your public website</p>
                      <p className="mt-1 break-all text-sm font-normal text-blue-700 dark:text-blue-300">{publicUrl || "Enter a valid website address to preview your URL."}</p>
                    </div>
                    <p className="mt-3 text-sm font-normal leading-6 text-slate-600 dark:text-slate-300">This will be your clinic's public website address. You can use your own custom domain later when that feature becomes available.</p>
                    <p className="mt-2 text-sm font-normal text-slate-600 dark:text-slate-300">Your website address cannot be changed after creation.</p>
                  </>}
                </div>
              )
            )}

            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 focus-visible:outline-2 focus-visible:outline-red-500 sm:col-span-2">
              Clinic Description <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span>

              <textarea
                id="clinic-description"
                ref={element => { inputs.current.description = element; }}
                aria-describedby={fieldErrors.description ? "clinic-description-error" : undefined}
                aria-invalid={Boolean(fieldErrors.description)}
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={4}
                maxLength={2000}
                disabled={saving || status !== "draft"}
                className={`${inputClass} resize-y ${fieldErrors.description ? "border-red-500 focus:ring-red-200" : ""}`}
              />
              <InlineError id="clinic-description-error" message={fieldErrors.description} />
            </label>

            {!editing && (
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 focus-visible:outline-2 focus-visible:outline-red-500 sm:col-span-2">
                Billing Preference

                <select
                  id="clinic-billingCycle"
                  ref={element => { inputs.current.billingCycle = element; }}
                  aria-invalid={Boolean(fieldErrors.billingCycle)}
                  aria-describedby={fieldErrors.billingCycle ? "clinic-billingCycle-error" : undefined}
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

                <InlineError id="clinic-billingCycle-error" message={fieldErrors.billingCycle} />
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
