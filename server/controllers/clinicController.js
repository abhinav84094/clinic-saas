import { checkSlugAvailability, createClinic, getUserClinics, updateClinicProfile } from "../services/clinicService.js";
import { createClinicSchema, updateClinicSchema} from "../validators/clinicValidator.js";


export const getSlugAvailability = async (req, res) => {
  try {
    const { slug } = req.query;

    const result = await checkSlugAvailability(slug);

    if (result.invalid) {
      return res.status(400).json({
        available: false,
        slug: result.slug,
        message: result.message,
      });
    }

    return res.status(200).json({
      available: result.available,
      slug: result.slug,
      message: result.message,
    });
  } catch (error) {
    console.error("Slug availability error:", error);

    return res.status(500).json({
      message: "Unable to check URL availability",
    });
  }
};




export const createClinicController = async (req, res) => {
  try {
    const validation = createClinicSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        message: "Invalid clinic details",
        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const clinic = await createClinic(
      req.user._id,
      validation.data
    );

    return res.status(201).json({
      message: "Clinic created successfully",
      clinic,
    });
  } catch (error) {
    if (error.statusCode === 409) {
      return res.status(409).json({
        message: error.message,
      });
    }

    console.error("Clinic creation error:", error);

    return res.status(500).json({
      message: "Unable to create clinic",
    });
  }
};





export const getMyClinics = async (req, res) => {
  try {
    const clinics = await getUserClinics(req.user._id);

    return res.status(200).json({
      message: "Clinics fetched successfully",
      clinics,
    });
  } catch (error) {
    console.error("Get my clinics error:", error);

    return res.status(500).json({
      message: "Unable to fetch clinics",
    });
  }
};




export const getClinicProfile = async (req, res) => {
  try {
    const clinic = req.clinic;

    return res.status(200).json({
      message: "Clinic fetched successfully",
      clinic: {
        id: clinic._id,
        name: clinic.name,
        slug: clinic.slug,
        description: clinic.description,
        contact: clinic.contact,
        address: clinic.address,
        branding: clinic.branding,
        timezone: clinic.timezone,
        status: clinic.status,
        bookingSettings: clinic.bookingSettings,
        createdAt: clinic.createdAt,
        updatedAt: clinic.updatedAt,
        website: {
          templateId: clinic.website?.templateId || "A",
        },
      },
      membership: {
        role: req.clinicMembership.role,
      },
    });
  } catch (error) {
    console.error("Get clinic profile error:", error);

    return res.status(500).json({
      message: "Unable to fetch clinic",
    });
  }
};

export const updateClinicProfileController = async (
  req,
  res
) => {
  try {
    const validation = updateClinicSchema.safeParse(
      req.body
    );

    if (!validation.success) {
      return res.status(400).json({
        message: "Invalid clinic details",
        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const clinic = await updateClinicProfile(
      req.clinic._id,
      validation.data
    );

    return res.status(200).json({
      message: "Clinic updated successfully",
      clinic,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message,
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Invalid clinic details",
      });
    }

    console.error("Update clinic error:", error);

    return res.status(500).json({
      message: "Unable to update clinic",
    });
  }
};
