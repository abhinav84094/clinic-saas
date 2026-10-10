import InlineError from "../components/shared/InlineError";
import ClinicSetupProgress from "../components/shared/ClinicSetupProgress";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, LoaderCircle, Monitor, Smartphone } from "lucide-react";
import api from "../services/api";
import ClinicTemplateRenderer from "../components/clinic/ClinicTemplateRenderer";
import { availableTemplates } from "../components/clinic/templates/templateRegistry";

const idOf = (value) => String(value?._id || value?.id || value || "");

export default function WebsiteSetupPage() {
  const { clinicId } = useParams();
  const navigate = useNavigate();
  const base = `/clinics/${clinicId}`;

  const [clinic, setClinic] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [device, setDevice] = useState("desktop");
  const [selectedTemplate, setSelectedTemplate] = useState("A");
  const [savedTemplate, setSavedTemplate] = useState("A");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorArea, setErrorArea] = useState("template");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [clinicResponse, doctorsResponse, servicesResponse, offeringsResponse] =
          await Promise.all([
            api.get(base),
            api.get(`${base}/doctors?includeInactive=true`),
            api.get(`${base}/services?includeInactive=true`),
            api.get(`${base}/doctor-services?includeInactive=true`),
          ]);

        if (!alive) return;
        const loadedClinic = clinicResponse.data.clinic;
        const templateId = loadedClinic.website?.templateId || "A";
        setClinic(loadedClinic);
        setSelectedTemplate(templateId);
        setSavedTemplate(templateId);
        setDoctors(doctorsResponse.data.doctors || []);
        setServices(servicesResponse.data.services || []);
        setOfferings(offeringsResponse.data.offerings || []);
      } catch (err) {
        if (alive) {
          setError(err.response?.data?.message || "Unable to load clinic preview.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => { alive = false; };
  }, [base]);

  async function saveTemplate({ fromContinue = false } = {}) {
    if (!clinic || savingTemplate) return false;
    if (selectedTemplate === savedTemplate) return true;
    setErrorArea(fromContinue ? "continue" : "template");
    setSavingTemplate(true);
    setError("");
    setSuccess("");
    const templateToSave = selectedTemplate;
    try {
      await api.patch(base, { website: { templateId: templateToSave } });
      setSavedTemplate(templateToSave);
      setClinic((current) => current ? {
        ...current,
        website: { ...current.website, templateId: templateToSave },
      } : current);
      setSuccess("Website template saved successfully.");
      return true;
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save website template.");
      return false;
    } finally {
      setSavingTemplate(false);
    }
  }

  async function continueToSubscription() {
    if (await saveTemplate({ fromContinue: true })) navigate(`${base}/subscription/setup`);
  }

  const visibleServices = services
    .filter((service) => service.isActive !== false)
    .map((service) => ({
      ...service,
      doctors: offerings
        .filter((offering) =>
          offering.isActive !== false &&
          idOf(offering.serviceId) === idOf(service) &&
          doctors.some((doctor) =>
            doctor.isActive !== false && idOf(doctor) === idOf(offering.doctorId)
          )
        )
        .map((offering) => ({
          offeringId: idOf(offering),
          doctorId: idOf(offering.doctorId),
          name: doctors.find((doctor) => idOf(doctor) === idOf(offering.doctorId))?.name || "Doctor",
          fee: offering.fee,
          durationMinutes: offering.durationMinutes,
        })),
    }))
    .filter((service) => service.doctors.length > 0);

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center gap-2">
        <LoaderCircle className="animate-spin" size={20} /> Loading website preview...
      </main>
    );
  }

  const isDraft = clinic?.status === "draft";
  const canEdit = clinic && ["draft", "active"].includes(clinic.status);
  const hasUnsavedSelection = selectedTemplate !== savedTemplate;

  return (
    <main className="min-h-dvh bg-slate-50 dark:bg-slate-950 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        {isDraft && <ClinicSetupProgress step={4} clinicId={clinicId} />}
        <Link
          to={isDraft ? `${base}/services/setup` : `/dashboard/clinic/${clinicId}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-300"
        >
          <ArrowLeft size={17} />
          {isDraft ? "Back to Services & Availability" : "Back to Dashboard"}
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">Your Clinic Website</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Choose a template and preview your clinic's information in that design.
            </p>
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1">
            <button type="button" aria-pressed={device === "desktop"}
              onClick={() => setDevice("desktop")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${device === "desktop" ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-300"}`}>
              <Monitor size={16} /> Desktop
            </button>
            <button type="button" aria-pressed={device === "mobile"}
              onClick={() => setDevice("mobile")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${device === "mobile" ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-300"}`}>
              <Smartphone size={16} /> Mobile
            </button>
          </div>
        </div>

        <InlineError message={!clinic ? error : ""} />

        {clinic && (
          <>
            <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Choose Your Website Template</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Your saved clinic details automatically appear in every template.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {availableTemplates.map((template) => {
                  const selected = selectedTemplate === template.id;
                  return (
                    <button key={template.id} type="button" aria-pressed={selected}
                      disabled={!canEdit || savingTemplate}
                      onClick={() => { setSelectedTemplate(template.id); setSuccess(""); setError(""); }}
                      className={`rounded-xl border-2 p-5 text-left transition disabled:opacity-60 ${selected ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40" : "border-slate-200 dark:border-slate-700 hover:border-blue-300"}`}>
                      <div className="mb-4 flex h-28 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-3xl font-bold text-blue-600 dark:text-blue-300">
                        {template.id}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">{template.name}</span>
                        {selected && <span className="text-xs font-bold text-blue-600 dark:text-blue-300">Selected</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
              {success && <p role="status" className="mt-4 text-sm text-green-700 dark:text-green-300">{success}</p>}
              {hasUnsavedSelection && (
                <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">Previewing an unsaved template selection.</p>
              )}
              <InlineError message={errorArea === "template" ? error : ""} />
              <button type="button" onClick={saveTemplate}
                disabled={!canEdit || savingTemplate || !hasUnsavedSelection}
                className="mt-5 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">
                {savingTemplate ? "Saving..." : "Save Selected Template"}
              </button>
            </section>

            <div className="overflow-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-200 dark:bg-slate-700 p-2 shadow-sm sm:p-5">
              <div className={`mx-auto overflow-hidden rounded-xl bg-white dark:bg-slate-900 shadow-lg transition-all ${device === "mobile" ? "max-w-[390px]" : "max-w-full"}`}>
                <ClinicTemplateRenderer
                  templateId={selectedTemplate}
                  clinic={clinic}
                  doctors={doctors}
                  services={visibleServices}
                  preview
                />
              </div>
            </div>

            {isDraft && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Happy with your preview? Continue to choose your subscription.
                  Your selected template will be saved before you move on.
                </p>
                <InlineError message={errorArea === "continue" ? error : ""} />
                <button type="button"
                  disabled={savingTemplate}
                  onClick={continueToSubscription}
                  className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                  {savingTemplate ? <><LoaderCircle size={18} className="animate-spin" /> Saving...</> : <>{hasUnsavedSelection ? "Save & Continue to Subscription" : "Continue to Subscription"} <ArrowRight size={18} /></>}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
