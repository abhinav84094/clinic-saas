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

                const styles = {
                  A: {
                    background: "bg-slate-50",
                    header: "bg-white",
                    heading: "bg-blue-600",
                    button: "bg-blue-600",
                    illustration: "bg-blue-100",
                    border: "border-blue-200",
                  },
                  B: {
                    background: "bg-teal-50",
                    header: "bg-white",
                    heading: "bg-teal-600",
                    button: "bg-teal-600",
                    illustration: "bg-teal-200",
                    border: "border-teal-200",
                  },
                  C: {
                    background: "bg-[#15242c]",
                    header: "bg-[#15242c]",
                    heading: "bg-[#d9b88a]",
                    button: "bg-[#d9b88a]",
                    illustration: "bg-[#304650]",
                    border: "border-slate-700",
                  },
                };

                const design = styles[template.id] || styles.A;

                return (
                  <button
                    key={template.id}
                    type="button"
                    aria-pressed={selected}
                    disabled={!canEdit || savingTemplate}
                    onClick={() => {
                      setSelectedTemplate(template.id);
                      setSuccess("");
                      setError("");
                    }}
                    className={`group overflow-hidden rounded-2xl border-2 p-3 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60 sm:p-4 ${
                      selected
                        ? "border-blue-600 bg-blue-50 shadow-md dark:bg-blue-950/40"
                        : "border-slate-200 bg-white hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900"
                    }`}
                  >
                    {/* Mini website preview */}
                    <div
                      className={`h-36 overflow-hidden rounded-xl border ${design.border} ${design.background}`}
                    >
                      {/* Mini navigation */}
                      <div
                        className={`flex h-8 items-center justify-between px-3 ${design.header}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <div className={`h-4 w-4 rounded-full ${design.heading}`} />
                          <div
                            className={`h-1.5 w-12 rounded ${
                              template.id === "C"
                                ? "bg-white/70"
                                : "bg-slate-500"
                            }`}
                          />
                        </div>

                        <div className="flex gap-1.5">
                          {[1, 2, 3].map((item) => (
                            <div
                              key={item}
                              className={`h-1 w-5 rounded ${
                                template.id === "C"
                                  ? "bg-white/40"
                                  : "bg-slate-300"
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Mini hero */}
                      <div className="flex gap-3 px-3 py-4">
                        <div className="flex-1 space-y-2">
                          <div className={`h-2 w-full rounded ${design.heading}`} />

                          <div
                            className={`h-2 w-3/4 rounded ${design.heading} opacity-70`}
                          />

                          <div
                            className={`h-1 w-full rounded ${
                              template.id === "C"
                                ? "bg-white/30"
                                : "bg-slate-300"
                            }`}
                          />

                          <div
                            className={`h-1 w-4/5 rounded ${
                              template.id === "C"
                                ? "bg-white/30"
                                : "bg-slate-300"
                            }`}
                          />

                          <div
                            className={`mt-3 h-4 w-16 rounded ${design.button}`}
                          />
                        </div>

                        <div
                          className={`flex h-16 w-2/5 items-center justify-center rounded-lg ${design.illustration}`}
                        >
                          <Stethoscope
                            size={25}
                            className={
                              template.id === "C"
                                ? "text-[#d9b88a]"
                                : template.id === "B"
                                  ? "text-teal-700"
                                  : "text-blue-600"
                            }
                          />
                        </div>
                      </div>

                      {/* Mini service cards */}
                      <div className="flex gap-2 px-3">
                        {[1, 2, 3].map((item) => (
                          <div
                            key={item}
                            className={`h-7 flex-1 rounded-md ${
                              template.id === "C"
                                ? "border border-white/20 bg-white/10"
                                : "border border-slate-200 bg-white"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Template information */}
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
                        <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                          Selected
                        </span>
                      )}
                    </div>

                    <div
                      className={`mt-4 rounded-lg py-2 text-center text-xs font-bold ${
                        selected
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {selected ? "Current Selection" : "Select Template"}
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
