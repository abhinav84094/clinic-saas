
import {
  ArrowRight, CalendarDays, HeartPulse, Mail,
  MapPin, Phone, Stethoscope, UserRound,
} from "lucide-react";

const addressOf = (address = {}) =>
  [address.line1, address.line2, address.city,
   address.state, address.postalCode]
    .filter(Boolean).join(", ");

export default function TemplateB({
  clinic,
  doctors = [],
  services = [],
  preview = false,
  onSelectDoctor,
}) {
  const color = /^#[0-9a-f]{6}$/i.test(
    clinic?.branding?.primaryColor || ""
  ) ? clinic.branding.primaryColor : "#0D9488";

  const activeDoctors = doctors.filter(d => d.isActive !== false);
  const activeServices = services.filter(s => s.isActive !== false);
  const contact = clinic?.contact || {};
  const address = addressOf(clinic?.address);

  return (
    <div className="min-w-0 overflow-hidden bg-white text-slate-900"
      style={{ "--accent": color }}>
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-10">
          <a href="#home" className="flex min-w-0 items-center gap-3">
            {clinic?.branding?.logoUrl ? (
              <img src={clinic.branding.logoUrl} alt="Clinic logo"
                className="h-11 w-11 rounded-xl object-contain" />
            ) : (
              <span className="rounded-xl p-3 text-white"
                style={{ background: color }}>
                <HeartPulse size={22} />
              </span>
            )}
            <span className="break-words text-xl font-extrabold">
              {clinic?.name || "Your Clinic"}
            </span>
          </a>
          <nav aria-label="Clinic sections"
            className="flex flex-wrap gap-5 text-sm font-semibold text-slate-600">
            <a href="#about">About</a>
            <a href="#services">Services</a>
            <a href="#doctors">Doctors</a>
            <a href="#contact">Contact</a>
          </nav>
        </div>
      </header>

      <section id="home" className="relative overflow-hidden bg-[#f0faf8]">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-teal-200/40 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-10 lg:grid-cols-2 lg:items-center lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-teal-800 shadow-sm">
              <HeartPulse size={16} /> Welcome to our clinic
            </span>
            <h1 className="mt-7 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Your health deserves
              <span className="block" style={{ color }}>thoughtful care.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-slate-600">
              {clinic?.description ||
                "Explore our healthcare services, meet our doctors and find the care you need."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#doctors"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 font-bold text-white"
                style={{ background: color }}>
                Meet Our Doctors <ArrowRight size={17} />
              </a>
              {contact.phone && (
                <a href={`tel:${contact.phone}`}
                  className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-6 py-3 font-bold text-slate-800">
                  <Phone size={17} /> Call Clinic
                </a>
              )}
            </div>
          </div>
          <div className="relative flex min-h-72 items-center justify-center rounded-[2rem] bg-gradient-to-br from-teal-100 via-white to-cyan-100 p-10 sm:min-h-96">
            <div className="absolute inset-6 rounded-[1.5rem] border border-white/80" />
            <div className="relative flex flex-col items-center text-center">
              <span className="rounded-full bg-white p-8 shadow-xl"
                style={{ color }}>
                <HeartPulse size={74} strokeWidth={1.3} />
              </span>
              <p className="mt-7 text-xl font-bold text-slate-800">
                Care that puts people first
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {clinic?.address?.city || "Your community"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="mx-auto max-w-7xl px-5 py-16 sm:px-10">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-widest"
            style={{ color }}>Who we are</p>
          <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
            Healthcare with a personal touch
          </h2>
          <p className="mt-5 leading-8 text-slate-600">
            {clinic?.description ||
              "Our clinic is here to help you explore available healthcare services and connect with our team."}
          </p>
        </div>
      </section>

      <section id="services" className="bg-slate-50 px-5 py-16 sm:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-bold uppercase tracking-widest"
            style={{ color }}>What we offer</p>
          <h2 className="mt-3 text-3xl font-extrabold">Our Services</h2>
          <div className="mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {activeServices.length ? activeServices.map((service) => (
              <article key={String(service._id || service.id)}
                className="rounded-3xl border border-slate-100 bg-white p-7 shadow-sm">
                <span className="inline-flex rounded-2xl bg-teal-50 p-4"
                  style={{ color }}><Stethoscope size={26} /></span>
                <h3 className="mt-6 text-xl font-bold">{service.name}</h3>
                {service.description && (
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {service.description}
                  </p>
                )}
                {service.doctors?.length > 0 && (
                  <div className="mt-5 space-y-2 border-t pt-4">
                    {service.doctors.map((doctor, index) => (
                      <div key={String(doctor.offeringId || doctor.doctorId || index)}
                        className="flex flex-wrap justify-between gap-2 text-xs">
                        <span>{doctor.name}</span>
                        <span className="font-semibold">
                          ₹{doctor.fee} · {doctor.durationMinutes} min
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            )) : <p className="text-slate-500">Services will appear here.</p>}
          </div>
        </div>
      </section>

      <section id="doctors" className="mx-auto max-w-7xl px-5 py-16 sm:px-10">
        <p className="text-sm font-bold uppercase tracking-widest"
          style={{ color }}>Our team</p>
        <h2 className="mt-3 text-3xl font-extrabold">Meet Our Doctors</h2>
        <div className="mt-9 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {activeDoctors.length ? activeDoctors.map((doctor) => (
            <article key={String(doctor._id || doctor.id)}
              className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-md">
              <div className="flex h-48 items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100">
                {doctor.photoUrl ? (
                  <img src={doctor.photoUrl} alt={doctor.name}
                    className="h-full w-full object-cover" />
                ) : <UserRound size={70} className="text-teal-400" />}
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold">{doctor.name}</h3>
                <p className="mt-1 text-sm font-semibold" style={{ color }}>
                  {doctor.specialization || "Doctor"}
                </p>
                {doctor.qualifications?.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    {doctor.qualifications.join(", ")}
                  </p>
                )}
                {doctor.bio && (
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    {doctor.bio}
                  </p>
                )}
                {!preview && (
                  <button type="button"
                    onClick={() => onSelectDoctor?.(doctor)}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold text-white"
                    style={{ background: color }}>
                    <CalendarDays size={17} /> Check Availability
                  </button>
                )}
              </div>
            </article>
          )) : <p className="text-slate-500">Doctor profiles will appear here.</p>}
        </div>
      </section>

      <section id="contact" className="bg-[#102c35] px-5 py-16 text-white sm:px-10">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-extrabold">Visit Our Clinic</h2>
          <p className="mt-3 text-slate-300">We're here when you need us.</p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="flex items-start gap-3 break-all">
                <Phone size={20} /> {contact.phone}
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex items-start gap-3 break-all">
                <Mail size={20} /> {contact.email}
              </a>
            )}
            {address && (
              <p className="flex items-start gap-3">
                <MapPin size={20} className="shrink-0" /> {address}
              </p>
            )}
          </div>
        </div>
      </section>
      <footer className="bg-[#0b2027] px-5 py-6 text-center text-xs text-slate-300">
        © {new Date().getFullYear()} {clinic?.name || "Clinic"}.
        All rights reserved.
      </footer>
      {preview && (
        <p className="bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-800">
          Preview only — your clinic is not published yet.
        </p>
      )}
    </div>
  );
}
