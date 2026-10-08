
import mongoose from "mongoose";

const { Schema } = mongoose;

const contactSchema = new Schema(
  {
    phone: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    whatsapp: {
      type: String,
      trim: true,
      maxlength: 20,
    },
  },
  { _id: false }
);

const addressSchema = new Schema(
  {
    line1: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    line2: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    city: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    state: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    country: {
      type: String,
      trim: true,
      default: "India",
    },
    postalCode: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    landmark: {
      type: String,
      trim: true,
      maxlength: 200,
    },
  },
  { _id: false }
);

const brandingSchema = new Schema(
  {
    logoUrl: {
      type: String,
      trim: true,
    },
    primaryColor: {
      type: String,
      default: "#2563EB",
      match: /^#[0-9A-Fa-f]{6}$/,
    },
  },
  { _id: false }
);

const bookingSettingsSchema = new Schema(
  {
    onlineBookingEnabled: {
      type: Boolean,
      default: false,
    },
    minimumNoticeMinutes: {
      type: Number,
      default: 60,
      min: 0,
      max: 10080,
    },
    bookingWindowDays: {
      type: Number,
      default: 30,
      min: 1,
      max: 365,
    },
  },
  { _id: false }
);

const clinicSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 150,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    contact: {
      type: contactSchema,
      default: () => ({}),
    },

    address: {
      type: addressSchema,
      default: () => ({}),
    },

    branding: {
      type: brandingSchema,
      default: () => ({}),
    },

    bookingSettings: {
      type: bookingSettingsSchema,
      default: () => ({}),
    },

    timezone: {
      type: String,
      trim: true,
      default: "Asia/Kolkata",
    },

    status: {
      type: String,
      enum: ["draft", "active", "suspended", "archived"],
      default: "draft",
    },

    activatedAt: {
      type: Date,
      default: null,
    },

    archivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    strict: "throw",
  }
);

clinicSchema.index({ createdBy: 1, createdAt: -1 });
clinicSchema.index({ status: 1 });

const Clinic = mongoose.model("Clinic", clinicSchema);

export default Clinic;
