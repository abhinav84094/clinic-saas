
import {
  getPublicClinicBySlug,
} from "../services/publicClinicService.js";

export const getPublicClinicController = async (req,res,next) => {
  try {
    const { slug } = req.params;

    const data = await getPublicClinicBySlug(slug);

    return res.status(200).json({
      message: "Clinic fetched successfully",
      data,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message,
      });
    }

    return next(error);
  }
};
