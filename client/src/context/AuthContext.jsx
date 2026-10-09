
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");

      const authenticatedUser =
        data.success && data.user ? data.user : null;

      setUser(authenticatedUser);
      return authenticatedUser;
    } catch (error) {
      setUser(null);

      if (error.response?.status !== 401) {
        console.error("Session verification failed:", error);
      }

      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const setAuthenticatedUser = useCallback((authenticatedUser) => {
    if (!authenticatedUser?.id) {
      throw new Error("Invalid authenticated user");
    }

    setUser(authenticatedUser);
    setLoading(false);
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const { data } = await api.post("/auth/login", {
      email: email.trim().toLowerCase(),
      password,
    });

    if (!data.success || !data.user) {
      throw new Error(data.message || "Login failed");
    }

    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refreshUser,
      setAuthenticatedUser,
    }),
    [
      user,
      loading,
      login,
      logout,
      refreshUser,
      setAuthenticatedUser,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
