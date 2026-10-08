import {getPublicClinicBySlug, getPublicClinicServices } from "../services/publicClinicService.js";

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



export const getPublicClinicServicesController = async (req, res) => {
  try {
    const services = await getPublicClinicServices(
      req.params.slug
    );

    return res.status(200).json({
      message: "Public clinic services fetched successfully",
      services,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message,
      });
    }

    console.error("Public clinic services error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
