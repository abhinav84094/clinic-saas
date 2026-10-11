
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { AuthLoadingScreen } from "./ProtectedRoute";
import ClinicLandingPage from "../../pages/ClinicLandingPage";

export default function HomeRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/my-clinics" replace />;
  }

  return <ClinicLandingPage />;
}
