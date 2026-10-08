import mongoose from "mongoose";
import bcrypt from "bcryptjs";


const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 8,
    },

    role: {
      type: String,
      enum: ["owner", "doctor", "staff"],
      default: "owner",
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationOtpHash: {
      type: String,
    },

    emailVerificationExpiresAt: {
      type: Date,
    },
    emailVerificationLastSentAt: {
      type: Date,
    },
    passwordResetOtpHash: {
      type: String,
    },

    passwordResetExpiresAt: {
      type: Date,
    },

    passwordResetLastSentAt: {
      type: Date,
    },

    passwordResetAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);


userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 12);
});


userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;