
import express from "express";

import {getPublicClinicController, getPublicClinicServicesController} from "../controllers/publicClinicController.js";
import { getPublicAvailabilityController } from "../controllers/availabilityController.js";


const router = express.Router();

// Public clinic profile — no login required
router.get("/:slug",getPublicClinicController);

router.get("/:slug/services",  getPublicClinicServicesController);

router.get("/:slug/availability", getPublicAvailabilityController);

export default router;
