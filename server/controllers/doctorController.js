
import { z } from "zod";

import {
  createDoctor,
  getClinicDoctors,
  getDoctorById,
  updateDoctor,
  updateDoctorStatus,
} from "../services/doctorService.js";

import {
  createDoctorSchema,
  updateDoctorSchema,
} from "../validators/doctorValidator.js";

const doctorStatusSchema = z.strictObject({
  isActive: z.boolean(),
});

const sendValidationError = (res, error) => {
  return res.status(400).json({
    message: "Validation failed",
    errors: error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  });
};

const handleDoctorError = (error, res, next) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      message: error.message,
    });
  }

  return next(error);
};

// POST /api/clinics/:clinicId/doctors
export const createDoctorController = async (req,res,next) => {
  try {
    const parsed = createDoctorSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendValidationError(res, parsed.error);
    }

    const doctor = await createDoctor(
      req.clinic._id,
      parsed.data
    );

    return res.status(201).json({
      message: "Doctor added successfully",
      doctor,
    });
  } catch (error) {
    return handleDoctorError(error, res, next);
  }
};

// GET /api/clinics/:clinicId/doctors
export const getClinicDoctorsController = async (req,res,next) => {
  try {
    const includeInactive =
      req.query.includeInactive === "true";

    const doctors = await getClinicDoctors(
      req.clinic._id,
      { includeInactive }
    );

    return res.status(200).json({
      message: "Doctors fetched successfully",
      count: doctors.length,
      doctors,
    });
  } catch (error) {
    return handleDoctorError(error, res, next);
  }
};

// GET /api/clinics/:clinicId/doctors/:doctorId
export const getDoctorController = async (req,res,next) => {
  try {
    const doctor = await getDoctorById(
      req.clinic._id,
      req.params.doctorId
    );

    return res.status(200).json({
      message: "Doctor fetched successfully",
      doctor,
    });
  } catch (error) {
    return handleDoctorError(error, res, next);
  }
};

// PATCH /api/clinics/:clinicId/doctors/:doctorId
export const updateDoctorController = async (req,res, next) => {
  try {
    const parsed = updateDoctorSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendValidationError(res, parsed.error);
    }

    const doctor = await updateDoctor(
      req.clinic._id,
      req.params.doctorId,
      parsed.data
    );

    return res.status(200).json({
      message: "Doctor profile updated successfully",
      doctor,
    });
  } catch (error) {
    return handleDoctorError(error, res, next);
  }
};

// PATCH /api/clinics/:clinicId/doctors/:doctorId/status
export const updateDoctorStatusController = async (req,res,next) => {
  try {
    const parsed = doctorStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendValidationError(res, parsed.error);
    }

    const doctor = await updateDoctorStatus(
      req.clinic._id,
      req.params.doctorId,
      parsed.data.isActive
    );

    return res.status(200).json({
      message: doctor.isActive
        ? "Doctor activated successfully"
        : "Doctor deactivated successfully",
      doctor,
    });
  } catch (error) {
    return handleDoctorError(error, res, next);
  }
};
