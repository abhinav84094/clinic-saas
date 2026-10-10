
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
import SubscriptionSetupPage from "./pages/SubscriptionSetupPage";
import ReviewPublishPage from "./pages/ReviewPublishPage";

import ClinicDashboardShell from "./components/dashboard/ClinicDashboardShell";

import { getClinicSlugFromHostname } from "./utils/clinicDomain";

import ServicesManagementPage from "./pages/dashboard/ServicesManagementPage";
import ClinicProfilePage from "./pages/dashboard/ClinicProfilePage";
import WebsiteManagementPage from "./pages/dashboard/WebsiteManagementPage";
import RenewPlanPage from "./pages/dashboard/RenewPlanPage";

function GuestRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <AuthLoadingScreen />;
  }

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

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/my-clinics" replace />;
  }

  const handleComplete = async (user) => {
    setAuthenticatedUser(user);

    navigate("/my-clinics", {
      replace: true,
    });
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

export default function App() {
  const subdomainSlug = getClinicSlugFromHostname();

  // Public clinic subdomain
  if (subdomainSlug) {
    return (
      <BrowserRouter>
        <Routes>
          <Route
            path="*"
            element={<PublicClinicPage />}
          />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Home */}
        <Route
          path="/"
          element={
            <Navigate
              to="/my-clinics"
              replace
            />
          }
        />

        {/* Authentication */}
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

        {/* Protected application routes */}
        <Route element={<ProtectedRoute />}>
          {/* My Clinics */}
          <Route
            path="/my-clinics"
            element={<MyClinicsPage />}
          />

          {/* Clinic onboarding */}
          <Route
            path="/clinics/new"
            element={<ClinicSetupPage />}
          />

          <Route
            path="/clinics/:clinicId/setup"
            element={<ClinicSetupPage />}
          />

          <Route
            path="/clinics/:clinicId/doctors/setup"
            element={<AddDoctorsPage />}
          />

          <Route
            path="/clinics/:clinicId/services/setup"
            element={<ServicesSetupPage />}
          />

          <Route
            path="/clinics/:clinicId/website/setup"
            element={<WebsiteSetupPage />}
          />

          <Route
            path="/clinics/:clinicId/subscription/setup"
            element={<SubscriptionSetupPage />}
          />

          <Route
            path="/clinics/:clinicId/review"
            element={<ReviewPublishPage />}
          />

          {/* Clinic Dashboard */}
          <Route
            path="/dashboard/clinic/:clinicId"
            element={<ClinicDashboardShell />}
          >
            {/* Overview */}
            <Route
              index
              element={<DashboardPage />}
            />

            {/* Clinic Profile */}
            <Route
              path="profile"
              element={<ClinicProfilePage />}
            />

            {/* Doctors */}
            <Route
              path="doctors"
              element={<AddDoctorsPage />}
            />

            {/* Services */}
            <Route
              path="services"
              element={<ServicesManagementPage />}
            />

            {/* Website Management */}
            <Route
              path="website"
              element={<WebsiteManagementPage />}
            />

            {/* Subscription Renewal */}
            <Route
              path="renew"
              element={<RenewPlanPage />}
            />
          </Route>

          {/* Dashboard redirect */}
          <Route
            path="/dashboard"
            element={
              <Navigate
                to="/my-clinics"
                replace
              />
            }
          />
        </Route>

        {/* Local public clinic route */}
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
                className="text-blue-600"
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
