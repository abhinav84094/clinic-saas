
import mongoose from "mongoose";

import Clinic from "../models/Clinic.js";
import Doctor from "../models/Doctor.js";
import Service from "../models/Service.js";
import DoctorService from "../models/DoctorService.js";
import Schedule from "../models/Schedule.js";
import ScheduleException from "../models/ScheduleException.js";
import Appointment from "../models/Appointment.js";
import BookingHold from "../models/BookingHold.js";
import { checkBookingEntitlement } from "./subscriptionService.js";

import {
  SLOT_INTERVAL_MINUTES,
  timeToMinutes,
  minutesToTime,
  localToUTC,
  getDayOfWeek,
} from "../utils/appointmentTime.js";

export const BOOKING_HOLD_MINUTES = 5;

const ACTIVE_APPOINTMENT_STATUSES = [
  "booked",
  "confirmed",
  "completed",
  "no_show",
];

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const createBookingHold = async ({
  slug,
  doctorServiceId,
  date,
  startTime,
  patientName,
  patientPhone,
  patientEmail,
  bookingNote,
}) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const clinic = await Clinic.findOne({
        slug,
        status: "active",
      }).session(session);

      if (!clinic) {
        throw createError("Clinic not found", 404);
      }

      // Booking is only available for paid plans.
      // This assumes the subscription entitlement exists.
      if (clinic.bookingSettings?.onlineBookingEnabled !== true) {
        throw createError(
            "Online booking is disabled for this clinic",
            403
        );
        }

        await checkBookingEntitlement(clinic._id, { session });

      const offering = await DoctorService.findOne({
        _id: doctorServiceId,
        clinicId: clinic._id,
        isActive: true,
      }).session(session);

      if (!offering) {
        throw createError("Service offering not found", 404);
      }

      const [doctor, service] = await Promise.all([
        Doctor.findOne({
          _id: offering.doctorId,
          clinicId: clinic._id,
          isActive: true,
        }).session(session),

        Service.findOne({
          _id: offering.serviceId,
          clinicId: clinic._id,
          isActive: true,
        }).session(session),
      ]);

      if (!doctor || !service) {
        throw createError("Doctor or service unavailable", 404);
      }

      const timezone = clinic.timezone || "Asia/Kolkata";
      const duration = offering.durationMinutes;

      const startMinutes = timeToMinutes(startTime);
      const endMinutes = startMinutes + duration;

      if (endMinutes >= 1440) {
        throw createError(
          "Appointment must end on the same day",
          400
        );
      }

      // The requested time must match our 15-minute grid.
      if (startMinutes % SLOT_INTERVAL_MINUTES !== 0) {
        throw createError("Invalid appointment start time", 400);
      }

      const endTime = minutesToTime(endMinutes);

      const startAt = localToUTC(date, startTime, timezone);
      const endAt = localToUTC(date, endTime, timezone);

      const now = new Date();

    if (startAt <= now) {
    throw createError("Cannot book a past slot", 400);
    }

    const minimumNoticeMinutes =
    clinic.bookingSettings?.minimumNoticeMinutes ?? 60;

    const bookingWindowDays =
    clinic.bookingSettings?.bookingWindowDays ?? 30;

    const earliestAllowed = new Date(
    now.getTime() + minimumNoticeMinutes * 60 * 1000
    );

    if (startAt < earliestAllowed) {
    throw createError(
        `Booking requires at least ${minimumNoticeMinutes} minutes notice`,
        400
    );
    }

    const latestAllowed = new Date(
    now.getTime() + bookingWindowDays * 24 * 60 * 60 * 1000
    );

    if (startAt > latestAllowed) {
    throw createError(
        "Booking date is outside the allowed booking window",
        400
    );
    }

      const dayOfWeek = getDayOfWeek(date, timezone);

      const schedules = await Schedule.find({
        clinicId: clinic._id,
        doctorId: doctor._id,
        dayOfWeek,
        isActive: true,
      }).session(session);

      const exceptions = await ScheduleException.find({
        clinicId: clinic._id,
        doctorId: doctor._id,
        date,
        isActive: true,
      }).session(session);

      if (exceptions.some((item) => item.type === "unavailable")) {
        throw createError("Doctor unavailable on this date", 409);
      }

      const overrides = exceptions.filter(
        (item) => item.type === "override"
      );

      const shifts = overrides.length > 0 ? overrides : schedules;

      const withinShift = shifts.some(
        (shift) =>
          startMinutes >= timeToMinutes(shift.startTime) &&
          endMinutes <= timeToMinutes(shift.endTime)
      );

      if (!withinShift) {
        throw createError("Slot outside working hours", 409);
      }

      const blocked = exceptions.some(
        (item) =>
          item.type === "blocked" &&
          startMinutes < timeToMinutes(item.endTime) &&
          endMinutes > timeToMinutes(item.startTime)
      );

      if (blocked) {
        throw createError("Slot is blocked", 409);
      }

      // Serialize all booking writes for this doctor.
      const lockedDoctor = await Doctor.findOneAndUpdate(
        {
          _id: doctor._id,
          clinicId: clinic._id,
          isActive: true,
        },
        { $inc: { __v: 1 } },
        { new: true, session }
      );

      if (!lockedDoctor) {
        throw createError("Doctor unavailable", 409);
      }

      const overlappingAppointment = await Appointment.exists({
        clinicId: clinic._id,
        doctorId: doctor._id,
        status: { $in: ACTIVE_APPOINTMENT_STATUSES },
        startAt: { $lt: endAt },
        endAt: { $gt: startAt },
      }).session(session);

      if (overlappingAppointment) {
        throw createError("Slot already booked", 409);
      }


      const overlappingHold = await BookingHold.exists({
        clinicId: clinic._id,
        doctorId: doctor._id,
        status: { $in: ["held", "payment_pending"] },
        expiresAt: { $gt: now },
        startAt: { $lt: endAt },
        endAt: { $gt: startAt },
      }).session(session);

      if (overlappingHold) {
        throw createError("Slot temporarily reserved", 409);
      }

      const expiresAt = new Date(
        now.getTime() + BOOKING_HOLD_MINUTES * 60 * 1000
      );

      const [hold] = await BookingHold.create(
        [
          {
            clinicId: clinic._id,
            doctorId: doctor._id,
            serviceId: service._id,
            doctorServiceId: offering._id,
            patientName,
            patientPhone,
            patientEmail,
            bookingNote,
            startAt,
            endAt,
            feeSnapshot: offering.fee,
            durationMinutesSnapshot: duration,
            status: "held",
            expiresAt,
          },
        ],
        { session }
      );

      result = {
        holdId: hold._id,
        expiresAt: hold.expiresAt,
        fee: hold.feeSnapshot,
        durationMinutes: hold.durationMinutesSnapshot,
        status: hold.status,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
};
