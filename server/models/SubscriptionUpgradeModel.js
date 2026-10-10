
import mongoose from "mongoose";

const { Schema } = mongoose;

const upgradePaymentSchema = new Schema(
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
    fromPlan: {
      type: String,
      required: true,
      immutable: true,
    },
    toPlan: {
      type: String,
      enum: ["starter", "growth", "unlimited"],
      required: true,
      immutable: true,
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "yearly"],
      required: true,
      immutable: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 100,
      immutable: true,
    },
    bookingLimit: {
      type: Number,
      default: null,
      min: 0,
      immutable: true,
    },
    currency: {
      type: String,
      enum: ["INR"],
      default: "INR",
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
      enum: ["created", "paid", "review_required"],
      default: "created",
      required: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    reviewReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    strict: "throw",
  }
);

upgradePaymentSchema.index(
  { clinicId: 1, status: 1, createdAt: -1 }
);

upgradePaymentSchema.index(
  { razorpayPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      razorpayPaymentId: { $type: "string" },
    },
  }
);

export default mongoose.model(
  "SubscriptionUpgradePayment",
  upgradePaymentSchema
);
