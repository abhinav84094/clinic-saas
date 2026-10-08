
import mongoose from "mongoose";
import Service from "../models/Service.js";

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const validateServiceId = (serviceId) => {
  if (!mongoose.isObjectIdOrHexString(serviceId)) {
    throw createError("Invalid service ID", 400);
  }
};

// Create a service in the clinic catalogue.
export const createService = async (clinicId, data) => {
  const service = await Service.create({
    clinicId,
    name: data.name,
    description: data.description ?? "",
    isActive: true,
  });

  return service;
};

// Get clinic services, optionally including inactive ones.
export const getClinicServices = async (
  clinicId,
  includeInactive = false
) => {
  const filter = { clinicId };

  if (!includeInactive) {
    filter.isActive = true;
  }

  return Service.find(filter)
    .sort({ name: 1, _id: 1 })
    .lean();
};

// Get a single service belonging to this clinic.
export const getServiceById = async (clinicId, serviceId) => {
  validateServiceId(serviceId);

  const service = await Service.findOne({
    _id: serviceId,
    clinicId,
  }).lean();

  if (!service) {
    throw createError("Service not found", 404);
  }

  return service;
};

// Update catalogue information (not doctor pricing).
export const updateService = async (
  clinicId,
  serviceId,
  data
) => {
  validateServiceId(serviceId);

  const service = await Service.findOneAndUpdate(
    {
      _id: serviceId,
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

  if (!service) {
    throw createError("Service not found", 404);
  }

  return service;
};

// Activate or deactivate a service.
export const updateServiceStatus = async (
  clinicId,
  serviceId,
  isActive
) => {
  validateServiceId(serviceId);

  const service = await Service.findOneAndUpdate(
    {
      _id: serviceId,
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

  if (!service) {
    throw createError("Service not found", 404);
  }

  return service;
};
