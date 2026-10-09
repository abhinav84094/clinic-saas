
import { useCallback, useEffect, useState } from "react";

export default function useCooldown(durationSeconds = 60) {
  const [expiresAt, setExpiresAt] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;

    const updateRemaining = () => {
      const remaining = Math.max(
        0,
        Math.ceil((expiresAt - Date.now()) / 1000)
      );

      setSecondsRemaining(remaining);
    };

    updateRemaining();

    const intervalId = window.setInterval(updateRemaining, 1000);

    return () => window.clearInterval(intervalId);
  }, [expiresAt]);

  const startCooldown = useCallback(() => {
    const nextExpiry = Date.now() + durationSeconds * 1000;

    setExpiresAt(nextExpiry);
    setSecondsRemaining(durationSeconds);
  }, [durationSeconds]);

  return {
    secondsRemaining,
    startCooldown,
  };
}
