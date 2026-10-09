
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);

const verifyGoogleToken = async (credential) => {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (
    !payload?.sub ||
    !payload?.email ||
    payload.email_verified !== true
  ) {
    throw new Error("Invalid Google account");
  }

  return {
    googleId: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name: payload.name?.trim() || "Google User",
  };
};

const issueLogin = (res, user) => {
  const token = generateToken(
    user._id,
    user.tokenVersion
  );

  res.cookie("accessToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });

  return res.status(200).json({
    success: true,
    requiresPassword: false,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
    },
  });
};

export const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body ?? {};

    if (typeof credential !== "string" || !credential) {
      return res.status(400).json({
        success: false,
        message: "Google credential is required",
      });
    }

    const googleUser = await verifyGoogleToken(credential);

    const user = await User.findOne({
      googleId: googleUser.googleId,
    });

    if (user) {
      if (!user.emailVerified) {
        return res.status(403).json({
          success: false,
          message: "Account verification required",
        });
      }

      return issueLogin(res, user);
    }

    const existingEmailUser = await User.findOne({
      email: googleUser.email,
    });

    if (existingEmailUser) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists. Please sign in using your password.",
      });
    }

    return res.status(200).json({
      success: true,
      requiresPassword: true,
      message: "Set a password to complete signup",
      name: googleUser.name,
      email: googleUser.email,
    });
  } catch (error) {
    console.error("Google login error:", error.message);

    return res.status(401).json({
      success: false,
      message: "Google authentication failed",
    });
  }
};

export const completeGoogleSignup = async (req, res) => {
  try {
    const { credential, password, confirmPassword } =
      req.body ?? {};

    if (
      typeof credential !== "string" ||
      typeof password !== "string" ||
      password.length < 8 ||
      password !== confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid Google credential and matching passwords of at least 8 characters are required",
      });
    }

    const googleUser = await verifyGoogleToken(credential);

    const existingUser = await User.findOne({
      $or: [
        { email: googleUser.email },
        { googleId: googleUser.googleId },
      ],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Account already exists. Please log in.",
      });
    }

    const user = await User.create({
      name: googleUser.name,
      email: googleUser.email,
      googleId: googleUser.googleId,
      password,
      emailVerified: true,
      role: "owner",
    });

    return issueLogin(res, user);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Account already exists",
      });
    }

    console.error("Complete Google signup error:", error.message);

    return res.status(400).json({
      success: false,
      message: "Unable to complete Google signup",
    });
  }
};
