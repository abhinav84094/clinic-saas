
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);

// Verify Google's ID token on the backend.
const verifyGoogleToken = async (credential) => {
  if (typeof credential !== "string" || !credential.trim()) {
    throw new Error("Google credential is required");
  }

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

  const email = payload.email.trim().toLowerCase();
  const domain = email.split("@")[1];

  // Google is authoritative for Gmail accounts and
  // Google Workspace accounts belonging to their hd domain.
  const emailIsAuthoritative =
    domain === "gmail.com" ||
    domain === "googlemail.com" ||
    (
      typeof payload.hd === "string" &&
      payload.hd.toLowerCase() === domain
    );

  return {
    googleId: payload.sub,
    email,
    name: payload.name?.trim() || "Google User",
    emailIsAuthoritative,
  };
};

// Same cookie and user response as existing Google login.
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

// POST /api/auth/google
export const googleLogin = async (req, res) => {
  try {
    const googleUser = await verifyGoogleToken(
      req.body?.credential
    );

    // Case 1: Google ID is already linked.
    const linkedUser = await User.findOne({
      googleId: googleUser.googleId,
    });

    if (linkedUser) {
      if (linkedUser.email !== googleUser.email) {
        return res.status(403).json({
          success: false,
          message: "Google account email mismatch",
        });
      }

      if (!linkedUser.emailVerified) {
        return res.status(403).json({
          success: false,
          message: "Please verify your account email first",
        });
      }

      return issueLogin(res, linkedUser);
    }

    // Case 2: User registered earlier using email/password.
    const existingUser = await User.findOne({
      email: googleUser.email,
    });

    if (existingUser) {
      // Do not overwrite an account linked to another Google ID.
      if (existingUser.googleId) {
        return res.status(409).json({
          success: false,
          message: "This email is linked to another Google account",
        });
      }

      // A verified Google email alone is not sufficient
      // proof for arbitrary third-party email domains.
      if (!googleUser.emailIsAuthoritative) {
        return res.status(403).json({
          success: false,
          message:
            "For this email provider, please sign in with your existing password.",
        });
      }

      if (!existingUser.emailVerified) {
        return res.status(403).json({
          success: false,
          message: "Please verify your account email first",
        });
      }

      // Existing account, existing role, existing data.
      // No new account and no additional password screen.
      return issueLogin(res, existingUser);
    }

    // Case 3: New Google user.
    // Frontend opens the registration/password setup page.
    return res.status(200).json({
      success: true,
      requiresPassword: true,
      message: "Set a password to complete registration",
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

// POST /api/auth/google/complete-signup
export const completeGoogleSignup = async (req, res) => {
  try {
    const {
      credential,
      password,
      confirmPassword,
    } = req.body ?? {};

    if (
      typeof password !== "string" ||
      password.length < 8 ||
      password !== confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Matching passwords of at least 8 characters are required",
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
        message: "Account already exists. Please sign in.",
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

    console.error("Google signup error:", error.message);

    return res.status(400).json({
      success: false,
      message: "Unable to complete Google signup",
    });
  }
};
