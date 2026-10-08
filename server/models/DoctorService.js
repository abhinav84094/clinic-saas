
import mongoose from "mongoose";

const doctorServiceSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      immutable: true,
    },

    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      immutable: true,
    },

    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      immutable: true,
    },

    fee: {
      type: Number,
      required: true,
      min: 0,
      max: 1000000,
      validate: {
        validator: Number.isFinite,
        message: "Fee must be a finite number",
      },
    },

    durationMinutes: {
      type: Number,
      required: true,
      min: 5,
      max: 480,
      validate: {
        validator: Number.isInteger,
        message: "Duration must be a whole number",
      },
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

// Prevent duplicate doctor-service combinations.
doctorServiceSchema.index(
  {
    clinicId: 1,
    doctorId: 1,
    serviceId: 1,
  },
  {
    unique: true,
  }
);

// Useful for fetching services offered by a doctor.
doctorServiceSchema.index({
  clinicId: 1,
  doctorId: 1,
  isActive: 1,
});

// Useful for fetching doctors offering a service.
doctorServiceSchema.index({
  clinicId: 1,
  serviceId: 1,
  isActive: 1,
});

export default mongoose.model(
  "DoctorService",
  doctorServiceSchema
);
