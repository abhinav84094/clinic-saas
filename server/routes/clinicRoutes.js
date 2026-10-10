
import { Router } from "express";

import {
  getSlugAvailability,
  createClinicController,
  getMyClinics,
  getClinicProfile,
  updateClinicProfileController,
} from "../controllers/clinicController.js";

import { protect } from "../middleware/authMiddleware.js";

import {
  requireClinicAccess,
} from "../middleware/clinicAccessMiddleware.js";

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

import {
  getClinicDashboardController,
} from "../controllers/dashboardController.js";

const router = Router();

// Clinic slug availability
router.get(
  "/slug-availability",
  getSlugAvailability
);

// Create clinic
router.post(
  "/",
  protect,
  createClinicController
);

// Current user's clinics
router.get(
  "/my-clinics",
  protect,
  getMyClinics
);

// Clinic profile
router.get(
  "/:clinicId",
  protect,
  requireClinicAccess(),
  getClinicProfile
);

// Dashboard statistics and upcoming appointments
router.get(
  "/:clinicId/dashboard",
  protect,
  requireClinicAccess(),
  getClinicDashboardController
);

// Update clinic
router.patch(
  "/:clinicId",
  protect,
  requireClinicAccess(["owner", "admin"]),
  updateClinicProfileController
);

// Publishing readiness
router.get(
  "/:clinicId/publishing-readiness",
  protect,
  requireClinicAccess(["owner", "admin"]),
  getPublishingReadinessController
);

// Publish clinic
router.post(
  "/:clinicId/publish",
  protect,
  requireClinicAccess(["owner"]),
  publishClinicController
);

// Subscription setup
router.get(
  "/:clinicId/subscription",
  protect,
  requireClinicAccess(["owner"]),
  getSubscriptionSetupController
);

// Update billing cycle
router.patch(
  "/:clinicId/subscription/billing-cycle",
  protect,
  requireClinicAccess(["owner"]),
  updateBillingCycleController
);

// Pending subscription payment
router.get(
  "/:clinicId/subscription/pending-payment",
  protect,
  requireClinicAccess(["owner"]),
  getPendingPaymentController
);

// Create Razorpay payment order
router.post(
  "/:clinicId/subscription/payment-order",
  protect,
  requireClinicAccess(["owner"]),
  createPaymentOrder
);

// Verify payment
router.post(
  "/:clinicId/subscription/verify-payment",
  protect,
  requireClinicAccess(["owner"]),
  verifyPaymentController
);

// Reconcile payment
router.post(
  "/:clinicId/subscription/reconcile-payment",
  protect,
  requireClinicAccess(["owner"]),
  reconcilePaymentController
);

export default router;
