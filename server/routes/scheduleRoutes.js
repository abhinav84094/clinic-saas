import express from "express";

import { protect } from "../middleware/authMiddleware.js";
import { requireClinicAccess } from "../middleware/clinicAccessMiddleware.js";

import {
  getDoctorSchedulesController,
  getScheduleByIdController,
  createDoctorScheduleController,
  updateDoctorScheduleController,
  updateScheduleStatusController,
} from "../controllers/scheduleController.js";

const router = express.Router({ mergeParams: true });

// Authentication + clinic membership check
router.use(protect);
router.use(requireClinicAccess());

// Read schedules
router.get("/", getDoctorSchedulesController);
router.get("/:scheduleId", getScheduleByIdController);

// Only owner/admin can modify schedules
router.post(
  "/",
  requireClinicAccess(["owner", "admin"]),
  createDoctorScheduleController
);

router.patch(
  "/:scheduleId",
  requireClinicAccess(["owner", "admin"]),
  updateDoctorScheduleController
);

router.patch(
  "/:scheduleId/status",
  requireClinicAccess(["owner", "admin"]),
  updateScheduleStatusController
);

export default router;