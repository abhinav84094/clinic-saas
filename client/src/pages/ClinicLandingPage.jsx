
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronRight,
  ClipboardList,
  Globe2,
  LayoutTemplate,
  Mail,
  Menu,
  Moon,
  Phone,
  ShieldCheck,
  Stethoscope,
  Sun,
  Users,
  MessageCircle,
  X,
} from "lucide-react";

// Public folder: client/public/prakash-logo.png
const LOGO_URL = "/prakash-logo.png";

// Public contact information from Vite environment variables
const CONTACT_EMAIL =
  import.meta.env.VITE_CONTACT_EMAIL?.trim() || "";

const CONTACT_PHONE =
  import.meta.env.VITE_CONTACT_PHONE?.trim() || "";

const CONTACT_WHATSAPP = (
  import.meta.env.VITE_CONTACT_WHATSAPP || ""
).replace(/\D/g, "");

const features = [
  {
    icon: Globe2,
    title: "Your Own Clinic Website",
    description:
      "Give your clinic a professional online presence with its own unique website address.",
  },
  {
    icon: Users,
    title: "Showcase Your Doctors",
    description:
      "Present your medical team, specialties, and clinic information in one convenient place.",
  },
  {
    icon: ClipboardList,
    title: "Manage Clinic Services",
    description:
      "Organize and display your clinic's services so patients can explore what you offer.",
  },
  {
    icon: LayoutTemplate,
    title: "Beautiful Website Templates",
    description:
      "Choose a design for your clinic without needing coding or web development skills.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Owner Dashboard",
    description:
      "Manage your clinic information through your authenticated dashboard.",
  },
  {
    icon: Stethoscope,
    title: "Built for Clinics",
    description:
      "A simple platform designed around the everyday needs of clinic owners.",
  },
];

const steps = [
  {
    number: "01",
    title: "Create Your Account",
    description:
      "Register and sign in to start setting up your clinic.",
  },
  {
    number: "02",
    title: "Add Clinic Details",
    description:
      "Enter your clinic information, doctors, and services.",
  },
  {
    number: "03",
    title: "Choose Your Design",
    description:
      "Select a website template that suits your clinic.",
  },
  {
    number: "04",
    title: "Publish Your Website",
    description:
      "Complete the required setup and publish your clinic website.",
  },
];

const faqs = [
  {
    question: "Do I need coding knowledge?",
    answer:
      "No. You can create your clinic website using the dashboard and available templates.",
  },
  {
    question: "Will my clinic get its own website?",
    answer:
      "Yes. Published clinics receive a unique website address under prakashsaas.com.",
  },
  {
    question: "Can I manage doctors and services?",
    answer:
      "Yes. You can manage supported clinic information through the owner dashboard.",
  },
  {
    question: "Can I change my website design?",
    answer:
      "The platform provides website templates you can choose during clinic setup.",
  },
  {
    question: "How do I get started?",
    answer:
      "Create an account, complete your clinic setup, choose a template, and follow the publishing process.",
  },
];

function BrandLogo({ footer = false }) {
  return (
    <Link to="/" className="flex items-center gap-3">
      <img
        src={LOGO_URL}
        alt="Prakash SaaS logo"
        className="h-10 w-10 shrink-0 object-contain"
      />
      <span
        className={`text-lg font-bold tracking-tight ${
          footer
            ? "text-white"
            : "text-slate-950 dark:text-white"
        }`}
      >
        Prakash{" "}
        <span className="text-blue-600 dark:text-blue-400">
          SaaS
        </span>
      </span>
    </Link>
  );
}

function Navbar({ theme, toggleTheme }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "About", href: "#about" },
    { label: "Contact", href: "#contact" },
    { label: "FAQs", href: "#faq" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95">
      <nav className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
        <BrandLogo />

        <div className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-slate-600 transition hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === "dark"
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
            title={
              theme === "dark" ? "Light mode" : "Dark mode"
            }
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {theme === "dark" ? (
              <Sun size={19} />
            ) : (
              <Moon size={19} />
            )}
          </button>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              to="/login"
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Get Started <ArrowRight size={16} />
            </Link>
          </div>

          <button
            type="button"
            aria-label={
              menuOpen ? "Close menu" : "Open menu"
            }
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
            className="rounded-lg p-2 text-slate-800 dark:text-white md:hidden"
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="border-t border-slate-100 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {link.label}
              </a>
            ))}

            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-3 text-sm font-semibold text-slate-700 dark:text-white"
            >
              Login
            </Link>

            <Link
              to="/register"
              onClick={() => setMenuOpen(false)}
              className="mt-2 rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white"
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export default function ClinicLandingPage() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("prakashsaas-theme");

      if (saved === "dark" || saved === "light") {
        return saved;
      }

      if (
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function"
      ) {
        return window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches
          ? "dark"
          : "light";
      }
    } catch {
      // Fall back to light mode.
    }

    return "light";
  });

  useEffect(() => {
    try {
      localStorage.setItem("prakashsaas-theme", theme);
    } catch {
      // Storage is optional.
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) =>
      current === "dark" ? "light" : "dark"
    );
  };

  return (
    <div
      className={`${
        theme === "dark" ? "dark" : ""
      } min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100`}
    >
      <Navbar theme={theme} toggleTheme={toggleTheme} />

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-white dark:from-slate-900 dark:via-slate-950 dark:to-slate-950">
        <div className="pointer-events-none absolute -right-32 top-10 h-96 w-96 rounded-full bg-blue-100/70 blur-3xl dark:bg-blue-900/20" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-20 sm:px-8 lg:grid-cols-2 lg:px-12 lg:pb-28 lg:pt-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
              <Stethoscope size={15} />
              Clinic Website & Management Platform
            </span>

            <h1 className="mt-7 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-6xl dark:text-white">
              Your Clinic Deserves a{" "}
              <span className="text-blue-600 dark:text-blue-400">
                Better Digital Presence.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg dark:text-slate-300">
              Create a professional clinic website, showcase
              your doctors and services, and manage your clinic
              information from one simple dashboard.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700"
              >
                Build Your Clinic Website
                <ArrowRight size={18} />
              </Link>

              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-7 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
              >
                See How It Works
                <ChevronRight size={17} />
              </a>
            </div>

            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-600 dark:text-slate-300">
              {[
                "No coding required",
                "Professional templates",
                "Simple clinic management",
              ].map((item) => (
                <span
                  key={item}
                  className="flex items-center gap-2"
                >
                  <Check
                    size={17}
                    className="text-blue-600 dark:text-blue-400"
                  />
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* PRODUCT PREVIEW */}
          <div className="relative">
            <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl shadow-blue-900/10 sm:p-5 dark:border-slate-700 dark:bg-slate-900">
              <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-green-300" />
                  <span className="ml-3 truncate text-xs text-slate-400">
                    yourclinic.prakashsaas.com
                  </span>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-white p-6 text-slate-900 sm:p-9">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 font-bold text-blue-800">
                      <Stethoscope size={22} />
                      Your Clinic
                    </div>
                    <span className="text-right text-xs text-slate-500">
                      Home · Doctors · Services
                    </span>
                  </div>

                  <div className="py-12 text-center">
                    <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">
                      Welcome to Your Clinic
                    </span>
                    <h2 className="mx-auto mt-4 max-w-sm text-2xl font-bold text-slate-900 sm:text-3xl">
                      Quality Care Starts Here
                    </h2>
                    <p className="mx-auto mt-4 max-w-xs text-sm leading-6 text-slate-500">
                      A professional online home for your
                      clinic, doctors, and healthcare services.
                    </p>
                    <div className="mx-auto mt-6 w-fit rounded-lg bg-blue-600 px-5 py-3 text-xs font-semibold text-white">
                      Explore Our Services
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      ["Doctors", Users],
                      ["Services", ClipboardList],
                      ["Our Clinic", Stethoscope],
                    ].map(([name, Icon]) => (
                      <div
                        key={name}
                        className="flex flex-col items-center gap-2 rounded-xl border border-blue-100 bg-white p-3 text-center sm:p-4"
                      >
                        <Icon
                          size={20}
                          className="text-blue-600"
                        />
                        <span className="text-xs font-medium text-slate-700">
                          {name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-3 text-center text-xs text-slate-400">
              Illustrative clinic website preview
            </p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section
        id="features"
        className="scroll-mt-24 bg-slate-50 py-20 sm:py-24 dark:bg-slate-900"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
              Features
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Everything Your Clinic Needs to Get Online
            </h2>
            <p className="mt-5 text-slate-600 dark:text-slate-300">
              From creating your website to organizing clinic
              information, manage it all in one place.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map(
              ({ icon: Icon, title, description }) => (
                <article
                  key={title}
                  className="rounded-2xl border border-slate-200 bg-white p-7 transition hover:-translate-y-1 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                    <Icon size={23} />
                  </div>
                  <h3 className="mt-5 text-lg font-bold">
                    {title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                    {description}
                  </p>
                </article>
              )
            )}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        id="how-it-works"
        className="scroll-mt-24 bg-white py-20 sm:py-24 dark:bg-slate-950"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
              How It Works
            </p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
              Launch Your Clinic Website in Four Steps
            </h2>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <div
                key={step.number}
                className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900"
              >
                <span className="text-4xl font-extrabold text-blue-100 dark:text-blue-900">
                  {step.number}
                </span>
                <h3 className="mt-5 text-lg font-bold">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section
        id="about"
        className="scroll-mt-24 bg-blue-950 py-20 text-white sm:py-24 dark:bg-slate-900"
      >
        <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-2 lg:items-center lg:px-12">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-blue-300">
              About Prakash SaaS
            </p>
            <h2 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
              Helping Clinics Build Their Digital Identity
            </h2>
          </div>

          <div>
            <p className="leading-8 text-blue-100 dark:text-slate-300">
              Prakash SaaS is designed to make website
              creation and clinic information management
              simpler for clinic owners. Set up your profile,
              present your doctors and services, and give
              patients a dedicated place to learn about
              your clinic.
            </p>

            <Link
              to="/register"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-blue-950 transition hover:bg-blue-50"
            >
              Get Started <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="scroll-mt-24 bg-white py-20 sm:py-24 dark:bg-slate-950"
      >
        <div className="mx-auto max-w-3xl px-5">
          <div className="mb-12 text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
              FAQs
            </p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
              >
                <summary className="cursor-pointer font-semibold text-slate-900 dark:text-white">
                  {faq.question}
                </summary>
                <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-blue-600 px-5 py-20 text-center text-white dark:bg-blue-900">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Ready to Bring Your Clinic Online?
          </h2>
          <p className="mt-5 text-blue-100">
            Start building your professional clinic website today.
          </p>
          <Link
            to="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-4 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
          >
            Get Started <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* CONTACT */}
      <section
        id="contact"
        className="scroll-mt-24 bg-slate-50 py-20 sm:py-24 dark:bg-slate-900"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
              Contact Us
            </p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
              Have Questions? Get in Touch.
            </h2>
            <p className="mt-5 text-slate-600 dark:text-slate-300">
              Need help with clinic setup, subscriptions,
              or your website? Contact Prakash SaaS.
            </p>
          </div>

          {CONTACT_EMAIL || CONTACT_PHONE || CONTACT_WHATSAPP ? (
            <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-3">
              {CONTACT_EMAIL && (
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="min-w-0 rounded-2xl border border-slate-200 bg-white p-7 transition hover:border-blue-400 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800"
                >
                  <Mail
                    size={24}
                    className="text-blue-600 dark:text-blue-400"
                  />
                  <h3 className="mt-5 text-lg font-bold">
                    Email Support
                  </h3>
                  <p className="mt-3 break-all text-sm text-blue-600 dark:text-blue-400">
                    {CONTACT_EMAIL}
                  </p>
                </a>
              )}

              {CONTACT_PHONE && (
                <a
                  href={`tel:${CONTACT_PHONE.replace(/[^\d+]/g, "")}`}
                  className="min-w-0 rounded-2xl border border-slate-200 bg-white p-7 transition hover:border-blue-400 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800"
                >
                  <Phone
                    size={24}
                    className="text-blue-600 dark:text-blue-400"
                  />
                  <h3 className="mt-5 text-lg font-bold">
                    Call Us
                  </h3>
                  <p className="mt-3 text-sm text-blue-600 dark:text-blue-400">
                    {CONTACT_PHONE}
                  </p>
                </a>
              )}

              {CONTACT_WHATSAPP && (
                <a
                  href={`https://wa.me/${CONTACT_WHATSAPP}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 rounded-2xl border border-slate-200 bg-white p-7 transition hover:border-blue-400 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800"
                >
                  <MessageCircle
                    size={24}
                    className="text-blue-600 dark:text-blue-400"
                  />
                  <h3 className="mt-5 text-lg font-bold">
                    WhatsApp
                  </h3>
                  <p className="mt-3 text-sm text-blue-600 dark:text-blue-400">
                    Chat with our team →
                  </p>
                </a>
              )}
            </div>
          ) : (
            <p className="mt-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Contact information will be available soon.
            </p>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-800 bg-slate-950 py-12 text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-5 sm:px-8 md:flex-row lg:px-12">
          <div>
            <BrandLogo footer />
            <p className="mt-3 max-w-sm text-sm leading-6">
              Professional clinic websites and management
              tools, made simpler.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <a href="#features" className="hover:text-white">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-white">
              How It Works
            </a>
            <a href="#about" className="hover:text-white">
              About
            </a>
            <a href="#faq" className="hover:text-white">
              FAQs
            </a>
            <a href="#contact" className="hover:text-white">
              Contact
            </a>
            <Link to="/login" className="hover:text-white">
              Login
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-7xl border-t border-slate-800 px-5 pt-6 text-xs sm:px-8 lg:px-12">
          © {new Date().getFullYear()} Prakash SaaS.
          All rights reserved.
        </div>
      </footer>
    </div>
  );
}
