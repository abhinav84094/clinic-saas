
import { useState } from "react";

import {
  Lock,
  Eye,
  EyeOff,
  LoaderCircle,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";

import api from "../services/api";

export default function GooglePasswordSetup({
  credential,
  email,
  onComplete,
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) return;

    setError("");

    if (!credential) {
      setError("Google session expired. Please sign in again.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post(
        "/auth/google/complete-signup",
        {
          credential,
          password,
          confirmPassword,
        }
      );

      if (!data.success || !data.user?.id) {
        throw new Error(
          data.message || "Unable to complete registration."
        );
      }

      await onComplete(data.user);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to complete signup. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "min-h-12 w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-12 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60 sm:text-sm";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck
            size={20}
            className="mt-0.5 shrink-0 text-blue-600"
            aria-hidden="true"
          />

          <div className="min-w-0">
            <p className="text-sm font-semibold text-blue-900">
              Google account verified
            </p>

            <p className="mt-1 break-all text-sm text-blue-700">
              {email}
            </p>
          </div>
        </div>
      </div>

      <div>
        <label
          htmlFor="googlePassword"
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          Create Password
        </label>

        <div className="relative">
          <Lock
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />

          <input
            id="googlePassword"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
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
            className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:text-slate-800"
          >
            {showPassword ? (
              <EyeOff size={18} />
            ) : (
              <Eye size={18} />
            )}
          </button>
        </div>
      </div>

      <div>
        <label
          htmlFor="googleConfirmPassword"
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          Confirm Password
        </label>

        <div className="relative">
          <Lock
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />

          <input
            id="googleConfirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setError("");
            }}
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
                ? "Hide confirm password"
                : "Show confirm password"
            }
            className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:text-slate-800"
          >
            {showConfirmPassword ? (
              <EyeOff size={18} />
            ) : (
              <Eye size={18} />
            )}
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <AlertCircle
            size={18}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span className="min-w-0 break-words">{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <>
            <LoaderCircle
              size={18}
              className="animate-spin"
              aria-hidden="true"
            />
            Creating Account...
          </>
        ) : (
          "Complete Registration"
        )}
      </button>

      <p className="text-center text-xs leading-relaxed text-slate-500">
        You can use either Google Sign-In or your password
        to access your account after registration.
      </p>
    </form>
  );
}
