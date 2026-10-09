import crypto from "node:crypto";
import { processSubscriptionWebhook } from "../services/subscriptionPaymentService.js";

export const handleRazorpayWebhook = async (req, res, next) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];

    if (!webhookSecret) {
      return res.status(503).json({
        message: "Webhook is not configured",
      });
    }

    if (typeof signature !== "string") {
      return res.status(400).json({
        message: "Missing webhook signature",
      });
    }

    // Razorpay requires the original raw request body.
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({
        message: "Invalid webhook payload",
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(req.body)
      .digest("hex");

    const received = Buffer.from(signature, "hex");
    const expected = Buffer.from(expectedSignature, "hex");

    if (
      received.length !== expected.length ||
      !crypto.timingSafeEqual(received, expected)
    ) {
      return res.status(400).json({
        message: "Invalid webhook signature",
      });
    }

    const event = JSON.parse(req.body.toString("utf8"));

    // Only process captured subscription payments.
    if (event.event !== "payment.captured") {
      return res.status(200).json({
        received: true,
        ignored: true,
      });
    }

    const payment = event.payload?.payment?.entity;

    if (!payment?.id || !payment?.order_id) {
      return res.status(400).json({
        message: "Invalid payment event",
      });
    }

    await processSubscriptionWebhook({
      razorpayOrderId: payment.order_id,
      razorpayPaymentId: payment.id,
    });

    return res.status(200).json({
      received: true,
    });
  } catch (error) {
    next(error);
  }
};