
import mongoose from "mongoose";

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const scheduleSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      immutable: true,
      index: true,
    },

    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      immutable: true,
    },

    dayOfWeek: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
      validate: {
        validator: Number.isInteger,
        message: "dayOfWeek must be an integer",
      },
    },

    startTime: {
      type: String,
      required: true,
      match: [
        TIME_REGEX,
        "startTime must be in HH:mm format",
      ],
    },

    endTime: {
      type: String,
      required: true,
      match: [
        TIME_REGEX,
        "endTime must be in HH:mm format",
      ],
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

// End time must be after start time.
scheduleSchema.pre("validate", function () {
  if (
    this.startTime &&
    this.endTime &&
    TIME_REGEX.test(this.startTime) &&
    TIME_REGEX.test(this.endTime) &&
    this.startTime >= this.endTime
  ) {
    this.invalidate(
      "endTime",
      "endTime must be later than startTime"
    );
  }
});

// Efficient doctor/day schedule lookup.
scheduleSchema.index({
  clinicId: 1,
  doctorId: 1,
  dayOfWeek: 1,
  isActive: 1,
  startTime: 1,
});

// Prevent identical shift entries.
scheduleSchema.index(
  {
    clinicId: 1,
    doctorId: 1,
    dayOfWeek: 1,
    startTime: 1,
    endTime: 1,
  },
  {
    unique: true,
  }
);

const Schedule = mongoose.model("Schedule", scheduleSchema);

export default Schedule;
