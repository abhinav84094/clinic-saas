
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

// ================================
// DASHBOARD
// ================================

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

// ================================
// PUBLIC CLINIC
// ================================

function PublicClinicPage() {
  return <h1>Public Clinic Website</h1>;
}

// ================================
// GUEST ROUTE
// ================================

function GuestRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <AuthLoadingScreen />;
  }

  return isAuthenticated ? (
    <Navigate to="/dashboard" replace />
  ) : (
    children
  );
}

// ================================
// GOOGLE PASSWORD SETUP PAGE
// ================================

function GooglePasswordSetupPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const { isAuthenticated, loading } = useAuth();

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

  const handleComplete = () => {
    // Backend has now created the user
    // and issued the accessToken cookie.
    // Reload so AuthProvider fetches /api/auth/me
    // and updates its authentication state.

    window.location.replace("/dashboard");
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">
          Complete Your Registration
        </h1>

        <p className="mb-6 text-sm text-slate-600">
          Your Google account is verified.
          Set a password to complete your registration.
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

// ================================
// APP ROUTES
// ================================

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ROOT */}

        <Route
          path="/"
          element={<Navigate to="/dashboard" replace />}
        />

        {/* LOGIN */}

        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />

        {/* REGISTER */}

        <Route
          path="/register"
          element={
            <GuestRoute>
              <RegisterPage />
            </GuestRoute>
          }
        />

        {/* EMAIL VERIFICATION */}

        <Route
          path="/verify-email"
          element={
            <GuestRoute>
              <VerifyEmailPage />
            </GuestRoute>
          }
        />

        {/* GOOGLE PASSWORD SETUP
            Must remain outside ProtectedRoute
            because account creation is not complete.
        */}

        <Route
          path="/google/set-password"
          element={<GooglePasswordSetupPage />}
        />

        {/* PROTECTED DASHBOARD */}

        <Route element={<ProtectedRoute />}>
          <Route
            path="/dashboard"
            element={<DashboardPage />}
          />
        </Route>

        {/* PUBLIC CLINIC */}

        <Route
          path="/c/:slug"
          element={<PublicClinicPage />}
        />

        {/* 404 */}

        <Route
          path="*"
          element={
            <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
              <h1 className="text-2xl font-bold">
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
