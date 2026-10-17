# API rate limiting

## Implemented policies

Each route has an independent built-in `express-rate-limit` MemoryStore. Counts
are per TCP peer IP, across clinic slugs and query strings, not per tenant.
IPv6 identities are grouped into /56 subnets to prevent host-address rotation.
Successful and unsuccessful requests both count; there are no authentication,
development, or localhost exemptions.

| Method and path | Requests | Window |
| --- | ---: | --- |
| POST /api/auth/google | 10 | 15 minutes |
| POST /api/auth/google/complete-signup | 5 | 1 hour |
| POST /api/auth/login | 10 | 15 minutes |
| GET /api/clinics/slug-availability | 30 | 1 minute |
| GET /api/public/clinics/:slug | 120 | 1 minute |
| GET /api/public/clinics/:slug/services | 120 | 1 minute |
| GET /api/public/clinics/:slug/availability | 30 | 1 minute |

Limited responses are HTTP 429 with:

```json
{"success":false,"message":"Too many requests. Please try again later."}
```

Draft-8 `RateLimit` and `RateLimit-Policy` headers describe the budget; 429 also
includes `Retry-After` in seconds. Legacy X-RateLimit headers are disabled.
Existing CORS behavior is unchanged; reading these headers in cross-origin
JavaScript would require a separately reviewed exposed-headers change.

## Proxy prerequisite: verify before production rollout

The original server did not set `trust proxy` (Express defaults to false). The
implementation explicitly keeps it false. Forwarded, X-Forwarded-For,
X-Real-IP and CF-Connecting-IP cannot select a limiter identity. The two
forwarded-header validation warnings are disabled because ignoring those
headers is intentional; other library validations remain enabled.

**This fallback is spoof-resistant but is not verified visitor-level limiting
on Render.** The TCP peer can be a Render proxy. Visitors sharing that peer
share a budget, and traffic through different proxies may use different
buckets. Do not describe this deployment as accurate per-visitor limiting
until its topology is verified. The local repository provides no trusted
proxy ranges, ingress restrictions, header sanitization guarantees, or Worker
source needed to establish a safe production chain. No guessed hop count or
proxy allowlist is supplied.

Before rollout, manually verify in an isolated Render staging service:

1. Establish the socket peer addresses and the forwarding chain for both
   `clinic-api.prakashsaas.com` and the direct `*.onrender.com` origin. Test IPv4
   and IPv6, normal browser calls and clinic Worker requests. Use temporary
   access-controlled diagnostics; never expose a public header echo endpoint,
   log credentials/cookies, or retain visitor IP diagnostics unnecessarily.
2. Obtain Render's guarantee for which forwarding headers its ingress rewrites
   or appends, and the actual proxy addresses/ranges reaching the application.
   Confirm Cloudflare's overwriting behavior and relevant Worker subrequest
   behavior. Cloudflare's public IP ranges alone do not identify the Render
   proxy directly connected to Node.
3. Send forged X-Forwarded-For (including multiple entries), Forwarded,
   CF-Connecting-IP and X-Real-IP through every reachable ingress. Establish
   whether the direct Render origin bypasses Cloudflare, and what ingress
   restriction or authenticated origin mechanism is available if reliance on
   Cloudflare headers is proposed. No infrastructure changes are made here.
4. Only after those guarantees are established, review a separate change to
   `configureProxyTrust`: prefer specific verified proxy addresses/CIDRs and
   Express's right-to-left first-untrusted-address resolution. Trust only
   controlled proxies; avoid blanket private-network ranges. Do not use
   `trust proxy = true`, take the leftmost X-Forwarded-For value, or choose a
   hop count without proving every ingress has the same safe path length.
   Continue using the IPv6-safe key generator; do not read CF-Connecting-IP
   directly without an independently authenticated Cloudflare origin path.
5. Repeat spoofing and independent-visitor tests in staging. Verify two real
   visitors get independent budgets and that exhausting a budget prevents
   further controller/database calls. If the topology remains uncertain,
   retain the fallback and assess shared-proxy throttling before release.

References: [Express proxy trust](https://expressjs.com/en/guide/behind-proxies/),
[Render proxy/IP overview](https://render.com/articles/how-render-handles-ddos-attacks),
[Cloudflare headers and Worker exceptions](https://developers.cloudflare.com/fundamentals/reference/http-headers/),
[express-rate-limit](https://github.com/express-rate-limit/express-rate-limit).
These describe general behavior; they do not prove this account's ingress configuration.

## Ordering and compatibility

CORS remains first, including preflight handling. The Razorpay raw-body route
still runs before JSON parsing and has no limiter. JSON/cookie parsing remains
unchanged. The seven limiters run at route level before token verification,
password work, or database-backed controllers. No global limiter is added.
Dashboard routes and authenticated clinic management remain unchanged. Google
credentials are still verified on both login and signup, signup still hashes
the supplied password via the User save hook, and JWT cookies remain unchanged.

## Payment recommendations (not implemented)

The subscription router requires JWT authentication and owner access. Existing
order/recovery logic preserves uncertain provider responses, reuses valid
quotes, and handles duplicate processing. The frontend can reconcile after
verification failures and retrieve pending checkout state after refresh.

Candidate limits for a later measured rollout, keyed by authenticated user ID
and clinic ID **after** authentication and owner authorization:

| Route family | Initial candidate |
| --- | --- |
| payment-order, upgrade-order, renewal-order | Shared 10 requests/minute/user/clinic |
| subscription, pending-payment reads | 60 requests/minute/user/clinic |
| billing-cycle updates | 20 requests/minute/user/clinic |

Monitor normal retry bursts and concurrent tabs before enforcing these. Leave
verify-payment and reconcile-payment unrestricted initially: they are recovery
paths for already-paid users. Do not apply an IP-based blanket limiter to the
Razorpay webhook; retain signature verification, raw bytes and idempotent
processing so legitimate redeliveries remain possible.

## Operational limits and remaining gaps

- Memory counters reset on process restarts/deployments. Each process/Render
  instance has its own counters: multiple instances multiply the effective
  budget. This design is for one instance and one Node process. Reassess shared
  storage before scaling; Redis/Upstash is not introduced.
- IP limits can affect shared NAT users and can be bypassed by distributed
  clients. Rotating trusted TCP peers also changes buckets in the fallback.
  High-cardinality traffic consumes memory until expiration; this is not a
  replacement for edge protection or request-size controls.
- Registration, OTP verification/resend, password recovery and other endpoints
  are outside this change and warrant a separate abuse review. Rate limiting
  does not establish CSRF protection for cookie-authenticated mutations.
- `npm audit` reports three high-severity findings in the existing
  nodemon -> chokidar -> braces dependency chain. No unrelated dependency
  remediation or force downgrade is performed.
- The limiter adds no sensitive logging. Existing controller/error logging has
  not been redesigned and warrants its own sensitive-data review.

## Changed files and verification

- `middleware/rateLimitMiddleware.js`: policies, reusable factory, independent
  memory limiters, IPv6 grouping, JSON 429 handling and explicit proxy fallback.
- `server.js`: configure proxy trust before handling requests.
- `routes/authRoutes.js`: Google login, completion and password login limiters.
- `routes/clinicRoutes.js`: slug-availability limiter only.
- `routes/publicClinicRoutes.js`: separate profile, services and availability limits.
- `package.json`, `package-lock.json`: consistent express-rate-limit dependency.
- `tests/rateLimit.test.js`: real HTTP boundary/header tests, deterministic
  MemoryStore expiration, real TCP peer independence, forwarding-header spoofing,
  all seven real router bindings, Google verification/signup/hash/cookie behavior,
  public profile/services and successful availability calculation using mocked
  persistence/providers. Payment recovery remains outside generic limiting.
- `docs/rate-limiting.md`: deployment prerequisites, limitations and recommendations.

Run `cd server && npm test`. Tests use local HTTP and mocked provider/persistence
calls; no live Google credentials, MongoDB or Razorpay payments are needed.
No DNS, Cloudflare, frontend environment, deployment or production account
configuration is changed. Work is on `feat/api-rate-limiting`, without pushing.
