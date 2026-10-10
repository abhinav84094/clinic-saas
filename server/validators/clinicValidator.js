import { z } from "zod";
import { validateSlug } from "../utils/slug.js";


const optionalText = (maxLength) => z.string().trim().max(maxLength).optional();

const optionalEmail = z.email().max(254).transform((email) => email.toLowerCase()).optional();

const optionalPhone = z.string().trim().regex(/^\+?[0-9]{7,15}$/, "Invalid phone number").optional();

const contactSchema = z.strictObject({
  phone: optionalPhone,
  email: optionalEmail,
  whatsapp: optionalPhone,
});

const addressSchema = z.strictObject({
  line1: optionalText(200),
  line2: optionalText(200),
  city: optionalText(100),
  state: optionalText(100),
  country: optionalText(100),
  postalCode: optionalText(20),
  landmark: optionalText(200),
});

const timezoneSchema = z.string().trim().refine(
    (value) => {
      try {
        new Intl.DateTimeFormat("en-US", {
          timeZone: value,
        });
        return true;
      } catch {
        return false;
      }
    },
    { message: "Invalid timezone" }
  );

  

export const createClinicSchema = z.strictObject({
  name: z.string().trim().min(2).max(150),

  slug: z
  .string()
  .trim()
  .transform((value) => value.toLowerCase())
  .refine((value) => validateSlug(value).valid, {
    message: "Invalid or unavailable clinic URL",
  }),

  description: optionalText(2000),

  contact: contactSchema.optional(),

  address: addressSchema.optional(),

  timezone: timezoneSchema.default("Asia/Kolkata"),
  
  billingCycle: z.enum(["monthly", "yearly"], {
    error: "Please select a valid billing cycle",
    }),
});



const updateContactSchema = contactSchema.partial();

const updateAddressSchema = addressSchema.partial();

const updateBrandingSchema = z.strictObject({
  logoUrl: z
    .union([
      z.url().refine(
        (value) => ["https:", "http:"].includes(new URL(value).protocol),
        "Logo must use HTTP or HTTPS"
      ),
      z.literal(""),
    ])
    .optional(),

  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color")
    .optional(),
});

export const updateClinicSchema = z.strictObject({
    name: z.string().trim().min(2).max(150).optional(),

    description: optionalText(2000),

    contact: updateContactSchema.optional(),

    address: updateAddressSchema.optional(),

    branding: updateBrandingSchema.optional(),

    timezone: timezoneSchema.optional(),
    website: z.strictObject({
      templateId: z.enum(["A"]),
    }).optional(),
    })
   .refine(
    (data) =>
      Object.values(data).some(
        (value) =>
          value !== undefined &&
          (typeof value !== "object" ||
            Object.keys(value).length > 0)
      ),
    { message: "At least one field must be provided" }
  );
