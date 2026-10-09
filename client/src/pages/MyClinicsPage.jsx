
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  ArrowRight,
  Building2,
  Globe2,
  LoaderCircle,
  LogOut,
  Plus,
} from "lucide-react";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function MyClinicsPage() {
  const { user, logout } = useAuth();

  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let alive = true;

    api
      .get("/clinics/my-clinics")
      .then(({ data }) => {
        if (alive) {
          setClinics(data.clinics || []);
        }
      })
      .catch((err) => {
        if (alive) {
          setError(
            err.response?.data?.message ||
              "Unable to load clinics."
          );
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setError("");

    try {
      await logout();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Logout failed."
      );
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              My Clinics
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Welcome, {user?.name || "Owner"}.
              Choose a clinic or create a new one.
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            {loggingOut ? (
              <LoaderCircle
                size={17}
                className="animate-spin"
              />
            ) : (
              <LogOut size={17} />
            )}
            Logout
          </button>
        </header>

        {error && (
          <p
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <LoaderCircle
              size={18}
              className="animate-spin"
            />
            Loading your clinics...
          </p>
        ) : (
          <>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Your Clinics
              {clinics.length > 0 && (
                <span className="ml-2 text-slate-400">
                  ({clinics.length})
                </span>
              )}
            </h2>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {clinics.map((clinic) => {
                const isDraft =
                  clinic.status === "draft";

                const isActive =
                  clinic.status === "active";

                const destination = isDraft
                  ? `/clinics/${clinic.id}/setup`
                  : `/dashboard/clinic/${clinic.id}`;

                return (
                  <article
                    key={clinic.id}
                    className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="mb-4 flex h-20 items-center justify-center rounded-xl bg-blue-50">
                      {clinic.branding?.logoUrl ? (
                        <img
                          src={clinic.branding.logoUrl}
                          alt={`${clinic.name} logo`}
                          className="max-h-16 max-w-full object-contain"
                        />
                      ) : (
                        <Building2
                          size={36}
                          className="text-blue-600"
                        />
                      )}
                    </div>

                    <h3 className="break-words text-lg font-semibold text-slate-900">
                      {clinic.name}
                    </h3>

                    <p className="mt-1 break-all text-xs text-slate-500">
                      /{clinic.slug}
                    </p>

                    <span
                      className={`mt-3 w-fit rounded-full px-3 py-1 text-xs font-medium ${
                        isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {isActive
                        ? "Published"
                        : isDraft
                          ? "Draft"
                          : clinic.status}
                    </span>

                    {(isDraft || isActive) && (
                      <Link
                        to={destination}
                        className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        {isDraft
                          ? "Continue Setup"
                          : "Manage Clinic"}

                        <ArrowRight size={17} />
                      </Link>
                    )}
                  </article>
                );
              })}

              <Link
                to="/clinics/new"
                className="flex min-h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-white p-6 text-center transition hover:border-blue-500 hover:bg-blue-50"
              >
                <span className="mb-4 rounded-full bg-blue-50 p-4 text-blue-600">
                  <Plus size={28} />
                </span>

                <span className="text-lg font-semibold text-slate-900">
                  Publish Your Clinic Online
                </span>

                <span className="mt-2 text-sm text-slate-500">
                  Create a professional online presence
                  for your clinic.
                </span>

                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-600">
                  Get Started
                  <ArrowRight size={16} />
                </span>
              </Link>
            </div>

            {clinics.length === 0 && (
              <p className="mt-5 flex items-center gap-2 text-sm text-slate-500">
                <Globe2 size={17} />
                You haven't added a clinic yet.
                Start with the card above.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
