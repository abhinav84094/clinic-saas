import dotenv from "dotenv";
import { sendVerificationOtp } from "./services/emailService.js";

dotenv.config();

const testEmail = async () => {
  try {
    await sendVerificationOtp(
      "abhinav84094@gmail.com",
      "123456"
    );

    console.log("Test email sent successfully");
  } catch (error) {
    console.error("Test email failed:", error.message);
  }
};

testEmail();