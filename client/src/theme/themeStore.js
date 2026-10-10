export const THEME_STORAGE_KEY = "clinic-saas-theme";
const listeners = new Set();
const media = window.matchMedia("(prefers-color-scheme: dark)");
let preference;
try {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") preference = stored;
} catch { /* Theme still works when storage is unavailable. */ }
let theme = preference || (media.matches ? "dark" : "light");

function applyTheme() {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}
function emit() {
  applyTheme();
  listeners.forEach(listener => listener());
}
applyTheme();

export const getTheme = () => theme;
export const getServerTheme = () => "light";
export function subscribeTheme(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function setTheme(next) {
  if (next !== "light" && next !== "dark") return;
  preference = next;
  theme = next;
  try { window.localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* Optional persistence. */ }
  emit();
}
media.addEventListener("change", event => {
  if (!preference) { theme = event.matches ? "dark" : "light"; emit(); }
});
window.addEventListener("storage", event => {
  if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
  preference = event.newValue === "light" || event.newValue === "dark" ? event.newValue : undefined;
  theme = preference || (media.matches ? "dark" : "light");
  emit();
});
