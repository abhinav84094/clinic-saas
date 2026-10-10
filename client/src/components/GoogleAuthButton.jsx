
import { useEffect, useRef, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import api from "../services/api";
import { useTheme } from "../theme/useTheme";

export default function GoogleAuthButton({
  onLogin,
  onPasswordRequired,
}) {
  const containerRef = useRef(null);
  const [buttonWidth, setButtonWidth] = useState(240);
  const theme = useTheme();
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => {
      const width = Math.floor(entries[0].contentRect.width);
      if (width > 0) setButtonWidth(Math.min(320, width));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleSuccess = async (response) => {
    if (loading) return;

    const credential = response?.credential;

    if (!credential) {
      setError("Google credential is missing. Please try again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data } = await api.post("/auth/google", {
        credential,
      });

      if (!data.success) {
        throw new Error(data.message || "Google login failed.");
      }

      if (data.requiresPassword) {
        if (!onPasswordRequired) {
          throw new Error("Registration handler is missing.");
        }

        await onPasswordRequired({
          credential,
          email: data.email,
          name: data.name,
        });

        return;
      }

      if (!data.user?.id) {
        throw new Error("Invalid authentication response.");
      }

      if (!onLogin) {
        throw new Error("Login handler is missing.");
      }

      await onLogin(data.user);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to sign in with Google."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-3">
      <div ref={containerRef} className="flex min-h-11 w-full min-w-0 items-center justify-center">
        {loading ? (
          <p
            role="status"
            className="text-sm text-slate-500 dark:text-slate-400"
          >
            Signing in with Google...
          </p>
        ) : (
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() =>
              setError("Google sign-in failed. Please try again.")
            }
            theme={theme === "dark" ? "filled_black" : "outline"}
            size="large"
            shape="rectangular"
            width={String(buttonWidth)}
          />
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300"
        >
          {error}
        </p>
      )}
    </div>
  );
}
