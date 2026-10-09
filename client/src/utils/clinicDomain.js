
const normalizeDomain = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "")
    .replace(/:\d+$/, "");

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "mail",
  "support",
  "static",
  "assets",
]);

export function getClinicSlugFromHostname(
  hostname = window.location.hostname
) {
  const baseDomain = normalizeDomain(
    import.meta.env.VITE_PUBLIC_BASE_DOMAIN
  );

  if (!baseDomain) return null;

  const host = normalizeDomain(hostname);

  if (!host.endsWith(`.${baseDomain}`)) {
    return null;
  }

  const subdomain = host.slice(
    0,
    -(`.${baseDomain}`.length)
  );

  // Only accept one subdomain label.
  // For example: prakash-consultancy.example.com
  if (
    !subdomain ||
    subdomain.includes(".") ||
    RESERVED_SUBDOMAINS.has(subdomain) ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(subdomain)
  ) {
    return null;
  }

  return subdomain;
}

export function getClinicPublicUrl(slug) {
  if (
    typeof slug !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
    RESERVED_SUBDOMAINS.has(slug)
  ) {
    return null;
  }

  const baseDomain = normalizeDomain(
    import.meta.env.VITE_PUBLIC_BASE_DOMAIN
  );

  // Local development: retain the existing /c/:slug route.
  if (!baseDomain) {
    return `${window.location.origin}/c/${slug}`;
  }

  return `https://${slug}.${baseDomain}`;
}
