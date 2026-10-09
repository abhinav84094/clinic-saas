
import mongoose from "mongoose";

import Clinic from "../models/Clinic.js";
import Doctor from "../models/Doctor.js";
import ClinicSubscription from "../models/ClinicSubscription.js";

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

export const getClinicPublishingReadiness = async (clinicId) => {
  if (!mongoose.isValidObjectId(clinicId)) {
    const error = new Error("Invalid clinic ID");
    error.statusCode = 400;
    throw error;
  }

  const clinic = await Clinic.findById(clinicId)
    .select("name slug contact address status activatedAt")
    .lean();

  if (!clinic || clinic.status === "archived") {
    const error = new Error("Clinic not found");
    error.statusCode = 404;
    throw error;
  }

  const [activeDoctorCount, subscription] = await Promise.all([
    Doctor.countDocuments({
      clinicId: clinic._id,
      isActive: true,
    }),
    ClinicSubscription.findOne({
      clinicId: clinic._id,
    }).lean(),
  ]);

  const missingRequirements = getMissingRequirements(
    clinic,
    activeDoctorCount
  );

  const hasActiveSubscription =
    subscription?.status === "active" &&
    subscription.currentPeriodStart instanceof Date &&
    subscription.currentPeriodStart <= new Date() &&
    subscription.currentPeriodEnd instanceof Date &&
    subscription.currentPeriodEnd > new Date();

  if (!hasActiveSubscription) {
    missingRequirements.push("active_subscription");
  }

  return {
    clinicId: clinic._id,
    status: clinic.status,
    ready: missingRequirements.length === 0,
    canPublish:
      clinic.status === "draft" &&
      missingRequirements.length === 0,
    missingRequirements,
    activeDoctorCount,
    subscriptionStatus: subscription?.status ?? "missing",
    activatedAt: clinic.activatedAt,
  };
};


export const publishClinic = async (clinicId) => {
  if (!mongoose.isObjectIdOrHexString(clinicId)) {
    const error = new Error("Invalid clinic ID");
    error.statusCode = 400;
    throw error;
  }

  return mongoose.connection.transaction(async (session) => {
    const clinic = await Clinic.findOneAndUpdate(
      {
        _id: clinicId,
        status: "draft",
      },
      {
        $inc: { __v: 1 },
      },
      {
        session,
        returnDocument: "after",
      }
    );

    if (!clinic) {
      const error = new Error(
        "Clinic not found or cannot be published"
      );
      error.statusCode = 409;
      throw error;
    }

    const subscription = await ClinicSubscription.findOne({
        clinicId,
        }).session(session);

        const now = new Date();

        if (
        !subscription ||
        subscription.status !== "active" ||
        !(subscription.currentPeriodStart instanceof Date) ||
        subscription.currentPeriodStart > now ||
        !(subscription.currentPeriodEnd instanceof Date) ||
        subscription.currentPeriodEnd <= now
        ) {
        const error = new Error(
            "An active subscription is required to publish the clinic"
        );
        error.statusCode = 403;
        throw error;
    }

    const activeDoctorCount =
      await Doctor.countDocuments({
        clinicId,
        isActive: true,
      }).session(session);

    const missingRequirements = getMissingRequirements(
      clinic,
      activeDoctorCount
    );

    if (missingRequirements.length > 0) {
      const error = new Error(
        "Clinic setup is incomplete"
      );
      error.statusCode = 422;
      error.missingRequirements = missingRequirements;
      throw error;
    }

    clinic.status = "active";
    clinic.activatedAt = new Date();

    await clinic.save({ session });

    return clinic;
  });
};

