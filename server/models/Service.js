
import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      immutable: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },

    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    strict: "throw",
  }
);

serviceSchema.index({
  clinicId: 1,
  isActive: 1,
  name: 1,
});

export default mongoose.model("Service", serviceSchema);
