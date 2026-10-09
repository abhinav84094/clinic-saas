
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { LoaderCircle } from "lucide-react";

import api from "../services/api";

import ClinicWebsiteTemplate from "../components/clinic/ClinicWebsiteTemplate";

export default function PublicClinicPage() {
  const { slug } = useParams();

  const [data, setData] = useState(null);
  const [services, setServices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
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
    <ClinicWebsiteTemplate
      clinic={data.clinic}
      doctors={data.doctors || []}
      services={services}
    />
  );
}
