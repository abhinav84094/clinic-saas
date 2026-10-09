
import {
  createSubscriptionPaymentOrder,
  verifySubscriptionPayment,
} from "../services/subscriptionPaymentService.js";



export const createPaymentOrder = async (req, res, next) => {
  try {
    const { clinicId } = req.params;

    const userId = req.user._id;

    const order = await createSubscriptionPaymentOrder({
      clinicId,
      userId,
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
    const { clinicId } = req.params;

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const result = await verifySubscriptionPayment({
      clinicId,
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
