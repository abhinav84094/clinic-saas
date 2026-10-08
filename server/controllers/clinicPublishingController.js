
import {
  getClinicPublishingReadiness,
  publishClinic,
} from "../services/clinicPublishingService.js";

export const getPublishingReadinessController = async (req,res,next) => {
  try {
    const readiness = await getClinicPublishingReadiness(
      req.clinic._id
    );

    return res.status(200).json({
      message: "Publishing readiness fetched successfully",
      readiness,
    });
  } catch (error) {
    return next(error);
  }
};

export const publishClinicController = async (req,res,next) => {
  try {
    const clinic = await publishClinic(req.clinic._id);

    return res.status(200).json({
      message: "Clinic website published successfully",
      clinic: {
        id: clinic._id,
        name: clinic.name,
        slug: clinic.slug,
        status: clinic.status,
        activatedAt: clinic.activatedAt,
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message,
        ...(error.missingRequirements && {
          missingRequirements: error.missingRequirements,
        }),
      });
    }

    return next(error);
  }
};
