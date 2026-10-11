import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSlug, suggestSlug, validateSlug } from "../../shared/slug.js";
import * as backend from "../utils/slug.js";
import { createClinicSchema, updateClinicSchema } from "../validators/clinicValidator.js";

test("frontend and backend share the same slug functions", () => {
  assert.equal(backend.suggestSlug, suggestSlug);
  assert.equal(backend.validateSlug, validateSlug);
  assert.equal(backend.normalizeSlug, normalizeSlug);
});

test("clinic name suggestions follow existing normalization and length rules", () => {
  assert.equal(suggestSlug("City Care Clinic"), "city-care-clinic");
  assert.equal(suggestSlug("City Care Dental Clinic"), "city-care-dental-clinic");
  assert.equal(suggestSlug("  Caf\u00e9 & Care!  "), "cafe-care");
  assert.equal(suggestSlug("!!!"), "");
  assert.equal(suggestSlug("a".repeat(62) + " & Care"), "a".repeat(62));
  assert.equal(suggestSlug("a".repeat(100)).length, 63);
});

test("slug validation retains reserved names, format and length restrictions", () => {
  for (const value of ["", "ab", "a".repeat(64), "admin", "login", "support", "care--clinic", "-care", "care_Clinic"]) {
    assert.equal(validateSlug(value).valid, false, value);
  }
  assert.deepEqual(validateSlug(" City-Care-Clinic "), { valid: true, slug: "city-care-clinic", reason: null });
});

test("creation payload still validates and profile edits cannot change saved slugs", () => {
  const result = createClinicSchema.safeParse({
    name: "City Care Clinic", slug: suggestSlug("City Care Clinic"), billingCycle: "monthly",
    contact: { phone: "9876543210" }, address: { city: "Delhi", state: "Delhi" },
  });
  assert.equal(result.success, true);
  assert.equal(result.data.slug, "city-care-clinic");
  assert.equal(result.data.timezone, "Asia/Kolkata");
  assert.equal(updateClinicSchema.safeParse({ name: "New Clinic Name" }).success, true);
  assert.equal(updateClinicSchema.safeParse({ name: "New Clinic Name", slug: "new-slug" }).success, false);
});
