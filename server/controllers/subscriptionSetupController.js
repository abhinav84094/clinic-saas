
import {
  getClinicSubscriptionSetup,
  updateSubscriptionBillingCycle,
} from "../services/subscriptionSetupService.js";

export const getSubscriptionSetupController = async (
  req,
  res,
  next
) => {
  try {
    const subscription = await getClinicSubscriptionSetup({
      clinicId: req.params.clinicId,
      userId: req.user._id,
    });

    return res.status(200).json({
      message: "Subscription fetched successfully",
      subscription,
    });
  } catch (error) {
    next(error);
  }
};

export const updateBillingCycleController = async (
  req,
  res,
  next
) => {
  try {
    const subscription =
      await updateSubscriptionBillingCycle({
        clinicId: req.params.clinicId,
        userId: req.user._id,
        billingCycle: req.body?.billingCycle,
      });

    return res.status(200).json({
      message: "Billing cycle updated successfully",
      subscription,
    });
  } catch (error) {
    next(error);
  }
};
