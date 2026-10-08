
import jwt from "jsonwebtoken";

const generateToken = (userId , tokenVersion) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    { userId: userId.toString(), tokenVersion },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
      algorithm: "HS256",
    }
  );
};

export default generateToken;
