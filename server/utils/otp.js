import crypto from "crypto";

export const generateOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

export const hashOtp = (otp) => {
  return crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");
};




export const hashPasswordResetOtp = (otp, userId) => {
  const secret = process.env.OTP_HASH_SECRET;

  if (!secret) {
    throw new Error("OTP_HASH_SECRET is not configured");
  }

  return crypto
    .createHmac("sha256", secret)
    .update(`${userId.toString()}:${otp}`)
    .digest("hex");
};
