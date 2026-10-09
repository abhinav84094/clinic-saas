
import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ID");

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);

    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Invalid calendar date");

const timeSchema = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d$/,
    "Time must be HH:mm"
  );

// Public availability request (query parameters)
export const availabilityQuerySchema = z
  .object({
    doctorServiceId: objectIdSchema,
    date: dateSchema,
  })
  .strict();

// Public appointment booking request
export const createAppointmentSchema = z
  .object({
    doctorServiceId: objectIdSchema,

    // Clinic-local date and time
    date: dateSchema,
    startTime: timeSchema,

    patientName: z
      .string()
      .trim()
      .min(2)
      .max(120),

    patientPhone: z
      .string()
      .trim()
      .regex(
        /^\+?[0-9][0-9\s-]{6,18}$/,
        "Invalid phone number"
      ),

    patientEmail: z
      .email()
      .max(254)
      .optional(),

    bookingNote: z
      .string()
      .trim()
      .max(500)
      .optional(),
  })
  .strict();

// Clinic dashboard appointment status update
export const updateAppointmentStatusSchema = z
  .object({
    status: z.enum([
      "booked",
      "confirmed",
      "completed",
      "cancelled",
      "no_show",
    ]),
  })
  .strict();
