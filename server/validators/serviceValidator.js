
import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId");

// Clinic service catalogue
export const createServiceSchema = z.strictObject({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
});

export const updateServiceSchema = createServiceSchema
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field is required"
  );

// Doctor-specific pricing and duration
export const createDoctorServiceSchema = z.strictObject({
  doctorId: objectIdSchema,
  serviceId: objectIdSchema,

  fee: z.number().finite().min(0).max(1000000),

  durationMinutes: z.number().int().min(5).max(480),
});

export const updateDoctorServiceSchema = z
  .strictObject({
    fee: z.number().finite().min(0).max(1000000).optional(),
    durationMinutes: z.number().int().min(5).max(480).optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field is required"
  );

export const updateServiceStatusSchema = z.strictObject({
  isActive: z.boolean(),
});
