
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  LoaderCircle,
  Pencil,
  Plus,
  UserRound,
  X,
} from "lucide-react";

import api from "../services/api";

const emptyForm = {
  name: "",
  specialization: "",
  qualifications: "",
  experienceYears: "",
  bio: "",
};

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500";

const idOf = (doctor) => doctor?._id || doctor?.id;

function getError(error) {
  const issues = error.response?.data?.errors;

  if (Array.isArray(issues) && issues.length) {
    return issues.map((issue) => issue.message).join("; ");
  }

  return error.response?.data?.message ||
    "Something went wrong. Please try again.";
}

export default function AddDoctorsPage() {
  const { clinicId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [clinic, setClinic] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [existingPhoto, setExistingPhoto] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyDoctorId, setBusyDoctorId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    const [clinicResponse, doctorsResponse] =
      await Promise.all([
        api.get(`/clinics/${clinicId}`),
        api.get(
          `/clinics/${clinicId}/doctors?includeInactive=true`
        ),
      ]);

    setClinic(clinicResponse.data.clinic);
    setDoctors(doctorsResponse.data.doctors || []);
  }, [clinicId]);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        setLoading(true);
        await load();
      } catch (err) {
        if (active) setError(getError(err));
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [load]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview("");
      return;
    }

    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setPhotoFile(null);
    setExistingPhoto("");
    setShowForm(false);
  }

  function openAdd() {
    resetForm();
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEdit(doctor) {
    setEditingId(idOf(doctor));
    setForm({
      name: doctor.name || "",
      specialization: doctor.specialization || "",
      qualifications:
        (doctor.qualifications || []).join(", "),
      experienceYears:
        doctor.experienceYears ?? "",
      bio: doctor.bio || "",
    });
    setPhotoFile(null);
    setExistingPhoto(doctor.photoUrl || "");
    setError("");
    setSuccess("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectPhoto(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(
        file.type
      )
    ) {
      setError("Choose a JPG, PNG or WebP image.");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setError("Image must be smaller than 3 MB.");
      return;
    }

    setError("");
    setPhotoFile(file);
    event.target.value = "";
  }

  

  async function uploadPhoto(doctorId) {
    if (!photoFile) return;

    const body = new FormData();
    body.append("photo", photoFile);

    const formData = new FormData();
    formData.append("photo", photoFile, photoFile.name);

    await api.post(
    `/clinics/${clinicId}/doctors/${doctorId}/photo`,
    formData,
    {
        headers: {
        "Content-Type": undefined,
        },
    }
    );
  }

  async function handleSave(event) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      name: form.name.trim(),
      specialization: form.specialization.trim(),
      qualifications: form.qualifications
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      bio: form.bio.trim(),
      ...(form.experienceYears !== "" && {
        experienceYears: Number(form.experienceYears),
      }),
    };

    let savedDoctorId = editingId;

    try {
      if (editingId) {
        await api.patch(
          `/clinics/${clinicId}/doctors/${editingId}`,
          payload
        );
      } else {
        const response = await api.post(
          `/clinics/${clinicId}/doctors`,
          payload
        );

        savedDoctorId = idOf(response.data.doctor);
      }

      if (photoFile) {
        try {
          await uploadPhoto(savedDoctorId);
        } catch (photoError) {
          await load();
          setEditingId(savedDoctorId);
          setError(
            "Doctor details saved, but photo upload failed: " +
              getError(photoError)
          );
          return;
        }
      }

      await load();
      resetForm();
      setSuccess("Doctor profile saved successfully.");
    } catch (err) {
      setError(getError(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(doctor) {
    const doctorId = idOf(doctor);

    setBusyDoctorId(doctorId);
    setError("");
    setSuccess("");

    try {
      await api.patch(
        `/clinics/${clinicId}/doctors/${doctorId}/status`,
        { isActive: !doctor.isActive }
      );

      await load();

      setSuccess(
        doctor.isActive
          ? "Doctor deactivated."
          : "Doctor activated."
      );
    } catch (err) {
      setError(getError(err));
    } finally {
      setBusyDoctorId("");
    }
  }

  const activeCount = doctors.filter(
    (doctor) => doctor.isActive
  ).length;

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center gap-2">
        <LoaderCircle className="animate-spin" size={20} />
        Loading doctors...
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link
          to={
            clinic?.status === "draft"
              ? `/clinics/${clinicId}/setup`
              : `/dashboard/clinic/${clinicId}`
          }
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600"
        >
          <ArrowLeft size={17} />
          {clinic?.status === "draft"
            ? "Back to Clinic Setup"
            : "Back to Dashboard"}
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Manage Doctors
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {clinic?.name} · {activeCount} active doctors
            </p>
          </div>

          {!showForm && (
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white"
            >
              <Plus size={18} />
              Add Doctor
            </button>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {success && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-xl bg-green-50 p-4 text-sm text-green-700"
          >
            <CheckCircle2 size={18} />
            {success}
          </p>
        )}

        {showForm && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {editingId ? "Edit Doctor" : "Add Doctor"}
              </h2>

              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                aria-label="Close form"
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div className="flex flex-wrap items-center gap-5 rounded-xl bg-slate-50 p-4">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-white">
                  {photoPreview || existingPhoto ? (
                    <img
                      src={photoPreview || existingPhoto}
                      alt="Doctor preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserRound
                      size={38}
                      className="text-slate-400"
                    />
                  )}
                </div>

                <div>
                  <p className="font-semibold">
                    Doctor Profile Photo
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    JPG, PNG or WebP · Maximum 3 MB
                  </p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={selectPhoto}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"
                  >
                    <Camera size={17} />
                    {photoPreview || existingPhoto
                      ? "Change Photo"
                      : "Choose Photo"}
                  </button>

                  {photoFile && (
                    <button
                      type="button"
                      onClick={() => setPhotoFile(null)}
                      className="ml-3 text-sm text-red-600"
                    >
                      Cancel selection
                    </button>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  Doctor Name *
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={form.name}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        name: event.target.value,
                      })
                    }
                    placeholder="Dr. Rahul Sharma"
                    className={inputClass}
                  />
                </label>

                <label className="text-sm font-semibold">
                  Specialization
                  <input
                    maxLength={250}
                    value={form.specialization}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        specialization: event.target.value,
                      })
                    }
                    placeholder="Cardiologist"
                    className={inputClass}
                  />
                </label>

                <label className="text-sm font-semibold">
                  Qualifications
                  <input
                    value={form.qualifications}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        qualifications: event.target.value,
                      })
                    }
                    placeholder="MBBS, MD"
                    className={inputClass}
                  />
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    Separate qualifications with commas.
                  </span>
                </label>

                <label className="text-sm font-semibold">
                  Years of Experience
                  <input
                    type="number"
                    min={0}
                    max={70}
                    step={1}
                    value={form.experienceYears}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        experienceYears: event.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </label>

                <label className="text-sm font-semibold sm:col-span-2">
                  About Doctor
                  <textarea
                    rows={4}
                    maxLength={10000}
                    value={form.bio}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        bio: event.target.value,
                      })
                    }
                    placeholder="Professional introduction"
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={resetForm}
                  className="rounded-xl border border-slate-200 px-5 py-3 font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white disabled:opacity-50"
                >
                  {saving && (
                    <LoaderCircle
                      size={18}
                      className="animate-spin"
                    />
                  )}
                  {saving ? "Saving..." : "Save Doctor"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {doctors.map((doctor) => (
            <article
              key={idOf(doctor)}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50">
                  {doctor.photoUrl ? (
                    <img
                      src={doctor.photoUrl}
                      alt={doctor.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserRound
                      size={28}
                      className="text-blue-500"
                    />
                  )}
                </div>

                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900">
                    {doctor.name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {doctor.specialization || "Doctor"}
                  </p>
                  <span
                    className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                      doctor.isActive
                        ? "bg-green-50 text-green-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {doctor.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              {doctor.qualifications?.length > 0 && (
                <p className="mt-4 text-sm text-slate-500">
                  {doctor.qualifications.join(", ")}
                </p>
              )}

              <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => openEdit(doctor)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700"
                >
                  <Pencil size={15} />
                  Edit
                </button>

                <button
                  type="button"
                  disabled={busyDoctorId === idOf(doctor)}
                  onClick={() => toggleStatus(doctor)}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {busyDoctorId === idOf(doctor)
                    ? "Updating..."
                    : doctor.isActive
                      ? "Deactivate"
                      : "Activate"}
                </button>
              </div>
            </article>
          ))}

          {!doctors.length && (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 sm:col-span-2">
              No doctors yet. Add your first doctor.
            </div>
          )}
        </section>

        {clinic?.status === "draft" && (
          <button
            type="button"
            disabled={!activeCount}
            onClick={() =>
              navigate(
                `/clinics/${clinicId}/services/setup`
              )
            }
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            Continue to Services & Availability
            <ArrowRight size={18} />
          </button>
        )}

        {clinic?.status !== "draft" && (
          <Link
            to={`/dashboard/clinic/${clinicId}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600"
          >
            <ArrowLeft size={17} />
            Return to Dashboard
          </Link>
        )}
      </div>
    </main>
  );
}
