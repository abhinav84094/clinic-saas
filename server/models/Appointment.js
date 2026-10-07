import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
    },

    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },

    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },

    patientName: {
      type: String,
      required: true,
      trim: true,
    },

    patientPhone: {
      type: String,
      required: true,
      trim: true,
    },

    patientEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },

    startAt: {
      type: Date,
      required: true,
    },

    endAt: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: [
        "booked",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      default: "booked",
    },

    bookingNote: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

appointmentSchema.index({
  clinicId: 1,
  doctorId: 1,
  startAt: 1,
});

const Appointment = mongoose.model(
  "Appointment",
  appointmentSchema
);

export default Appointment;