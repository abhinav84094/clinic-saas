
import { Router } from "express";
import Clinic from "../models/Clinic.js";

const router = Router();

router.get("/clinics", async (req, res) => {
  try {
    const clinics = await Clinic.find({
      status: "active",
      slug: { $not: /^prod-demo-/ },
    })
      .select("slug updatedAt -_id")
      .sort({ slug: 1 })
      .lean();

    res.set("Cache-Control", "public, max-age=300");

    return res.status(200).json({
      clinics: clinics.map((clinic) => ({
        slug: clinic.slug,
        updatedAt: clinic.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Sitemap clinics error:", error);

    return res.status(500).json({
      message: "Unable to generate clinic sitemap data",
    });
  }
});

export default router;
