
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { LoaderCircle } from "lucide-react";

import api from "../services/api";
import ClinicWebsiteTemplate from "../components/clinic/ClinicWebsiteTemplate";
import DoctorAvailabilityModal from "../components/clinic/DoctorAvailabilityModal";
import { getClinicSlugFromHostname } from "../utils/clinicDomain";

export default function PublicClinicPage() {
  const { slug: routeSlug } = useParams();

  const slug = getClinicSlugFromHostname() || routeSlug;

  const [data, setData] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const closeModal = useCallback(() => {
    setSelectedDoctor(null);
  }, []);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError("");
      setData(null);
      setServices([]);
      setSelectedDoctor(null);

      if (!slug) {
        setError("Invalid clinic website URL.");
        setLoading(false);
        return;
      }

      try {
        const [profile, catalog] = await Promise.all([
          api.get(
            `/public/clinics/${encodeURIComponent(slug)}`
          ),
          api.get(
            `/public/clinics/${encodeURIComponent(slug)}/services`
          ),
        ]);

        if (!alive) return;

        setData(profile.data.data);
        setServices(catalog.data.services || []);
      } catch (err) {
        if (alive) {
          setError(
            err.response?.status === 404
              ? "Clinic not found or not published yet."
              : "Unable to load this clinic."
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
  }, [slug]);

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center gap-2">
        <LoaderCircle
          size={20}
          className="animate-spin"
        />
        Loading clinic...
      </main>
    );
  }

  if (error || !data?.clinic) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4 text-center text-slate-600">
        {error || "Clinic not found."}
      </main>
    );
  }

  return (
    <>
      <main>
        <ClinicWebsiteTemplate
          clinic={data.clinic}
          doctors={data.doctors || []}
          services={services}
          onSelectDoctor={setSelectedDoctor}
        />
      </main>

      <DoctorAvailabilityModal
        open={Boolean(selectedDoctor)}
        onClose={closeModal}
        doctor={selectedDoctor}
        clinic={data.clinic}
        services={services}
        slug={slug}
      />
    </>
  );
}
