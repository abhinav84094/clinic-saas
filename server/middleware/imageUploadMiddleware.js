
import multer from "multer";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function hasValidImageSignature(buffer) {
  if (!Buffer.isBuffer(buffer)) return false;

  // JPEG
  const isJpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  // PNG
  const pngSignature = Buffer.from([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);

  const isPng =
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(pngSignature);

  // WebP
  const isWebp =
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";

  return isJpeg || isPng || isWebp;
}

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 1,
  },

  fileFilter: (req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(
        new Error(
          "Only JPG, PNG and WebP images are allowed"
        )
      );
    }

    callback(null, true);
  },
});

export function uploadSingleImage(req, res, next) {
  upload.single("photo")(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        message:
          error.code === "LIMIT_FILE_SIZE"
            ? "Image must be 3 MB or smaller"
            : error.message || "Invalid image upload",
      });
    }

    if (
      !req.file ||
      !hasValidImageSignature(req.file.buffer)
    ) {
      return res.status(400).json({
        message:
          "Please upload a valid JPG, PNG or WebP image",
      });
    }

    next();
  });
}
