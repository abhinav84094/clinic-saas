
import mongoose from "mongoose";

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const scheduleExceptionSchema = new mongoose.Schema(
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

    // Clinic-local calendar date (YYYY-MM-DD).
    date: {
      type: String,
      required: true,
      match: [
        DATE_REGEX,
        "date must be in YYYY-MM-DD format",
      ],
    },

    type: {
      type: String,
      enum: ["unavailable", "blocked", "override"],
      required: true,
    },

    // Required for blocked and override.
    // Must be absent for unavailable.
    startTime: {
      type: String,
      match: [
        TIME_REGEX,
        "startTime must be in HH:mm format",
      ],
    },

    endTime: {
      type: String,
      match: [
        TIME_REGEX,
        "endTime must be in HH:mm format",
      ],
    },

    reason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
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

scheduleExceptionSchema.pre("validate", function () {
  // Reject impossible calendar dates, e.g. 2026-02-30.
  if (this.date && DATE_REGEX.test(this.date)) {
    const parsed = new Date(`${this.date}T00:00:00.000Z`);

    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== this.date
    ) {
      this.invalidate("date", "Invalid calendar date");
    }
  }

  if (this.type === "unavailable") {
    if (this.startTime != null || this.endTime != null) {
      this.invalidate(
        "startTime",
        "Full-day unavailability cannot have time ranges"
      );
    }

    return;
  }

  if (this.type === "blocked" || this.type === "override") {
    if (!this.startTime || !this.endTime) {
      this.invalidate(
        "startTime",
        "Both startTime and endTime are required"
      );
      return;
    }

    if (
      TIME_REGEX.test(this.startTime) &&
      TIME_REGEX.test(this.endTime) &&
      this.startTime >= this.endTime
    ) {
      this.invalidate(
        "endTime",
        "endTime must be later than startTime"
      );
    }
  }
});

// Efficient doctor/date exception lookup.
scheduleExceptionSchema.index({
  clinicId: 1,
  doctorId: 1,
  date: 1,
  isActive: 1,
  type: 1,
});

// Prevent exact duplicate exceptions.
scheduleExceptionSchema.index(
  {
    clinicId: 1,
    doctorId: 1,
    date: 1,
    type: 1,
    startTime: 1,
    endTime: 1,
  },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  }
);

const ScheduleException = mongoose.model(
  "ScheduleException",
  scheduleExceptionSchema
);

export default ScheduleException;
