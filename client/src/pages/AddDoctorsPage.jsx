
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  Plus,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";

import api from "../services/api";

const initialForm = {
  name: "",
  specialization: "",
  qualifications: "",
  experienceYears: "",
  bio: "",
  photoUrl: "",
};

const inputClass =
  "mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function getErrorMessage(error) {
  const errors = error.response?.data?.errors;

  const details = Array.isArray(errors)
    ? errors
        .map((item) => {
          const field = item.field || item.path?.join(".");
          return field
            ? `${field}: ${item.message}`
            : item.message;
        })
        .filter(Boolean)
        .join("; ")
    : "";

  return (
    details ||
    error.response?.data?.message ||
    "Something went wrong. Please try again."
  );
}

export default function AddDoctorsPage() {
  const { clinicId } = useParams();
  const navigate = useNavigate();

  const [clinic, setClinic] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState(initialForm);

  const [showDoctorForm, setShowDoctorForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    const [clinicResponse, doctorResponse] = await Promise.all([
      api.get(`/clinics/${clinicId}`),
      api.get(
        `/clinics/${clinicId}/doctors?includeInactive=true`
      ),
    ]);

    setClinic(clinicResponse.data.clinic);
    setDoctors(doctorResponse.data.doctors || []);
  }, [clinicId]);

  useEffect(() => {
    let active = true;

    async function initialize() {
      setLoading(true);

      try {
        const [clinicResponse, doctorResponse] =
          await Promise.all([
            api.get(`/clinics/${clinicId}`),
            api.get(
              `/clinics/${clinicId}/doctors?includeInactive=true`
            ),
          ]);

        if (!active) return;

        setClinic(clinicResponse.data.clinic);
        setDoctors(doctorResponse.data.doctors || []);
      } catch (err) {
        if (active) {
          setError(getErrorMessage(err));
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [clinicId]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  }

  function openDoctorForm() {
    setForm(initialForm);
    setError("");
    setSuccess("");
    setShowDoctorForm(true);
  }

  function closeDoctorForm() {
    if (saving) return;

    setForm(initialForm);
    setError("");
    setShowDoctorForm(false);
  }

  async function handleAddDoctor(event) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setError("");
    setSuccess("");

    const qualifications = form.qualifications
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const payload = {
      name: form.name.trim(),
      qualifications,
      ...(form.specialization.trim() && {
        specialization: form.specialization.trim(),
      }),
      ...(form.experienceYears !== "" && {
        experienceYears: Number(form.experienceYears),
      }),
      ...(form.bio.trim() && {
        bio: form.bio.trim(),
      }),
      ...(form.photoUrl.trim() && {
        photoUrl: form.photoUrl.trim(),
      }),
    };

    try {
      await api.post(
        `/clinics/${clinicId}/doctors`,
        payload
      );

      await loadData();

      setForm(initialForm);
      setShowDoctorForm(false);
      setSuccess("Doctor added successfully.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const activeDoctors = doctors.filter(
    (doctor) => doctor.isActive
  );

  function handleContinue() {
    if (activeDoctors.length === 0) {
      setError(
        "Add at least one active doctor to continue."
      );
      return;
    }

    navigate(
      `/clinics/${clinicId}/services/setup`
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center gap-2 text-slate-600">
        <LoaderCircle
          size={20}
          className="animate-spin"
        />
        Loading doctors...
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          to={`/clinics/${clinicId}/setup`}
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-600"
        >
          <ArrowLeft size={17} />
          Clinic Details
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-7">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="rounded-xl bg-blue-50 p-3 text-blue-600">
                <Stethoscope size={24} />
              </span>

              <span className="text-xs font-semibold text-blue-600">
                STEP 2 OF 6
              </span>
            </div>

            <div className="mb-5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-2/6 rounded-full bg-blue-600" />
            </div>

            <h1 className="text-2xl font-bold text-slate-900">
              Add Doctors
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              {clinic?.name || "Your clinic"} — manage the
              doctors who provide consultations.
            </p>
          </div>

          {success && (
            <p
              role="status"
              className="mb-5 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"
            >
              <CheckCircle2 size={18} />
              {success}
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">
                Your Doctors
              </h2>

              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {activeDoctors.length} Active
              </span>
            </div>

            {doctors.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-7 text-center">
                <UserRound
                  size={32}
                  className="mx-auto text-slate-400"
                />

                <p className="mt-3 font-medium text-slate-700">
                  No doctors added yet
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Add your first doctor to continue
                  setting up your clinic.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {doctors.map((doctor) => (
                  <article
                    key={doctor._id || doctor.id}
                    className="flex min-w-0 gap-4 rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-blue-600">
                      {doctor.photoUrl ? (
                        <img
                          src={doctor.photoUrl}
                          alt={doctor.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <UserRound size={25} />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h3 className="break-words font-semibold text-slate-900">
                        {doctor.name}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        {doctor.specialization ||
                          "Specialization not set"}
                      </p>

                      {doctor.qualifications?.length > 0 && (
                        <p className="mt-1 text-xs text-slate-500">
                          {doctor.qualifications.join(", ")}
                        </p>
                      )}

                      {Number.isFinite(
                        doctor.experienceYears
                      ) && (
                        <p className="mt-1 text-xs text-slate-500">
                          {doctor.experienceYears} years
                          of experience
                        </p>
                      )}

                      <span
                        className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-medium ${
                          doctor.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {doctor.isActive
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {clinic?.status === "draft" && (
            <section className="mt-7 border-t border-slate-100 pt-6">
              {!showDoctorForm ? (
                <button
                  type="button"
                  onClick={openDoctorForm}
                  className="flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50 p-5 text-blue-700 transition hover:border-blue-500 hover:bg-blue-100"
                >
                  <Plus size={24} />
                  <span className="font-semibold">
                    {doctors.length === 0
                      ? "Add Your First Doctor"
                      : "Add Another Doctor"}
                  </span>
                </button>
              ) : (
                <>
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">
                      Add a Doctor
                    </h2>

                    <button
                      type="button"
                      onClick={closeDoctorForm}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    >
                      <X size={17} />
                      Cancel
                    </button>
                  </div>

                  <form
                    onSubmit={handleAddDoctor}
                    className="grid gap-4 sm:grid-cols-2"
                  >
                    <label className="text-sm font-medium text-slate-700">
                      Doctor Name *

                      <input
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Dr. Rahul Sharma"
                        required
                        minLength={2}
                        maxLength={120}
                        className={inputClass}
                      />
                    </label>

                    <label className="text-sm font-medium text-slate-700">
                      Specialization

                      <input
                        name="specialization"
                        value={form.specialization}
                        onChange={handleChange}
                        placeholder="General Physician"
                        maxLength={250}
                        className={inputClass}
                      />
                    </label>

                    <label className="text-sm font-medium text-slate-700">
                      Qualifications

                      <input
                        name="qualifications"
                        value={form.qualifications}
                        onChange={handleChange}
                        placeholder="MBBS, MD"
                        className={inputClass}
                      />

                      <span className="mt-1 block text-xs font-normal text-slate-500">
                        Separate qualifications with commas.
                      </span>
                    </label>

                    <label className="text-sm font-medium text-slate-700">
                      Years of Experience

                      <input
                        name="experienceYears"
                        type="number"
                        min={0}
                        max={70}
                        step={1}
                        value={form.experienceYears}
                        onChange={handleChange}
                        placeholder="5"
                        className={inputClass}
                      />
                    </label>

                    <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                      Photo URL

                      <input
                        name="photoUrl"
                        type="url"
                        value={form.photoUrl}
                        onChange={handleChange}
                        placeholder="https://example.com/doctor.jpg"
                        className={inputClass}
                      />
                    </label>

                    <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                      About the Doctor

                      <textarea
                        name="bio"
                        value={form.bio}
                        onChange={handleChange}
                        rows={3}
                        maxLength={10000}
                        placeholder="Brief professional introduction"
                        className={`${inputClass} resize-y`}
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={saving}
                      className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700 disabled:opacity-60 sm:col-span-2"
                    >
                      {saving ? (
                        <>
                          <LoaderCircle
                            size={18}
                            className="animate-spin"
                          />
                          Adding Doctor...
                        </>
                      ) : (
                        <>
                          <Plus size={18} />
                          Add Doctor
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}
            </section>
          )}

          <div className="mt-7 border-t border-slate-100 pt-6">
            {activeDoctors.length > 0 && (
              <p className="mb-4 flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 size={18} />
                Doctor requirement completed.
              </p>
            )}

            {clinic?.status === "draft" ? (
              <button
                type="button"
                onClick={handleContinue}
                disabled={
                  activeDoctors.length === 0 ||
                  saving
                }
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue to Services & Availability
                <ArrowRight size={18} />
              </button>
            ) : (
              <Link
                to={`/dashboard/clinic/${clinicId}`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600"
              >
                Return to Dashboard
                <ArrowRight size={17} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
