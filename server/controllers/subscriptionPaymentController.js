
import {
  createSubscriptionPaymentOrder,
  verifySubscriptionPayment,
  reconcileSubscriptionPayment,
  createPlanChangeOrder,
} from "../services/subscriptionPaymentService.js";

export const createPaymentOrder = async (req, res, next) => {
  try {
    const order = await createSubscriptionPaymentOrder({
      clinicId: req.params.clinicId,
      userId: req.user._id,
    });

    return res.status(201).json({
      message: "Subscription payment order created successfully",
      order,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyPaymentController = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body || {};

    const result = await verifySubscriptionPayment({
      clinicId: req.params.clinicId,
      userId: req.user._id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });

    return res.status(200).json({
      success: true,
      message: result.alreadyProcessed
        ? "Subscription payment was already verified"
        : "Subscription payment verified successfully",
      subscription: result,
    });
  } catch (error) {
    next(error);
  }
};

export const reconcilePaymentController = async (
  req,
  res,
  next
) => {
  try {
    const { razorpay_order_id } = req.body || {};

    if (
      typeof razorpay_order_id !== "string" ||
      !/^order_[A-Za-z0-9]+$/.test(razorpay_order_id)
    ) {
      return res.status(400).json({
        message: "A valid Razorpay order ID is required",
      });
    }

    const result = await reconcileSubscriptionPayment({
      clinicId: req.params.clinicId,
      userId: req.user._id,
      razorpayOrderId: razorpay_order_id,
    });

    return res.status(200).json({
      success: true,
      message: result.alreadyProcessed
        ? "Payment was already processed"
        : "Payment recovered and subscription activated",
      subscription: result,
    });
  } catch (error) {
    next(error);
  }
};




export const createUpgradeOrderController = async (
  req,
  res,
  next
) => {
  try {
    const order = await createPlanChangeOrder({
      clinicId: req.params.clinicId,
      userId: req.user._id,
      purpose: "upgrade",
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
    const order = await createPlanChangeOrder({
      clinicId: req.params.clinicId,
      userId: req.user._id,
      purpose: "renewal",
      billingCycle: req.body?.billingCycle,
    });

    return res.status(201).json({
      success: true,
      message: "Basic renewal checkout created",
      order,
    });
  } catch (error) {
    next(error);
  }
};
