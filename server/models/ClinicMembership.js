
import mongoose from "mongoose";

const { Schema } = mongoose;

const clinicMembershipSchema = new Schema(
  {
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      immutable: true,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    role: {
      type: String,
      enum: ["owner", "admin", "doctor", "staff"],
      required: true,
    },

    status: {
      type: String,
      enum: ["invited", "active", "suspended", "removed"],
      default: "active",
    },

    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    joinedAt: {
      type: Date,
      default: null,
    },

    removedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    strict: "throw",
  }
);

clinicMembershipSchema.index(
  { clinicId: 1, userId: 1 },
  { unique: true }
);

clinicMembershipSchema.index({
  userId: 1,
  status: 1,
});

clinicMembershipSchema.index({
  clinicId: 1,
  status: 1,
  role: 1,
});

const ClinicMembership = mongoose.model(
  "ClinicMembership",
  clinicMembershipSchema
);

export default ClinicMembership;
