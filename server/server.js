import "dotenv/config";
import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js"
import cookieParser from "cookie-parser";
import clinicRoutes from "./routes/clinicRoutes.js";
import doctorRoutes from './routes/doctorRoutes.js';
import publicClinicRoutes from "./routes/publicClinicRoutes.js"
import serviceRoutes from "./routes/serviceRoutes.js";
import doctorServiceRoutes from "./routes/doctorServiceRoutes.js";
import scheduleRoutes from "./routes/scheduleRoutes.js";

import path from "node:path";
import { fileURLToPath } from "node:url";
import { protect } from "./middleware/authMiddleware.js";
import { handleRazorpayWebhook } from "./controllers/razorpayWebhookController.js";

const app = express();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;

app.use(cors());


app.post(
  "/api/webhooks/razorpay",
  express.raw({ type: "application/json" }),
  handleRazorpayWebhook
);



app.use(express.json());
app.use(cookieParser());

if (process.env.NODE_ENV !== "production") {
  app.get("/test-checkout", protect, (req, res) => {
    res.sendFile(path.join(__dirname, "test-checkout.html"));
  });
}

app.use("/api/auth", authRoutes);
app.use("/api/clinics", clinicRoutes);
app.use("/api/clinics/:clinicId/doctors", doctorRoutes);
app.use("/api/public/clinics", publicClinicRoutes);
app.use("/api/clinics/:clinicId/services",serviceRoutes);
app.use("/api/clinics/:clinicId/doctor-services",doctorServiceRoutes);
app.use("/api/clinics/:clinicId/schedules",  scheduleRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Clinic SaaS API is running",
  });
});


app.use((err, req, res, next) => {
  console.error("API ERROR:", err);

  const statusCode =
    Number.isInteger(err.statusCode) &&
    err.statusCode >= 400 &&
    err.statusCode <= 599
      ? err.statusCode
      : 500;

  const message =
    typeof err.message === "string"
      ? err.message
      : typeof err.error?.description === "string"
        ? err.error.description
        : "Internal server error";

  return res.status(statusCode).json({
    success: false,
    message: statusCode === 500
      ? "Internal server error"
      : message,
  });
});

app.listen(PORT, async () => {
    await connectDB();
  console.log(`Server running on port ${PORT}`);
});