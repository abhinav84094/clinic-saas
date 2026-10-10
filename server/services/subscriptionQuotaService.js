import { getPlanConfig } from "./subscriptionService.js";

export const calculateUpgradeQuota = ({
  subscription,
  toPlan,
  bookingLimit,
}) => {
  const config = getPlanConfig(
    toPlan,
    subscription.billingCycle
  );

  const purchasedLimit = bookingLimit === undefined ? config.bookingLimit : bookingLimit;

  if (purchasedLimit === null) {
    return null;
  }

  const remaining =
    subscription.bookingLimit === null
      ? 0
      : Math.max(
          0,
          subscription.bookingLimit - subscription.bookingsUsed
        );

  const total = purchasedLimit + remaining;

  if (!Number.isSafeInteger(total)) {
    throw new Error("Booking quota overflow");
  }

  return total;
};