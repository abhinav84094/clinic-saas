

import {
  createServiceSchema,
  updateServiceSchema,
  updateServiceStatusSchema,
} from "../validators/serviceValidator.js";

import {
  createService,
  getClinicServices,
  getServiceById,
  updateService,
  updateServiceStatus,
} from "../services/serviceService.js";

const handleError = (res, error) => {
  if (error.name === "ZodError") {
    return res.status(400).json({
      message: "Validation failed",
      errors: error.issues,
    });
  }

  if (error.statusCode) {
    return res.status(error.statusCode).json({
      message: error.message,
    });
  }

  console.error("Service controller error:", error);

  return res.status(500).json({
    message: "Internal server error",
  });
};

// POST /api/clinics/:clinicId/services
export const createServiceController = async (req, res) => {
  try {
    const data = createServiceSchema.parse(req.body);

    const service = await createService(
      req.clinic._id,
      data
    );

    return res.status(201).json({
      message: "Service created successfully",
      service,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// GET /api/clinics/:clinicId/services
export const getClinicServicesController = async (req, res) => {
  try {
    const includeInactive =
      req.query.includeInactive === "true";

    const services = await getClinicServices(
      req.clinic._id,
      includeInactive
    );

    return res.status(200).json({
      message: "Services fetched successfully",
      services,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// GET /api/clinics/:clinicId/services/:serviceId
export const getServiceByIdController = async (req, res) => {
  try {
    const service = await getServiceById(
      req.clinic._id,
      req.params.serviceId
    );

    return res.status(200).json({
      message: "Service fetched successfully",
      service,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// PATCH /api/clinics/:clinicId/services/:serviceId
export const updateServiceController = async (req, res) => {
  try {
    const data = updateServiceSchema.parse(req.body);

    const service = await updateService(
      req.clinic._id,
      req.params.serviceId,
      data
    );

    return res.status(200).json({
      message: "Service updated successfully",
      service,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// PATCH /api/clinics/:clinicId/services/:serviceId/status
export const updateServiceStatusController = async (req, res) => {
  try {
    const { isActive } =
      updateServiceStatusSchema.parse(req.body);

    const service = await updateServiceStatus(
      req.clinic._id,
      req.params.serviceId,
      isActive
    );

    return res.status(200).json({
      message: `Service ${
        isActive ? "activated" : "deactivated"
      } successfully`,
      service,
    });
  } catch (error) {
    return handleError(res, error);
  }
};
