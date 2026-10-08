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

const app = express();

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/clinics", clinicRoutes);
app.use("/api/clinics/:clinicId/doctors", doctorRoutes);
app.use("/api/public/clinics", publicClinicRoutes);
app.use("/api/clinics/:clinicId/services",serviceRoutes);
app.use("/api/clinics/:clinicId/doctor-services",doctorServiceRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Clinic SaaS API is running",
  });
});




app.listen(PORT, async () => {
    await connectDB();
  console.log(`Server running on port ${PORT}`);
});