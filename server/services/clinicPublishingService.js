
import mongoose from "mongoose";

import Clinic from "../models/Clinic.js";
import Doctor from "../models/Doctor.js";

const hasText = (value) =>
  typeof value === "string" && value.trim().length > 0;

const getMissingRequirements = (clinic, doctorCount) => {
  const missing = [];

  if (!hasText(clinic.name)) {
    missing.push("clinic_name");
  }

  if (!hasText(clinic.slug)) {
    missing.push("clinic_slug");
  }

  if (!hasText(clinic.contact?.phone)) {
    missing.push("contact_phone");
  }

  if (!hasText(clinic.address?.city)) {
    missing.push("address_city");
  }

  if (!hasText(clinic.address?.state)) {
    missing.push("address_state");
  }

  if (doctorCount < 1) {
    missing.push("active_doctor");
  }

  return missing;
};

export const getClinicPublishingReadiness = async (
  clinicId
) => {
  const clinic = await Clinic.findById(clinicId)
    .select(
      "name slug contact address status activatedAt"
    )
    .lean();

  if (!clinic || clinic.status === "archived") {
    const error = new Error("Clinic not found");
    error.statusCode = 404;
    throw error;
  }

  const activeDoctorCount = await Doctor.countDocuments({
    clinicId: clinic._id,
    isActive: true,
  });

  const missingRequirements = getMissingRequirements(
    clinic,
    activeDoctorCount
  );

  return {
    clinicId: clinic._id,
    status: clinic.status,
    ready: missingRequirements.length === 0,
    canPublish: clinic.status === "draft" &&missingRequirements.length === 0,
    missingRequirements,
    activeDoctorCount,
    activatedAt: clinic.activatedAt,
  };
};

export const publishClinic = async (clinicId) => {
  if (!mongoose.isObjectIdOrHexString(clinicId)) {
    const error = new Error("Invalid clinic ID");
    error.statusCode = 400;
    throw error;
  }

  const readiness =
    await getClinicPublishingReadiness(clinicId);

  if (readiness.status !== "draft") {
    const error = new Error(
      "Only draft clinics can be published"
    );
    error.statusCode = 409;
    throw error;
  }

  if (!readiness.ready) {
    const error = new Error(
      "Clinic setup is incomplete"
    );

    error.statusCode = 422;
    error.missingRequirements =
      readiness.missingRequirements;

    throw error;
  }

  const clinic = await Clinic.findOneAndUpdate(
    {
      _id: clinicId,
      status: "draft",
    },
    {
      $set: {
        status: "active",
        activatedAt: new Date(),
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  if (!clinic) {
    const error = new Error(
      "Clinic publishing state has changed"
    );
    error.statusCode = 409;
    throw error;
  }

  return clinic;
};
