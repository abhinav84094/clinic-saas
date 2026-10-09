
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import VerifyEmailPage from "./pages/auth/VerifyEmailPage";

import MyClinicsPage from "./pages/MyClinicsPage";
import ClinicSetupPage from "./pages/ClinicSetupPage";
import DashboardPage from "./pages/DashboardPage";

import GooglePasswordSetup from "./components/GooglePasswordSetup";
import { useAuth } from "./context/AuthContext";
import ProtectedRoute, {
  AuthLoadingScreen,
} from "./components/shared/ProtectedRoute";

import AddDoctorsPage from "./pages/AddDoctorsPage";
import ServicesSetupPage from "./pages/ServicesSetupPage";



import WebsiteSetupPage from "./pages/WebsiteSetup";
import PublicClinicPage from "./pages/PublicClinicPage";






function GuestRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <AuthLoadingScreen />;

  if (isAuthenticated) {
    return <Navigate to="/my-clinics" replace />;
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

  if (loading) return <AuthLoadingScreen />;

  if (isAuthenticated) {
    return <Navigate to="/my-clinics" replace />;
  }

  if (!credential) {
    return <Navigate to="/login" replace />;
  }

  const handleComplete = async (user) => {
    setAuthenticatedUser(user);
    navigate("/my-clinics", { replace: true });
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-6 sm:px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <h1 className="text-center text-2xl font-bold text-slate-900">
          Complete Your Registration
        </h1>

        <p className="mb-6 mt-3 text-center text-sm text-slate-500">
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


function WebsiteSetupPlaceholder() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-5">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm font-semibold text-blue-600">
          STEP 4 OF 6
        </p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">
          Website Customization
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          Your services and availability have been saved.
          The website template editor will be implemented next.
        </p>
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
          element={<Navigate to="/my-clinics" replace />}
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
            path="/my-clinics"
            element={<MyClinicsPage />}
          />

          <Route
            path="/clinics/new"
            element={<ClinicSetupPage />}
          />

          <Route
            path="/clinics/:clinicId/setup"
            element={<ClinicSetupPage />}
          />

          <Route
            path="/clinics/:clinicId/services/setup"
            element={<ServicesSetupPage />}
          />

          <Route
            path="/clinics/:clinicId/doctors/setup"
            element={<AddDoctorsPage />}
          />

          <Route
            path="/clinics/:clinicId/website/setup"
            element={<WebsiteSetupPlaceholder />}
          />

          <Route
            path="/dashboard/clinic/:clinicId"
            element={<DashboardPage />}
          />

          <Route
            path="/dashboard"
            element={<Navigate to="/my-clinics" replace />}
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
              <h1 className="text-2xl font-bold">
                404 — Page Not Found
              </h1>
              <a href="/" className="text-blue-600">
                Return Home
              </a>
            </main>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
