
import mongoose from "mongoose";
import Clinic from "../models/Clinic.js";
import ClinicMembership from "../models/ClinicMembership.js";

const VALID_ROLES = new Set([
  "owner",
  "admin",
  "doctor",
  "staff",
]);

export const requireClinicAccess = (allowedRoles = []) => {
  if (
    !Array.isArray(allowedRoles) ||
    allowedRoles.some((role) => !VALID_ROLES.has(role))
  ) {
    throw new Error("Invalid clinic authorization configuration");
  }

  return async (req, res, next) => {
    try {
      const { clinicId } = req.params;

      if (!req.user?._id) {
        return res.status(401).json({
          message: "Authentication required",
        });
      }

      if (
        !clinicId ||
        !mongoose.isObjectIdOrHexString(clinicId)
      ) {
        return res.status(400).json({
          message: "Invalid clinic ID",
        });
      }

      const membership = await ClinicMembership.findOne({
        clinicId,
        userId: req.user._id,
        status: "active",
      }).lean();

      if (!membership) {
        return res.status(404).json({
          message: "Clinic not found",
        });
      }

      if (
        allowedRoles.length > 0 &&
        !allowedRoles.includes(membership.role)
      ) {
        return res.status(403).json({
          message: "You do not have permission for this action",
        });
      }

      const clinic = await Clinic.findById(clinicId);

      if (!clinic || clinic.status === "archived") {
        return res.status(404).json({
          message: "Clinic not found",
        });
      }

      if (clinic.status === "suspended") {
        return res.status(403).json({
          message: "Clinic access is suspended",
        });
      }

      req.clinic = clinic;
      req.clinicMembership = membership;

      return next();
    } catch (error) {
      return next(error);
    }
  };
};
