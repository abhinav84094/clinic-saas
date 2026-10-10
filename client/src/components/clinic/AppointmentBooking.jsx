
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  LoaderCircle,
  MessageCircle,
  Phone,
} from "lucide-react";
import api from "../../services/api";

const getToday = (timezone) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const value = (type) =>
    parts.find((part) => part.type === type)?.value;

  return `${value("year")}-${value("month")}-${value("day")}`;
};

export default function AppointmentBooking({
  slug,
  clinic,
  services = [],
  selectedDoctorId,
  onlineBookingAvailable = false,
}) {
  const timezone = clinic?.timezone || "Asia/Kolkata";

  const offerings = useMemo(
    () =>
      services.flatMap((service) =>
        (service.doctors || []).map((doctor) => ({
          id: doctor.offeringId,
          doctorId: String(doctor.doctorId),
          doctorName: doctor.name,
          serviceName: service.name,
          fee: doctor.fee,
          duration: doctor.durationMinutes,
        }))
      ),
    [services]
  );

  const doctorOfferings = offerings.filter(
    (offering) =>
      String(offering.doctorId) === String(selectedDoctorId)
  );

  const [offeringId, setOfferingId] = useState("");
  const [date, setDate] = useState(() => getToday(timezone));
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setOfferingId(doctorOfferings[0]?.id || "");
    setSelectedSlot(null);
  }, [selectedDoctorId, services]);

  useEffect(() => {
    let alive = true;

    setSlots([]);
    setSelectedSlot(null);
    setError("");

    if (!offeringId || !date || !slug) return;

    async function fetchSlots() {
      setLoading(true);

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

        if (alive) {
          setSlots(response.data.slots || []);
        }
      } catch (err) {
        if (alive) {
          setError(
            err.response?.data?.message ||
              "Unable to load available slots."
          );
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    fetchSlots();

    return () => {
      alive = false;
    };
  }, [slug, offeringId, date]);

  const offering = doctorOfferings.find(
    (item) => item.id === offeringId
  );

  const whatsappNumber = (
    clinic?.contact?.whatsapp ||
    clinic?.contact?.phone ||
    ""
  ).replace(/\D/g, "");

  const phoneNumber = clinic?.contact?.phone;

  const whatsappMessage = encodeURIComponent(
    `Hello, I would like to enquire about an appointment at ${clinic?.name || "your clinic"}.\n` +
      `Doctor: ${offering?.doctorName || "Not selected"}\n` +
      `Service: ${offering?.serviceName || "Not selected"}\n` +
      `Preferred date: ${date}\n` +
      `Preferred time: ${selectedSlot?.startTime || "Please suggest a time"}\n` +
      `Please confirm availability.`
  );

  return (
    <section
      id="book-appointment"
      className="scroll-mt-6 bg-blue-50 px-5 py-14 sm:px-8"
    >
      <div className="mx-auto max-w-4xl rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <CalendarDays className="text-blue-600" />
          Appointment Availability
        </h2>

        {!selectedDoctorId ? (
          <p className="mt-4 text-sm text-slate-500">
            Select a doctor above to check availability.
          </p>
        ) : doctorOfferings.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No active services are available for this doctor.
            Please contact the clinic.
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm text-slate-600">
              Selected doctor:{" "}
              <strong>{doctorOfferings[0].doctorName}</strong>
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Service
                <select
                  value={offeringId}
                  onChange={(e) =>
                    setOfferingId(e.target.value)
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                >
                  {doctorOfferings.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.serviceName} — ₹{item.fee}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium">
                Preferred date
                <input
                  type="date"
                  min={getToday(timezone)}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                />
              </label>
            </div>

            <h3 className="mt-6 font-semibold">
              Available time slots
            </h3>

            {loading && (
              <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                <LoaderCircle
                  className="animate-spin"
                  size={17}
                />
                Checking availability...
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="mt-3 text-sm text-red-600"
              >
                {error}
              </p>
            )}

            {!loading && !error && (
              <div className="mt-4 flex flex-wrap gap-2">
                {slots.length ? (
                  slots.map((slot) => (
                    <button
                      type="button"
                      key={slot.startAt}
                      onClick={() =>
                        setSelectedSlot(slot)
                      }
                      className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                        selectedSlot?.startAt === slot.startAt
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 text-slate-700"
                      }`}
                    >
                      {slot.startTime}
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    No available slots for this date.
                  </p>
                )}
              </div>
            )}

            {selectedSlot && (
              <p className="mt-4 text-sm text-slate-600">
                Preferred time:{" "}
                <strong>{selectedSlot.startTime}</strong>
              </p>
            )}

            {!onlineBookingAvailable && (
              <p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                Online booking is currently unavailable.
                Contact the clinic to confirm your appointment.
                Selecting a time here does not reserve it.
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {whatsappNumber && (
                <a
                  href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 font-semibold text-white"
                >
                  <MessageCircle size={18} />
                  WhatsApp Clinic
                </a>
              )}

              {phoneNumber && (
                <a
                  href={`tel:${phoneNumber}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white"
                >
                  <Phone size={18} />
                  Call Clinic
                </a>
              )}
            </div>

            {onlineBookingAvailable && (
              <p className="mt-4 text-sm text-slate-500">
                Secure online payment and confirmation will
                become available once the booking payment
                integration is completed.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
