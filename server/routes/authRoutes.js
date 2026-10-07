import express from "express";
import {
  registerUser,
  verifyEmail,
  resendVerificationOtp,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification-otp",resendVerificationOtp);

export default router;