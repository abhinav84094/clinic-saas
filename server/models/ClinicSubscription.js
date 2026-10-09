
import mongoose from "mongoose";

const { Schema } = mongoose;

const clinicSubscriptionSchema = new Schema(
  {
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      unique: true,
      immutable: true,
    },

    plan: {
      type: String,
      enum: ["basic", "starter", "growth", "unlimited"],
      default: "basic",
      required: true,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "trialing",
        "active",
        "past_due",
        "cancelled",
        "expired",
      ],
      default: "pending",
      required: true,
    },

    billingCycle: {
      type: String,
      enum: ["monthly", "yearly"],
      default: "monthly",
      required: true,
    },

    currentPeriodStart: {
      type: Date,
      default: null,
    },

    currentPeriodEnd: {
      type: Date,
      default: null,
    },

    bookingLimit: {
      type: Number,
      default: 0,
      min: 0,
    },

    bookingsUsed: {
      type: Number,
      default: 0,
      min: 0,
    },

    priceSnapshot: {
      type: Number,
      required: true,
      min: 0,
    },

    // Prevent concurrent order creation and billing updates.
    // An uncertain Razorpay operation must be reviewed before unlocking.
    paymentOrderLock: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    strict: "throw",
  }
);

clinicSubscriptionSchema.pre("validate", function () {
  const hasStart = this.currentPeriodStart != null;
  const hasEnd = this.currentPeriodEnd != null;

  if (hasStart !== hasEnd) {
    this.invalidate(
      "currentPeriodEnd",
      "Both subscription period dates must be provided together"
    );
    return;
  }

  if (hasStart && this.currentPeriodEnd <= this.currentPeriodStart) {
    this.invalidate(
      "currentPeriodEnd",
      "Subscription end must be after start"
    );
  }

  if (["active", "trialing"].includes(this.status) && !hasStart) {
    this.invalidate(
      "currentPeriodStart",
      "Active subscriptions require a valid billing period"
    );
  }
});

clinicSubscriptionSchema.index({
  status: 1,
  currentPeriodEnd: 1,
});

const ClinicSubscription = mongoose.model(
  "ClinicSubscription",
  clinicSubscriptionSchema
);

export default ClinicSubscription;
