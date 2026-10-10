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

  async function saveTemplate() {
    if (!clinic || savingTemplate || selectedTemplate === savedTemplate) return;
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
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save website template.");
    } finally {
      setSavingTemplate(false);
    }
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
    <main className="min-h-dvh bg-slate-100 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link
          to={isDraft ? `${base}/services/setup` : `/dashboard/clinic/${clinicId}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600"
        >
          <ArrowLeft size={17} />
          {isDraft ? "Back to Services & Availability" : "Back to Dashboard"}
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {isDraft && (
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Step 4 of 6</p>
            )}
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Your Clinic Website</h1>
            <p className="mt-2 text-sm text-slate-600">
              Choose a template and preview your clinic's information in that design.
            </p>
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
            <button type="button" aria-pressed={device === "desktop"}
              onClick={() => setDevice("desktop")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${device === "desktop" ? "bg-blue-600 text-white" : "text-slate-600"}`}>
              <Monitor size={16} /> Desktop
            </button>
            <button type="button" aria-pressed={device === "mobile"}
              onClick={() => setDevice("mobile")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${device === "mobile" ? "bg-blue-600 text-white" : "text-slate-600"}`}>
              <Smartphone size={16} /> Mobile
            </button>
          </div>
        </div>

        {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

        {clinic && (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-bold text-slate-900">Choose Your Website Template</h2>
              <p className="mt-1 text-sm text-slate-500">
                Your saved clinic details automatically appear in every template.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {availableTemplates.map((template) => {
                  const selected = selectedTemplate === template.id;
                  return (
                    <button key={template.id} type="button" aria-pressed={selected}
                      disabled={!canEdit || savingTemplate}
                      onClick={() => { setSelectedTemplate(template.id); setSuccess(""); }}
                      className={`rounded-xl border-2 p-5 text-left transition disabled:opacity-60 ${selected ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:border-blue-300"}`}>
                      <div className="mb-4 flex h-28 items-center justify-center rounded-lg bg-slate-100 text-3xl font-bold text-blue-600">
                        {template.id}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">{template.name}</span>
                        {selected && <span className="text-xs font-bold text-blue-600">Selected</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
              {success && <p role="status" className="mt-4 text-sm text-green-700">{success}</p>}
              {hasUnsavedSelection && (
                <p className="mt-4 text-sm text-amber-700">Previewing an unsaved template selection.</p>
              )}
              <button type="button" onClick={saveTemplate}
                disabled={!canEdit || savingTemplate || !hasUnsavedSelection}
                className="mt-5 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">
                {savingTemplate ? "Saving..." : "Save Selected Template"}
              </button>
            </section>

            <div className="overflow-auto rounded-2xl border border-slate-200 bg-slate-200 p-2 shadow-sm sm:p-5">
              <div className={`mx-auto overflow-hidden rounded-xl bg-white shadow-lg transition-all ${device === "mobile" ? "max-w-[390px]" : "max-w-full"}`}>
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
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-600">
                  Your clinic information is already saved. Continue once your template selection is saved.
                </p>
                <button type="button"
                  disabled={savingTemplate || hasUnsavedSelection}
                  onClick={() => navigate(`${base}/subscription/setup`)}
                  className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                  Continue to Subscription <ArrowRight size={18} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
