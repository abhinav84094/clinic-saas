
import mongoose from "mongoose";

import Clinic from "../models/Clinic.js";
import Doctor from "../models/Doctor.js";

const createServiceError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const validateDoctorId = (doctorId) => {
  if (!mongoose.isObjectIdOrHexString(doctorId)) {
    throw createServiceError("Invalid doctor ID", 400);
  }
};

export const createDoctor = async ( clinicId, doctorData) => {
  const doctor = await Doctor.create({
    ...doctorData,
    clinicId,
    isActive: true,
  });

  return doctor;
};

export const getClinicDoctors = async (clinicId,{ includeInactive = false } = {}) => {
  const filter = { clinicId };

  if (!includeInactive) {
    filter.isActive = true;
  }

  return Doctor.find(filter)
    .sort({ createdAt: -1 })
    .lean();
};

export const getDoctorById = async (clinicId,doctorId) => {
  validateDoctorId(doctorId);

  const doctor = await Doctor.findOne({_id: doctorId,clinicId,}).lean();

  if (!doctor) {
    throw createServiceError("Doctor not found", 404);
  }

  return doctor;
};

export const updateDoctor = async (clinicId,doctorId,doctorData) => {
  validateDoctorId(doctorId);

  const doctor = await Doctor.findOneAndUpdate(
    {
      _id: doctorId,
      clinicId,
    },
    {
      $set: doctorData,
    },
    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  if (!doctor) {
    throw createServiceError("Doctor not found", 404);
  }

  return doctor;
};

export const updateDoctorStatus = async (clinicId,doctorId,isActive) => {
  validateDoctorId(doctorId);

  if (typeof isActive !== "boolean") {
    throw createServiceError(
      "isActive must be a boolean",
      400
    );
  }

  return mongoose.connection.transaction(async (session) => {
    const clinic = await Clinic.findOneAndUpdate(
        {
            _id: clinicId,
            status: { $nin: ["archived", "suspended"] },
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
      throw createServiceError("Clinic not found", 404);
    }

    const doctor = await Doctor.findOne({
      _id: doctorId,
      clinicId,
    }).session(session);

    if (!doctor) {
      throw createServiceError("Doctor not found", 404);
    }

    if (doctor.isActive === isActive) {
      return doctor;
    }

    if (
      clinic.status === "active" &&
      doctor.isActive &&
      !isActive
    ) {
      const activeDoctorCount =
        await Doctor.countDocuments({
          clinicId,
          isActive: true,
        }).session(session);

      if (activeDoctorCount <= 1) {
        throw createServiceError(
          "Cannot deactivate the last active doctor of a published clinic",
          409
        );
      }
    }

    doctor.isActive = isActive;
    await doctor.save({ session });

    return doctor;
  });
};
