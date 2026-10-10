// Keep all order creation on the same validation and locking path.
import { createPlanChangeOrder } from "./subscriptionPaymentService.js";

export const createUpgradeOrder = ({ clinicId, userId, toPlan, billingCycle }) =>
  createPlanChangeOrder({ clinicId, userId, purpose: "upgrade", toPlan, billingCycle });

export const createRenewalOrder = ({ clinicId, userId, billingCycle }) =>
  createPlanChangeOrder({ clinicId, userId, purpose: "renewal", billingCycle });
