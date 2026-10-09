
import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  Monitor,
  Smartphone,
} from "lucide-react";

import api from "../services/api";

import ClinicWebsiteTemplate from "../components/clinic/ClinicWebsiteTemplate";

const idOf = (value) =>
  String(value?._id || value?.id || value || "");

export default function WebsiteSetupPage() {
  const { clinicId } = useParams();
  const navigate = useNavigate();

  const base = `/clinics/${clinicId}`;

  const [clinic, setClinic] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [offerings, setOfferings] = useState([]);

  const [device, setDevice] = useState("desktop");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const [clinicResponse, doctorsResponse,
          servicesResponse, offeringsResponse] =
          await Promise.all([
            api.get(base),
            api.get(
              `${base}/doctors?includeInactive=true`
            ),
            api.get(
              `${base}/services?includeInactive=true`
            ),
            api.get(
              `${base}/doctor-services?includeInactive=true`
            ),
          ]);

        if (!alive) return;

        setClinic(clinicResponse.data.clinic);
        setDoctors(doctorsResponse.data.doctors || []);
        setServices(servicesResponse.data.services || []);
        setOfferings(offeringsResponse.data.offerings || []);
      } catch (err) {
        if (alive) {
          setError(
            err.response?.data?.message ||
              "Unable to load clinic preview."
          );
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [base]);

  const visibleServices = services
    .filter((service) => service.isActive !== false)
    .map((service) => ({
      ...service,

      doctors: offerings
        .filter(
          (offering) =>
            offering.isActive !== false &&
            idOf(offering.serviceId) === idOf(service) &&
            doctors.some(
              (doctor) =>
                doctor.isActive !== false &&
                idOf(doctor) ===
                  idOf(offering.doctorId)
            )
        )
        .map((offering) => ({
          offeringId: idOf(offering),
          doctorId: idOf(offering.doctorId),

          name:
            doctors.find(
              (doctor) =>
                idOf(doctor) ===
                idOf(offering.doctorId)
            )?.name || "Doctor",

          fee: offering.fee,
          durationMinutes: offering.durationMinutes,
        })),
    }))
    .filter((service) => service.doctors.length > 0);

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center gap-2">
        <LoaderCircle
          className="animate-spin"
          size={20}
        />
        Loading website preview...
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-slate-100 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link
          to={`/clinics/${clinicId}/services/setup`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600"
        >
          <ArrowLeft size={17} />
          Back to Services & Availability
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Step 4 of 6
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              Your Clinic Website
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              This is your default website template.
              You can edit its branding after publishing.
            </p>
          </div>

          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
            <button
              type="button"
              aria-pressed={device === "desktop"}
              onClick={() => setDevice("desktop")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                device === "desktop"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600"
              }`}
            >
              <Monitor size={16} />
              Desktop
            </button>

            <button
              type="button"
              aria-pressed={device === "mobile"}
              onClick={() => setDevice("mobile")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                device === "mobile"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600"
              }`}
            >
              <Smartphone size={16} />
              Mobile
            </button>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {clinic && (
          <div className="overflow-auto rounded-2xl border border-slate-200 bg-slate-200 p-2 shadow-sm sm:p-5">
            <div
              className={`mx-auto overflow-hidden rounded-xl bg-white shadow-lg transition-all ${
                device === "mobile"
                  ? "max-w-[390px]"
                  : "max-w-full"
              }`}
            >
              <ClinicWebsiteTemplate
                clinic={clinic}
                doctors={doctors}
                services={visibleServices}
                preview
              />
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">
            Your clinic's information is already saved
            from previous steps. No additional website
            settings are needed.
          </p>

          <button
            type="button"
            disabled={
              !clinic || clinic.status !== "draft"
            }
            onClick={() =>
              navigate(
                `/clinics/${clinicId}/subscription/setup`
              )
            }
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue to Subscription
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </main>
  );
}
