
import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function GoogleAuthButton({
  onLogin,
  onPasswordRequired,
}) {
  const [error, setError] = useState("");

  const handleGoogleSuccess = async (response) => {
    try {
      setError("");

      const credential = response.credential;

      const { data } = await axios.post(
        `${API_URL}/api/auth/google`,
        { credential },
        { withCredentials: true }
      );

      if (data.requiresPassword) {
        onPasswordRequired({
          credential,
          email: data.email,
          name: data.name,
        });
        return;
      }

      onLogin(data.user);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Google authentication failed"
      );
    }
  };

  return (
    <div>
      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={() =>
          setError("Google sign-in was cancelled or failed")
        }
      />
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
