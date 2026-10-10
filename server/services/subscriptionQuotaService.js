import { getPlanConfig } from "./subscriptionService.js";

export const calculateUpgradeQuota = ({
  subscription,
  toPlan,
}) => {
  const config = getPlanConfig(
    toPlan,
    subscription.billingCycle
  );

  if (config.bookingLimit === null) {
    return null;
  }

  const remaining =
    subscription.bookingLimit === null
      ? 0
      : Math.max(
          0,
          subscription.bookingLimit - subscription.bookingsUsed
        );

  const total = config.bookingLimit + remaining;

  if (!Number.isSafeInteger(total)) {
    throw new Error("Booking quota overflow");
  }

  return total;
};