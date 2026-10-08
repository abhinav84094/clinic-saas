import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendVerificationOtp = async (email, otp) => {
  const { data, error } = await resend.emails.send({
    from: "Clinic SaaS <onboarding@resend.dev>",
    to: email,
    subject: "Verify your email",
    html: `
      <h2>Email Verification</h2>

      <p>Your verification code is:</p>

      <h1>${otp}</h1>

      <p>This code will expire in 10 minutes.</p>

      <p>If you did not create this account, you can ignore this email.</p>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
};




export const sendPasswordResetOtp = async (email, otp) => {
  const { data, error } = await resend.emails.send({
    from: "Clinic SaaS <onboarding@resend.dev>",
    to: email,
    subject: "Reset your password",
    html: `
      <h2>Password Reset Request</h2>

      <p>We received a request to reset your password.</p>

      <p>Your password reset code is:</p>

      <h1>${otp}</h1>

      <p>This code will expire in 10 minutes.</p>

      <p>If you did not request a password reset,
      you can safely ignore this email.</p>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
};
