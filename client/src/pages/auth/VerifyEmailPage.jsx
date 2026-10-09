
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  MailCheck,
  ArrowRight,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import api from "../../services/api";
import useCooldown from "../../hooks/useCooldown";

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const initialEmail =
    typeof location.state?.email === "string"
      ? location.state.email
      : "";

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { secondsRemaining, startCooldown } = useCooldown(60);

  const handleVerify = async (event) => {
    event.preventDefault();

    if (loading || resending) return;

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otp.trim();

    if (!normalizedEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (!/^\d{6}$/.test(normalizedOtp)) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { data } = await api.post("/auth/verify-email", {
        email: normalizedEmail,
        otp: normalizedOtp,
      });

      if (!data.success) {
        throw new Error(data.message || "Verification failed.");
      }

      setSuccess("Email verified successfully. You can now sign in.");
      setOtp("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to verify your email."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending || loading || secondsRemaining > 0) return;

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Please enter your email address first.");
      return;
    }

    setResending(true);
    setError("");
    setSuccess("");

    try {
      const { data } = await api.post("/auth/resend-verification-otp", {
        email: normalizedEmail,
      });

      if (!data.success) {
        throw new Error(data.message || "Unable to resend code.");
      }

      setSuccess(data.message || "A new verification code has been sent.");
      startCooldown();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to resend verification code."
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <MailCheck size={28} aria-hidden="true" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Verify Your Email
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Enter the verification code sent to your email address.
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-5">
          <div>
            <label htmlFor="verificationEmail" className="mb-2 block text-sm font-medium text-slate-700">
              Email Address
            </label>
            <input
              id="verificationEmail"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
                setSuccess("");
              }}
              autoComplete="email"
              placeholder="you@example.com"
              required
              disabled={loading || resending}
              className="min-h-12 w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="verificationOtp" className="mb-2 block text-sm font-medium text-slate-700">
              Verification Code
            </label>
            <input
              id="verificationOtp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={otp}
              onChange={(event) => {
                setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
                setError("");
              }}
              placeholder="Enter 6-digit code"
              required
              disabled={loading || resending}
              className="min-h-12 w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-xl font-semibold tracking-[0.3em] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            />
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span className="min-w-0 break-words">{error}</span>
            </div>
          )}

          {success && (
            <div role="status" className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <span className="min-w-0 break-words">{success}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || resending || Boolean(success && success.startsWith("Email verified successfully"))}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <LoaderCircle size={18} className="animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                Verify Email
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="mt-5 text-center">
          <p className="text-sm text-slate-500">
            Didn't receive the code?
          </p>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending || loading || secondsRemaining > 0}
            className="mt-2 min-h-11 text-sm font-semibold text-blue-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {resending
              ? "Sending..."
              : secondsRemaining > 0
                ? `Resend code in ${secondsRemaining}s`
                : "Resend Verification Code"}
          </button>
        </div>

        <div className="mt-5 border-t border-slate-100 pt-5 text-center">
          <Link to="/login" className="text-sm font-semibold text-blue-600 hover:underline">
            Back to Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}
