
import { useEffect, useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import { LoaderCircle } from "lucide-react";

import api from "../../services/api";
import DashboardLayout from "./DashboardLayout";

export default function ClinicDashboardShell() {
  const { clinicId } = useParams();

  const [clinic, setClinic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadClinic() {
      setLoading(true);
      setError("");

      try {
        const response = await api.get(
          `/clinics/${clinicId}`
        );

        if (active) {
          setClinic(response.data.clinic);
        }
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.message ||
              "Unable to load clinic."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadClinic();

    return () => {
      active = false;
    };
  }, [clinicId]);

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center gap-3">
        <LoaderCircle
          size={20}
          className="animate-spin"
        />
        Loading clinic workspace...
      </main>
    );
  }

  if (error || !clinic) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <p role="alert" className="text-red-600">
          {error || "Clinic not found."}
        </p>
      </main>
    );
  }

  return (
    <DashboardLayout clinicId={clinicId} clinic={clinic}>
      <Outlet context={{ clinic }} />
    </DashboardLayout>
  );
}
