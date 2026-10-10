
import {
  CalendarDays,
  Mail,
  MapPin,
  Phone,
  Stethoscope,
  UserRound,
} from "lucide-react";

const getId = (value) =>
  String(value?._id || value?.id || value || "");

const addressText = (address = {}) =>
  [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

export default function ClinicWebsiteTemplate({
  clinic,
  doctors = [],
  services = [],
  preview = false,
  onSelectDoctor,
}) {
  const color = /^#[0-9a-fA-F]{6}$/.test(
    clinic?.branding?.primaryColor || ""
  )
    ? clinic.branding.primaryColor
    : "#2563EB";

  const contact = clinic?.contact || {};
  const address = addressText(clinic?.address);

  const activeDoctors = doctors.filter(
    (doctor) => doctor.isActive !== false
  );

  const activeServices = services.filter(
    (service) => service.isActive !== false
  );

  return (
    <div
      className="min-w-0 overflow-hidden rounded-xl bg-white text-slate-900"
      style={{ "--clinic-primary": color }}
    >
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {clinic?.branding?.logoUrl ? (
              <img
                src={clinic.branding.logoUrl}
                alt="Clinic logo"
                className="h-12 w-12 rounded-xl object-contain"
              />
            ) : (
              <div
                className="rounded-xl p-3 text-white"
                style={{ backgroundColor: color }}
              >
                <Stethoscope size={22} />
              </div>
            )}

            <span className="break-words text-lg font-bold">
              {clinic?.name || "Your Clinic"}
            </span>
          </div>

          <nav
            className="flex flex-wrap gap-4 text-sm font-medium text-slate-600"
            aria-label="Clinic sections"
          >
            <a href="#about">About</a>
            <a href="#doctors">Doctors</a>
            <a href="#services">Services</a>
            <a href="#contact">Contact</a>
          </nav>
        </div>
      </header>

      <section className="bg-slate-50 px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <p
            className="mb-3 text-sm font-bold uppercase tracking-widest"
            style={{ color }}
          >
            Welcome to {clinic?.name || "Our Clinic"}
          </p>

          <h1 className="max-w-3xl text-3xl font-extrabold leading-tight sm:text-5xl">
            Compassionate care, closer to you.
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
            {clinic?.description ||
              "Meet our doctors, explore our services and get in touch with our clinic."}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold text-white"
                style={{ backgroundColor: color }}
              >
                <Phone size={17} />
                Call Clinic
              </a>
            )}

            <a
              href="#services"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700"
            >
              <CalendarDays size={17} />
              View Services
            </a>
          </div>
        </div>
      </section>

      <section
        id="about"
        className="mx-auto max-w-6xl px-5 py-12 sm:px-8"
      >
        <h2 className="text-2xl font-bold">
          About Our Clinic
        </h2>

        <p className="mt-3 max-w-3xl leading-7 text-slate-600">
          {clinic?.description ||
            "We are here to help you find the care you need."}
        </p>
      </section>

      <section
        id="doctors"
        className="bg-slate-50 px-5 py-12 sm:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold">
            Meet Our Doctors
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeDoctors.length ? (
              activeDoctors.map((doctor) => (
                <article
                  key={getId(doctor)}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-slate-100">
                    {doctor.photoUrl ? (
                      <img
                        src={doctor.photoUrl}
                        alt={doctor.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserRound
                        size={25}
                        className="text-slate-500"
                      />
                    )}
                  </div>

                  <h3 className="font-bold">
                    {doctor.name}
                  </h3>

                  <p className="mt-1 text-sm text-slate-600">
                    {doctor.specialization || "Doctor"}
                  </p>

                  {doctor.qualifications?.length > 0 && (
                    <p className="mt-2 text-xs text-slate-500">
                      {doctor.qualifications.join(", ")}
                    </p>
                  )}

                  {doctor.bio && (
                    <p className="mt-3 text-sm text-slate-600">
                      {doctor.bio}
                    </p>
                  )}

                  {!preview && (
                    <button
                      type="button"
                      onClick={() => onSelectDoctor?.(doctor)}
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white"
                      style={{ backgroundColor: color }}
                    >
                      <CalendarDays size={17} />
                      Check Availability
                    </button>
                  )}
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                Doctor profiles will appear here.
              </p>
            )}
          </div>
        </div>
      </section>

      <section
        id="services"
        className="mx-auto max-w-6xl px-5 py-12 sm:px-8"
      >
        <h2 className="text-2xl font-bold">
          Our Services
        </h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {activeServices.length ? (
            activeServices.map((service) => (
              <article
                key={getId(service)}
                className="rounded-2xl border border-slate-200 p-5"
              >
                <div
                  className="mb-3 inline-flex rounded-lg bg-slate-100 p-2"
                  style={{ color }}
                >
                  <Stethoscope size={20} />
                </div>

                <h3 className="font-bold">
                  {service.name}
                </h3>

                {service.description && (
                  <p className="mt-2 text-sm text-slate-600">
                    {service.description}
                  </p>
                )}

                {service.doctors?.length > 0 && (
                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                    {service.doctors.map((doctor) => (
                      <div
                        key={getId(
                          doctor.offeringId || doctor.doctorId
                        )}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <span>{doctor.name}</span>
                        <span className="font-semibold">
                          ₹{doctor.fee} ·{" "}
                          {doctor.durationMinutes} min
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))
          ) : (
            <p className="text-sm text-slate-500">
              Services will appear here.
            </p>
          )}
        </div>
      </section>

      <section
        id="contact"
        className="bg-slate-50 px-5 py-12 sm:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold">
            Contact & Location
          </h2>

          <div className="mt-5 grid gap-3 text-sm text-slate-700">
            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="flex items-start gap-3"
              >
                <Phone size={18} style={{ color }} />
                {contact.phone}
              </a>
            )}

            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="flex items-start gap-3"
              >
                <Mail size={18} style={{ color }} />
                {contact.email}
              </a>
            )}

            {address && (
              <p className="flex items-start gap-3">
                <MapPin size={18} style={{ color }} />
                {address}
              </p>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 px-5 py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()}{" "}
        {clinic?.name || "Clinic"}. All rights reserved.
      </footer>

      {preview && (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-800">
          Preview only — your clinic is not published yet.
        </div>
      )}
    </div>
  );
}
