
import {
  ArrowUpRight, CalendarDays, Mail, MapPin,
  Phone, Plus, Stethoscope, UserRound,
} from "lucide-react";

const addressOf = (a = {}) =>
  [a.line1, a.line2, a.city, a.state, a.postalCode]
    .filter(Boolean).join(", ");

export default function TemplateC({
  clinic,
  doctors = [],
  services = [],
  preview = false,
  onSelectDoctor,
}) {
  const accent = /^#[0-9a-f]{6}$/i.test(
    clinic?.branding?.primaryColor || ""
  ) ? clinic.branding.primaryColor : "#B58A56";

  const activeDoctors = doctors.filter(d => d.isActive !== false);
  const activeServices = services.filter(s => s.isActive !== false);
  const contact = clinic?.contact || {};
  const address = addressOf(clinic?.address);

  return (
    <div className="min-w-0 overflow-hidden bg-[#faf8f4] text-[#202b32]"
      style={{ "--accent": accent }}>
      <header className="bg-[#15242c] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-5 py-6 sm:px-10">
          <a href="#home" className="flex min-w-0 items-center gap-3">
            {clinic?.branding?.logoUrl ? (
              <img src={clinic.branding.logoUrl} alt="Clinic logo"
                className="h-12 w-12 rounded-lg bg-white object-contain p-1" />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/40">
                <Plus size={24} />
              </span>
            )}
            <span className="break-words font-serif text-2xl font-bold">
              {clinic?.name || "Your Clinic"}
            </span>
          </a>
          <nav aria-label="Clinic sections"
            className="flex flex-wrap gap-5 text-xs font-semibold uppercase tracking-widest text-white/75">
            <a href="#about">About</a>
            <a href="#services">Services</a>
            <a href="#doctors">Specialists</a>
            <a href="#contact">Contact</a>
          </nav>
        </div>
      </header>

      <section id="home" className="relative bg-[#15242c] text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-14 sm:px-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:py-28">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d9b88a]">
              Welcome to {clinic?.name || "Our Clinic"}
            </p>
            <h1 className="mt-8 max-w-3xl font-serif text-5xl leading-[1.12] tracking-tight sm:text-6xl lg:text-7xl">
              A more personal approach to
              <span className="italic text-[#d9b88a]"> your wellbeing.</span>
            </h1>
            <p className="mt-8 max-w-xl text-base leading-8 text-slate-300">
              {clinic?.description ||
                "Discover our medical services and connect with our team of healthcare professionals."}
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <a href="#doctors"
                className="inline-flex items-center gap-2 bg-[#d9b88a] px-6 py-4 text-sm font-bold text-[#15242c]">
                Explore Our Specialists <ArrowUpRight size={18} />
              </a>
              {contact.phone && (
                <a href={`tel:${contact.phone}`}
                  className="inline-flex items-center gap-2 border border-white/30 px-6 py-4 text-sm font-semibold">
                  <Phone size={17} /> Call Clinic
                </a>
              )}
            </div>
          </div>
          <div className="relative flex min-h-80 items-center justify-center border border-white/15 bg-[#233842] p-8 sm:min-h-[420px]">
            <div className="absolute inset-5 border border-[#d9b88a]/35" />
            <div className="relative text-center">
              <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border border-[#d9b88a]/60">
                <Stethoscope size={65} className="text-[#d9b88a]" strokeWidth={1} />
              </div>
              <p className="mt-9 font-serif text-3xl text-white">
                Your care, our focus.
              </p>
              <p className="mt-3 text-sm tracking-widest text-slate-300">
                {clinic?.address?.city || "WELCOME"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="mx-auto grid max-w-7xl gap-7 px-5 py-20 sm:px-10 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em]"
            style={{ color: accent }}>Our philosophy</p>
          <h2 className="mt-4 font-serif text-4xl sm:text-5xl">
            Dedicated to your care.
          </h2>
        </div>
        <p className="text-lg leading-9 text-slate-600">
          {clinic?.description ||
            "Learn about our clinic, explore our services and find the right healthcare professional for your needs."}
        </p>
      </section>

      <section id="services" className="bg-white px-5 py-20 sm:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[0.25em]"
            style={{ color: accent }}>Our expertise</p>
          <h2 className="mt-4 font-serif text-4xl sm:text-5xl">
            Medical Services
          </h2>
          <div className="mt-12 border-t border-slate-200">
            {activeServices.length ? activeServices.map((service, index) => (
              <article key={String(service._id || service.id)}
                className="grid gap-4 border-b border-slate-200 py-7 md:grid-cols-[60px_1fr_1.2fr] md:gap-8">
                <span className="font-serif text-2xl text-slate-400">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="font-serif text-2xl">{service.name}</h3>
                <div>
                  {service.description && (
                    <p className="leading-7 text-slate-600">
                      {service.description}
                    </p>
                  )}
                  {service.doctors?.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {service.doctors.map((doctor, i) => (
                        <div key={String(doctor.offeringId || doctor.doctorId || i)}
                          className="flex flex-wrap justify-between gap-3 text-sm text-slate-600">
                          <span>{doctor.name}</span>
                          <span>₹{doctor.fee} · {doctor.durationMinutes} min</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            )) : (
              <p className="py-8 text-slate-500">
                Services will appear here.
              </p>
            )}
          </div>
        </div>
      </section>

      <section id="doctors" className="px-5 py-20 sm:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[0.25em]"
            style={{ color: accent }}>Meet the team</p>
          <h2 className="mt-4 font-serif text-4xl sm:text-5xl">
            Our Specialists
          </h2>
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {activeDoctors.length ? activeDoctors.map((doctor) => (
              <article key={String(doctor._id || doctor.id)}
                className="grid overflow-hidden border border-[#e7e1d7] bg-white sm:grid-cols-[160px_1fr]">
                <div className="flex min-h-48 items-center justify-center bg-[#e8e5dd]">
                  {doctor.photoUrl ? (
                    <img src={doctor.photoUrl} alt={doctor.name}
                      className="h-full w-full object-cover" />
                  ) : (
                    <UserRound size={62} className="text-slate-400" />
                  )}
                </div>
                <div className="p-6">
                  <h3 className="font-serif text-2xl">{doctor.name}</h3>
                  <p className="mt-2 text-sm font-semibold"
                    style={{ color: accent }}>
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
                      className="mt-5 inline-flex items-center gap-2 border-b-2 border-[#b58a56] pb-2 text-sm font-bold">
                      <CalendarDays size={17} /> Check Availability
                      <ArrowUpRight size={16} />
                    </button>
                  )}
                </div>
              </article>
            )) : (
              <p className="text-slate-500">
                Doctor profiles will appear here.
              </p>
            )}
          </div>
        </div>
      </section>

      <section id="contact" className="bg-[#15242c] px-5 py-20 text-white sm:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#d9b88a]">
            Get in touch
          </p>
          <h2 className="mt-4 font-serif text-4xl sm:text-5xl">
            We'd love to hear from you.
          </h2>
          <div className="mt-10 grid gap-7 md:grid-cols-3">
            {contact.phone && (
              <a href={`tel:${contact.phone}`}
                className="flex items-start gap-3 break-all">
                <Phone size={20} className="shrink-0 text-[#d9b88a]" />
                {contact.phone}
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`}
                className="flex items-start gap-3 break-all">
                <Mail size={20} className="shrink-0 text-[#d9b88a]" />
                {contact.email}
              </a>
            )}
            {address && (
              <p className="flex items-start gap-3">
                <MapPin size={20} className="shrink-0 text-[#d9b88a]" />
                {address}
              </p>
            )}
          </div>
        </div>
      </section>
      <footer className="bg-[#0d1a20] px-5 py-6 text-center text-xs text-slate-300">
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
