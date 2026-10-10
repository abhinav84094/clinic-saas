import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export function AuthLoadingScreen() {
  return (
    <div
      className="flex min-h-dvh items-center justify-center bg-slate-50 dark:bg-slate-950 px-4"
      role="status"
      aria-label="Checking authentication"
    >
      <div className="flex flex-col items-center gap-3 text-slate-600 dark:text-slate-300">
        <LoaderCircle
          className="animate-spin text-blue-600 dark:text-blue-300"
          size={32}
          aria-hidden="true"
        />
        <p className="text-sm">Checking your session...</p>
      </div>
    </div>
  );
}

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{
          from: location.pathname + location.search + location.hash,
        }}
        replace
      />
    );
  }

  return <Outlet />;
}