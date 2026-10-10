
import { getCloudinary } from "../config/cloudinary.js";

const ALLOWED_CATEGORIES = new Set([
  "doctors",
  "logos",
  "gallery",
]);

function storageFolder(clinicId, category) {
  if (!ALLOWED_CATEGORIES.has(category)) {
    throw new Error("Unsupported image category");
  }

  return `prakash-saas/clinics/${clinicId}/${category}`;
}

export function uploadImage({
  buffer,
  clinicId,
  category,
}) {
  const cloudinary = getCloudinary();

  const folder = storageFolder(clinicId, category);

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);

        if (!result?.secure_url || !result?.public_id) {
          return reject(
            new Error("Image storage returned an invalid result")
          );
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    stream.on("error", reject);
    stream.end(buffer);
  });
}

export async function deleteImage(publicId) {
  if (!publicId) return;

  const cloudinary = getCloudinary();

  return cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
  });
}
