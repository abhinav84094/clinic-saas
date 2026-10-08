
import { z } from "zod";

const doctorNameSchema = z
  .string()
  .trim()
  .min(2, "Doctor name must contain at least 2 characters")
  .max(120, "Doctor name cannot exceed 120 characters");

const qualificationsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, "Qualification cannot be empty")
      .max(200, "Qualification is too long")
  )
  .max(15, "Maximum 15 qualifications are allowed")
  .default([]);

const specializationSchema = z
  .string()
  .trim()
  .max(250, "Specialization is too long")
  .optional();

const experienceYearsSchema = z
  .number()
  .int("Experience must be a whole number")
  .min(0, "Experience cannot be negative")
  .max(70, "Experience cannot exceed 70 years")
  .optional();

const bioSchema = z
  .string()
  .trim()
  .max(10000, "Bio cannot exceed 10000 characters")
  .optional();

const photoUrlSchema = z
  .union([
    z.url().refine(
      (value) => {
        const protocol = new URL(value).protocol;
        return protocol === "https:" || protocol === "http:";
      },
      "Photo URL must use HTTP or HTTPS"
    ),
    z.literal(""),
  ])
  .optional();

export const createDoctorSchema = z.strictObject({
  name: doctorNameSchema,
  qualifications: qualificationsSchema,
  specialization: specializationSchema,
  experienceYears: experienceYearsSchema,
  bio: bioSchema,
  photoUrl: photoUrlSchema,
});

export const updateDoctorSchema = z
  .strictObject({
    name: doctorNameSchema.optional(),

    qualifications: qualificationsSchema.optional(),

    specialization: specializationSchema,

    experienceYears: experienceYearsSchema,

    bio: bioSchema,

    photoUrl: photoUrlSchema,
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field must be provided"
  );
