
import { DateTime } from "luxon";

import Clinic from "../models/Clinic.js";
import Doctor from "../models/Doctor.js";
import Service from "../models/Service.js";
import DoctorService from "../models/DoctorService.js";
import Schedule from "../models/Schedule.js";
import ScheduleException from "../models/ScheduleException.js";
import Appointment from "../models/Appointment.js";

import {
  SLOT_INTERVAL_MINUTES,
  timeToMinutes,
  minutesToTime,
  localToUTC,
  getDayOfWeek,
  intervalsOverlap,
} from "../utils/appointmentTime.js";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const BLOCKING_STATUSES = [
  "booked",
  "confirmed",
  "completed",
  "no_show",
];

// Validate clinic and doctor-specific service offering.
export const getActiveBookingOffering = async (
  slug,
  doctorServiceId,
  { session = null } = {}
) => {
  let clinicQuery = Clinic.findOne({
    slug,
    status: "active",
  });

  if (session) clinicQuery = clinicQuery.session(session);

  const clinic = await clinicQuery.lean();

  if (!clinic) {
    throw createError("Clinic not found", 404);
  }

  let offeringQuery = DoctorService.findOne({
    _id: doctorServiceId,
    clinicId: clinic._id,
    isActive: true,
  });

  if (session) offeringQuery = offeringQuery.session(session);

  const offering = await offeringQuery.lean();

  if (!offering) {
    throw createError("Service offering not found", 404);
  }

  const [doctor, service] = await Promise.all([
    Doctor.findOne({
      _id: offering.doctorId,
      clinicId: clinic._id,
      isActive: true,
    }).lean(),

    Service.findOne({
      _id: offering.serviceId,
      clinicId: clinic._id,
      isActive: true,
    }).lean(),
  ]);

  if (!doctor || !service) {
    throw createError(
      "Doctor or service is unavailable",
      404
    );
  }

  return { clinic, offering, doctor, service };
};

// Fetch doctor shifts for a particular date.
const getWorkingShifts = async (
  clinicId,
  doctorId,
  date,
  timezone
) => {
  const dayOfWeek = getDayOfWeek(date, timezone);

  const [weeklySchedules, exceptions] = await Promise.all([
    Schedule.find({
      clinicId,
      doctorId,
      dayOfWeek,
      isActive: true,
    }).lean(),

    ScheduleException.find({
      clinicId,
      doctorId,
      date,
      isActive: true,
    }).lean(),
  ]);

  const unavailable = exceptions.some(
    (exception) => exception.type === "unavailable"
  );

  if (unavailable) {
    return {
      shifts: [],
      blocked: [],
    };
  }

  const overrides = exceptions.filter(
    (exception) => exception.type === "override"
  );

  const blocked = exceptions
    .filter((exception) => exception.type === "blocked")
    .map((exception) => ({
      start: timeToMinutes(exception.startTime),
      end: timeToMinutes(exception.endTime),
    }));

  const selectedShifts =
    overrides.length > 0 ? overrides : weeklySchedules;

  return {
    shifts: selectedShifts.map((shift) => ({
      start: timeToMinutes(shift.startTime),
      end: timeToMinutes(shift.endTime),
    })),
    blocked,
  };
};

// Calculate available appointment slots.
export const getAvailableSlots = async ({
  slug,
  doctorServiceId,
  date,
}) => {
  const { clinic, offering, doctor, service } =
    await getActiveBookingOffering(slug, doctorServiceId);

  const timezone = clinic.timezone || "Asia/Kolkata";

  if (!DateTime.local().setZone(timezone).isValid) {
    throw createError("Invalid clinic timezone", 500);
  }

  const requestedDate = DateTime.fromISO(date, {
    zone: timezone,
  });

  if (!requestedDate.isValid) {
    throw createError("Invalid date", 400);
  }

  const today = DateTime.now()
    .setZone(timezone)
    .startOf("day");

  if (requestedDate < today) {
    return {
      date,
      timezone,
      doctor: {
        id: String(doctor._id),
        name: doctor.name,
      },
      service: {
        id: String(service._id),
        name: service.name,
        fee: offering.fee,
        durationMinutes: offering.durationMinutes,
      },
      slots: [],
    };
  }

  const { shifts, blocked } = await getWorkingShifts(
    clinic._id,
    doctor._id,
    date,
    timezone
  );

  const dayStart = requestedDate.startOf("day").toUTC().toJSDate();
  const dayEnd = requestedDate.plus({ days: 1 })
    .startOf("day")
    .toUTC()
    .toJSDate();

  const appointments = await Appointment.find({
    clinicId: clinic._id,
    doctorId: doctor._id,
    status: { $in: BLOCKING_STATUSES },
    startAt: { $lt: dayEnd },
    endAt: { $gt: dayStart },
  })
    .select("startAt endAt")
    .lean();

  const duration = offering.durationMinutes;
  const now = new Date();
  const slots = [];

  for (const shift of shifts) {
    for (
      let start = shift.start;
      start + duration <= shift.end;
      start += SLOT_INTERVAL_MINUTES
    ) {
      const end = start + duration;

      const blockedByException = blocked.some(
        (range) =>
          intervalsOverlap(
            start,
            end,
            range.start,
            range.end
          )
      );

      if (blockedByException) continue;

      const startTime = minutesToTime(start);
      const endTime = minutesToTime(end);

      const startAt = localToUTC(
        date,
        startTime,
        timezone
      );

      const endAt = localToUTC(
        date,
        endTime,
        timezone
      );

      if (startAt <= now) continue;

      const alreadyBooked = appointments.some(
        (appointment) =>
          intervalsOverlap(
            startAt,
            endAt,
            appointment.startAt,
            appointment.endAt
          )
      );

      if (alreadyBooked) continue;

      slots.push({
        startTime,
        endTime,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      });
    }
  }

  slots.sort((a, b) =>
    a.startAt.localeCompare(b.startAt)
  );

  return {
    date,
    timezone,
    doctor: {
      id: String(doctor._id),
      name: doctor.name,
    },
    service: {
      id: String(service._id),
      name: service.name,
      fee: offering.fee,
      durationMinutes: duration,
    },
    slots,
  };
};
