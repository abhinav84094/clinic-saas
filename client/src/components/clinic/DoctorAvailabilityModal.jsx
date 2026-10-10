
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Clock3,
  LoaderCircle,
  MessageCircle,
  Phone,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";
import api from "../../services/api";

const idOf = (value) =>
  String(value?._id || value?.id || value || "");

function todayInTimezone(timezone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const part = (type) =>
    parts.find((item) => item.type === type)?.value;

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatTime(time) {
  if (!time) return "";

  const [hours, minutes] = time.split(":").map(Number);

  const period = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;

  return `${hour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function whatsappNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length === 10) return `91${digits}`;

  return digits;
}

export default function DoctorAvailabilityModal({
  open,
  onClose,
  doctor,
  clinic,
  services = [],
  slug,
}) {
  const timezone = clinic?.timezone || "Asia/Kolkata";
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);

  const offerings = useMemo(() => {
    if (!doctor) return [];

    return services.flatMap((service) =>
      (service.doctors || [])
        .filter(
          (item) =>
            idOf(item.doctorId) === idOf(doctor) &&
            item.offeringId
        )
        .map((item) => ({
          offeringId: idOf(item.offeringId),
          serviceName: service.name,
          doctorName: item.name || doctor.name,
          fee: item.fee,
          durationMinutes: item.durationMinutes,
        }))
    );
  }, [doctor, services]);

  const [offeringId, setOfferingId] = useState("");
  const [date, setDate] = useState(() =>
    todayInTimezone(timezone)
  );
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setOfferingId(offerings[0]?.offeringId || "");
    setDate(todayInTimezone(timezone));
    setSlots([]);
    setSelectedSlot(null);
    setError("");
  }, [open, doctor, offerings, timezone]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;

    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = Array.from(
        dialogRef.current.querySelectorAll(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);

      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !slug || !offeringId || !date) return;

    let active = true;

    setLoading(true);
    setError("");
    setSlots([]);
    setSelectedSlot(null);

    async function loadAvailability() {
      try {
        const response = await api.get(
          `/public/clinics/${encodeURIComponent(slug)}/availability`,
          {
            params: {
              doctorServiceId: offeringId,
              date,
            },
          }
        );

        if (active) {
          setSlots(response.data.slots || []);
        }
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.message ||
              "Unable to check availability."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAvailability();

    return () => {
      active = false;
    };
  }, [open, slug, offeringId, date]);

  const selectedOffering = offerings.find(
    (item) => item.offeringId === offeringId
  );

  const phone = clinic?.contact?.phone || "";
  const whatsapp = whatsappNumber(
    clinic?.contact?.whatsapp || phone
  );

  const message = encodeURIComponent(
    [
      `Hello ${clinic?.name || "Clinic"},`,
      "I would like to enquire about an appointment.",
      `Doctor: ${doctor?.name || ""}`,
      `Service: ${selectedOffering?.serviceName || ""}`,
      `Date: ${date}`,
      `Preferred time: ${
        selectedSlot
          ? formatTime(selectedSlot.startTime)
          : "Please suggest an available time"
      }`,
      "Please confirm availability.",
    ].join("\n")
  );

  if (!open || !doctor) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-0 sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="availability-dialog-title"
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2
              id="availability-dialog-title"
              className="text-lg font-bold text-slate-900"
            >
              Appointment Availability
            </h2>
            <p className="text-xs text-slate-500">
              Check available times and contact the clinic
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close appointment popup"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          >
            <X size={21} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="flex items-center gap-4 rounded-xl bg-blue-50 p-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
              {doctor.photoUrl ? (
                <img
                  src={doctor.photoUrl}
                  alt={doctor.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserRound
                  size={30}
                  className="text-slate-500"
                />
              )}
            </div>

            <div className="min-w-0">
              <h3 className="font-bold text-slate-900">
                {doctor.name}
              </h3>
              <p className="text-sm text-slate-600">
                {doctor.specialization || "Doctor"}
              </p>

              {doctor.qualifications?.length > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  {doctor.qualifications.join(", ")}
                </p>
              )}
            </div>
          </div>

          {offerings.length ? (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Select Service
                  <select
                    value={offeringId}
                    onChange={(event) =>
                      setOfferingId(event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none focus:border-blue-500"
                  >
                    {offerings.map((item) => (
                      <option
                        key={item.offeringId}
                        value={item.offeringId}
                      >
                        {item.serviceName} — ₹{item.fee}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Select Date
                  <input
                    type="date"
                    min={todayInTimezone(timezone)}
                    value={date}
                    onChange={(event) =>
                      setDate(event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none focus:border-blue-500"
                  />
                </label>
              </div>

              {selectedOffering && (
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <Stethoscope size={16} />
                    ₹{selectedOffering.fee}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 size={16} />
                    {selectedOffering.durationMinutes} min
                  </span>
                </div>
              )}

              <h4 className="mt-7 flex items-center gap-2 font-bold text-slate-900">
                <CalendarDays
                  size={19}
                  className="text-blue-600"
                />
                Available Time Slots
              </h4>

              {loading && (
                <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                  />
                  Checking availability...
                </p>
              )}

              {error && (
                <p
                  role="alert"
                  className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

              {!loading && !error && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {slots.length ? (
                    slots.map((slot) => (
                      <button
                        key={slot.startAt}
                        type="button"
                        onClick={() =>
                          setSelectedSlot(slot)
                        }
                        aria-pressed={
                          selectedSlot?.startAt === slot.startAt
                        }
                        className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                          selectedSlot?.startAt === slot.startAt
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-blue-400"
                        }`}
                      >
                        {formatTime(slot.startTime)}
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      No available slots for this date.
                      Try another date.
                    </p>
                  )}
                </div>
              )}

              {selectedSlot && (
                <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
                  Preferred time:{" "}
                  <strong>
                    {formatTime(selectedSlot.startTime)}
                  </strong>
                </p>
              )}
            </>
          ) : (
            <p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
              This doctor currently has no active services.
              Please contact the clinic directly.
            </p>
          )}

          <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Online booking is not currently available.
            Contact the clinic to confirm an appointment.
            Selecting a slot here does not reserve it.
          </p>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp}?text=${message}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 font-semibold text-white hover:bg-green-700"
              >
                <MessageCircle size={18} />
                WhatsApp Clinic
              </a>
            )}

            {phone && (
              <a
                href={`tel:${phone}`}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
              >
                <Phone size={18} />
                Call Clinic
              </a>
            )}

            {!whatsapp && !phone && (
              <p className="w-full text-center text-sm text-slate-500">
                Contact details are not available yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
