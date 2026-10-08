import { Router } from "express";
import { getSlugAvailability, createClinicController, getMyClinics, getClinicProfile,
    updateClinicProfileController
} from "../controllers/clinicController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireClinicAccess } from "../middleware/clinicAccessMiddleware.js";
import {
  getPublishingReadinessController,
  publishClinicController,
} from "../controllers/clinicPublishingController.js";

const router = Router();

router.get("/slug-availability", getSlugAvailability);
router.post("/", protect, createClinicController);
router.get("/my-clinics", protect, getMyClinics);

router.get(
  "/:clinicId",
  protect,
  requireClinicAccess(),
  getClinicProfile
);

router.patch(
  "/:clinicId",
  protect,
  requireClinicAccess(["owner", "admin"]),
  updateClinicProfileController
);


router.get(
  "/:clinicId/publishing-readiness",
  protect,
  requireClinicAccess(["owner", "admin"]),
  getPublishingReadinessController
);

router.post(
  "/:clinicId/publish",
  protect,
  requireClinicAccess(["owner"]),
  publishClinicController
);


export default router;