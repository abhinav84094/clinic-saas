
import Clinic from "../models/Clinic.js";
import Doctor from "../models/Doctor.js";

import { normalizeSlug } from "../utils/slug.js";
import Service from "../models/Service.js";
import DoctorService from "../models/DoctorService.js";



const createServiceError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getPublicClinicFields = (clinic) => ({
  id: clinic._id,
  name: clinic.name,
  slug: clinic.slug,
  description: clinic.description || "",
  contact: {
    phone: clinic.contact?.phone || "",
    email: clinic.contact?.email || "",
    whatsapp: clinic.contact?.whatsapp || "",
  },
  address: {
    line1: clinic.address?.line1 || "",
    line2: clinic.address?.line2 || "",
    city: clinic.address?.city || "",
    state: clinic.address?.state || "",
    country: clinic.address?.country || "India",
    postalCode: clinic.address?.postalCode || "",
    landmark: clinic.address?.landmark || "",
  },
  branding: {
    logoUrl: clinic.branding?.logoUrl || "",
    primaryColor:
      clinic.branding?.primaryColor || "#2563EB",
  },
  timezone: clinic.timezone || "Asia/Kolkata",
});

const getPublicDoctorFields = (doctor) => ({
  id: doctor._id,
  name: doctor.name,
  qualifications: doctor.qualifications || [],
  specialization: doctor.specialization || "",
  experienceYears: doctor.experienceYears ?? null,
  bio: doctor.bio || "",
  photoUrl: doctor.photoUrl || "",
});

export const getPublicClinicBySlug = async (slugValue) => {
  const slug = normalizeSlug(slugValue);

  if (!slug) {
    throw createServiceError("Clinic not found", 404);
  }

  const clinic = await Clinic.findOne({
    slug,
    status: "active",
  })
    .select(
      "name slug description contact address branding timezone"
    )
    .lean();

  if (!clinic) {
    throw createServiceError("Clinic not found", 404);
  }

  const doctors = await Doctor.find({
    clinicId: clinic._id,
    isActive: true,
  })
    .select(
      "name qualifications specialization experienceYears bio photoUrl"
    )
    .sort({ createdAt: 1 })
    .lean();

  return {
    clinic: getPublicClinicFields(clinic),
    doctors: doctors.map(getPublicDoctorFields),
  };
};




export const getPublicClinicServices = async (slugValue) => {
  const slug = normalizeSlug(slugValue);

  const clinic = await Clinic.findOne({
    slug,
    status: "active",
  })
    .select("_id")
    .lean();

  if (!clinic) {
    const error = new Error("Clinic not found");
    error.statusCode = 404;
    throw error;
  }

  const offerings = await DoctorService.find({
    clinicId: clinic._id,
    isActive: true,
  })
    .populate({
      path: "doctorId",
      match: {
        clinicId: clinic._id,
        isActive: true,
      },
      select: "name specialization qualifications",
    })
    .populate({
      path: "serviceId",
      match: {
        clinicId: clinic._id,
        isActive: true,
      },
      select: "name description",
    })
    .lean();

  const serviceMap = new Map();

  for (const offering of offerings) {
    // Exclude inactive, deleted or cross-clinic references.
    if (!offering.doctorId || !offering.serviceId) {
      continue;
    }

    const service = offering.serviceId;
    const doctor = offering.doctorId;

    const serviceKey = String(service._id);

    if (!serviceMap.has(serviceKey)) {
      serviceMap.set(serviceKey, {
        id: serviceKey,
        name: service.name,
        description: service.description,
        doctors: [],
      });
    }

    serviceMap.get(serviceKey).doctors.push({
      offeringId: String(offering._id),
      doctorId: String(doctor._id),
      name: doctor.name,
      specialization: doctor.specialization,
      qualifications: doctor.qualifications,
      fee: offering.fee,
      durationMinutes: offering.durationMinutes,
    });
  }

  return Array.from(serviceMap.values())
    .map((service) => ({
      ...service,
      doctors: service.doctors.sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};
