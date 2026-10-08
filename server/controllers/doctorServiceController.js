
import {
  createDoctorServiceSchema,
  updateDoctorServiceSchema,
  updateServiceStatusSchema,
} from "../validators/serviceValidator.js";

import {
  createDoctorService,
  getClinicDoctorServices,
  getDoctorServiceById,
  updateDoctorService,
  updateDoctorServiceStatus,
} from "../services/doctorServiceService.js";

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

  console.error("Doctor-service controller error:", error);

  return res.status(500).json({
    message: "Internal server error",
  });
};

// POST /api/clinics/:clinicId/doctor-services
export const createDoctorServiceController = async (req, res) => {
  try {
    const data = createDoctorServiceSchema.parse(req.body);

    const offering = await createDoctorService(
      req.clinic._id,
      data
    );

    return res.status(201).json({
      message: "Service assigned to doctor successfully",
      offering,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// GET /api/clinics/:clinicId/doctor-services
export const getClinicDoctorServicesController = async (req, res) => {
  try {
    const { doctorId, serviceId } = req.query;

    const offerings = await getClinicDoctorServices(
      req.clinic._id,
      {
        doctorId,
        serviceId,
        includeInactive: req.query.includeInactive === "true",
      }
    );

    return res.status(200).json({
      message: "Doctor services fetched successfully",
      offerings,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// GET /api/clinics/:clinicId/doctor-services/:doctorServiceId
export const getDoctorServiceByIdController = async (req, res) => {
  try {
    const offering = await getDoctorServiceById(
      req.clinic._id,
      req.params.doctorServiceId
    );

    return res.status(200).json({
      message: "Doctor service fetched successfully",
      offering,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// PATCH /api/clinics/:clinicId/doctor-services/:doctorServiceId
export const updateDoctorServiceController = async (req, res) => {
  try {
    const data = updateDoctorServiceSchema.parse(req.body);

    const offering = await updateDoctorService(
      req.clinic._id,
      req.params.doctorServiceId,
      data
    );

    return res.status(200).json({
      message: "Doctor service updated successfully",
      offering,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// PATCH /api/clinics/:clinicId/doctor-services/:doctorServiceId/status
export const updateDoctorServiceStatusController = async (req, res) => {
  try {
    const { isActive } =
      updateServiceStatusSchema.parse(req.body);

    const offering = await updateDoctorServiceStatus(
      req.clinic._id,
      req.params.doctorServiceId,
      isActive
    );

    return res.status(200).json({
      message: `Doctor service ${
        isActive ? "activated" : "deactivated"
      } successfully`,
      offering,
    });
  } catch (error) {
    return handleError(res, error);
  }
};
