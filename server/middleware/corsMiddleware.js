import cors from "cors";

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  return allowedOrigins.some((allowed) => {
    if (!allowed.includes("*")) {
      return origin === allowed;
    }

    const suffix = allowed.replace("*.", "");

    try {
      const requestUrl = new URL(origin);
      const allowedUrl = new URL(suffix);

      return (
        requestUrl.protocol === allowedUrl.protocol &&
        requestUrl.port === "" &&
        requestUrl.hostname.endsWith(`.${allowedUrl.hostname}`) &&
        /^[a-z0-9-]+$/.test(
          requestUrl.hostname.slice(
            0,
            -(allowedUrl.hostname.length + 1)
          )
        )
      );
    } catch {
      return false;
    }
  });
};

export default cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    const error = new Error("Not allowed by CORS");
    error.statusCode = 403;
    return callback(error);
  },
  credentials: true,
});