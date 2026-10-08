
import express from "express";

import {
  getPublicClinicController,
} from "../controllers/publicClinicController.js";

const router = express.Router();

// Public clinic profile — no login required
router.get("/:slug",getPublicClinicController);

export default router;
