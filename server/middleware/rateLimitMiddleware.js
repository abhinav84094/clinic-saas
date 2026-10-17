import { rateLimit, ipKeyGenerator } from "express-rate-limit";

export const rateLimitPolicies = Object.freeze({
  googleLogin: { windowMs: 15 * 60 * 1000, limit: 10 },
  googleSignup: { windowMs: 60 * 60 * 1000, limit: 5 },
  passwordLogin: { windowMs: 15 * 60 * 1000, limit: 10 },
  slugAvailability: { windowMs: 60 * 1000, limit: 30 },
  publicClinic: { windowMs: 60 * 1000, limit: 120 },
  publicServices: { windowMs: 60 * 1000, limit: 120 },
  publicAvailability: { windowMs: 60 * 1000, limit: 30 },
});

// Until the Render proxy chain is verified, use only the TCP peer identity.
// Never use CF-Connecting-IP or a client-supplied forwarding header here.
export const configureProxyTrust = (app) => app.set("trust proxy", false);

export const createApiLimiter = (policy) => rateLimit({
  ...policy,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  // Group IPv6 addresses by /56 to prevent bypass by rotating host addresses.
  keyGenerator: (req) => ipKeyGenerator(req.ip, 56),
  // Forwarded headers are deliberately ignored with the conservative trust model.
  validate: { xForwardedForHeader: false, forwardedHeader: false },
  handler: (_req, res) => res.status(429).json({
    success: false,
    message: "Too many requests. Please try again later.",
  }),
});

// Each endpoint has its own MemoryStore; all successes and failures count.
export const apiLimiters = Object.fromEntries(
  Object.entries(rateLimitPolicies).map(([name, policy]) => [name, createApiLimiter(policy)])
);
