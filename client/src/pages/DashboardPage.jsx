
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  ExternalLink,
  Globe2,
  LoaderCircle,
  Plus,
  RefreshCw,
  Stethoscope,
  Users,
} from "lucide-react";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { getClinicPublicUrl } from "../utils/clinicDomain";

const formatDate = (value) => {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

function StatCard({ label, value, icon: Icon, description }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        <Icon size={21} />
      </div>

      <p className="text-sm font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-bold text-slate-900">
        {value}
      </p>

      {description && (
        <p className="mt-2 text-xs text-slate-400">
          {description}
        </p>
      )}
    </article>
  );
}

function QuickAction({ to, icon: Icon, title, description }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-xl border border-slate-200 p-4 transition hover:border-blue-200 hover:bg-blue-50"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 group-hover:bg-white group-hover:text-blue-600">
        <Icon size={21} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">
          {title}
        </p>

        <p className="mt-1 text-xs text-slate-500">
          {description}
        </p>
      </div>

      <ArrowUpRight
        size={17}
        className="shrink-0 text-slate-400 group-hover:text-blue-600"
      />
    </Link>
  );
}

export default function DashboardPage() {
  const { clinicId } = useParams();
  const { user } = useAuth();

  const [clinic, setClinic] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ initial = false } = {}) => {
    if (initial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError("");

    try {
      const [clinicResponse, dashboardResponse] =
        await Promise.all([
          api.get(`/clinics/${clinicId}`),
          api.get(`/clinics/${clinicId}/dashboard`),
        ]);

      setClinic(clinicResponse.data.clinic);
      setDashboard(dashboardResponse.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load clinic dashboard."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clinicId]);

  useEffect(() => {
    load({ initial: true });
  }, [load]);

  const stats = dashboard?.stats;

  const publicUrl =
    clinic?.status === "active" && clinic?.slug
      ? getClinicPublicUrl(clinic.slug)
      : null;

  const statCards = [
    {
      label: "Today's Appointments",
      value: stats?.todayAppointments ?? 0,
      icon: CalendarDays,
      description: "Non-cancelled appointments today",
    },
    {
      label: "Total Patients",
      value: stats?.totalPatients ?? 0,
      icon: Users,
      description: "Unique patients with non-cancelled bookings",
    },
    {
      label: "Active Doctors",
      value: stats?.activeDoctors ?? 0,
      icon: Stethoscope,
      description: "Currently active doctors",
    },
    {
      label: "Clinic Website",
      value:
        clinic?.status === "active"
          ? "Live"
          : "Not Live",
      icon: Globe2,
      description:
        clinic?.status === "active"
          ? "Your clinic is published"
          : "Clinic website is not published",
    },
  ];


const quickActions = [
  {
    title: "Manage Doctors",
    description: "Add or update doctor profiles",
    icon: Stethoscope,
    to: `/dashboard/clinic/${clinicId}/doctors`,
  },
  {
    title: "Manage Services",
    description: "Consultations, pricing and services",
    icon: ClipboardList,
    to: `/dashboard/clinic/${clinicId}/services`,
  },
  {
    title: "Manage Availability",
    description: "Configure doctor working schedules",
    icon: Clock3,
    to: `/dashboard/clinic/${clinicId}/services`,
  },
  {
    title: "Clinic Profile",
    description: "Update clinic information",
    icon: Plus,
    to: `/dashboard/clinic/${clinicId}/profile`,
  },
];


  return (

    <div className="space-y-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Clinic Overview
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Welcome back,{" "}
              {user?.name?.split(" ")[0] || "Owner"}.
              Manage your clinic from one place.
            </p>
          </div>

          <button
            type="button"
            onClick={() => load()}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}

            <button
              type="button"
              onClick={() => load({ initial: true })}
              className="ml-3 font-bold underline"
            >
              Retry
            </button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-3 rounded-2xl bg-white p-16 text-slate-500">
            <LoaderCircle
              size={21}
              className="animate-spin"
            />
            Loading dashboard...
          </div>
        )}

        {!loading && clinic && dashboard && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {statCards.map((card) => (
                <StatCard key={card.label} {...card} />
              ))}
            </section>

            {clinic.status !== "active" && (
              <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div>
                  <h2 className="font-bold text-amber-900">
                    Clinic is not published
                  </h2>

                  <p className="mt-1 text-sm text-amber-800">
                    Complete your clinic setup and review
                    publishing requirements.
                  </p>
                </div>

                <Link
                  to={`/clinics/${clinicId}/review`}
                  className="rounded-xl bg-amber-900 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Review Clinic
                </Link>
              </section>
            )}

            <div className="grid gap-6 xl:grid-cols-3">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Quick Actions
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Frequently used clinic management tools
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {quickActions.map((action) => (
                    <QuickAction
                      key={action.title}
                      {...action}
                    />
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">
                  Clinic Status
                </h2>

                <div className="mt-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-500">
                      Clinic
                    </span>

                    <span className="truncate text-sm font-semibold">
                      {clinic.name}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">
                      Status
                    </span>

                    <span className="text-sm font-semibold capitalize">
                      {clinic.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">
                      Active Doctors
                    </span>

                    <span className="text-sm font-semibold">
                      {stats?.activeDoctors ?? 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">
                      Website
                    </span>

                    <span className="inline-flex items-center gap-1 text-sm font-semibold">
                      {clinic.status === "active" ? (
                        <>
                          <CheckCircle2
                            size={15}
                            className="text-green-600"
                          />
                          Published
                        </>
                      ) : (
                        "Not published"
                      )}
                    </span>
                  </div>
                </div>

                {publicUrl && (
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white"
                  >
                    View Clinic Website
                    <ExternalLink size={16} />
                  </a>
                )}

                <Link
                  to={`/clinics/${clinicId}/website/setup`}
                  className="mt-3 block rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700"
                >
                  Website Settings
                </Link>
              </section>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Upcoming Appointments
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Your next scheduled patient visits
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {dashboard.upcomingAppointments?.length || 0} shown
                </span>
              </div>

              {dashboard.upcomingAppointments?.length ? (
                <div className="divide-y divide-slate-100">
                  {dashboard.upcomingAppointments.map((item) => (
                    <div
                      key={item._id}
                      className="flex flex-wrap items-center justify-between gap-4 py-4"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {item.patientName}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {item.doctorId?.name ||
                            "Doctor unavailable"}
                          {" · "}
                          {item.serviceId?.name ||
                            "Service unavailable"}
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-sm font-semibold text-slate-700">
                          {formatDate(item.startAt)}
                        </p>

                        <p className="mt-1 text-xs font-semibold capitalize text-blue-600">
                          {item.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
                  <CalendarDays
                    size={30}
                    className="mx-auto text-slate-400"
                  />

                  <h3 className="mt-3 font-semibold text-slate-800">
                    No upcoming appointments
                  </h3>

                  <p className="mt-2 text-sm text-slate-500">
                    Upcoming patient bookings will appear here
                    once appointment booking is available.
                  </p>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    
  );
}
