import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    qualifications: {
      type: [String],
      default: [],
    },

    specialization: {
      type: String,
      trim: true,
    },

    experienceYears: {
      type: Number,
      min: 0,
    },

    bio: {
      type: String,
      trim: true,
    },

    photoUrl: {
      type: String,
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

doctorSchema.index({ clinicId: 1 });

const Doctor = mongoose.model("Doctor", doctorSchema);

export default Doctor;
