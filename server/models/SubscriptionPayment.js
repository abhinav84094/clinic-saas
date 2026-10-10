
import mongoose from "mongoose";

const { Schema } = mongoose;

const subscriptionPaymentSchema = new Schema(
  {
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      immutable: true,
    },

    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "ClinicSubscription",
      required: true,
      immutable: true,
    },

    plan: {
      type: String,
      enum: ["basic", "starter", "growth", "unlimited"],
      required: true,
      immutable: true,
    },

    billingCycle: {
      type: String,
      enum: ["monthly", "yearly"],
      required: true,
      immutable: true,
    },

    // Amount stored in paise, not rupees.
    amount: {
      type: Number,
      required: true,
      min: 0,
      immutable: true,
    },

    currency: {
      type: String,
      required: true,
      enum: ["INR"],
      immutable: true,
    },

    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },

    razorpayPaymentId: {
      type: String,
      default: null,
    },

    
    status: {
      type: String,
      enum: [
        "created",
        "paid",
        "failed",
        "refunded",
        "abandoned",
        "superseded",
        "review_required",
      ],
      default: "created",
      required: true,
    },

    reviewRequiredAt: {
      type: Date,
      default: null,
    },

    reviewReason: {
      type: String,
      default: null,
    },

    supersededAt: {
      type: Date,
      default: null,
    },

    purpose: {
      type: String,
      enum: ["registration", "upgrade", "renewal"],
      default: "registration",
      required: true,
      immutable: true,
    },

    fromPlan: {
      type: String,
      enum: ["basic", "starter", "growth", "unlimited"],
      default: null,
      immutable: true,
    },

    bookingLimitSnapshot: {
      type: Number,
      default: null,
      min: 0,
      immutable: true,
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    abandonedAt: {
      type: Date,
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    refundedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    strict: "throw",
  }
);

subscriptionPaymentSchema.index({
  clinicId: 1,
  createdAt: -1,
});

subscriptionPaymentSchema.index({
  subscriptionId: 1,
  status: 1,
});

// Prevent the same Razorpay payment from being
// attached to multiple subscription records.
subscriptionPaymentSchema.index(
  { razorpayPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      razorpayPaymentId: { $type: "string" },
    },
  }
);

const SubscriptionPayment = mongoose.model(
  "SubscriptionPayment",
  subscriptionPaymentSchema
);

export default SubscriptionPayment;
