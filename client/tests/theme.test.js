import test from "node:test";
import assert from "node:assert/strict";

async function fixture(t, {stored, systemDark = false, denied = false} = {}) {
  const beforeWindow = globalThis.window;
  const beforeDocument = globalThis.document;
  const callbacks = {};
  const media = {matches: systemDark, addEventListener: (_event, fn) => {callbacks.media = fn;}};
  const storage = new Map(stored === undefined ? [] : [["clinic-saas-theme", stored]]);
  const classes = new Set();
  globalThis.document = {documentElement: {classList: {toggle: (key, on) => on ? classes.add(key) : classes.delete(key)}, style: {}}};
  globalThis.window = {
    matchMedia: () => media,
    addEventListener: (_event, fn) => {callbacks.storage = fn;},
    localStorage: {
      getItem: key => {if (denied) throw new Error("storage denied"); return storage.get(key) ?? null;},
      setItem: (key, value) => {if (denied) throw new Error("storage denied"); storage.set(key, value);},
    },
  };
  t.after(() => {globalThis.window = beforeWindow; globalThis.document = beforeDocument;});
  const store = await import(`../src/theme/themeStore.js?case=${encodeURIComponent(t.name)}`);
  return {store, storage, classes, callbacks, media};
}

test("stored theme overrides system, updates document and persists toggle", async t => {
  const {store, storage, classes} = await fixture(t, {stored:"light",systemDark:true});
  assert.equal(store.getTheme(),"light");
  assert.equal(classes.has("dark"),false);
  let notifications = 0;
  const unsubscribe = store.subscribeTheme(() => notifications++);
  store.setTheme("dark");
  assert.equal(store.getTheme(),"dark");
  assert.equal(classes.has("dark"),true);
  assert.equal(document.documentElement.style.colorScheme,"dark");
  assert.equal(storage.get(store.THEME_STORAGE_KEY),"dark");
  assert.equal(notifications,1);
  unsubscribe();
  store.setTheme("light");
  assert.equal(notifications,1);
});

test("system changes apply until a user chooses their theme", async t => {
  const {store, callbacks} = await fixture(t, {systemDark:true});
  assert.equal(store.getTheme(),"dark");
  callbacks.media({matches:false});
  assert.equal(store.getTheme(),"light");
  store.setTheme("dark");
  callbacks.media({matches:false});
  assert.equal(store.getTheme(),"dark");
});

test("storage restrictions and invalid preferences do not break toggle", async t => {
  const {store} = await fixture(t, {denied:true});
  assert.equal(store.getTheme(),"light");
  assert.doesNotThrow(() => store.setTheme("dark"));
  assert.equal(store.getTheme(),"dark");
  store.setTheme("invalid");
  assert.equal(store.getTheme(),"dark");
});

test("theme syncs across tabs and removed preference follows system", async t => {
  const {store, callbacks} = await fixture(t, {stored:"invalid",systemDark:false});
  assert.equal(store.getTheme(),"light");
  callbacks.storage({key:store.THEME_STORAGE_KEY,newValue:"dark"});
  assert.equal(store.getTheme(),"dark");
  callbacks.storage({key:store.THEME_STORAGE_KEY,newValue:null});
  assert.equal(store.getTheme(),"light");
});
