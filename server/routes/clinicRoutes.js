import { Router } from "express";
import { getSlugAvailability, createClinicController, getMyClinics, getClinicProfile,
    updateClinicProfileController
} from "../controllers/clinicController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireClinicAccess } from "../middleware/clinicAccessMiddleware.js";

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

export default router;