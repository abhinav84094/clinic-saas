
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { LoaderCircle } from "lucide-react";

import api from "../services/api";
import ClinicTemplateRenderer from "../components/clinic/ClinicTemplateRenderer";
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

useEffect(() => {
  const clinic = data?.clinic;
  if (!clinic) return;

  const location = [
    clinic.address?.city,
    clinic.address?.state,
  ]
    .filter(Boolean)
    .join(", ");

  const title =
    clinic.seo?.title ||
    [clinic.name, location].filter(Boolean).join(" | ");

  const description =
    clinic.seo?.description ||
    clinic.description ||
    `${clinic.name}${location ? ` in ${location}` : ""} — clinic details, doctors and services.`;

  const image =
    clinic.branding?.logoUrl ||
    new URL("/prakash-logo.png", window.location.origin).href;

  document.title = title;

  const setMeta = (attribute, key, content) => {
    let tag = document.head.querySelector(
      `meta[${attribute}="${key}"]`
    );

    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute(attribute, key);
      document.head.appendChild(tag);
    }

    tag.setAttribute("content", content);
  };

  setMeta("name", "description", description);
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", description);
  setMeta("property", "og:type", "website");
  setMeta("property", "og:image", image);
  setMeta("property", "og:url", window.location.href.split(/[?#]/)[0]);
  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:title", title);
  setMeta("name", "twitter:description", description);
  setMeta("name", "twitter:image", image);

  let canonical = document.head.querySelector(
    'link[rel="canonical"]'
  );

  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }

  canonical.setAttribute(
    "href",
    new URL(window.location.pathname, window.location.origin).href
  );
}, [data]);


useEffect(() => {
  const clinic = data?.clinic;
  if (!clinic) return;

  const addressValues = {
    streetAddress: [
      clinic.address?.line1,
      clinic.address?.line2,
    ]
      .filter(Boolean)
      .join(", "),
    addressLocality: clinic.address?.city,
    addressRegion: clinic.address?.state,
    postalCode: clinic.address?.postalCode,
    addressCountry: clinic.address?.country,
  };

  const address = Object.fromEntries(
    Object.entries(addressValues).filter(([, value]) => value)
  );

  const pageUrl = new URL(
    window.location.pathname,
    window.location.origin
  ).href;

  const schema = {
    "@context": "https://schema.org",
    "@type": "MedicalClinic",
    "@id": `${pageUrl}#clinic`,
    name: clinic.name,
    url: pageUrl,
    ...(clinic.description
      ? { description: clinic.description }
      : {}),
    ...(clinic.contact?.phone
      ? { telephone: clinic.contact.phone }
      : {}),
    ...(clinic.contact?.email
      ? { email: clinic.contact.email }
      : {}),
    ...(clinic.branding?.logoUrl
      ? { image: clinic.branding.logoUrl }
      : {}),
    ...(Object.keys(address).length
      ? {
          address: {
            "@type": "PostalAddress",
            ...address,
          },
        }
      : {}),
  };

  let script = document.head.querySelector("#clinic-jsonld");

  if (!script) {
    script = document.createElement("script");
    script.id = "clinic-jsonld";
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(schema).replace(/</g, "\\u003c");

  return () => script.remove();
}, [data]);

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
      <main className="flex min-h-dvh items-center justify-center px-4 text-center text-slate-600 dark:text-slate-300">
        {error || "Clinic not found."}
      </main>
    );
  }

  return (
    <>
      <main>
        
        <ClinicTemplateRenderer
        templateId={data.clinic.website?.templateId || "A"}
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
