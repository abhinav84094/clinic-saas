import User from "../models/User.js";
import { generateOtp, hashOtp,hashPasswordResetOtp } from "../utils/otp.js";
import { sendVerificationOtp, sendPasswordResetOtp } from "../services/emailService.js";
import generateToken from "../utils/generateToken.js";
import crypto from "crypto";

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



export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isPasswordCorrect = await user.comparePassword(password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in",
      });
    }

    const token = generateToken(user._id, user.tokenVersion);

    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while logging in",
    });
  }
};




export const logoutUser = (req, res) => {
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};


export const forgotPassword = async (req, res) => {
  const genericMessage =
    "If an account exists with this email, a password reset code will be sent.";

  try {
    const { email } = req.body ?? {};

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "A valid email is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(200).json({
        success: true,
        message: genericMessage,
      });
    }

    // Allow only one OTP request every 60 seconds.
    if (user.passwordResetLastSentAt) {
      const elapsedTime =
        Date.now() -
        user.passwordResetLastSentAt.getTime();

      if (elapsedTime < 60 * 1000) {
        return res.status(200).json({
          success: true,
          message: genericMessage,
        });
      }
    }

    const otp = generateOtp();

    const otpHash = hashPasswordResetOtp(
      otp,
      user._id
    );

    user.passwordResetOtpHash = otpHash;

    user.passwordResetExpiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );

    user.passwordResetLastSentAt = new Date();

    user.passwordResetAttempts = 0;

    await user.save();

    await sendPasswordResetOtp(user.email, otp);

    return res.status(200).json({
      success: true,
      message: genericMessage,
    });
  } catch (error) {
    console.error(
      "Forgot password error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Unable to process password reset request",
    });
  }
};



export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body ?? {};

    if (
      typeof email !== "string" ||
      typeof otp !== "string" ||
      typeof newPassword !== "string" ||
      !email.trim() ||
      !/^\d{6}$/.test(otp) ||
      newPassword.length < 8
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid email, 6-digit OTP, and password of at least 8 characters are required",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    });

    if (
      !user ||
      !user.passwordResetOtpHash ||
      !user.passwordResetExpiresAt
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset code",
      });
    }

    if (user.passwordResetExpiresAt <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset code",
      });
    }

    if (user.passwordResetAttempts >= 5) {
      return res.status(429).json({
        success: false,
        message: "Too many incorrect attempts. Request a new code.",
      });
    }

    const submittedHash = hashPasswordResetOtp(
      otp,
      user._id
    );

    const storedHash = Buffer.from(
      user.passwordResetOtpHash,
      "hex"
    );

    const receivedHash = Buffer.from(
      submittedHash,
      "hex"
    );

    const isValidOtp =
      storedHash.length === receivedHash.length &&
      crypto.timingSafeEqual(storedHash, receivedHash);

    if (!isValidOtp) {
      user.passwordResetAttempts += 1;
      await user.save();

      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset code",
      });
    }

    user.password = newPassword;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;

    user.passwordResetOtpHash = undefined;
    user.passwordResetExpiresAt = undefined;
    user.passwordResetLastSentAt = undefined;
    user.passwordResetAttempts = 0;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. Please log in.",
    });
  } catch (error) {
    console.error("Reset password error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to reset password",
    });
  }
};
