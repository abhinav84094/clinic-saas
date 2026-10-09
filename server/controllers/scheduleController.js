
import {
  getDoctorSchedules,
  getScheduleById,
  createDoctorSchedule,
  updateDoctorSchedule,
  updateScheduleStatus,
} from "../services/scheduleService.js";

import {
  createScheduleSchema,
  updateScheduleSchema,
  scheduleStatusSchema,
} from "../validators/scheduleValidator.js";

const handleScheduleError = (error, res) => {
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

  if (error.code === 11000) {
    return res.status(409).json({
      message: "Duplicate schedule",
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      message: error.message,
    });
  }

  console.error("Schedule error:", error);

  return res.status(500).json({
    message: "Internal server error",
  });
};

// GET /api/clinics/:clinicId/schedules
export const getDoctorSchedulesController = async (req, res) => {
  try {
    const { doctorId, includeInactive } = req.query;

    if (!doctorId) {
      return res.status(400).json({
        message: "doctorId query parameter is required",
      });
    }

    const schedules = await getDoctorSchedules(
      req.clinic._id,
      doctorId,
      {
        includeInactive: includeInactive === "true",
      }
    );

    return res.status(200).json({
      message: "Doctor schedules fetched successfully",
      schedules,
    });
  } catch (error) {
    return handleScheduleError(error, res);
  }
};

// GET /api/clinics/:clinicId/schedules/:scheduleId
export const getScheduleByIdController = async (req, res) => {
  try {
    const schedule = await getScheduleById(
      req.clinic._id,
      req.params.scheduleId
    );

    return res.status(200).json({
      message: "Schedule fetched successfully",
      schedule,
    });
  } catch (error) {
    return handleScheduleError(error, res);
  }
};

// POST /api/clinics/:clinicId/schedules
export const createDoctorScheduleController = async (req, res) => {
  try {
    const data = createScheduleSchema.parse(req.body);

    const schedule = await createDoctorSchedule(
      req.clinic._id,
      data
    );

    return res.status(201).json({
      message: "Doctor schedule created successfully",
      schedule,
    });
  } catch (error) {
    return handleScheduleError(error, res);
  }
};

// PATCH /api/clinics/:clinicId/schedules/:scheduleId
export const updateDoctorScheduleController = async (req, res) => {
  try {
    const data = updateScheduleSchema.parse(req.body);

    const schedule = await updateDoctorSchedule(
      req.clinic._id,
      req.params.scheduleId,
      data
    );

    return res.status(200).json({
      message: "Doctor schedule updated successfully",
      schedule,
    });
  } catch (error) {
    return handleScheduleError(error, res);
  }
};

// PATCH /api/clinics/:clinicId/schedules/:scheduleId/status
export const updateScheduleStatusController = async (req, res) => {
  try {
    const { isActive } = scheduleStatusSchema.parse(req.body);

    const schedule = await updateScheduleStatus(
      req.clinic._id,
      req.params.scheduleId,
      isActive
    );

    return res.status(200).json({
      message: "Schedule status updated successfully",
      schedule,
    });
  } catch (error) {
    return handleScheduleError(error, res);
  }
};
