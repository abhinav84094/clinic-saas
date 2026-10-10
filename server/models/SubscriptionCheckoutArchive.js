import mongoose from "mongoose";

// Retired uncertain attempts remain recoverable if a late provider order appears.
const schema = new mongoose.Schema({
  clinicId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  subscriptionId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  receipt: { type: String, required: true, unique: true, immutable: true },
  draft: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
  operator: { type: String, required: true, immutable: true },
  reason: { type: String, required: true, immutable: true },
}, { timestamps: true, strict: "throw" });

export default mongoose.model("SubscriptionCheckoutArchive", schema);
