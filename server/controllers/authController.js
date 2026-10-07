import User from "../models/User.js";
import { generateOtp, hashOtp } from "../utils/otp.js";
import { sendVerificationOtp } from "../services/emailService.js";

export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase(),
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    const otp = generateOtp();

    const otpHash = hashOtp(otp);

    const otpExpiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );

    const user = await User.create({
      name,
      email,
      password,
      emailVerificationOtpHash: otpHash,
      emailVerificationExpiresAt: otpExpiresAt,
      emailVerificationLastSentAt: new Date(),
    });

    await sendVerificationOtp(user.email, otp);

    return res.status(201).json({
      success: true,
      message:
        "Registration successful. Please verify your email using the OTP sent to you.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    console.error("Register user error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while registering user",
    });
  }
};



export const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification request",
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
    }

    if (
      !user.emailVerificationOtpHash ||
      !user.emailVerificationExpiresAt
    ) {
      return res.status(400).json({
        success: false,
        message: "No active verification OTP found",
      });
    }

    if (user.emailVerificationExpiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired",
      });
    }

    const enteredOtpHash = hashOtp(otp);

    if (enteredOtpHash !== user.emailVerificationOtpHash) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    user.emailVerified = true;
    user.emailVerificationOtpHash = undefined;
    user.emailVerificationExpiresAt = undefined;
    user.emailVerificationLastSentAt = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Verify email error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while verifying email",
    });
  }
};




export const resendVerificationOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
    });

    if (!user) {
      return res.status(200).json({
        success: true,
        message:
          "If an account exists with this email, a verification OTP has been sent.",
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
    }

    const cooldown = 60 * 1000;

    if (
      user.emailVerificationLastSentAt &&
      Date.now() -
        user.emailVerificationLastSentAt.getTime() <
        cooldown
    ) {
      return res.status(429).json({
        success: false,
        message:
          "Please wait before requesting another OTP",
      });
    }

    const otp = generateOtp();

    user.emailVerificationOtpHash = hashOtp(otp);

    user.emailVerificationExpiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );

    user.emailVerificationLastSentAt = new Date();

    await user.save();

    await sendVerificationOtp(user.email, otp);

    return res.status(200).json({
      success: true,
      message: "A new verification OTP has been sent",
    });
  } catch (error) {
    console.error("Resend verification OTP error:", error);

    return res.status(500).json({
      success: false,
      message:
        "Server error while resending verification OTP",
    });
  }
};