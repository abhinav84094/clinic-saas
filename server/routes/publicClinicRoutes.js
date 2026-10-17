
import express from "express";
import { apiLimiters } from "../middleware/rateLimitMiddleware.js";

import {getPublicClinicController, getPublicClinicServicesController} from "../controllers/publicClinicController.js";
import { getPublicAvailabilityController } from "../controllers/availabilityController.js";


const router = express.Router();

// Public clinic profile — no login required
router.get("/:slug", apiLimiters.publicClinic, getPublicClinicController);

router.get("/:slug/services", apiLimiters.publicServices, getPublicClinicServicesController);

router.get("/:slug/availability", apiLimiters.publicAvailability, getPublicAvailabilityController);

export default router;
