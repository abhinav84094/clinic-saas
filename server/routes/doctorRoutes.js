
import express from "express";

import { protect } from "../middleware/authMiddleware.js";
import {
  requireClinicAccess,
} from "../middleware/clinicAccessMiddleware.js";

import {
  createDoctorController,
  getClinicDoctorsController,
  getDoctorController,
  updateDoctorController,
  updateDoctorStatusController,
} from "../controllers/doctorController.js";

import {
  uploadSingleImage,
} from "../middleware/imageUploadMiddleware.js";

import {
  uploadDoctorPhotoController,
  deleteDoctorPhotoController,
} from "../controllers/doctorPhotoController.js";

const router = express.Router({
  mergeParams: true,
});

router.use(protect);

router.get(
  "/",
  requireClinicAccess(),
  getClinicDoctorsController
);

router.get(
  "/:doctorId",
  requireClinicAccess(),
  getDoctorController
);

router.post(
  "/",
  requireClinicAccess(["owner", "admin"]),
  createDoctorController
);

router.patch(
  "/:doctorId",
  requireClinicAccess(["owner", "admin"]),
  updateDoctorController
);

router.patch(
  "/:doctorId/status",
  requireClinicAccess(["owner", "admin"]),
  updateDoctorStatusController
);

router.post(
  "/:doctorId/photo",
  requireClinicAccess(["owner", "admin"]),
  uploadSingleImage,
  uploadDoctorPhotoController
);

router.delete(
  "/:doctorId/photo",
  requireClinicAccess(["owner", "admin"]),
  deleteDoctorPhotoController
);

export default router;
