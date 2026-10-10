
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  CalendarCheck,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Globe2,
  LayoutDashboard,
  Menu,
  Settings,
  Stethoscope,
  Users,
  Wallet,
  X,
} from "lucide-react";


const navigation = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    path: (id) => `/dashboard/clinic/${id}`,
  },
  {
    label: "Clinic Profile",
    icon: Settings,
    path: (id) => `/dashboard/clinic/${id}/profile`,
  },
  {
    label: "Doctors",
    icon: Stethoscope,
    path: (id) => `/dashboard/clinic/${id}/doctors`,
  },
  {
    label: "Services & Availability",
    icon: CalendarClock,
    path: (id) => `/dashboard/clinic/${id}/services`,
  },
  {
    label: "Website",
    icon: Globe2,
    path: (id) => `/dashboard/clinic/${id}/website`,
  },
  {
    label: "Appointments",
    icon: CalendarCheck,
    comingSoon: true,
  },
  {
    label: "Patients",
    icon: Users,
    comingSoon: true,
  },
  {
    label: "Payments",
    icon: Wallet,
    comingSoon: true,
  },
  {
    label: "Subscription",
    icon: CreditCard,
    path: (id) => `/dashboard/clinic/${id}/subscription`,
  },
];


function SidebarContent({ clinicId, clinic, onNavigate }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
          <Activity size={22} />
        </div>

        <div>
          <p className="font-bold text-slate-900 dark:text-slate-100">
            Prakash SaaS
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Clinic Management
          </p>
        </div>
      </div>

      <div className="px-4 pt-5">
        <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-3">
          <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
            {clinic?.name || "Your Clinic"}
          </p>

          <p className="mt-1 text-xs capitalize text-blue-700 dark:text-blue-300">
            {clinic?.status || "Loading..."}
          </p>
        </div>
      </div>

      <nav
        aria-label="Clinic dashboard navigation"
        className="flex-1 space-y-1 overflow-y-auto px-3 py-5"
      >
        {navigation.map((item) => {
          const Icon = item.icon;

          if (item.comingSoon) {
            return (
              <div
                key={item.label}
                className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-400 dark:text-slate-400"
              >
                <Icon size={19} />

                <span className="flex-1">
                  {item.label}
                </span>

                <span className="text-[10px]">
                  Soon
                </span>
              </div>
            );
          }

          return (
            <NavLink
              key={item.label}
              to={item.path(clinicId)}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 hover:dark:bg-slate-800"
                }`
              }
            >
              <Icon size={19} />

              <span className="flex-1">
                {item.label}
              </span>

              <ChevronRight size={15} />
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 dark:border-slate-700 p-4">
        <Link
          to="/my-clinics"
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 hover:dark:bg-slate-800"
        >
          <ArrowLeft size={18} />
          Back to My Clinics
        </Link>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  clinicId,
  clinic,
  children,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 lg:block">
        <SidebarContent
          clinicId={clinicId}
          clinic={clinic}
        />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-slate-950/50"
          />

          <aside className="relative z-10 h-full w-72 max-w-[85vw] bg-white dark:bg-slate-900 shadow-xl">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-5 z-20 rounded-lg p-2 hover:bg-slate-100 hover:dark:bg-slate-800"
            >
              <X size={20} />
            </button>

            <SidebarContent
              clinicId={clinicId}
              clinic={clinic}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="min-h-dvh lg:pl-64">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 sm:px-7">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 hover:bg-slate-100 hover:dark:bg-slate-800 lg:hidden"
            >
              <Menu size={22} />
            </button>

            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                {clinic?.name || "Clinic Dashboard"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Owner Workspace
              </p>
            </div>
          </div>

          <span
            className={`ml-3 shrink-0 rounded-full px-3 py-1 text-xs font-semibold capitalize ${
              clinic?.status === "active"
                ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300"
                : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
            }`}
          >
            {clinic?.status || "Loading"}
          </span>
        </header>

        <main className="mx-auto max-w-7xl p-4 sm:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
