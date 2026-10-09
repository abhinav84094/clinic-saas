
import mongoose from "mongoose";

const bookingHoldSchema = new mongoose.Schema(
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

    doctorServiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DoctorService",
      required: true,
      immutable: true,
    },

    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      immutable: true,
    },

    patientName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    patientPhone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },

    patientEmail: {
      type: String,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    bookingNote: {
        type: String,
        trim: true,
        maxlength: 500,
        default: "",
    },

    startAt: {
      type: Date,
      required: true,
    },

    endAt: {
      type: Date,
      required: true,
    },

    feeSnapshot: {
      type: Number,
      required: true,
      min: 0,
    },

    durationMinutesSnapshot: {
      type: Number,
      required: true,
      min: 5,
      max: 480,
    },

    status: {
      type: String,
      enum: [
        "held",
        "payment_pending",
        "confirmed",
        "expired",
        "cancelled",
      ],
      default: "held",
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    paymentOrderId: {
      type: String,
      trim: true,
    },

    paymentId: {
      type: String,
      trim: true,
    },

    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
    },
  },
  {
    timestamps: true,
    strict: "throw",
  }
);

// Find overlapping active holds efficiently.
bookingHoldSchema.index({
  clinicId: 1,
  doctorId: 1,
  status: 1,
  startAt: 1,
  endAt: 1,
  expiresAt: 1,
});

// Prevent associating one payment order with multiple holds.
bookingHoldSchema.index(
  { paymentOrderId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      paymentOrderId: { $type: "string" },
    },
  }
);

const BookingHold = mongoose.model(
  "BookingHold",
  bookingHoldSchema
);

export default BookingHold;
