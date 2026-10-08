
import express from "express";

import { protect } from "../middleware/authMiddleware.js";
import { requireClinicAccess } from "../middleware/clinicAccessMiddleware.js";

import {
  createDoctorController,
  getClinicDoctorsController,
  getDoctorController,
  updateDoctorController,
  updateDoctorStatusController,
} from "../controllers/doctorController.js";

const router = express.Router({
  mergeParams: true,
});

// All doctor routes require authentication.
router.use(protect);

// List doctors — all active clinic members.
router.get("/",requireClinicAccess(),  getClinicDoctorsController);

// Get a single doctor — all active clinic members.
router.get("/:doctorId", requireClinicAccess(), getDoctorController);

// Add doctor — owner/admin only.
router.post(
  "/",
  requireClinicAccess(["owner", "admin"]),
  createDoctorController
);

// Update doctor profile — owner/admin only.
router.patch(
  "/:doctorId",
  requireClinicAccess(["owner", "admin"]),
  updateDoctorController
);

// Activate/deactivate doctor — owner/admin only.
router.patch(
  "/:doctorId/status",
  requireClinicAccess(["owner", "admin"]),
  updateDoctorStatusController
);

export default router;
