
import { useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  Stethoscope,
  UserRound,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";

import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useAuth();

  const googleCredential =
    location.state?.googleCredential || null;

  const isGoogleRegistration = Boolean(googleCredential);

  const [form, setForm] = useState({
    name: isGoogleRegistration
      ? location.state?.name || ""
      : "",
    email: isGoogleRegistration
      ? location.state?.email || ""
      : "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();

    if (!name) {
      setError("Please enter your name.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (isGoogleRegistration) {
        const { data } = await api.post(
          "/auth/google/complete-signup",
          {
            credential: googleCredential,
            password: form.password,
            confirmPassword: form.confirmPassword,
          }
        );

        if (!data.success || !data.user) {
          throw new Error(
            data.message || "Google registration failed."
          );
        }

        const authenticatedUser = await refreshUser();

        if (!authenticatedUser) {
          throw new Error(
            "Account created, but session could not be restored. Please sign in."
          );
        }

        navigate("/dashboard", { replace: true });
        return;
      }

      const { data } = await api.post("/auth/register", {
        name,
        email,
        password: form.password,
      });

      if (!data.success) {
        throw new Error(
          data.message || "Registration failed."
        );
      }

      navigate("/verify-email", {
        replace: true,
        state: { email },
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to create your account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "block min-h-12 w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-12 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60";

  const iconClass =
    "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400";

  const toggleClass =
    "absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-500";

  return (
    <main className="flex min-h-screen min-h-dvh w-full min-w-0 items-start justify-center overflow-x-hidden bg-slate-50 px-3 py-5 sm:items-center sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mx-auto w-full min-w-0 max-w-md rounded-2xl border border-slate-200 bg-white px-4 py-6 shadow-sm min-[375px]:px-5 sm:px-8 sm:py-8">
        <div className="mb-6 text-center sm:mb-7">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white sm:h-14 sm:w-14">
            <Stethoscope
              size={26}
              aria-hidden="true"
              className="sm:h-7 sm:w-7"
            />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-slate-900 min-[375px]:text-2xl sm:text-3xl">
            {isGoogleRegistration
              ? "Complete Registration"
              : "Create Your Account"}
          </h1>

          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            {isGoogleRegistration
              ? "Set a password for your Google account"
              : "Start managing your clinic in one place"}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="w-full min-w-0 space-y-4"
        >
          <div className="w-full min-w-0">
            <label
              htmlFor="name"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Full Name
            </label>

            <div className="relative w-full min-w-0">
              <UserRound
                size={18}
                aria-hidden="true"
                className={iconClass}
              />

              <input
                id="name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                placeholder="Enter your full name"
                autoComplete="name"
                maxLength={100}
                required
                disabled={loading || isGoogleRegistration}
                className={inputClass}
              />
            </div>
          </div>

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
                className={iconClass}
              />

              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                autoComplete="email"
                required
                disabled={loading || isGoogleRegistration}
                className={inputClass}
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
                className={iconClass}
              />

              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={handleChange}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                minLength={8}
                required
                disabled={loading}
                className={inputClass}
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword((previous) => !previous)
                }
                aria-label={
                  showPassword ? "Hide password" : "Show password"
                }
                aria-pressed={showPassword}
                className={toggleClass}
              >
                {showPassword ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <div className="w-full min-w-0">
            <label
              htmlFor="confirmPassword"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Confirm Password
            </label>

            <div className="relative w-full min-w-0">
              <Lock
                size={18}
                aria-hidden="true"
                className={iconClass}
              />

              <input
                id="confirmPassword"
                name="confirmPassword"
                type={
                  showConfirmPassword ? "text" : "password"
                }
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                minLength={8}
                required
                disabled={loading}
                className={inputClass}
              />

              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword((previous) => !previous)
                }
                aria-label={
                  showConfirmPassword
                    ? "Hide password"
                    : "Show password"
                }
                aria-pressed={showConfirmPassword}
                className={toggleClass}
              >
                {showConfirmPassword ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
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
            className="flex min-h-12 w-full min-w-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:text-base"
          >
            {loading ? (
              <>
                <LoaderCircle
                  size={18}
                  className="shrink-0 animate-spin"
                  aria-hidden="true"
                />
                Creating Account...
              </>
            ) : (
              <>
                {isGoogleRegistration
                  ? "Complete Registration"
                  : "Create Account"}

                <ArrowRight
                  size={18}
                  className="shrink-0"
                  aria-hidden="true"
                />
              </>
            )}
          </button>
        </form>

        <p className="mt-5 break-words text-center text-sm leading-relaxed text-slate-500 sm:mt-6">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            Sign In
          </Link>
        </p>
      </div>
    </main>
  );
}
