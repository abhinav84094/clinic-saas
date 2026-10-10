import Clinic from "../models/Clinic.js";
import { validateSlug } from "../utils/slug.js";
import mongoose from "mongoose";
import ClinicMembership from "../models/ClinicMembership.js";
import { initializeClinicSubscription } from "./subscriptionService.js";


export const checkSlugAvailability = async (value) => {
  const validation = validateSlug(value);

  if (!validation.valid) {
    return {
      available: false,
      slug: validation.slug,
      message: validation.reason,
      invalid: true,
    };
  }

  const existingClinic = await Clinic.exists({
    slug: validation.slug,
  });

  return {
    available: !existingClinic,
    slug: validation.slug,
    message: existingClinic
      ? "This URL is not available"
      : "This URL is available",
    invalid: false,
  };
};





export const createClinic = async (userId, clinicData) => {
  const slug = clinicData.slug;
  const billingCycle = clinicData.billingCycle;

  if (!["monthly", "yearly"].includes(billingCycle)) {
    const error = new Error("Invalid billing cycle");
    error.statusCode = 400;
    throw error;
  }

  const existingClinic = await Clinic.exists({ slug });

  if (existingClinic) {
    const error = new Error("This clinic URL is not available");
    error.statusCode = 409;
    throw error;
  }

  try {
    const clinic = await mongoose.connection.transaction(
      async (session) => {
        const [newClinic] = await Clinic.create(
          [
            {
              name: clinicData.name,
              slug,
              description: clinicData.description,
              contact: clinicData.contact,
              address: clinicData.address,
              timezone: clinicData.timezone,
              createdBy: userId,
              status: "draft",
            },
          ],
          { session }
        );

        await ClinicMembership.create(
          [
            {
              clinicId: newClinic._id,
              userId,
              role: "owner",
              status: "active",
              joinedAt: new Date(),
            },
          ],
          { session }
        );

        await initializeClinicSubscription({
          clinicId: newClinic._id,
          billingCycle,
          session,
        });

        return newClinic;
      }
    );

    return clinic;
  } catch (error) {
    if (
      error.code === 11000 &&
      (error.keyPattern?.slug || error.keyValue?.slug)
    ) {
      const conflict = new Error(
        "This clinic URL is not available"
      );
      conflict.statusCode = 409;
      throw conflict;
    }

    throw error;
  }
};






export const getUserClinics = async (userId) => {
  const memberships = await ClinicMembership.find({
    userId,
    status: "active",
  })
    .select("clinicId role")
    .populate({
      path: "clinicId",
      select: "name slug status branding createdAt",
    })
    .lean();

  const clinics = memberships
    .filter((membership) => membership.clinicId)
    .map((membership) => ({
      id: membership.clinicId._id,
      name: membership.clinicId.name,
      slug: membership.clinicId.slug,
      status: membership.clinicId.status,
      branding: membership.clinicId.branding,
      createdAt: membership.clinicId.createdAt,
      role: membership.role,
    }));

  return clinics;
};




export const updateClinicProfile = async (
  clinicId,
  clinicData
) => {
  const updates = {};

  const directFields = [
    "name",
    "description",
    "timezone",
  ];

  for (const field of directFields) {
    if (clinicData[field] !== undefined) {
      updates[field] = clinicData[field];
    }
  }

  const nestedFields = [
    "contact",
    "address",
    "branding",
    "website",
  ];

  for (const group of nestedFields) {
    if (clinicData[group] === undefined) {
      continue;
    }

    for (const [field, value] of Object.entries(
      clinicData[group]
    )) {
      if (value !== undefined) {
        updates[`${group}.${field}`] = value;
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    const error = new Error("No fields to update");
    error.statusCode = 400;
    throw error;
  }

  const clinic = await Clinic.findOneAndUpdate(
    {
      _id: clinicId,
      status: { $nin: ["suspended", "archived"] },
    },
    { $set: updates },
    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  if (!clinic) {
    const error = new Error("Clinic not available");
    error.statusCode = 404;
    throw error;
  }

  return clinic;
};
