
import mongoose from "mongoose";
import Doctor from "../models/Doctor.js";
import Service from "../models/Service.js";
import DoctorService from "../models/DoctorService.js";

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const validateId = (id, fieldName) => {
  if (!mongoose.isObjectIdOrHexString(id)) {
    throw createError(`Invalid ${fieldName}`, 400);
  }
};

// Verify that the doctor and service belong to the same clinic
// and are currently active.
const validateDoctorAndService = async (
  clinicId,
  doctorId,
  serviceId
) => {
  validateId(doctorId, "doctor ID");
  validateId(serviceId, "service ID");

  const [doctor, service] = await Promise.all([
    Doctor.findOne({
      _id: doctorId,
      clinicId,
      isActive: true,
    }).lean(),

    Service.findOne({
      _id: serviceId,
      clinicId,
      isActive: true,
    }).lean(),
  ]);

  if (!doctor) {
    throw createError("Active doctor not found in this clinic", 404);
  }

  if (!service) {
    throw createError("Active service not found in this clinic", 404);
  }
};

// Assign a service to a doctor with custom pricing.
export const createDoctorService = async (clinicId, data) => {
  await validateDoctorAndService(
    clinicId,
    data.doctorId,
    data.serviceId
  );

  try {
    return await DoctorService.create({
      clinicId,
      doctorId: data.doctorId,
      serviceId: data.serviceId,
      fee: data.fee,
      durationMinutes: data.durationMinutes,
      isActive: true,
    });
  } catch (error) {
    if (error.code === 11000) {
      throw createError(
        "This service is already assigned to the doctor",
        409
      );
    }

    throw error;
  }
};

// Get doctor-service combinations belonging to a clinic.
export const getClinicDoctorServices = async (
  clinicId,
  filters = {}
) => {
  const query = { clinicId };

  if (filters.doctorId) {
    validateId(filters.doctorId, "doctor ID");
    query.doctorId = filters.doctorId;
  }

  if (filters.serviceId) {
    validateId(filters.serviceId, "service ID");
    query.serviceId = filters.serviceId;
  }

  if (!filters.includeInactive) {
    query.isActive = true;
  }

  return DoctorService.find(query)
    .populate(
      "doctorId",
      "name qualifications specialization isActive"
    )
    .populate("serviceId", "name description isActive")
    .sort({ createdAt: -1 })
    .lean();
};

// Get one doctor-service pricing record.
export const getDoctorServiceById = async (
  clinicId,
  doctorServiceId
) => {
  validateId(doctorServiceId, "doctor-service ID");

  const doctorService = await DoctorService.findOne({
    _id: doctorServiceId,
    clinicId,
  })
    .populate("doctorId", "name specialization isActive")
    .populate("serviceId", "name description isActive")
    .lean();

  if (!doctorService) {
    throw createError("Doctor-service offering not found", 404);
  }

  return doctorService;
};

// Update the fee or consultation duration.
export const updateDoctorService = async (
  clinicId,
  doctorServiceId,
  data
) => {
  validateId(doctorServiceId, "doctor-service ID");

  const doctorService = await DoctorService.findOneAndUpdate(
    {
      _id: doctorServiceId,
      clinicId,
    },
    {
      $set: data,
    },
    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  if (!doctorService) {
    throw createError("Doctor-service offering not found", 404);
  }

  return doctorService;
};

// Enable or disable a doctor's specific service.
export const updateDoctorServiceStatus = async (
  clinicId,
  doctorServiceId,
  isActive
) => {
  validateId(doctorServiceId, "doctor-service ID");

  // Activation requires an active doctor and an active service.
  if (isActive) {
    const offering = await DoctorService.findOne({
      _id: doctorServiceId,
      clinicId,
    }).lean();

    if (!offering) {
      throw createError("Doctor-service offering not found", 404);
    }

    await validateDoctorAndService(
      clinicId,
      offering.doctorId,
      offering.serviceId
    );
  }

  const doctorService = await DoctorService.findOneAndUpdate(
    {
      _id: doctorServiceId,
      clinicId,
    },
    {
      $set: { isActive },
    },
    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  if (!doctorService) {
    throw createError("Doctor-service offering not found", 404);
  }

  return doctorService;
};
