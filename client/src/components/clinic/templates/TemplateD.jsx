import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  HeartPulse,
  MapPin,
  Search,
  ShieldPlus,
  Stethoscope,
  UserRound,
} from "lucide-react";

const addressOf = (address = {}) =>
  [address.line1, address.line2, address.city, address.state, address.postalCode]
    .filter(Boolean)
    .join(", ");

const qualificationsOf = (qualifications) =>
  Array.isArray(qualifications)
    ? qualifications.join(" · ")
    : qualifications || "";

export default function TemplateD({
  clinic,
  doctors = [],
  services = [],
  preview = false,
  onSelectDoctor,
}) {
  const [search, setSearch] = useState("");

  const color = /^#[0-9a-f]{6}$/i.test(clinic?.branding?.primaryColor || "")
    ? clinic.branding.primaryColor
    : "#5B4BE8";

  const activeDoctors = doctors.filter((doctor) => doctor.isActive !== false);
  const activeServices = services.filter((service) => service.isActive !== false);
  const contact = clinic?.contact || {};
  const address = addressOf(clinic?.address);
  const featuredDoctor = activeDoctors[0];

  const filteredDoctors = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return activeDoctors;

    return activeDoctors.filter((doctor) =>
      [
        doctor.name,
        doctor.specialization,
        qualificationsOf(doctor.qualifications),
        doctor.bio,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [doctors, search]);

  return (
    <div className="template-d-mobile min-w-0 overflow-hidden bg-[#f7f8fc] text-[#182033]" style={{ containerType: "inline-size", containerName: "template-d-clinic", "--tdm-brand": color }}>
      <style>{`
        @keyframes template-d-enter {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes template-d-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .template-d-enter { animation: template-d-enter 600ms ease-out both; }
        .template-d-float { animation: template-d-float 4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .template-d-enter, .template-d-float { animation: none !important; }
        }
/* Container queries also work when the dashboard preview is narrower than the browser. */
@container template-d-clinic (max-width: 767px) {
  .template-d-mobile :where(header, main, section, article, footer, div, a, p, h1, h2, h3, span, label, input) { min-width: 0; }
  .template-d-mobile :where(h1, h2, h3, p, span) { overflow-wrap: break-word; word-break: normal; }
  .template-d-mobile :where(a, button, input):focus-visible { outline: 3px solid #a5b4fc; outline-offset: -3px; }
  .template-d-mobile .tdm-header-inner { display: flex; flex-direction: column; align-items: stretch; gap: 14px; padding: 18px 16px 14px; }
  .template-d-mobile .tdm-brand { width: 100%; gap: 11px; }
  .template-d-mobile .tdm-brand > img, .template-d-mobile .tdm-brand > span:first-child { width: 42px; height: 42px; border-radius: 14px; flex-shrink: 0; }
  .template-d-mobile .tdm-brand-name { white-space: normal; overflow: visible; font-size: 17px; line-height: 1.35; letter-spacing: -.025em; }
  .template-d-mobile .tdm-nav { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); width: 100%; gap: 4px; padding: 4px; border: 1px solid #e8eaf3; border-radius: 14px; background: #f4f5fa; overflow: visible; }
  .template-d-mobile .tdm-nav a { display: flex; align-items: center; justify-content: center; padding: 9px 4px; min-height: 42px; border-radius: 10px; font-size: 12px; line-height: 1.4; white-space: normal; text-align: center; color: #334155; }
  .template-d-mobile .tdm-nav a:hover, .template-d-mobile .tdm-nav a:focus-visible { background: white; color: #182033; }
  .template-d-mobile .tdm-hero-layout { display: flex; flex-direction: column; align-items: stretch; gap: 28px; padding: 32px 16px 28px; }
  .template-d-mobile .tdm-hero-copy { width: 100%; animation: none; }
  .template-d-mobile .tdm-eyebrow { max-width: 100%; font-size: 9px; letter-spacing: .07em; line-height: 1.5; padding: 8px 11px; gap: 7px; }
  .template-d-mobile .tdm-eyebrow svg { flex-shrink: 0; }
  .template-d-mobile .tdm-headline { margin-top: 20px; max-width: none; font-size: clamp(34px, 8.8cqi, 48px); line-height: 1.13; letter-spacing: -.045em; text-wrap: balance; }
  .template-d-mobile .tdm-headline > span { margin-top: 4px; color: #e1dcff; }
  .template-d-mobile .tdm-intro { margin-top: 16px; max-width: none; font-size: 14px; line-height: 1.8; color: #e0e2f2; }
  .template-d-mobile .tdm-hero-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 22px; }
  .template-d-mobile .tdm-hero-actions a { width: 100%; min-height: 50px; padding: 13px 18px; border-radius: 14px; font-size: 14px; line-height: 1.5; white-space: normal; transform: none; }
  .template-d-mobile .tdm-hero-actions a:first-child { background: #fff !important; color: #24234d; box-shadow: 0 8px 24px #080b2725; }
  .template-d-mobile .tdm-hero-actions a + a { background: #ffffff0d; border-color: #ffffff40; }
  .template-d-mobile .tdm-location { margin-top: 18px; font-size: 12px; line-height: 1.6; color: #e0e2f2; }
  .template-d-mobile .tdm-feature { width: 100%; max-width: none; animation: none; }
  .template-d-mobile .tdm-feature-frame { border-radius: 24px; padding: 8px; background: #ffffff14; box-shadow: 0 14px 36px #090b2b22; }
  .template-d-mobile .tdm-feature-photo { height: clamp(230px, 68cqi, 320px); border-radius: 18px; }
  .template-d-mobile .tdm-feature-photo > img { object-position: center 25%; }
  .template-d-mobile .tdm-feature-badge { top: 12px; right: 12px; left: 12px; width: fit-content; max-width: calc(100% - 24px); border-radius: 12px; gap: 8px; padding: 8px 10px; animation: none; }
  .template-d-mobile .tdm-feature-badge > span:first-child { width: 30px; height: 30px; border-radius: 9px; }
  .template-d-mobile .tdm-feature-badge > span:last-child > span:first-child { font-size: 10px; }
  .template-d-mobile .tdm-feature-badge > span:last-child > span:last-child { font-size: 9px; white-space: normal; }
  .template-d-mobile .tdm-feature-info { padding: 18px; }
  .template-d-mobile .tdm-feature-info > p:first-child { font-size: 9px; letter-spacing: .14em; color: #e0e2f2; }
  .template-d-mobile .tdm-feature-info > p:nth-child(2) { margin-top: 6px; font-size: 23px; line-height: 1.2; letter-spacing: -.025em; }
  .template-d-mobile .tdm-feature-info > p:nth-child(3) { font-size: 12px; color: #edeefa; }
  .template-d-mobile .tdm-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
  .template-d-mobile .tdm-stats > div { display: flex; align-items: center; justify-content: center; gap: 9px; border-radius: 14px; padding: 13px 10px; background: #ffffff0d; }
  .template-d-mobile .tdm-stats > div > p:first-child { font-size: 23px; line-height: 1; }
  .template-d-mobile .tdm-stats > div > p:last-child { margin: 0; color: #e0e2f2; font-size: 12px; white-space: nowrap; }
  .template-d-mobile .tdm-doctors { padding: 36px 16px; }
  .template-d-mobile .tdm-doctors-heading { display: flex; flex-direction: column; align-items: stretch; gap: 20px; }
  .template-d-mobile .tdm-doctors-heading > div > p:first-child { font-size: 9px; letter-spacing: .13em; line-height: 1.7; }
  .template-d-mobile .tdm-doctors-heading h2 { margin-top: 6px; font-size: 28px; line-height: 1.2; letter-spacing: -.04em; }
  .template-d-mobile .tdm-doctors-heading > div > p:last-child { margin-top: 10px; font-size: 13px; line-height: 1.75; }
  .template-d-mobile .tdm-search { width: 100%; max-width: none; min-height: 52px; gap: 10px; border-radius: 14px; border-color: #dce0ed; box-shadow: 0 4px 14px #20295405; }
  .template-d-mobile .tdm-search:focus-within { outline: 2px solid #a5b4fc; outline-offset: 2px; }
  .template-d-mobile .tdm-search input { width: 100%; font-size: 16px; padding-block: 14px; }
  .template-d-mobile .tdm-doctor-grid { grid-template-columns: minmax(0, 1fr); gap: 20px; margin-top: 22px; }
  .template-d-mobile .tdm-doctor-card { display: flex; flex-direction: column; border-radius: 22px; border-color: #e5e7f0; box-shadow: 0 6px 24px #23305508; animation: none; transform: none; }
  .template-d-mobile .tdm-doctor-photo { height: clamp(220px, 64cqi, 300px); }
  .template-d-mobile .tdm-doctor-photo img { object-position: center 25%; transform: none; }
  .template-d-mobile .tdm-doctor-photo > span { left: 14px; top: 14px; max-width: calc(100% - 28px); padding: 6px 11px; font-size: 11px; white-space: normal; line-height: 1.6; border-radius: 12px; }
  .template-d-mobile .tdm-doctor-body { padding: 20px; }
  .template-d-mobile .tdm-doctor-body h3 { font-size: 21px; line-height: 1.3; letter-spacing: -.03em; }
  .template-d-mobile .tdm-doctor-body > p { font-size: 13px; line-height: 1.8; }
  .template-d-mobile .tdm-doctor-body > button { display: flex; justify-content: space-between; width: 100%; min-height: 48px; margin-top: 18px; padding: 12px 15px; border: 1px solid #e5e7f0; border-radius: 12px; background: #f5f5fc; font-size: 13px; text-align: left; }
  .template-d-mobile .tdm-services { padding: 30px 16px; }
  .template-d-mobile .tdm-services > div > p { font-size: 9px; line-height: 1.7; letter-spacing: .13em; }
  .template-d-mobile .tdm-services-layout { display: flex; flex-direction: column; align-items: stretch; gap: 18px; }
  .template-d-mobile .tdm-services h2 { font-size: 25px; line-height: 1.25; letter-spacing: -.035em; }
  .template-d-mobile .tdm-service-list { display: flex; flex-direction: column; gap: 9px; }
  .template-d-mobile .tdm-service-list > span { display: block; border-radius: 12px; border-color: #e4e6f0; padding: 13px 15px; font-size: 13px; line-height: 1.65; overflow-wrap: anywhere; }
  .template-d-mobile .tdm-service-list > span::before { content: ''; display: inline-block; width: 7px; height: 7px; margin-right: 10px; vertical-align: middle; border-radius: 50%; background: var(--tdm-brand); }
  .template-d-mobile .tdm-contact { padding: 32px 16px; }
  .template-d-mobile .tdm-contact-layout { display: flex; flex-direction: column; align-items: stretch; gap: 22px; }
  .template-d-mobile .tdm-contact h2 { font-size: 24px; line-height: 1.3; letter-spacing: -.025em; }
  .template-d-mobile .tdm-contact-layout > div:first-child > p:first-child { font-size: 9px; }
  .template-d-mobile .tdm-contact-layout > div:first-child > p:last-child { font-size: 13px; line-height: 1.8; }
  .template-d-mobile .tdm-contact-actions { display: flex; flex-direction: column; width: 100%; gap: 10px; }
  .template-d-mobile .tdm-contact-actions a { width: 100%; min-height: 48px; border-radius: 12px; padding: 13px 16px; font-size: 13px; }
  .template-d-mobile footer { padding: 18px 16px; font-size: 11px; line-height: 1.8; color: #c2c5d8; }
  .template-d-mobile main > section { scroll-margin-top: 16px; }
}

      `}</style>

      <header className="border-b border-slate-200/70 bg-white">
        <div className="tdm-header-inner mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-5 gap-y-3 px-4 py-4 sm:px-7 lg:px-10">
          <a href="#home" className="tdm-brand flex min-w-0 items-center gap-3">
            {clinic?.branding?.logoUrl ? (
              <img
                src={clinic.branding.logoUrl}
                alt={`${clinic?.name || "Clinic"} logo`}
                className="size-11 shrink-0 rounded-2xl object-contain"
              />
            ) : (
              <span
                className="grid size-11 shrink-0 place-items-center rounded-2xl text-white"
                style={{ backgroundColor: color }}
              >
                <HeartPulse size={22} />
              </span>
            )}
            <span className="tdm-brand-name truncate text-base font-bold tracking-tight sm:text-lg">
              {clinic?.name || "Your Clinic"}
            </span>
          </a>

          <nav
            aria-label="Clinic sections"
            className="tdm-nav flex w-full items-center justify-between gap-2 overflow-x-auto text-sm font-medium text-slate-600 sm:w-auto sm:justify-start sm:gap-7"
          >
            <a className="whitespace-nowrap px-1 py-2 hover:text-slate-950" href="#doctors">
              Our doctors
            </a>
            <a className="whitespace-nowrap px-1 py-2 hover:text-slate-950" href="#services">
              Services
            </a>
            <a className="whitespace-nowrap px-1 py-2 hover:text-slate-950" href="#contact">
              Contact
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section
          id="home"
          className="relative overflow-hidden text-white"
          style={{
            background: `radial-gradient(circle at 78% 18%, ${color} 0%, #27265f 42%, #171a37 100%)`,
          }}
        >
          <div className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full border border-white/10 sm:size-[28rem]" />
          <div className="pointer-events-none absolute -bottom-48 left-1/3 size-96 rounded-full border border-white/10" />

          <div className="tdm-hero-layout relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-7 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-10 lg:py-20">
            <div className="tdm-hero-copy template-d-enter">
              <p className="tdm-eyebrow inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/90">
                <ShieldPlus size={15} />
                Healthcare, with a human touch
              </p>

              <h1 className="tdm-headline mt-6 max-w-2xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                Meet your care team.
                <span className="mt-1 block text-violet-200">
                  Feel at home.
                </span>
              </h1>

              <p className="tdm-intro mt-5 max-w-xl text-sm leading-7 text-white/75 sm:text-base sm:leading-8">
                {clinic?.description ||
                  "Get to know our doctors, explore their specialties and discover a team that puts your wellbeing first."}
              </p>

              <div className="tdm-hero-actions mt-7 flex flex-col gap-3 min-[420px]:flex-row">
                <a
                  href="#doctors"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                  style={{ backgroundColor: color }}
                >
                  Meet our doctors <ArrowRight size={17} />
                </a>

                {contact.phone && (
                  <a
                    href={`tel:${contact.phone}`}
                    className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Call the clinic
                  </a>
                )}
              </div>

              {address && (
                <p className="tdm-location mt-6 flex items-start gap-2 text-sm text-white/70">
                  <MapPin size={17} className="mt-0.5 shrink-0" />
                  <span>{clinic?.address?.city || address}</span>
                </p>
              )}
            </div>

            <div className="tdm-feature template-d-enter mx-auto w-full max-w-md lg:justify-self-end">
              <div className="tdm-feature-frame relative rounded-[2rem] border border-white/20 bg-white/10 p-3 shadow-2xl shadow-black/20 backdrop-blur-sm">
                <div className="tdm-feature-photo relative h-[300px] overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-violet-200 via-indigo-100 to-sky-200 sm:h-[390px]">
                  {featuredDoctor?.photoUrl ? (
                    <img
                      src={featuredDoctor.photoUrl}
                      alt={featuredDoctor.name || "Doctor"}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="grid size-full place-items-center text-indigo-500">
                      <UserRound size={112} strokeWidth={1} />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-[#171a37]/90 via-transparent to-[#171a37]/10" />

                  <div className="tdm-feature-badge template-d-float absolute right-3 top-3 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-2xl border border-white/70 bg-white/90 px-3 py-2.5 text-slate-800 shadow-lg sm:right-4 sm:top-4 sm:px-4">
                    <span
                      className="grid size-9 shrink-0 place-items-center rounded-xl text-white"
                      style={{ backgroundColor: color }}
                    >
                      <Stethoscope size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold">Meet the specialists</span>
                      <span className="block truncate text-[11px] text-slate-500">
                        Care for every stage of life
                      </span>
                    </span>
                  </div>

                  <div className="tdm-feature-info absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                      Featured doctor
                    </p>
                    <p className="mt-2 break-words text-2xl font-bold sm:text-3xl">
                      {featuredDoctor?.name || clinic?.name || "Our care team"}
                    </p>
                    {featuredDoctor?.specialization && (
                      <p className="mt-1 text-sm text-white/80">
                        {featuredDoctor.specialization}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="tdm-stats mt-4 grid grid-cols-2 gap-3 text-center text-white sm:mt-5">
                <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-3">
                  <p className="text-xl font-bold">{activeDoctors.length}</p>
                  <p className="mt-1 text-xs text-white/70">Doctors</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-3">
                  <p className="text-xl font-bold">{activeServices.length}</p>
                  <p className="mt-1 text-xs text-white/70">Services</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="doctors" className="tdm-doctors px-4 py-14 sm:px-7 sm:py-16 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="tdm-doctors-heading flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p
                  className="text-xs font-bold uppercase tracking-[0.16em]"
                  style={{ color }}
                >
                  The people behind your care
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                  Meet our doctors
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                  Explore our doctors and learn more about their areas of care.
                </p>
              </div>

              <label className="tdm-search flex min-h-12 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 shadow-sm sm:max-w-xs">
                <Search size={18} className="shrink-0 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search doctors"
                  aria-label="Search doctors by name or specialty"
                  className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none placeholder:text-slate-400"
                />
              </label>
            </div>

            {filteredDoctors.length > 0 ? (
              <div className="tdm-doctor-grid mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
                {filteredDoctors.map((doctor, index) => (
                  <article
                    key={String(doctor._id || doctor.id || index)}
                    className="tdm-doctor-card template-d-enter group min-w-0 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                    style={{ animationDelay: `${Math.min(index * 65, 325)}ms` }}
                  >
                    <div className="tdm-doctor-photo relative h-56 overflow-hidden bg-gradient-to-br from-violet-100 via-indigo-50 to-sky-100 sm:h-64">
                      {doctor.photoUrl ? (
                        <img
                          src={doctor.photoUrl}
                          alt={doctor.name || "Doctor"}
                          loading="lazy"
                          className="size-full object-cover transition duration-500 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <div
                          className="grid size-full place-items-center"
                          style={{ color }}
                        >
                          <UserRound size={76} strokeWidth={1} />
                        </div>
                      )}

                      <span
                        className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)] truncate rounded-full border border-white/70 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur"
                        title={doctor.specialization || "Doctor"}
                      >
                        {doctor.specialization || "Doctor"}
                      </span>
                    </div>

                    <div className="tdm-doctor-body p-5 sm:p-6">
                      <h3 className="break-words text-lg font-bold tracking-tight sm:text-xl">
                        {doctor.name || "Doctor"}
                      </h3>

                      {qualificationsOf(doctor.qualifications) && (
                        <p className="mt-2 break-words text-xs leading-5 text-slate-500">
                          {qualificationsOf(doctor.qualifications)}
                        </p>
                      )}

                      {doctor.bio && (
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {doctor.bio}
                        </p>
                      )}

                      {!preview && (
                        <button
                          type="button"
                          onClick={() => onSelectDoctor?.(doctor)}
                          className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition hover:brightness-95 sm:w-auto sm:justify-start sm:px-0"
                          style={{ color }}
                        >
                          View doctor details <ArrowUpRight size={17} />
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
                <Stethoscope className="mx-auto" size={30} style={{ color }} />
                <p className="mt-4 font-semibold">
                  {search ? "No doctors match your search." : "Doctor profiles will appear here."}
                </p>
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="mt-3 min-h-11 px-3 text-sm font-semibold underline underline-offset-4"
                    style={{ color }}
                  >
                    Clear search
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {activeServices.length > 0 && (
          <section id="services" className="tdm-services border-y border-slate-200/70 bg-white px-4 py-12 sm:px-7 sm:py-14 lg:px-10">
            <div className="mx-auto max-w-7xl">
              <p
                className="text-xs font-bold uppercase tracking-[0.16em]"
                style={{ color }}
              >
                How we can help
              </p>
              <div className="tdm-services-layout mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <h2 className="max-w-lg text-2xl font-bold tracking-tight sm:text-3xl">
                  Care for your everyday health
                </h2>
                <div className="tdm-service-list flex flex-wrap gap-2">
                  {activeServices.map((service, index) => (
                    <span
                      key={String(service._id || service.id || index)}
                      className="rounded-full border border-slate-200 bg-[#f7f8fc] px-4 py-2 text-sm font-medium text-slate-700"
                    >
                      {service.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <section id="contact" className="tdm-contact bg-[#171a37] px-4 py-12 text-white sm:px-7 sm:py-14 lg:px-10">
          <div className="tdm-contact-layout mx-auto flex max-w-7xl flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
                Visit or contact us
              </p>
              <h2 className="mt-2 break-words text-2xl font-bold">
                {clinic?.name || "Your Clinic"}
              </h2>
              {address && (
                <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-white/70">
                  <MapPin size={17} className="mt-0.5 shrink-0" />
                  <span className="break-words">{address}</span>
                </p>
              )}
            </div>

            <div className="tdm-contact-actions flex w-full flex-col gap-3 min-[420px]:flex-row sm:w-auto">
              {contact.phone && (
                <a
                  href={`tel:${contact.phone}`}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#171a37] transition hover:bg-violet-100"
                >
                  Call clinic
                </a>
              )}
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Email clinic
                </a>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#101228] px-4 py-5 text-center text-xs text-white/55">
        © {new Date().getFullYear()} {clinic?.name || "Clinic"}. All rights reserved.
      </footer>

      {preview && (
        <p className="bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-900">
          Preview only — your clinic is not published yet.
        </p>
      )}
    </div>
  );
}