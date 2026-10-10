import { Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, ArrowRight, Building2 } from "lucide-react";

const steps = [
  { label: "Clinic details", path: "setup", hint: "Add your clinic's name, contact details and location. Required fields are marked with *." },
  { label: "Doctors", path: "doctors/setup", hint: "Add at least one active doctor. Save each profile before continuing to services." },
  { label: "Services & hours", path: "services/setup", hint: "Start with a service, assign it to a doctor with a fee, then add the doctor's working hours." },
  { label: "Website", path: "website/setup", hint: "Choose a design and check the desktop and mobile previews. Your website stays private until you publish." },
  { label: "Subscription", path: "subscription/setup", hint: "Choose monthly or yearly billing. After payment is verified, review your clinic before publishing." },
  { label: "Review & publish", path: "review", hint: "Check your details and fix any missing requirements. Publishing makes your clinic website public." },
];

export default function ClinicSetupProgress({ step, clinicId }) {
  const current = steps[step - 1];
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [step, clinicId]);
  return (
    <section aria-label="Clinic setup progress" className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:px-6">
        <Link to="/my-clinics" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-300">
          <ArrowLeft size={16} /> My Clinics
        </Link>
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><Building2 size={18} className="text-blue-600 dark:text-blue-300" /> Clinic setup · {step} of 6</span>
      </div>
      <nav aria-label="Setup steps" className="hidden px-4 py-5 md:block sm:px-6">
        <ol className="grid grid-cols-6 gap-2">
          {steps.map((item, index) => {
            const active = index === step - 1;
            const content = <><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>{index + 1}</span><span className="text-center text-xs font-semibold leading-5">{item.label}</span></>;
            const className = `flex min-h-20 flex-col items-center justify-start gap-2 rounded-xl p-2 ${active ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : "text-slate-500 dark:text-slate-400"}`;
            return <li key={item.path}>{clinicId && index < step - 1
              ? <Link to={`/clinics/${clinicId}/${item.path}`} className={`${className} hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-slate-800`}>{content}</Link>
              : <div aria-current={active ? "step" : undefined} className={className}>{content}</div>}</li>;
          })}
        </ol>
      </nav>
      <div className="px-4 py-4 sm:px-6 md:pt-0">
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-label="Current setup step" aria-valuemin={1} aria-valuemax={6} aria-valuenow={step}>
          <div className="h-full rounded-full bg-blue-600" style={{ width: `${step / 6 * 100}%` }} />
        </div>
        <p className="mb-1 font-semibold text-slate-900 dark:text-slate-100 md:hidden">{current.label}</p>
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{current.hint}</p>
        {step < 6 && <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><ArrowRight size={13} /> Next: {steps[step].label}</p>}
        {step > 1 && step < 5 && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Save changes in each form before moving to another step.</p>}
      </div>
    </section>
  );
}
