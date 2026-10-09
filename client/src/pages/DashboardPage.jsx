
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Globe2,
  LoaderCircle,
  Settings,
  Stethoscope,
  Users,
} from "lucide-react";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function DashboardPage() {
  const { clinicId } = useParams();
  const { user } = useAuth();

  const [clinic, setClinic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    setLoading(true);
    setError("");
    setClinic(null);

    api
      .get(`/clinics/${clinicId}`)
      .then(({ data }) => {
        if (alive) {
          setClinic(data.clinic);
        }
      })
      .catch((err) => {
        if (alive) {
          setError(
            err.response?.data?.message ||
              "Unable to load this clinic."
          );
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [clinicId]);

  const statistics = [
    {
      label: "Today's Appointments",
      icon: CalendarDays,
    },
    {
      label: "Total Patients",
      icon: Users,
    },
    {
      label: "Doctors",
      icon: Stethoscope,
    },
    {
      label: "Website",
      icon: Globe2,
    },
  ];

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/my-clinics"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft size={17} />
          My Clinics
        </Link>

        {loading && (
          <p className="flex items-center gap-2 text-slate-500">
            <LoaderCircle
              size={18}
              className="animate-spin"
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

        {clinic && (
          <>
            <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-50 text-blue-600">
                  {clinic.branding?.logoUrl ? (
                    <img
                      src={clinic.branding.logoUrl}
                      alt={`${clinic.name} logo`}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <Building2 size={27} />
                  )}
                </div>

                <div className="min-w-0">
                  <h1 className="break-words text-xl font-bold text-slate-900 sm:text-2xl">
                    {clinic.name}
                  </h1>

                  <p className="text-sm text-slate-500">
                    Clinic Management Dashboard
                  </p>
                </div>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  clinic.status === "active"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {clinic.status === "active"
                  ? "Published"
                  : clinic.status}
              </span>
            </header>

            <section className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                Welcome back,{" "}
                {user?.name?.split(" ")[0] || "Owner"}!
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Manage {clinic.name} from this workspace.
              </p>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {statistics.map(({ label, icon: Icon }) => (
                <article
                  key={label}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <Icon
                    size={22}
                    className="mb-4 text-blue-600"
                  />

                  <p className="text-sm text-slate-500">
                    {label}
                  </p>

                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    —
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Live data coming soon
                  </p>
                </article>
              ))}
            </section>

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="font-bold text-slate-900">
                  Appointments
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  Appointments belonging to {clinic.name}{" "}
                  will appear here when this module
                  is connected.
                </p>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <Settings
                    size={19}
                    className="text-blue-600"
                  />

                  <h3 className="font-bold text-slate-900">
                    Clinic Settings
                  </h3>
                </div>

                <p className="mt-2 text-sm text-slate-500">
                  {[
                    clinic.address?.city,
                    clinic.address?.state,
                  ]
                    .filter(Boolean)
                    .join(", ") || "Location not set"}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {clinic.contact?.phone ||
                    "Phone not set"}
                </p>

                <Link
                  to={`/clinics/${clinicId}/setup`}
                  className="mt-4 inline-flex text-sm font-semibold text-blue-600"
                >
                  View Clinic Details
                </Link>
              </section>
            </div>

            {clinic.status === "active" && (
              <a
                href={`/c/${clinic.slug}`}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600"
              >
                <Globe2 size={17} />
                View Public Clinic Website
              </a>
            )}
          </>
        )}
      </div>
    </main>
  );
}
