import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { setImmediate } from "node:timers";
import { normalizeSlug, suggestSlug, validateSlug } from "../../shared/slug.js";
import { fieldErrorsFrom } from "../src/utils/formErrors.js";

// Execute the component's actual handlers/effects with controlled hooks and APIs.
// This checks logic only; browser rendering and native scrolling need a browser.
const source = (await readFile(new URL("../src/pages/ClinicSetupPage.jsx", import.meta.url), "utf8"))
  .replace(/import[\s\S]*?from\s+["'][^"']+["'];/g, "")
  .replace("export default function ClinicSetupPage()", "function ClinicSetupPage()");
const logic = source.slice(0, source.indexOf("  const fields = [")) +
  "return {form, handleChange, handleSubmit, inputs, fieldErrors, slugFeedback, slugError, publicUrl, manualSlug, setForm, setAvailability, setAvailabilityAttempt}; } ClinicSetupPage;";

function fixture({editing = false, coarse = false, reduced = false} = {}) {
  let cursor = 0;
  const slots = [], pending = [], timers = new Map(), calls = [], navigations = [], focus = [], scroll = [];
  let timerId = 0;
  const api = {
    get: (url, options) => new Promise((resolve, reject) => calls.push({url, options, resolve, reject})),
    post: async (url, payload) => { calls.push({url, payload}); return { data: {clinic: {_id: "new-clinic"}} }; },
    patch: async (url, payload) => { calls.push({url, payload}); },
  };
  const state = initial => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = initial;
    return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
  };
  const effect = (callback, deps) => {
    const index = cursor++, old = slots[index];
    if (!old || deps.some((dep, i) => dep !== old.deps[i])) {
      old?.cleanup?.();
      slots[index] = {deps};
      pending.push(() => {slots[index].cleanup = callback();});
    }
  };
  const context = vm.createContext({
    normalizeSlug, suggestSlug, validateSlug, fieldErrorsFrom, api,
    getClinicPublicUrl: slug => `https://${slug}.example.test`,
    useParams: () => ({clinicId: editing ? "saved-clinic" : undefined}),
    useNavigate: () => (...args) => navigations.push(args),
    useState: state,
    useRef: initial => {const i = cursor++; return slots[i] ||= {current: initial};},
    useEffect: effect, useLayoutEffect: effect,
    setTimeout: callback => {timers.set(++timerId, callback); return timerId;},
    clearTimeout: id => timers.delete(id), AbortController,
    window: {matchMedia: query => ({matches: query.includes("coarse") ? coarse : reduced})},
  });
  const Component = vm.runInContext(logic, context);
  let view;
  function render() {
    cursor = 0; view = Component();
    for (const name of Object.keys(view.form)) view.inputs.current[name] ||= {
      disabled: editing && name === "slug", validity: {valid: true}, validationMessage: "Required",
      parentElement: {focus: () => focus.push(`${name}-container`)},
      focus: () => focus.push(name), scrollIntoView: options => scroll.push({name, ...options}),
    };
    while (pending.length) pending.shift()();
    return view;
  }
  render();
  return {render, api, calls, navigations, focus, scroll,
    change(name, value) { view.handleChange({target: {name, value}}); return render(); },
    async check() { for (const [id, callback] of [...timers]) {timers.delete(id); await callback();} return render(); },
    startChecks() {for (const [id, callback] of [...timers]) {timers.delete(id); callback();}},
    async settle() {await new Promise(setImmediate); return render();},
    async submit() {await view.handleSubmit({preventDefault() {}}); return render();},
  };
}

test("name suggestion tracks name until manual override and can be restored", () => {
  const f = fixture();
  assert.equal(f.change("name", "City Care Clinic").form.slug, "city-care-clinic");
  assert.equal(f.change("name", "City Care Dental").form.slug, "city-care-dental");
  f.change("slug", "my-choice");
  assert.equal(f.change("name", "New Name").form.slug, "my-choice");
  f.change("slug", "");
  assert.equal(f.change("name", "Another Name").form.slug, "");
  const v = f.render(); v.manualSlug.current = false;
  assert.equal(f.change("name", "City Care Clinic").form.slug, "city-care-clinic");
});

test("debouncing skips invalid values and ignores stale availability responses", async () => {
  const f = fixture(); f.change("slug", "admin"); f.startChecks(); assert.equal(f.calls.length, 0);
  f.change("slug", "old-address"); f.change("slug", "new-address"); f.startChecks();
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].options.params.slug, "new-address");
  f.change("slug", "latest-address"); f.startChecks();
  assert.equal(f.calls[0].options.signal.aborted, true);
  f.calls[1].resolve({data: {slug: "latest-address", available: false}});
  assert.match((await f.settle()).slugError, /already in use/);
  f.calls[0].resolve({data: {slug: "new-address", available: true}});
  assert.match((await f.settle()).slugError, /already in use/);
});

test("availability requires backend confirmation and network failure has retry feedback", async () => {
  const f = fixture(); f.change("slug", "city-care-clinic"); f.startChecks();
  assert.match(f.render().slugFeedback, /Checking/);
  f.calls[0].resolve({data: {slug: "city-care-clinic", available: true}});
  assert.match((await f.settle()).slugFeedback, /is available/);
  assert.match(f.change("slug", " CITY-CARE-CLINIC ").slugFeedback, /is available/);
  f.change("slug", "new-address"); f.startChecks(); f.calls[1].reject(new Error("offline"));
  assert.match((await f.settle()).slugFeedback, /Unable to check/);
  f.render().setAvailabilityAttempt(n => n + 1); f.render(); f.startChecks();
  assert.equal(f.calls.length, 3);
});

test("submission focuses first invalid field and respects touch/reduced motion", async () => {
  for (const coarse of [false, true]) {
    const f = fixture({coarse, reduced: true});
    f.render().inputs.current.name.validity.valid = false;
    const v = await f.submit();
    assert.equal(v.fieldErrors.name, "Required");
    assert.deepEqual(f.focus, [coarse ? "name-container" : "name"]);
    assert.equal(f.scroll[0].behavior, "instant"); assert.equal(f.calls.length, 0);
  }
});

test("409 and backend field errors focus the relevant input, background failure does not", async () => {
  const f = fixture(); f.change("name", "City Care Clinic");
  f.api.post = async () => {throw {response: {status: 409, data: {message: "Conflict"}}};};
  assert.match((await f.submit()).fieldErrors.slug, /already in use/);
  assert.equal(f.focus.at(-1), "slug");
  f.change("slug", "another-address");
  f.api.post = async () => {throw {response: {status: 400, data: {errors: [{field: "contact.phone", message: "Invalid phone number"}]}}};};
  assert.equal((await f.submit()).fieldErrors.phone, "Invalid phone number"); assert.equal(f.focus.at(-1), "phone");
  const previous = f.focus.length;
  f.api.post = async () => {throw new Error("offline");}; await f.submit();
  assert.equal(f.focus.length, previous);
});

test("valid creation preserves payload/navigation and editing never submits saved slug", async () => {
  const f = fixture(); f.change("name", "City Care Clinic"); f.change("phone", "9876543210"); await f.submit();
  assert.equal(f.calls[0].payload.slug, "city-care-clinic");
  assert.equal(f.calls[0].payload.billingCycle, "monthly");
  assert.equal(f.navigations[0][0], "/clinics/new-clinic/doctors/setup");
  const e = fixture({editing: true});
  e.calls[0].resolve({data: {clinic: {name: "Old Name", slug: "saved-slug", status: "draft"}}}); await e.settle();
  assert.equal(e.change("name", "New Name").form.slug, "saved-slug"); await e.submit();
  assert.equal(e.calls.at(-1).url, "/clinics/saved-clinic");
  assert.equal("slug" in e.calls.at(-1).payload, false);
});
