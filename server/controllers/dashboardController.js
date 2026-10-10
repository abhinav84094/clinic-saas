
import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import { DateTime } from "luxon";

export async function getClinicDashboardController(req, res, next) {
  try {
    const clinicId = req.clinic._id;
    const now = new Date();

    // Calculate today's boundaries in Indian time.
    const today = DateTime.now()
      .setZone("Asia/Kolkata")
      .startOf("day");

    const startUtc = today.toUTC().toJSDate();

    const endUtc = today
      .plus({ days: 1 })
      .toUTC()
      .toJSDate();

    const [
      todayAppointments,
      activeDoctors,
      uniquePatients,
      upcoming,
    ] = await Promise.all([
      // Today's non-cancelled appointments
      Appointment.countDocuments({
        clinicId,
        startAt: {
          $gte: startUtc,
          $lt: endUtc,
        },
        status: { $ne: "cancelled" },
      }),

      // Active doctors
      Doctor.countDocuments({
        clinicId,
        isActive: true,
      }),

      // Unique patients identified by phone number
      Appointment.aggregate([
        {
          $match: {
            clinicId,
            status: { $ne: "cancelled" },
          },
        },
        {
          $group: {
            _id: "$patientPhone",
          },
        },
        {
          $count: "total",
        },
      ]),

      // Next 8 upcoming appointments
      Appointment.find({
        clinicId,
        startAt: { $gte: now },
        status: {
          $in: ["booked", "confirmed"],
        },
      })
        .sort({ startAt: 1 })
        .limit(8)
        .select(
          "patientName startAt status doctorId serviceId"
        )
        .populate("doctorId", "name")
        .populate("serviceId", "name")
        .lean(),
    ]);

    return res.status(200).json({
      success: true,

      stats: {
        todayAppointments,
        totalPatients: uniquePatients[0]?.total ?? 0,
        activeDoctors,
        websiteStatus: req.clinic.status,
      },

      upcomingAppointments: upcoming,
    });
  } catch (error) {
    next(error);
  }
}
