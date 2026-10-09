
import { useState } from "react";

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { LoaderCircle, LogOut } from "lucide-react";

import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import VerifyEmailPage from "./pages/auth/VerifyEmailPage";

import GooglePasswordSetup from "./components/GooglePasswordSetup";

import { useAuth } from "./context/AuthContext";

import ProtectedRoute, {
  AuthLoadingScreen,
} from "./components/shared/ProtectedRoute";

function DashboardPage() {
  const { user, logout } = useAuth();

  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError("");

    try {
      await logout();
    } catch (error) {
      setLogoutError(
        error.response?.data?.message ||
          "Logout failed. Please try again."
      );
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold text-slate-900">
              Clinic Owner Dashboard
            </h1>

            <p className="mt-2 break-words text-sm text-slate-600">
              Welcome, {user?.name || "Clinic Owner"}
            </p>

            <p className="mt-1 break-all text-xs text-slate-500">
              {user?.email}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingOut ? (
              <LoaderCircle
                size={17}
                className="animate-spin"
              />
            ) : (
              <LogOut size={17} />
            )}

            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>

        {logoutError && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {logoutError}
          </p>
        )}
      </div>
    </main>
  );
}

function PublicClinicPage() {
  return <h1>Public Clinic Website</h1>;
}

function GuestRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function GooglePasswordSetupPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    isAuthenticated,
    loading,
    setAuthenticatedUser,
  } = useAuth();

  const credential = location.state?.credential;
  const email = location.state?.email;

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!credential) {
    return <Navigate to="/login" replace />;
  }

  const handleComplete = async (user) => {
    setAuthenticatedUser(user);

    navigate("/dashboard", {
      replace: true,
    });
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Complete Your Registration
        </h1>

        <p className="mb-6 mt-3 text-center text-sm leading-relaxed text-slate-500">
          Your Google account is verified.
          Set a password to finish creating your account.
        </p>

        <GooglePasswordSetup
          credential={credential}
          email={email}
          onComplete={handleComplete}
        />
      </div>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Navigate to="/dashboard" replace />}
        />

        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />

        <Route
          path="/register"
          element={
            <GuestRoute>
              <RegisterPage />
            </GuestRoute>
          }
        />

        <Route
          path="/verify-email"
          element={
            <GuestRoute>
              <VerifyEmailPage />
            </GuestRoute>
          }
        />

        <Route
          path="/google/set-password"
          element={<GooglePasswordSetupPage />}
        />

        <Route element={<ProtectedRoute />}>
          <Route
            path="/dashboard"
            element={<DashboardPage />}
          />
        </Route>

        <Route
          path="/c/:slug"
          element={<PublicClinicPage />}
        />

        <Route
          path="*"
          element={
            <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
              <h1 className="text-2xl font-bold text-slate-900">
                404 — Page Not Found
              </h1>

              <a
                href="/"
                className="text-blue-600 hover:underline"
              >
                Return Home
              </a>
            </main>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
