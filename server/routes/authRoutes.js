import express from "express";
import {
  registerUser,
  verifyEmail,
  resendVerificationOtp,
   loginUser,
    logoutUser,
    forgotPassword,
    resetPassword
} from "../controllers/authController.js";
import { protect, getMe } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification-otp",resendVerificationOtp);
router.post("/login", loginUser);
router.get("/me", protect, getMe);
router.post("/logout", logoutUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;