import mongoose from "mongoose";

const { Schema } = mongoose;

const clinicPaymentAccountSchema = new Schema(
  {
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      immutable: true,
      unique: true,
    },

    provider: {
      type: String,
      enum: ["razorpay"],
      default: "razorpay",
      required: true,
      immutable: true,
    },

    // Taken from the verified provider response.
    // Never accept merchant identity directly from the browser.
    merchantAccountId: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },

    mode: {
      type: String,
      enum: ["test", "live"],
      required: true,
      default: "test",
    },

    connectionStatus: {
      type: String,
      enum: ["not_connected", "connected", "disconnected"],
      required: true,
      default: "not_connected",
    },

    // Our normalized assessment of provider payment readiness.
    // OAuth authorization alone must not enable bookings.
    paymentReadiness: {
      type: String,
      enum: ["unknown", "enabled", "disabled"],
      required: true,
      default: "unknown",
    },

    // Your platform's approval, separate from provider verification.
    reviewStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      required: true,
      default: "pending",
    },

    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    reviewNote: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
      select: false,
    },

    connectedAt: {
      type: Date,
      default: null,
    },

    disconnectedAt: {
      type: Date,
      default: null,
    },

    // Latest successful provider readiness check.
    lastVerifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    strict: "throw",
  }
);

clinicPaymentAccountSchema.pre("validate", function () {
  if (
    this.connectionStatus === "connected" &&
    (!this.merchantAccountId || !this.connectedAt)
  ) {
    this.invalidate(
      "connectionStatus",
      "Connected accounts require merchant identity and connection time"
    );
  }

  if (
    this.paymentReadiness === "enabled" &&
    (
      this.connectionStatus !== "connected" ||
      !this.lastVerifiedAt
    )
  ) {
    this.invalidate(
      "paymentReadiness",
      "Payment readiness requires a connected, verified account"
    );
  }

  if (
    this.reviewStatus === "approved" &&
    (!this.reviewedBy || !this.reviewedAt)
  ) {
    this.invalidate(
      "reviewStatus",
      "Approval requires reviewer identity and review time"
    );
  }
});

// One merchant may operate multiple clinics.
clinicPaymentAccountSchema.index({
  provider: 1,
  merchantAccountId: 1,
});

export default mongoose.model(
  "ClinicPaymentAccount",
  clinicPaymentAccountSchema
);