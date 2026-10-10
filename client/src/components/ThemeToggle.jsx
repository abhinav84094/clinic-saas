import { Moon, Sun } from "lucide-react";
import { useTheme } from "../theme/useTheme";
import { setTheme } from "../theme/themeStore";

export default function ThemeToggle() {
  const theme = useTheme();
  const dark = theme === "dark";
  return (
      <button
        type="button"
        onClick={() => setTheme(dark ? "light" : "dark")}
        aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        aria-pressed={dark}
        title={dark ? "Switch to light mode" : "Switch to dark mode"}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        {dark ? "Light mode" : "Dark mode"}
      </button>
  );
}
