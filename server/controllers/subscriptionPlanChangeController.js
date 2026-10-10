
import {
  createUpgradeOrder,
  createRenewalOrder,
} from "../services/subscriptionPlanChangeService.js";

export const createUpgradeOrderController = async (
  req,
  res,
  next
) => {
  try {
    const order = await createUpgradeOrder({
      clinicId: req.params.clinicId,
      userId: req.user._id,
      toPlan: req.body?.toPlan,
    });

    return res.status(201).json({
      success: true,
      message: "Upgrade checkout created",
      order,
    });
  } catch (error) {
    next(error);
  }
};

export const createRenewalOrderController = async (
  req,
  res,
  next
) => {
  try {
    const order = await createRenewalOrder({
      clinicId: req.params.clinicId,
      userId: req.user._id,
      billingCycle: req.body?.billingCycle,
    });

    return res.status(201).json({
      success: true,
      message: "Renewal checkout created",
      order,
    });
  } catch (error) {
    next(error);
  }
};
