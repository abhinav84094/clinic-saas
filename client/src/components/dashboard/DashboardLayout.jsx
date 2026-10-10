
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
    path: (id) => `/clinics/${id}/setup`,
  },
  {
    label: "Doctors",
    icon: Stethoscope,
    path: (id) => `/clinics/${id}/doctors/setup`,
  },
  {
    label: "Services & Availability",
    icon: CalendarClock,
    path: (id) => `/clinics/${id}/services/setup`,
  },
  {
    label: "Website",
    icon: Globe2,
    path: (id) => `/clinics/${id}/website/setup`,
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
    comingSoon: true,
  },
];

function SidebarContent({ clinicId, clinic, onNavigate }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
          <Activity size={22} />
        </div>

        <div>
          <p className="font-bold text-slate-900">
            Prakash SaaS
          </p>
          <p className="text-xs text-slate-500">
            Clinic Management
          </p>
        </div>
      </div>

      <div className="px-4 pt-5">
        <div className="rounded-xl bg-blue-50 p-3">
          <p className="truncate text-sm font-bold text-slate-900">
            {clinic?.name || "Your Clinic"}
          </p>

          <p className="mt-1 text-xs capitalize text-blue-700">
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
                className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-400"
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
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100"
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

      <div className="border-t border-slate-200 p-4">
        <Link
          to="/my-clinics"
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100"
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
    <div className="min-h-dvh bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">
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

          <aside className="relative z-10 h-full w-72 max-w-[85vw] bg-white shadow-xl">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-5 z-20 rounded-lg p-2 hover:bg-slate-100"
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
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"
            >
              <Menu size={22} />
            </button>

            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                {clinic?.name || "Clinic Dashboard"}
              </p>
              <p className="text-xs text-slate-500">
                Owner Workspace
              </p>
            </div>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
              clinic?.status === "active"
                ? "bg-green-50 text-green-700"
                : "bg-amber-50 text-amber-700"
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
