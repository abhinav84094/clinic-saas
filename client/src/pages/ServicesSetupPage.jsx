import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, LoaderCircle, Pencil, Plus, X } from "lucide-react";
import api from "../services/api";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const inputClass = "mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100";
const idOf = (v) => String(v && typeof v === "object" ? (v._id || v.id || "") : (v || ""));
const getError = (e) => e.response?.data?.message || e.message || "Something went wrong.";
const keyOf = (s) => `${idOf(s.doctorId)}|${s.startTime}|${s.endTime}`;
const sid = (s) => idOf(s._id || s.id);
const defaultSchedule = { doctorId: "", daysOfWeek: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "17:00" };

function Section({ title, description, children }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
    <h2 className="text-lg font-bold text-slate-900">{title}</h2>
    <p className="mb-5 mt-1 text-sm text-slate-500">{description}</p>
    {children}
  </section>;
}

export default function ServicesSetupPage() {
  const { clinicId } = useParams();
  const navigate = useNavigate();
  const base = `/clinics/${clinicId}`;
  const [clinic, setClinic] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [serviceForm, setServiceForm] = useState({ name: "", description: "" });
  const [offeringForm, setOfferingForm] = useState({ doctorId: "", serviceId: "", fee: "", durationMinutes: "30" });
  const [scheduleForm, setScheduleForm] = useState(defaultSchedule);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [showOfferingForm, setShowOfferingForm] = useState(false);
  const [editingOfferingId, setEditingOfferingId] = useState(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingScheduleIds, setEditingScheduleIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const activeDoctors = doctors.filter((d) => d.isActive);
  const activeServices = services.filter((s) => s.isActive);
  const isDraft = clinic?.status === "draft";
  const clearMessages = () => { setError(""); setSuccess(""); };
  const doctorName = (id) => doctors.find((d) => idOf(d) === idOf(id))?.name || "Doctor";
  const serviceName = (id) => services.find((s) => idOf(s) === idOf(id))?.name || "Service";

  async function refreshCatalog() {
    const [s, o] = await Promise.all([
      api.get(`${base}/services?includeInactive=true`),
      api.get(`${base}/doctor-services?includeInactive=true`),
    ]);
    setServices(s.data.services || []);
    setOfferings(o.data.offerings || []);
  }
  async function refreshSchedules(list = doctors) {
    const results = await Promise.all(list.map((d) => api.get(`${base}/schedules`, { params: { doctorId: idOf(d), includeInactive: true } })));
    setSchedules(results.flatMap((r) => r.data.schedules || []));
  }
  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true);
      try {
        const [c, d, s, o] = await Promise.all([
          api.get(base), api.get(`${base}/doctors?includeInactive=true`),
          api.get(`${base}/services?includeInactive=true`), api.get(`${base}/doctor-services?includeInactive=true`),
        ]);
        const dl = d.data.doctors || [];
        const sl = s.data.services || [];
        const results = await Promise.all(dl.map((doctor) => api.get(`${base}/schedules`, { params: { doctorId: idOf(doctor), includeInactive: true } })));
        if (!live) return;
        setClinic(c.data.clinic); setDoctors(dl); setServices(sl);
        setOfferings(o.data.offerings || []);
        setSchedules(results.flatMap((r) => r.data.schedules || []));
        const doctorId = idOf(dl.find((x) => x.isActive));
        const serviceId = idOf(sl.find((x) => x.isActive));
        setOfferingForm((p) => ({ ...p, doctorId, serviceId }));
        setScheduleForm((p) => ({ ...p, doctorId }));
      } catch (e) { if (live) setError(getError(e)); }
      finally { if (live) setLoading(false); }
    }
    load();
    return () => { live = false; };
  }, [base]);

  async function addService(e) {
    e.preventDefault(); if (busy) return;
    clearMessages(); setBusy("service");
    try {
      const r = await api.post(`${base}/services`, { name: serviceForm.name.trim(), description: serviceForm.description.trim() });
      await refreshCatalog();
      const serviceId = idOf(r.data.service);
      if (serviceId) setOfferingForm((p) => ({ ...p, serviceId }));
      setServiceForm({ name: "", description: "" }); setShowServiceForm(false);
      setSuccess("Service added successfully.");
    } catch (err) { setError(getError(err)); } finally { setBusy(""); }
  }
  function openAddOffering() {
    clearMessages(); setEditingOfferingId(null);
    setOfferingForm({ doctorId: idOf(activeDoctors[0]), serviceId: idOf(activeServices[0]), fee: "", durationMinutes: "30" });
    setShowOfferingForm(true);
  }
  function openEditOffering(o) {
    clearMessages(); setEditingOfferingId(sid(o));
    setOfferingForm({ doctorId: idOf(o.doctorId), serviceId: idOf(o.serviceId), fee: String(o.fee), durationMinutes: String(o.durationMinutes) });
    setShowOfferingForm(true);
  }
  async function saveOffering(e) {
    e.preventDefault(); if (busy) return;
    clearMessages();
    if (offeringForm.fee === "" || offeringForm.durationMinutes === "") return setError("Enter a fee and duration.");
    if (!editingOfferingId && offerings.some((o) => idOf(o.doctorId) === offeringForm.doctorId && idOf(o.serviceId) === offeringForm.serviceId)) {
      return setError("This consultation already exists. Use Edit on its card.");
    }
    setBusy("offering");
    try {
      const data = { fee: Number(offeringForm.fee), durationMinutes: Number(offeringForm.durationMinutes) };
      if (editingOfferingId) await api.patch(`${base}/doctor-services/${editingOfferingId}`, data);
      else await api.post(`${base}/doctor-services`, { ...data, doctorId: offeringForm.doctorId, serviceId: offeringForm.serviceId });
      await refreshCatalog(); setShowOfferingForm(false); setEditingOfferingId(null);
      setSuccess("Consultation saved successfully.");
    } catch (err) { setError(getError(err)); } finally { setBusy(""); }
  }

  const scheduleGroups = useMemo(() => {
    const map = new Map();
    for (const schedule of schedules.filter((s) => s.isActive)) {
      const key = keyOf(schedule);
      if (!map.has(key)) map.set(key, { key, doctorId: idOf(schedule.doctorId), startTime: schedule.startTime, endTime: schedule.endTime, items: [] });
      map.get(key).items.push(schedule);
    }
    return [...map.values()].sort((a, b) => a.doctorId.localeCompare(b.doctorId) || a.startTime.localeCompare(b.startTime));
  }, [schedules]);

  function openAddSchedule() {
    clearMessages(); setEditingScheduleIds([]);
    setScheduleForm({ ...defaultSchedule, daysOfWeek: [...defaultSchedule.daysOfWeek], doctorId: idOf(activeDoctors[0]) });
    setShowScheduleForm(true);
  }
  function openEditSchedule(group) {
    clearMessages(); setEditingScheduleIds(group.items.map(sid));
    setScheduleForm({ doctorId: group.doctorId, daysOfWeek: [...new Set(group.items.map((s) => Number(s.dayOfWeek)))].sort(), startTime: group.startTime, endTime: group.endTime });
    setShowScheduleForm(true);
  }
  function closeSchedule() { if (busy) return; setShowScheduleForm(false); setEditingScheduleIds([]); clearMessages(); }
  function toggleDay(day) {
    setScheduleForm((p) => ({ ...p, daysOfWeek: p.daysOfWeek.includes(day) ? p.daysOfWeek.filter((d) => d !== day) : [...p.daysOfWeek, day].sort() }));
    clearMessages();
  }

  async function saveSchedule(e) {
    e.preventDefault(); if (busy) return;
    clearMessages();
    const { doctorId, startTime, endTime } = scheduleForm;
    const days = [...new Set(scheduleForm.daysOfWeek)].sort();
    if (!doctorId || !days.length) return setError("Select a doctor and at least one day.");
    if (startTime >= endTime) return setError("End time must be later than start time.");
    const editSet = new Set(editingScheduleIds);
    const conflicts = schedules.filter((s) => s.isActive && idOf(s.doctorId) === doctorId && !editSet.has(sid(s)) && days.includes(Number(s.dayOfWeek)) && s.startTime < endTime && s.endTime > startTime);
    if (conflicts.length) return setError(`Overlapping working hours on ${[...new Set(conflicts.map((s) => DAYS[s.dayOfWeek]))].join(", ")}.`);

    setBusy("schedule");
    const errors = [];
    let changed = 0;
    try {
      const originals = schedules.filter((s) => editSet.has(sid(s)));
      const existingByDay = new Map(originals.map((s) => [Number(s.dayOfWeek), s]));
      // Remove deselected days first, freeing their slots.
      for (const old of originals.filter((s) => !days.includes(Number(s.dayOfWeek)))) {
        try { await api.patch(`${base}/schedules/${sid(old)}/status`, { isActive: false }); changed++; }
        catch (err) { errors.push(`${DAYS[old.dayOfWeek]}: ${getError(err)}`); }
      }
      for (const day of days) {
        const old = existingByDay.get(day);
        try {
          if (old) {
            if (old.startTime !== startTime || old.endTime !== endTime) {
              await api.patch(`${base}/schedules/${sid(old)}`, { startTime, endTime }); changed++;
            }
          } else {
            // Reuse an inactive identical record if possible; otherwise create a new shift.
            const inactive = schedules.find((s) => !s.isActive && idOf(s.doctorId) === doctorId && Number(s.dayOfWeek) === day && s.startTime === startTime && s.endTime === endTime);
            if (inactive) await api.patch(`${base}/schedules/${sid(inactive)}/status`, { isActive: true });
            else await api.post(`${base}/schedules`, { doctorId, dayOfWeek: day, startTime, endTime });
            changed++;
          }
        } catch (err) { errors.push(`${DAYS[day]}: ${getError(err)}`); }
      }
      try { await refreshSchedules(); }
      catch { errors.push("Could not refresh schedules. Reload before retrying."); }
      if (errors.length) setError(`${changed} change(s) saved. ${errors.join("; ")}`);
      else { setShowScheduleForm(false); setEditingScheduleIds([]); setSuccess("Working hours saved successfully."); }
    } finally { setBusy(""); }
  }

  const validOfferings = offerings.filter((o) => o.isActive && activeDoctors.some((d) => idOf(d) === idOf(o.doctorId)) && activeServices.some((s) => idOf(s) === idOf(o.serviceId)));
  const activeSchedules = schedules.filter((s) => s.isActive && activeDoctors.some((d) => idOf(d) === idOf(s.doctorId)));
  const canContinue = isDraft && validOfferings.length > 0 && activeSchedules.length > 0;
  if (loading) return <main className="flex min-h-dvh items-center justify-center gap-2 text-slate-600"><LoaderCircle size={20} className="animate-spin" /> Loading services...</main>;

  return <main className="min-h-dvh bg-slate-50 px-4 py-6 sm:px-6 sm:py-10"><div className="mx-auto max-w-3xl space-y-6">
    <Link to={`/clinics/${clinicId}/doctors/setup`} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600"><ArrowLeft size={17}/> Back to Doctors</Link>
    <header><div className="mb-3 flex items-center justify-between"><Clock3 size={25} className="text-blue-600"/><span className="text-xs font-semibold text-blue-600">STEP 3 OF 6</span></div><div className="mb-5 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full w-1/2 rounded-full bg-blue-600"/></div><h1 className="text-2xl font-bold text-slate-900">Services & Availability</h1><p className="mt-2 text-sm text-slate-500">Configure consultations and working hours for {clinic?.name || "your clinic"}.</p></header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {success && <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 size={18}/>{success}</p>}
    {!isDraft && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">This clinic is not in draft status. Onboarding changes are disabled.</p>}

    <Section title="1. Clinic Services" description="Create the types of consultations offered by your clinic.">
      <div className="space-y-3">{services.map((s) => <div key={idOf(s)} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><p className="font-semibold text-slate-900">{s.name}</p>{s.description && <p className="mt-1 text-sm text-slate-500">{s.description}</p>}</div><span className={`rounded-full px-3 py-1 text-xs ${s.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{s.isActive ? "Active" : "Inactive"}</span></div>)}{!services.length && <p className="text-sm text-slate-500">No services added yet.</p>}</div>
      {isDraft && <div className="mt-5">{!showServiceForm ? <button type="button" disabled={!!busy} onClick={() => { clearMessages(); setShowServiceForm(true); }} className="flex min-h-16 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 font-semibold text-blue-700"><Plus size={19}/> Add Service</button> : <form onSubmit={addService} className="space-y-4 rounded-xl border border-slate-200 p-4"><div className="flex justify-between"><strong>Add Service</strong><button type="button" disabled={!!busy} onClick={() => setShowServiceForm(false)}>Cancel</button></div><label className="block text-sm font-medium">Service Name<input required minLength={2} maxLength={120} className={inputClass} value={serviceForm.name} onChange={(e) => setServiceForm((p) => ({ ...p, name: e.target.value }))}/></label><label className="block text-sm font-medium">Description<textarea className={inputClass} rows={2} value={serviceForm.description} onChange={(e) => setServiceForm((p) => ({ ...p, description: e.target.value }))}/></label><button disabled={!!busy} className="min-h-11 w-full rounded-xl bg-blue-600 font-semibold text-white">Save Service</button></form>}</div>}
    </Section>

    <Section title="2. Doctor Consultation Details" description="Manage consultation fees and durations for each doctor.">
      <div className="space-y-3">{offerings.map((o) => <div key={sid(o)} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><p className="font-semibold text-slate-900">{doctorName(o.doctorId)} — {serviceName(o.serviceId)}</p><p className="mt-1 text-sm text-slate-500">₹{o.fee} · {o.durationMinutes} minutes {!o.isActive && "· Inactive"}</p></div>{isDraft && <button type="button" disabled={!!busy} onClick={() => openEditOffering(o)} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-600"><Pencil size={15}/> Edit</button>}</div>)}{!offerings.length && <p className="text-sm text-slate-500">No consultations configured yet.</p>}</div>
      {isDraft && <div className="mt-5">{!showOfferingForm ? <button type="button" disabled={!!busy || !activeDoctors.length || !activeServices.length} onClick={openAddOffering} className="flex min-h-16 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 font-semibold text-blue-700 disabled:opacity-50"><Plus size={19}/> Add Consultation</button> : <form onSubmit={saveOffering} className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2"><div className="flex items-center justify-between sm:col-span-2"><strong>{editingOfferingId ? "Edit Consultation" : "Add Consultation"}</strong><button type="button" disabled={!!busy} onClick={() => { setShowOfferingForm(false); setEditingOfferingId(null); }} className="inline-flex items-center gap-1 text-sm text-slate-500"><X size={16}/> Cancel</button></div><label className="text-sm font-medium">Doctor<select required disabled={!!editingOfferingId || !!busy} value={offeringForm.doctorId} onChange={(e) => setOfferingForm((p) => ({ ...p, doctorId: e.target.value }))} className={inputClass}><option value="">Select Doctor</option>{activeDoctors.map((d) => <option key={idOf(d)} value={idOf(d)}>{d.name}</option>)}</select></label><label className="text-sm font-medium">Service<select required disabled={!!editingOfferingId || !!busy} value={offeringForm.serviceId} onChange={(e) => setOfferingForm((p) => ({ ...p, serviceId: e.target.value }))} className={inputClass}><option value="">Select Service</option>{activeServices.map((s) => <option key={idOf(s)} value={idOf(s)}>{s.name}</option>)}</select></label><label className="text-sm font-medium">Consultation Fee (₹)<input required type="number" min="0" max="1000000" step="0.01" value={offeringForm.fee} onChange={(e) => setOfferingForm((p) => ({ ...p, fee: e.target.value }))} className={inputClass}/></label><label className="text-sm font-medium">Duration (Minutes)<input required type="number" min="5" max="480" step="1" value={offeringForm.durationMinutes} onChange={(e) => setOfferingForm((p) => ({ ...p, durationMinutes: e.target.value }))} className={inputClass}/></label><button disabled={!!busy} className="min-h-12 rounded-xl bg-blue-600 font-semibold text-white sm:col-span-2">{busy === "offering" ? "Saving..." : editingOfferingId ? "Save Changes" : "Add Consultation"}</button></form>}</div>}
    </Section>

    <Section title="3. Weekly Doctor Availability" description="Manage doctors' recurring working days and hours.">
      <div className="space-y-3">{scheduleGroups.map((g) => <div key={g.key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><p className="font-semibold text-slate-900">{doctorName(g.doctorId)}</p><p className="mt-1 text-sm text-slate-600">{[...new Set(g.items.map((s) => Number(s.dayOfWeek)))].sort().map((day) => DAYS[day]).join(", ")}</p><p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><Clock3 size={15}/>{g.startTime} – {g.endTime}</p></div>{isDraft && <button type="button" disabled={!!busy} onClick={() => openEditSchedule(g)} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"><Pencil size={15}/> Edit</button>}</div>)}{!scheduleGroups.length && <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">No working hours configured yet.</p>}</div>
      {isDraft && <div className="mt-5">{!showScheduleForm ? <button type="button" disabled={!!busy || !activeDoctors.length} onClick={openAddSchedule} className="flex min-h-16 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 font-semibold text-blue-700 disabled:opacity-50"><Plus size={19}/> Add Working Hours</button> : <form onSubmit={saveSchedule} className="mt-4 grid gap-5 rounded-xl border border-slate-200 p-4 sm:grid-cols-2"><div className="flex items-center justify-between sm:col-span-2"><strong>{editingScheduleIds.length ? "Edit Working Hours" : "Add Working Hours"}</strong><button type="button" disabled={!!busy} onClick={closeSchedule} className="inline-flex items-center gap-1 text-sm text-slate-500"><X size={16}/> Cancel</button></div><label className="text-sm font-medium sm:col-span-2">Doctor<select required disabled={!!editingScheduleIds.length || !!busy} value={scheduleForm.doctorId} onChange={(e) => setScheduleForm((p) => ({ ...p, doctorId: e.target.value }))} className={inputClass}><option value="">Select Doctor</option>{activeDoctors.map((d) => <option key={idOf(d)} value={idOf(d)}>{d.name}</option>)}</select></label><div className="sm:col-span-2"><div className="mb-3 flex items-center justify-between gap-2"><span className="text-sm font-medium">Working Days</span><div className="flex gap-3 text-xs font-semibold"><button type="button" onClick={() => setScheduleForm((p) => ({ ...p, daysOfWeek: [0,1,2,3,4,5,6] }))} className="text-blue-600">Select All</button><button type="button" onClick={() => setScheduleForm((p) => ({ ...p, daysOfWeek: [] }))} className="text-slate-500">Clear</button></div></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{DAYS.map((day, i) => <button type="button" key={day} aria-pressed={scheduleForm.daysOfWeek.includes(i)} onClick={() => toggleDay(i)} className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-medium ${scheduleForm.daysOfWeek.includes(i) ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700"}`}>{day}</button>)}</div><p className="mt-2 text-xs text-slate-500">{scheduleForm.daysOfWeek.length} day(s) selected</p></div><label className="text-sm font-medium">Start Time<input type="time" required className={inputClass} value={scheduleForm.startTime} onChange={(e) => setScheduleForm((p) => ({ ...p, startTime: e.target.value }))}/></label><label className="text-sm font-medium">End Time<input type="time" required className={inputClass} value={scheduleForm.endTime} onChange={(e) => setScheduleForm((p) => ({ ...p, endTime: e.target.value }))}/></label><button disabled={!!busy || !scheduleForm.daysOfWeek.length} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white disabled:opacity-50 sm:col-span-2">{busy === "schedule" ? <><LoaderCircle size={18} className="animate-spin"/> Saving...</> : <><Clock3 size={18}/>{editingScheduleIds.length ? "Save Changes" : "Save Working Hours"}</>}</button></form>}</div>}
    </Section>

    <Section title="Setup Progress" description="Complete these requirements before continuing."><div className="space-y-3 text-sm"><p className={validOfferings.length ? "text-emerald-700" : "text-slate-500"}>{validOfferings.length ? "✓" : "○"} At least one active doctor-service assignment</p><p className={activeSchedules.length ? "text-emerald-700" : "text-slate-500"}>{activeSchedules.length ? "✓" : "○"} At least one active working schedule</p></div><button type="button" disabled={!canContinue || !!busy} onClick={() => navigate(`/clinics/${clinicId}/website/setup`)} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Continue to Website Customization <ArrowRight size={18}/></button></Section>
  </div></main>;
}
