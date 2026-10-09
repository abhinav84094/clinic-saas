
import { Router } from "express";

import {
  getSlugAvailability,
  createClinicController,
  getMyClinics,
  getClinicProfile,
  updateClinicProfileController,
} from "../controllers/clinicController.js";

import { protect } from "../middleware/authMiddleware.js";
import { requireClinicAccess } from "../middleware/clinicAccessMiddleware.js";

import {
  getPublishingReadinessController,
  publishClinicController,
} from "../controllers/clinicPublishingController.js";

import {
  createPaymentOrder,
  verifyPaymentController,
  reconcilePaymentController,
} from "../controllers/subscriptionPaymentController.js";

import {
  getSubscriptionSetupController,
  updateBillingCycleController,
} from "../controllers/subscriptionSetupController.js";

import {
  getPendingPaymentController,
} from "../controllers/subscriptionRecoveryController.js";

const router = Router();

router.get(
  "/slug-availability",
  getSlugAvailability
);

router.post(
  "/",
  protect,
  createClinicController
);

router.get(
  "/my-clinics",
  protect,
  getMyClinics
);

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

router.get(
  "/:clinicId/subscription",
  protect,
  requireClinicAccess(["owner"]),
  getSubscriptionSetupController
);

router.patch(
  "/:clinicId/subscription/billing-cycle",
  protect,
  requireClinicAccess(["owner"]),
  updateBillingCycleController
);

router.get(
  "/:clinicId/subscription/pending-payment",
  protect,
  requireClinicAccess(["owner"]),
  getPendingPaymentController
);

router.post(
  "/:clinicId/subscription/payment-order",
  protect,
  requireClinicAccess(["owner"]),
  createPaymentOrder
);

router.post(
  "/:clinicId/subscription/verify-payment",
  protect,
  requireClinicAccess(["owner"]),
  verifyPaymentController
);

router.post(
  "/:clinicId/subscription/reconcile-payment",
  protect,
  requireClinicAccess(["owner"]),
  reconcilePaymentController
);

export default router;
