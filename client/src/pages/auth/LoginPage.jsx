
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Stethoscope,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import GoogleAuthButton from "../../components/GoogleAuthButton";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, refreshUser } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const requestedPath = location.state?.from;

  const destination =
    typeof requestedPath === "string" &&
    requestedPath.startsWith("/") &&
    !requestedPath.startsWith("//") &&
    !requestedPath.startsWith("/\\")
      ? requestedPath
      : "/dashboard";

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");

    try {
      await login(form);

      navigate(destination, {
        replace: true,
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to sign in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const authenticatedUser = await refreshUser();

    if (!authenticatedUser) {
      throw new Error(
        "Google sign-in succeeded, but your session could not be restored."
      );
    }

    navigate(destination, {
      replace: true,
    });
  };

  const handleGoogleRegistration = ({
    credential,
    email,
    name,
  }) => {
    navigate("/register", {
      state: {
        googleCredential: credential,
        email,
        name,
      },
    });
  };

  return (
    <main className="flex min-h-screen min-h-dvh w-full min-w-0 items-start justify-center overflow-x-hidden bg-slate-50 px-3 py-5 sm:items-center sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mx-auto w-full min-w-0 max-w-md rounded-2xl border border-slate-200 bg-white px-4 py-6 shadow-sm min-[375px]:px-5 sm:px-8 sm:py-8">
        <div className="mb-6 text-center sm:mb-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white sm:h-14 sm:w-14">
            <Stethoscope
              size={26}
              aria-hidden="true"
              className="sm:h-7 sm:w-7"
            />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-slate-900 min-[375px]:text-2xl sm:text-3xl">
            Welcome Back
          </h1>

          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Sign in to manage your clinic
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="w-full min-w-0 space-y-4 sm:space-y-5"
        >
          <div className="w-full min-w-0">
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Email Address
            </label>

            <div className="relative w-full min-w-0">
              <Mail
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                id="email"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                autoComplete="email"
                required
                disabled={loading}
                className="block min-h-12 w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="w-full min-w-0">
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Password
            </label>

            <div className="relative w-full min-w-0">
              <Lock
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                disabled={loading}
                className="block min-h-12 w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-12 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword((prev) => !prev)
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
                aria-pressed={showPassword}
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-500"
              >
                {showPassword ? (
                  <EyeOff
                    size={18}
                    aria-hidden="true"
                  />
                ) : (
                  <Eye
                    size={18}
                    aria-hidden="true"
                  />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="flex min-w-0 items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />

              <span className="min-w-0 break-words">
                {error}
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex min-h-12 w-full min-w-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:text-base"
          >
            {loading ? (
              <>
                <LoaderCircle
                  size={18}
                  className="shrink-0 animate-spin"
                  aria-hidden="true"
                />
                Signing In...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight
                  size={18}
                  className="shrink-0"
                  aria-hidden="true"
                />
              </>
            )}
          </button>
        </form>

        <div className="relative my-5 w-full min-w-0 sm:my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>

          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400 sm:px-4 sm:text-xs">
              Or continue with
            </span>
          </div>
        </div>

        <div className="flex w-full min-w-0 max-w-full justify-center overflow-hidden">
          <div className="flex w-full min-w-0 justify-center [&>div]:max-w-full [&_iframe]:max-w-full">
            <GoogleAuthButton
              onLogin={handleGoogleLogin}
              onPasswordRequired={handleGoogleRegistration}
            />
          </div>
        </div>

        <p className="mt-5 break-words text-center text-sm leading-relaxed text-slate-500 sm:mt-6">
          New to the platform?{" "}
          Sign In by Google
        </p>
      </div>
    </main>
  );
}
