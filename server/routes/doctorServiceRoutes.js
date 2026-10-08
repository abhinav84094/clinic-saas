
import express from "express";

import { protect } from "../middleware/authMiddleware.js";
import { requireClinicAccess } from "../middleware/clinicAccessMiddleware.js";

import {
  createDoctorServiceController,
  getClinicDoctorServicesController,
  getDoctorServiceByIdController,
  updateDoctorServiceController,
  updateDoctorServiceStatusController,
} from "../controllers/doctorServiceController.js";

const router = express.Router({ mergeParams: true });

router.use(protect);

// List doctor-service offerings
router.get(
  "/",
  requireClinicAccess(),
  getClinicDoctorServicesController
);

// Assign a service to a doctor
router.post(
  "/",
  requireClinicAccess(["owner", "admin"]),
  createDoctorServiceController
);

// Get a particular offering
router.get(
  "/:doctorServiceId",
  requireClinicAccess(),
  getDoctorServiceByIdController
);

// Update fee or duration
router.patch(
  "/:doctorServiceId",
  requireClinicAccess(["owner", "admin"]),
  updateDoctorServiceController
);

// Activate or deactivate offering
router.patch(
  "/:doctorServiceId/status",
  requireClinicAccess(["owner", "admin"]),
  updateDoctorServiceStatusController
);

export default router;
