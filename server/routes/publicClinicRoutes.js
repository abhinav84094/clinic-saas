
import express from "express";

import {
  getPublicClinicController, getPublicClinicServicesController
} from "../controllers/publicClinicController.js";

const router = express.Router();

// Public clinic profile — no login required
router.get("/:slug",getPublicClinicController);

router.get("/:slug/services",  getPublicClinicServicesController);

export default router;
