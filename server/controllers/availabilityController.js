import { getAvailableSlots } from "../services/availabilityService.js";
import { availabilityQuerySchema } from "../validators/appointmentValidator.js";

export const getPublicAvailabilityController = async (req, res) => {
  try {
    const { doctorServiceId, date } =
      availabilityQuerySchema.parse(req.query);

    const availability = await getAvailableSlots({
      slug: req.params.slug,
      doctorServiceId,
      date,
    });

    return res.status(200).json({
      message: "Available slots fetched successfully",
      ...availability,
    });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.issues,
      });
    }

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message,
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid identifier",
      });
    }

    console.error("Availability error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};