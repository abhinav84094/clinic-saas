
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CalendarClock,
  ClipboardList,
  LoaderCircle,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import api from "../../services/api";

const DAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none";

const idOf = (value) =>
  String(
    value && typeof value === "object"
      ? value._id || value.id || ""
      : value || ""
  );

const getError = (error) => {
  const issues = error.response?.data?.errors;
  if (Array.isArray(issues) && issues.length) {
    return issues.map((item) => item.message).join("; ");
  }
  return error.response?.data?.message ||
    "Something went wrong. Please try again.";
};

const emptyService = { name: "", description: "" };
const emptyOffering = {
  doctorId: "",
  serviceId: "",
  fee: "",
  durationMinutes: "30",
};
const emptySchedule = {
  doctorId: "",
  dayOfWeek: "1",
  startTime: "09:00",
  endTime: "17:00",
};

function Section({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-bold text-slate-900">
        {title}
      </h2>
      <p className="mb-5 mt-1 text-sm text-slate-500">
        {description}
      </p>
      {children}
    </section>
  );
}

function StatusButton({ active, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${
        active
          ? "border-red-200 text-red-700"
          : "border-green-200 text-green-700"
      }`}
    >
      {active ? "Deactivate" : "Activate"}
    </button>
  );
}

export default function ServicesManagementPage() {
  const { clinicId } = useParams();
  const base = `/clinics/${clinicId}`;

  const [clinic, setClinic] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [schedules, setSchedules] = useState([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [serviceForm, setServiceForm] = useState(null);
  const [serviceEditId, setServiceEditId] = useState(null);

  const [offeringForm, setOfferingForm] = useState(null);
  const [offeringEditId, setOfferingEditId] = useState(null);

  const [scheduleForm, setScheduleForm] = useState(null);
  const [scheduleEditId, setScheduleEditId] = useState(null);

  const load = useCallback(async () => {
    const [c, d, s, o] = await Promise.all([
      api.get(base),
      api.get(`${base}/doctors?includeInactive=true`),
      api.get(`${base}/services?includeInactive=true`),
      api.get(`${base}/doctor-services?includeInactive=true`),
    ]);

    const doctorList = d.data.doctors || [];

    const scheduleResponses = await Promise.all(
      doctorList.map((doctor) =>
        api.get(`${base}/schedules`, {
          params: {
            doctorId: idOf(doctor),
            includeInactive: true,
          },
        })
      )
    );

    setClinic(c.data.clinic);
    setDoctors(doctorList);
    setServices(s.data.services || []);
    setOfferings(o.data.offerings || []);
    setSchedules(
      scheduleResponses.flatMap(
        (response) => response.data.schedules || []
      )
    );
  }, [base]);

  useEffect(() => {
    let alive = true;

    async function initialize() {
      setLoading(true);
      try {
        await load();
      } catch (err) {
        if (alive) setError(getError(err));
      } finally {
        if (alive) setLoading(false);
      }
    }

    initialize();
    return () => { alive = false; };
  }, [load]);

  const canManage =
    clinic?.status === "draft" ||
    clinic?.status === "active";

  const activeDoctors = doctors.filter((d) => d.isActive);
  const activeServices = services.filter((s) => s.isActive);

  const doctorName = (value) =>
    doctors.find((d) => idOf(d) === idOf(value))?.name ||
    "Unknown doctor";

  const serviceName = (value) =>
    services.find((s) => idOf(s) === idOf(value))?.name ||
    "Unknown service";

  async function perform(action, message) {
    if (busy || !canManage) return;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      await action();
      await load();
      setSuccess(message);
    } catch (err) {
      setError(getError(err));
      // Refresh even when a request's final state is uncertain.
      try { await load(); } catch { /* keep original error */ }
    } finally {
      setBusy(false);
    }
  }

  function startService(service = null) {
    setError("");
    setServiceEditId(service ? idOf(service) : null);
    setServiceForm(
      service
        ? {
            name: service.name,
            description: service.description || "",
          }
        : { ...emptyService }
    );
  }

  async function saveService(event) {
    event.preventDefault();

    const payload = {
      name: serviceForm.name.trim(),
      description: serviceForm.description.trim(),
    };

    if (payload.name.length < 2) {
      setError("Service name must contain at least 2 characters.");
      return;
    }

    await perform(async () => {
      if (serviceEditId) {
        await api.patch(
          `${base}/services/${serviceEditId}`,
          payload
        );
      } else {
        await api.post(`${base}/services`, payload);
      }
      setServiceForm(null);
      setServiceEditId(null);
    }, "Service saved successfully.");
  }

  function startOffering(offering = null) {
    setError("");
    setOfferingEditId(offering ? idOf(offering) : null);
    setOfferingForm(
      offering
        ? {
            doctorId: idOf(offering.doctorId),
            serviceId: idOf(offering.serviceId),
            fee: String(offering.fee),
            durationMinutes: String(offering.durationMinutes),
          }
        : {
            ...emptyOffering,
            doctorId: idOf(activeDoctors[0]),
            serviceId: idOf(activeServices[0]),
          }
    );
  }

  async function saveOffering(event) {
    event.preventDefault();

    const fee = Number(offeringForm.fee);
    const durationMinutes = Number(
      offeringForm.durationMinutes
    );

    if (
      offeringForm.fee === "" ||
      !Number.isFinite(fee) ||
      fee < 0 ||
      fee > 1000000 ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 5 ||
      durationMinutes > 480
    ) {
      setError("Enter a valid fee and duration.");
      return;
    }

    const payload = { fee, durationMinutes };

    await perform(async () => {
      if (offeringEditId) {
        await api.patch(
          `${base}/doctor-services/${offeringEditId}`,
          payload
        );
      } else {
        await api.post(`${base}/doctor-services`, {
          ...payload,
          doctorId: offeringForm.doctorId,
          serviceId: offeringForm.serviceId,
        });
      }

      setOfferingForm(null);
      setOfferingEditId(null);
    }, "Consultation saved successfully.");
  }

  function startSchedule(schedule = null) {
    setError("");
    setScheduleEditId(schedule ? idOf(schedule) : null);
    setScheduleForm(
      schedule
        ? {
            doctorId: idOf(schedule.doctorId),
            dayOfWeek: String(schedule.dayOfWeek),
            startTime: schedule.startTime,
            endTime: schedule.endTime,
          }
        : {
            ...emptySchedule,
            doctorId: idOf(activeDoctors[0]),
          }
    );
  }

  async function saveSchedule(event) {
    event.preventDefault();

    if (scheduleForm.startTime >= scheduleForm.endTime) {
      setError("End time must be after start time.");
      return;
    }

    const payload = {
      dayOfWeek: Number(scheduleForm.dayOfWeek),
      startTime: scheduleForm.startTime,
      endTime: scheduleForm.endTime,
    };

    await perform(async () => {
      if (scheduleEditId) {
        await api.patch(
          `${base}/schedules/${scheduleEditId}`,
          payload
        );
      } else {
        await api.post(`${base}/schedules`, {
          ...payload,
          doctorId: scheduleForm.doctorId,
        });
      }

      setScheduleForm(null);
      setScheduleEditId(null);
    }, "Working hours saved successfully.");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-12">
        <LoaderCircle className="animate-spin" size={20} />
        Loading clinic services...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Services & Availability
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Manage clinic services, consultation pricing,
            and doctor working hours.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            perform(async () => {}, "Information refreshed.")
          }
          className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {success && (
        <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-700">
          {success}
        </p>
      )}

      {!canManage && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          Management is unavailable for this clinic status.
        </p>
      )}

      <Section
        title="Clinic Services"
        description="Manage services offered by your clinic."
      >
        <div className="space-y-3">
          {services.map((service) => (
            <div
              key={idOf(service)}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
            >
              <div>
                <p className="font-semibold">{service.name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {service.description || "No description"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {service.isActive ? "Active" : "Inactive"}
                </p>
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => startService(service)}
                    className="rounded-lg border px-3 py-2 text-xs font-semibold"
                  >
                    Edit
                  </button>
                  <StatusButton
                    active={service.isActive}
                    disabled={busy}
                    onClick={() =>
                      perform(
                        () =>
                          api.patch(
                            `${base}/services/${idOf(service)}/status`,
                            { isActive: !service.isActive }
                          ),
                        "Service status updated."
                      )
                    }
                  />
                </div>
              )}
            </div>
          ))}
          {!services.length && (
            <p className="text-sm text-slate-500">
              No services configured yet.
            </p>
          )}
        </div>

        {canManage && !serviceForm && (
          <button
            type="button"
            disabled={busy}
            onClick={() => startService()}
            className="mt-4 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Plus size={17} /> Add Service
          </button>
        )}

        {serviceForm && (
          <form onSubmit={saveService} className="mt-5 space-y-4 rounded-xl border p-4">
            <div className="flex justify-between">
              <strong>{serviceEditId ? "Edit Service" : "Add Service"}</strong>
              <button type="button" disabled={busy} onClick={() => setServiceForm(null)}>
                <X size={18} />
              </button>
            </div>
            <label className="block text-sm font-medium">
              Service Name
              <input
                required minLength={2} maxLength={120}
                className={inputClass}
                value={serviceForm.name}
                onChange={(e) => setServiceForm((p) => ({ ...p, name: e.target.value }))}
              />
            </label>
            <label className="block text-sm font-medium">
              Description
              <textarea
                maxLength={2000}
                rows={3}
                className={inputClass}
                value={serviceForm.description}
                onChange={(e) => setServiceForm((p) => ({ ...p, description: e.target.value }))}
              />
            </label>
            <button disabled={busy} className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50">
              {busy ? "Saving..." : "Save Service"}
            </button>
          </form>
        )}
      </Section>

      <Section
        title="Doctor Consultations"
        description="Assign services to doctors and configure fees and duration."
      >
        <div className="space-y-3">
          {offerings.map((offering) => (
            <div
              key={idOf(offering)}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
            >
              <div>
                <p className="font-semibold">
                  {doctorName(offering.doctorId)} — {serviceName(offering.serviceId)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  ₹{offering.fee} · {offering.durationMinutes} minutes
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {offering.isActive ? "Active" : "Inactive"}
                </p>
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <button
                    type="button" disabled={busy}
                    onClick={() => startOffering(offering)}
                    className="rounded-lg border px-3 py-2 text-xs font-semibold"
                  >
                    Edit
                  </button>
                  <StatusButton
                    active={offering.isActive}
                    disabled={busy}
                    onClick={() =>
                      perform(
                        () =>
                          api.patch(
                            `${base}/doctor-services/${idOf(offering)}/status`,
                            { isActive: !offering.isActive }
                          ),
                        "Consultation status updated."
                      )
                    }
                  />
                </div>
              )}
            </div>
          ))}
          {!offerings.length && (
            <p className="text-sm text-slate-500">No consultations configured.</p>
          )}
        </div>

        {canManage && !offeringForm && (
          <button
            type="button"
            disabled={busy || !activeDoctors.length || !activeServices.length}
            onClick={() => startOffering()}
            className="mt-4 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Plus size={17} /> Add Consultation
          </button>
        )}

        {offeringForm && (
          <form onSubmit={saveOffering} className="mt-5 grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
            <div className="flex justify-between sm:col-span-2">
              <strong>{offeringEditId ? "Edit Consultation" : "Add Consultation"}</strong>
              <button type="button" disabled={busy} onClick={() => setOfferingForm(null)}>
                <X size={18} />
              </button>
            </div>

            <label className="text-sm font-medium">
              Doctor
              <select
                required
                disabled={!!offeringEditId}
                className={inputClass}
                value={offeringForm.doctorId}
                onChange={(e) => setOfferingForm((p) => ({ ...p, doctorId: e.target.value }))}
              >
                <option value="">Select Doctor</option>
                {activeDoctors.map((d) => (
                  <option key={idOf(d)} value={idOf(d)}>{d.name}</option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Service
              <select
                required
                disabled={!!offeringEditId}
                className={inputClass}
                value={offeringForm.serviceId}
                onChange={(e) => setOfferingForm((p) => ({ ...p, serviceId: e.target.value }))}
              >
                <option value="">Select Service</option>
                {activeServices.map((s) => (
                  <option key={idOf(s)} value={idOf(s)}>{s.name}</option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Consultation Fee (₹)
              <input
                required type="number" min="0" max="1000000" step="0.01"
                className={inputClass}
                value={offeringForm.fee}
                onChange={(e) => setOfferingForm((p) => ({ ...p, fee: e.target.value }))}
              />
            </label>

            <label className="text-sm font-medium">
              Duration (Minutes)
              <input
                required type="number" min="5" max="480" step="1"
                className={inputClass}
                value={offeringForm.durationMinutes}
                onChange={(e) => setOfferingForm((p) => ({ ...p, durationMinutes: e.target.value }))}
              />
            </label>

            <button
              disabled={busy}
              className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50 sm:col-span-2"
            >
              {busy ? "Saving..." : "Save Consultation"}
            </button>
          </form>
        )}
      </Section>

      <Section
        title="Doctor Working Hours"
        description="Configure individual weekly shifts. Overlapping active shifts are rejected by the backend."
      >
        <div className="mb-4 flex items-center gap-2 text-blue-600">
          <CalendarClock size={19} />
          <span className="text-sm font-medium">
            Weekly availability
          </span>
        </div>

        <div className="space-y-3">
          {[...schedules]
            .sort((a, b) =>
              idOf(a.doctorId).localeCompare(idOf(b.doctorId)) ||
              a.dayOfWeek - b.dayOfWeek ||
              a.startTime.localeCompare(b.startTime)
            )
            .map((schedule) => (
              <div
                key={idOf(schedule)}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
              >
                <div>
                  <p className="font-semibold">
                    {doctorName(schedule.doctorId)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {DAYS[schedule.dayOfWeek]} · {schedule.startTime} – {schedule.endTime}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {schedule.isActive ? "Active" : "Inactive"}
                  </p>
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    <button
                      type="button" disabled={busy}
                      onClick={() => startSchedule(schedule)}
                      className="rounded-lg border px-3 py-2 text-xs font-semibold"
                    >
                      Edit
                    </button>
                    <StatusButton
                      active={schedule.isActive}
                      disabled={busy}
                      onClick={() =>
                        perform(
                          () =>
                            api.patch(
                              `${base}/schedules/${idOf(schedule)}/status`,
                              { isActive: !schedule.isActive }
                            ),
                          "Schedule status updated."
                        )
                      }
                    />
                  </div>
                )}
              </div>
            ))}

          {!schedules.length && (
            <p className="text-sm text-slate-500">
              No working hours configured yet.
            </p>
          )}
        </div>

        {canManage && !scheduleForm && (
          <button
            type="button"
            disabled={busy || !activeDoctors.length}
            onClick={() => startSchedule()}
            className="mt-4 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Plus size={17} /> Add Working Hours
          </button>
        )}

        {scheduleForm && (
          <form onSubmit={saveSchedule} className="mt-5 grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
            <div className="flex justify-between sm:col-span-2">
              <strong>{scheduleEditId ? "Edit Working Hours" : "Add Working Hours"}</strong>
              <button type="button" disabled={busy} onClick={() => setScheduleForm(null)}>
                <X size={18} />
              </button>
            </div>

            <label className="text-sm font-medium">
              Doctor
              <select
                required
                disabled={!!scheduleEditId}
                className={inputClass}
                value={scheduleForm.doctorId}
                onChange={(e) => setScheduleForm((p) => ({ ...p, doctorId: e.target.value }))}
              >
                <option value="">Select Doctor</option>
                {activeDoctors.map((d) => (
                  <option key={idOf(d)} value={idOf(d)}>{d.name}</option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Day
              <select
                className={inputClass}
                value={scheduleForm.dayOfWeek}
                onChange={(e) => setScheduleForm((p) => ({ ...p, dayOfWeek: e.target.value }))}
              >
                {DAYS.map((day, index) => (
                  <option key={day} value={index}>{day}</option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Start Time
              <input
                required type="time"
                className={inputClass}
                value={scheduleForm.startTime}
                onChange={(e) => setScheduleForm((p) => ({ ...p, startTime: e.target.value }))}
              />
            </label>

            <label className="text-sm font-medium">
              End Time
              <input
                required type="time"
                className={inputClass}
                value={scheduleForm.endTime}
                onChange={(e) => setScheduleForm((p) => ({ ...p, endTime: e.target.value }))}
              />
            </label>

            <button
              disabled={busy}
              className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50 sm:col-span-2"
            >
              {busy ? "Saving..." : "Save Working Hours"}
            </button>
          </form>
        )}
      </Section>
    </div>
  );
}
