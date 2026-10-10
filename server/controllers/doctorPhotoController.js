
import mongoose from "mongoose";

import Doctor from "../models/Doctor.js";

import {
  uploadImage,
  deleteImage,
} from "../services/imageStorageService.js";

function getManagedPublicId(url, clinicId) {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== "res.cloudinary.com"
    ) {
      return null;
    }

    const prefix = `/${cloudName}/image/upload/`;

    if (!parsed.pathname.startsWith(prefix)) {
      return null;
    }

    const rest = decodeURIComponent(
      parsed.pathname.slice(prefix.length)
    );

    const withoutVersion = rest.replace(/^v\d+\//, "");
    const publicId = withoutVersion.replace(
      /\.(jpg|jpeg|png|webp)$/i,
      ""
    );

    const expectedPrefix =
      `prakash-saas/clinics/${clinicId}/doctors/`;

    return publicId.startsWith(expectedPrefix)
      ? publicId
      : null;
  } catch {
    return null;
  }
}

async function findDoctor(req) {
  const { doctorId } = req.params;

  if (!mongoose.isObjectIdOrHexString(doctorId)) {
    const error = new Error("Invalid doctor ID");
    error.statusCode = 400;
    throw error;
  }

  const doctor = await Doctor.findOne({
    _id: doctorId,
    clinicId: req.clinic._id,
  });

  if (!doctor) {
    const error = new Error("Doctor not found");
    error.statusCode = 404;
    throw error;
  }

  return doctor;
}

export async function uploadDoctorPhotoController(
  req,
  res,
  next
) {
  try {
    const doctor = await findDoctor(req);
    const clinicId = String(req.clinic._id);
    const oldPhotoUrl = doctor.photoUrl;

    const uploaded = await uploadImage({
      buffer: req.file.buffer,
      clinicId,
      category: "doctors",
    });

    try {
      doctor.photoUrl = uploaded.url;
      await doctor.save();
    } catch (error) {
      await deleteImage(uploaded.publicId).catch(() => {});
      throw error;
    }

    const oldPublicId = getManagedPublicId(
      oldPhotoUrl,
      clinicId
    );

    if (oldPublicId) {
      await deleteImage(oldPublicId).catch((error) => {
        console.error(
          "Previous doctor photo cleanup failed:",
          error
        );
      });
    }

    return res.status(200).json({
      message: "Doctor photo uploaded successfully",
      photoUrl: doctor.photoUrl,
      doctor,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteDoctorPhotoController(
  req,
  res,
  next
) {
  try {
    const doctor = await findDoctor(req);
    const clinicId = String(req.clinic._id);

    const oldPhotoUrl = doctor.photoUrl;
    doctor.photoUrl = "";

    await doctor.save();

    const oldPublicId = getManagedPublicId(
      oldPhotoUrl,
      clinicId
    );

    if (oldPublicId) {
      await deleteImage(oldPublicId).catch((error) => {
        console.error(
          "Doctor photo cleanup failed:",
          error
        );
      });
    }

    return res.status(200).json({
      message: "Doctor photo removed successfully",
      doctor,
    });
  } catch (error) {
    next(error);
  }
}
