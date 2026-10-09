
import mongoose from "mongoose";

import Clinic from "../models/Clinic.js";
import Doctor from "../models/Doctor.js";
import Schedule from "../models/Schedule.js";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidObjectId = (id) =>
  mongoose.isValidObjectId(id);

// Check doctor belongs to the requested clinic.
export const getClinicDoctor = async (
  clinicId,
  doctorId
) => {
  if (!isValidObjectId(doctorId)) {
    throw createError("Invalid doctor ID", 400);
  }

  const doctor = await Doctor.findOne({
    _id: doctorId,
    clinicId,
  });

  if (!doctor) {
    throw createError(
      "Doctor not found in this clinic",
      404
    );
  }

  return doctor;
};

// Fetch weekly shifts for a doctor.
export const getDoctorSchedules = async (
  clinicId,
  doctorId,
  { includeInactive = false } = {}
) => {
  await getClinicDoctor(clinicId, doctorId);

  const filter = {
    clinicId,
    doctorId,
  };

  if (!includeInactive) {
    filter.isActive = true;
  }

  return Schedule.find(filter)
    .select(
      "doctorId dayOfWeek startTime endTime isActive"
    )
    .sort({
      dayOfWeek: 1,
      startTime: 1,
    })
    .lean();
};

// Fetch one weekly shift.
export const getScheduleById = async (
  clinicId,
  scheduleId
) => {
  if (!isValidObjectId(scheduleId)) {
    throw createError("Invalid schedule ID", 400);
  }

  const schedule = await Schedule.findOne({
    _id: scheduleId,
    clinicId,
  }).lean();

  if (!schedule) {
    throw createError("Schedule not found", 404);
  }

  return schedule;
};



const hasOverlap = (startA, endA, startB, endB) =>
  startA < endB && endA > startB;

const validateTimeRange = (startTime, endTime) => {
  if (startTime >= endTime) {
    throw createError(
      "endTime must be later than startTime",
      400
    );
  }
};

const assertNoOverlappingShift = async ({
  clinicId,
  doctorId,
  dayOfWeek,
  startTime,
  endTime,
  excludeScheduleId = null,
  session,
}) => {
  const filter = {
    clinicId,
    doctorId,
    dayOfWeek,
    isActive: true,
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };

  if (excludeScheduleId) {
    filter._id = { $ne: excludeScheduleId };
  }

  const overlap = await Schedule.findOne(filter)
    .session(session)
    .lean();

  if (overlap) {
    throw createError(
      "Schedule overlaps with an existing active shift",
      409
    );
  }
};

const runScheduleTransaction = async (
  clinicId,
  doctorId,
  operation
) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      // Force concurrent changes to the same doctor
      // to conflict at the database level.
      const doctor = await Doctor.findOneAndUpdate(
        {
          _id: doctorId,
          clinicId,
          isActive: true,
        },
        {
          $inc: { __v: 1 },
        },
        {
          session,
          new: true,
        }
      );

      if (!doctor) {
        throw createError(
          "Active doctor not found in this clinic",
          404
        );
      }

      result = await operation(session);
    });

    return result;
  } finally {
    await session.endSession();
  }
};

// Create a weekly shift.
export const createDoctorSchedule = async (
  clinicId,
  data
) => {
  const {
    doctorId,
    dayOfWeek,
    startTime,
    endTime,
  } = data;

  validateTimeRange(startTime, endTime);

  return runScheduleTransaction(
    clinicId,
    doctorId,
    async (session) => {
      await assertNoOverlappingShift({
        clinicId,
        doctorId,
        dayOfWeek,
        startTime,
        endTime,
        session,
      });

      const [schedule] = await Schedule.create(
        [
          {
            clinicId,
            doctorId,
            dayOfWeek,
            startTime,
            endTime,
          },
        ],
        { session }
      );

      return schedule;
    }
  );
};

// Update an existing weekly shift.
export const updateDoctorSchedule = async (
  clinicId,
  scheduleId,
  updates
) => {
  if (!isValidObjectId(scheduleId)) {
    throw createError("Invalid schedule ID", 400);
  }

  const existing = await Schedule.findOne({
    _id: scheduleId,
    clinicId,
  }).lean();

  if (!existing) {
    throw createError("Schedule not found", 404);
  }

  return runScheduleTransaction(
    clinicId,
    existing.doctorId,
    async (session) => {
      const schedule = await Schedule.findOne({
        _id: scheduleId,
        clinicId,
        doctorId: existing.doctorId,
      }).session(session);

      if (!schedule) {
        throw createError("Schedule not found", 404);
      }

      const dayOfWeek =
        updates.dayOfWeek ?? schedule.dayOfWeek;

      const startTime =
        updates.startTime ?? schedule.startTime;

      const endTime =
        updates.endTime ?? schedule.endTime;

      validateTimeRange(startTime, endTime);

      if (schedule.isActive) {
        await assertNoOverlappingShift({
          clinicId,
          doctorId: schedule.doctorId,
          dayOfWeek,
          startTime,
          endTime,
          excludeScheduleId: schedule._id,
          session,
        });
      }

      schedule.dayOfWeek = dayOfWeek;
      schedule.startTime = startTime;
      schedule.endTime = endTime;

      await schedule.save({ session });

      return schedule;
    }
  );
};

// Activate or deactivate a weekly shift.
export const updateScheduleStatus = async (
  clinicId,
  scheduleId,
  isActive
) => {
  if (!isValidObjectId(scheduleId)) {
    throw createError("Invalid schedule ID", 400);
  }

  const existing = await Schedule.findOne({
    _id: scheduleId,
    clinicId,
  }).lean();

  if (!existing) {
    throw createError("Schedule not found", 404);
  }

  return runScheduleTransaction(
    clinicId,
    existing.doctorId,
    async (session) => {
      const schedule = await Schedule.findOne({
        _id: scheduleId,
        clinicId,
        doctorId: existing.doctorId,
      }).session(session);

      if (!schedule) {
        throw createError("Schedule not found", 404);
      }

      if (schedule.isActive === isActive) {
        return schedule;
      }

      if (isActive) {
        await assertNoOverlappingShift({
          clinicId,
          doctorId: schedule.doctorId,
          dayOfWeek: schedule.dayOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          excludeScheduleId: schedule._id,
          session,
        });
      }

      schedule.isActive = isActive;

      await schedule.save({ session });

      return schedule;
    }
  );
};
