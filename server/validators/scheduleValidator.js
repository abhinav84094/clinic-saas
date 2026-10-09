
import { z } from "zod";

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const timeSchema = z
  .string()
  .regex(TIME_REGEX, "Time must be in HH:mm format");

const dateSchema = z
  .string()
  .regex(DATE_REGEX, "Date must be in YYYY-MM-DD format")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);

    return (
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Invalid calendar date");

const timeRangeValidation = (data, ctx) => {
  if (
    data.startTime !== undefined &&
    data.endTime !== undefined &&
    data.startTime >= data.endTime
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["endTime"],
      message: "endTime must be later than startTime",
    });
  }
};

// Weekly shift create
export const createScheduleSchema = z
  .object({
    doctorId: z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid doctor ID"),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: timeSchema,
    endTime: timeSchema,
  })
  .strict()
  .superRefine(timeRangeValidation);

// Weekly shift update
export const updateScheduleSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    startTime: timeSchema.optional(),
    endTime: timeSchema.optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field is required"
  )
  .superRefine(timeRangeValidation);

// Activate / deactivate weekly shift
export const scheduleStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

// Date-specific exception create
export const createScheduleExceptionSchema = z
  .discriminatedUnion("type", [
    z
      .object({
        doctorId: z.string().regex(/^[a-fA-F0-9]{24}$/),
        date: dateSchema,
        type: z.literal("unavailable"),
        reason: z.string().trim().max(500).optional(),
      })
      .strict(),

    z
      .object({
        doctorId: z.string().regex(/^[a-fA-F0-9]{24}$/),
        date: dateSchema,
        type: z.literal("blocked"),
        startTime: timeSchema,
        endTime: timeSchema,
        reason: z.string().trim().max(500).optional(),
      })
      .strict()
      .superRefine(timeRangeValidation),

    z
      .object({
        doctorId: z.string().regex(/^[a-fA-F0-9]{24}$/),
        date: dateSchema,
        type: z.literal("override"),
        startTime: timeSchema,
        endTime: timeSchema,
        reason: z.string().trim().max(500).optional(),
      })
      .strict()
      .superRefine(timeRangeValidation),
  ]);

// Activate / deactivate date exception
export const scheduleExceptionStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();
