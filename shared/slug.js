
const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "booking",
  "clinics",
  "dashboard",
  "help",
  "login",
  "logout",
  "register",
  "settings",
  "signup",
  "support",
  "www",
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const normalizeSlug = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
};

export const suggestSlug = (clinicName) => {
  if (typeof clinicName !== "string") {
    return "";
  }

  return clinicName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "");
};

export const validateSlug = (value) => {
  const slug = normalizeSlug(value);

  if (slug.length < 3 || slug.length > 63) {
    return {
      valid: false,
      slug,
      reason: "Slug must contain 3 to 63 characters",
    };
  }

  if (!SLUG_PATTERN.test(slug)) {
    return {
      valid: false,
      slug,
      reason:
        "Slug may contain only letters, numbers, and hyphens between words",
    };
  }

  if (RESERVED_SLUGS.has(slug)) {
    return {
      valid: false,
      slug,
      reason: "This URL is reserved",
    };
  }

  return {
    valid: true,
    slug,
    reason: null,
  };
};
