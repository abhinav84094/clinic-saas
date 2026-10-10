
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Link,
  useParams,
} from "react-router-dom";

import {
  ArrowLeft,
  CalendarDays,
  Globe2,
  LoaderCircle,
  RefreshCw,
  Settings,
  Stethoscope,
  Users,
} from "lucide-react";

import api from "../services/api";

import { useAuth } from "../context/AuthContext";

import {
  getClinicPublicUrl,
} from "../utils/clinicDomain";

const formatDate = (value) =>
  new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function DashboardPage() {
  const { clinicId } = useParams();

  const { user } = useAuth();

  const [clinic, setClinic] = useState(null);

  const [dashboard, setDashboard] = useState(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        clinicResponse,
        dashboardResponse,
      ] = await Promise.all([
        api.get(`/clinics/${clinicId}`),

        api.get(`/clinics/${clinicId}/dashboard`),
      ]);

      setClinic(clinicResponse.data.clinic);

      setDashboard(dashboardResponse.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to load dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = dashboard?.stats;

  const cards = [
    {
      label: "Today's appointments",
      value: stats?.todayAppointments ?? "—",
      icon: CalendarDays,
    },
    {
      label: "Unique patients",
      value: stats?.totalPatients ?? "—",
      icon: Users,
    },
    {
      label: "Active doctors",
      value: stats?.activeDoctors ?? "—",
      icon: Stethoscope,
    },
    {
      label: "Website",
      value:
        clinic?.status === "active"
          ? "Published"
          : "Not published",
      icon: Globe2,
    },
  ];

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-6">

        <Link
          to="/my-clinics"
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600"
        >
          <ArrowLeft size={17} />
          My Clinics
        </Link>

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {clinic?.name || "Clinic Dashboard"}
            </h1>

            <p className="text-sm text-slate-500">
              Welcome back,{" "}
              {user?.name?.split(" ")[0] || "Owner"}.
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {loading && (
          <p className="flex items-center gap-2 text-slate-500">
            <LoaderCircle
              className="animate-spin"
              size={18}
            />
            Loading dashboard...
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {clinic && dashboard && (
          <>
            {/* Statistics */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map(
                ({ label, value, icon: Icon }) => (
                  <article
                    key={label}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <Icon
                      className="mb-4 text-blue-600"
                      size={23}
                    />

                    <p className="text-sm text-slate-500">
                      {label}
                    </p>

                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {value}
                    </p>
                  </article>
                )
              )}
            </div>

            <div className="grid gap-5 lg:grid-cols-3">

              {/* Upcoming appointments */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
                <h2 className="mb-4 text-lg font-bold text-slate-900">
                  Upcoming appointments
                </h2>

                {dashboard.upcomingAppointments?.length ? (
                  <div className="divide-y divide-slate-100">
                    {dashboard.upcomingAppointments.map(
                      (item) => (
                        <div
                          key={item._id}
                          className="flex flex-wrap items-center justify-between gap-2 py-3"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">
                              {item.patientName}
                            </p>

                            <p className="text-sm text-slate-500">
                              {item.doctorId?.name ||
                                "Doctor unavailable"}
                              {" · "}
                              {item.serviceId?.name ||
                                "Service unavailable"}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {formatDate(item.startAt)}
                            </p>

                            <p className="text-xs capitalize text-blue-600">
                              {item.status}
                            </p>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    No upcoming appointments yet.
                  </p>
                )}
              </section>

              {/* Clinic management */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
                  <Settings
                    size={19}
                    className="text-blue-600"
                  />
                  Manage clinic
                </h2>

                <p className="text-sm text-slate-500">
                  {[
                    clinic.address?.city,
                    clinic.address?.state,
                  ]
                    .filter(Boolean)
                    .join(", ") || "Location not set"}
                </p>

                <div className="mt-5 flex flex-col gap-3 text-sm font-semibold text-blue-600">

                  <Link to={`/clinics/${clinicId}/setup`}>
                    Clinic details
                  </Link>

                  <Link to={`/clinics/${clinicId}/doctors/setup`}>
                    Manage doctors
                  </Link>

                  <Link to={`/clinics/${clinicId}/services/setup`}>
                    Manage services
                  </Link>

                  <Link to={`/clinics/${clinicId}/website/setup`}>
                    Website setup
                  </Link>

                  <Link to={`/clinics/${clinicId}/review`}>
                    Review & publish
                  </Link>

                  {clinic.status === "active" &&
                    getClinicPublicUrl(clinic.slug) && (
                      <a
                        href={getClinicPublicUrl(clinic.slug)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View public website ↗
                      </a>
                    )}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
