
import express from "express";

import { protect } from "../middleware/authMiddleware.js";
import { requireClinicAccess } from "../middleware/clinicAccessMiddleware.js";

import {
  createServiceController,
  getClinicServicesController,
  getServiceByIdController,
  updateServiceController,
  updateServiceStatusController,
} from "../controllers/serviceController.js";

const router = express.Router({ mergeParams: true });

router.use(protect);

// Get all services
router.get(
  "/",
  requireClinicAccess(),
  getClinicServicesController
);

// Create a service
router.post(
  "/",
  requireClinicAccess(["owner", "admin"]),
  createServiceController
);

// Get a specific service
router.get(
  "/:serviceId",
  requireClinicAccess(),
  getServiceByIdController
);

// Update service information
router.patch(
  "/:serviceId",
  requireClinicAccess(["owner", "admin"]),
  updateServiceController
);

// Activate or deactivate a service
router.patch(
  "/:serviceId/status",
  requireClinicAccess(["owner", "admin"]),
  updateServiceStatusController
);

export default router;
