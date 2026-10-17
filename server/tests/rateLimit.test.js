import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { ipKeyGenerator } from "express-rate-limit";
import { OAuth2Client } from "google-auth-library";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Clinic from "../models/Clinic.js";
import Doctor from "../models/Doctor.js";
import DoctorService from "../models/DoctorService.js";
import Service from "../models/Service.js";
import Schedule from "../models/Schedule.js";
import ScheduleException from "../models/ScheduleException.js";
import Appointment from "../models/Appointment.js";
import BookingHold from "../models/BookingHold.js";
import { configureProxyTrust, createApiLimiter, rateLimitPolicies } from "../middleware/rateLimitMiddleware.js";

// Import real routers without live provider credentials or a MongoDB connection.
process.env.RESEND_API_KEY = "re_unit_test";
process.env.JWT_SECRET = "rate-limit-test-secret";
const { default: authRoutes } = await import("../routes/authRoutes.js");
const { default: publicRoutes } = await import("../routes/publicClinicRoutes.js");
const { default: clinicRoutes } = await import("../routes/clinicRoutes.js");

async function serve(t, app) {
  configureProxyTrust(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  return (path = "/", { method = "GET", body, headers = {}, ip = "127.0.0.1" } = {}) => new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: server.address().port, path, method,
      localAddress: ip, agent: false, headers: { "content-type": "application/json", ...headers } }, res => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) }));
    });
    req.on("error", reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

for (const [name, policy] of Object.entries(rateLimitPolicies)) {
  test(`${name}: configured window and limit, 429 JSON and standard headers`, async t => {
    const app = express();
    app.get("/", createApiLimiter(policy), (_req, res) => res.json({ success: true }));
    const request = await serve(t, app);
    for (let i = 0; i < policy.limit; i++) {
      const response = await request();
      assert.equal(response.status, 200);
      assert.ok(response.headers.ratelimit);
      assert.ok(response.headers["ratelimit-policy"].includes(`w=${policy.windowMs / 1000}`));
      assert.equal(response.headers["x-ratelimit-limit"], undefined);
    }
    const blocked = await request();
    assert.equal(blocked.status, 429);
    assert.deepEqual(blocked.body, { success: false, message: "Too many requests. Please try again later." });
    assert.ok(Number(blocked.headers["retry-after"]) > 0);
    assert.ok(Number(blocked.headers["retry-after"]) <= policy.windowMs / 1000);
  });
}

test("windows reset using the built-in MemoryStore", async t => {
  t.mock.timers.enable({ apis: ["Date"], now: 1000000 });
  const app = express();
  app.get("/", createApiLimiter({ limit: 1, windowMs: 60000 }), (_req, res) => res.json({ success: true }));
  const request = await serve(t, app);
  assert.equal((await request()).status, 200);
  assert.equal((await request()).status, 429);
  t.mock.timers.tick(60001);
  assert.equal((await request()).status, 200);
});

test("independent TCP peers are independent; spoofed headers do not change identity", async t => {
  const app = express();
  app.get("/", createApiLimiter({ limit: 1, windowMs: 60000 }), (req, res) => res.json({ ip: req.ip }));
  const request = await serve(t, app);
  assert.deepEqual((await request()).body, { ip: "127.0.0.1" });
  for (const ip of ["198.51.100.1", "198.51.100.2"]) {
    assert.equal((await request("/", { headers: { "x-forwarded-for": ip, "cf-connecting-ip": ip,
      "x-real-ip": ip, forwarded: `for=${ip}` } })).status, 429);
  }
  const independent = await request("/", { ip: "127.0.0.2" });
  assert.equal(independent.status, 200);
  assert.equal(independent.body.ip, "127.0.0.2");
  assert.equal(ipKeyGenerator("2001:db8:abcd:1200::1", 56), ipKeyGenerator("2001:db8:abcd:12ff::2", 56));
});

test("real Google routes preserve verification, password setup, hashing and session cookies", async t => {
  const payload = { sub: "google-unit", email: "unit@gmail.com", email_verified: true, name: "Unit Owner" };
  const verify = t.mock.method(OAuth2Client.prototype, "verifyIdToken", async ({ idToken }) => {
    assert.equal(idToken, "test-credential");
    return { getPayload: () => payload };
  });
  t.mock.method(User, "findOne", async () => null);
  let saved;
  t.mock.method(User.collection, "insertOne", async document => {
    saved = document;
    return { acknowledged: true, insertedId: document._id };
  });
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  const request = await serve(t, app);
  const login = await request("/api/auth/google", { method: "POST", body: { credential: "test-credential" } });
  assert.equal(login.status, 200);
  assert.equal(login.body.requiresPassword, true);
  assert.equal(login.headers["set-cookie"], undefined);
  assert.equal(saved, undefined);
  const signup = await request("/api/auth/google/complete-signup", { method: "POST", body: {
    credential: "test-credential", password: "password-unit", confirmPassword: "password-unit",
  } });
  assert.equal(signup.status, 200);
  assert.equal(signup.body.requiresPassword, false);
  assert.equal(verify.mock.callCount(), 2);
  assert.equal(saved.googleId, payload.sub);
  assert.equal(saved.emailVerified, true);
  assert.notEqual(saved.password, "password-unit");
  assert.equal(await bcrypt.compare("password-unit", saved.password), true);
  assert.ok(signup.headers["set-cookie"][0].includes("accessToken="));
  assert.ok(signup.headers["set-cookie"][0].includes("HttpOnly"));
  // Existing Google user still gets an authenticated session.
  t.mock.method(User, "findOne", async () => saved);
  const existing = await request("/api/auth/google", { method: "POST", body: { credential: "test-credential" } });
  assert.equal(existing.status, 200);
  assert.equal(existing.body.requiresPassword, false);
  assert.ok(existing.headers["set-cookie"]);
  // Invalid credentials still fail through the original controller.
  t.mock.method(console, "error", () => {});
  assert.equal((await request("/api/auth/google", { method: "POST", body: {} })).status, 401);
});

const query = value => ({ select() { return this; }, sort() { return this; }, populate() { return this; }, lean: async () => value });

test("availability still calculates appointment slots through the real service", async t => {
  t.mock.method(Clinic, "findOne", () => query({ _id: "clinic-unit", timezone: "Asia/Kolkata" }));
  t.mock.method(DoctorService, "findOne", () => query({ doctorId: "doctor-unit", serviceId: "service-unit", fee: 500, durationMinutes: 30 }));
  t.mock.method(Doctor, "findOne", () => query({ _id: "doctor-unit", name: "Unit Doctor" }));
  t.mock.method(Service, "findOne", () => query({ _id: "service-unit", name: "Consultation" }));
  t.mock.method(Schedule, "find", () => query([{ startTime: "09:00", endTime: "10:00" }]));
  for (const model of [ScheduleException, Appointment, BookingHold]) t.mock.method(model, "find", () => query([]));
  const app = express();
  app.use("/api/public/clinics", publicRoutes);
  const request = await serve(t, app);
  const result = await request("/api/public/clinics/unit-clinic/availability?doctorServiceId=507f1f77bcf86cd799439011&date=2099-01-01", { ip: "127.0.0.4" });
  assert.equal(result.status, 200);
  assert.equal(result.body.doctor.name, "Unit Doctor");
  assert.equal(result.body.service.fee, 500);
  assert.ok(result.body.slots.length > 0);
  assert.equal(result.body.slots[0].startTime, "09:00");
  assert.equal(result.body.slots[0].endTime, "09:30");
});

test("real public routes preserve profile/services responses and availability validation", async t => {
  t.mock.method(Clinic, "findOne", () => query({ _id: "clinic-unit", name: "Unit Clinic", slug: "unit-clinic" }));
  t.mock.method(Doctor, "find", () => query([]));
  t.mock.method(DoctorService, "find", () => query([]));
  const app = express();
  app.use("/api/public/clinics", publicRoutes);
  const request = await serve(t, app);
  const profile = await request("/api/public/clinics/unit-clinic");
  assert.equal(profile.status, 200);
  assert.equal(profile.body.data.clinic.name, "Unit Clinic");
  assert.deepEqual(profile.body.data.doctors, []);
  const services = await request("/api/public/clinics/unit-clinic/services");
  assert.equal(services.status, 200);
  assert.deepEqual(services.body.services, []);
  assert.equal((await request("/api/public/clinics/unit-clinic/availability")).status, 400);
  // Count across slugs and queries; URL changes must not bypass the limit.
  for (let i = 1; i < 30; i++) assert.equal((await request(`/api/public/clinics/other-${i}/availability?date=${i}`)).status, 400);
  assert.equal((await request("/api/public/clinics/unit-clinic/availability")).status, 429);
  assert.equal((await request("/api/public/clinics/unit-clinic/services")).status, 200);
});

test("all seven real routes enforce their policies before controller work", async t => {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/clinics", clinicRoutes);
  app.use("/api/public/clinics", publicRoutes);
  const request = await serve(t, app);
  const endpoints = [
    ["POST", "/api/auth/google", "googleLogin"],
    ["POST", "/api/auth/google/complete-signup", "googleSignup"],
    ["POST", "/api/auth/login", "passwordLogin"],
    ["GET", "/api/clinics/slug-availability", "slugAvailability"],
    ["GET", "/api/public/clinics/unit-clinic", "publicClinic"],
    ["GET", "/api/public/clinics/unit-clinic/services", "publicServices"],
    ["GET", "/api/public/clinics/unit-clinic/availability", "publicAvailability"],
  ];
  t.mock.method(console, "error", () => {});
  t.mock.method(User, "findOne", async () => null);
  t.mock.method(Clinic, "findOne", () => query(null));
  for (const [method, path, name] of endpoints) {
    // A new actual TCP peer avoids state left by other router integration tests.
    const options = { method, body: method === "POST" ? {} : undefined, ip: "127.0.0.3" };
    for (let i = 0; i < rateLimitPolicies[name].limit; i++) assert.notEqual((await request(path, options)).status, 429, path);
    assert.equal((await request(path, options)).status, 429, path);
  }
  // Payment recovery retains authentication and is not given a generic limiter.
  const recovery = await request("/api/clinics/clinic-unit/subscription/reconcile-payment", { method: "POST", body: {} });
  assert.equal(recovery.status, 401);
  assert.equal(recovery.headers.ratelimit, undefined);
});
