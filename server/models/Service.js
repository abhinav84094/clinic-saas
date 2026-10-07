import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    fee: {
      type: Number,
      min: 0,
    },

    durationMinutes: {
      type: Number,
      min: 1,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

serviceSchema.index({ clinicId: 1 });

const Service = mongoose.model("Service", serviceSchema);

export default Service;