const mongoose = require("mongoose");

// Money SAMSTHE received from a business. Not to be confused with Order.payments (a business's own sales).
const PAYMENT_METHODS = ["card", "upi", "netbanking", "wallet", "bank_transfer", "cash", "other"];
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"];

const paymentSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription" },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    status: { type: String, enum: PAYMENT_STATUSES, default: "pending", index: true },
    gatewayReference: { type: String, trim: true, default: "" },
    paidAt: { type: Date },
    notes: { type: String, trim: true, default: "" },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    utr: { type: String },
      rejectedUtr: { type: String },
      rejectReason: { type: String },
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
  },
  { timestamps: true }
);

paymentSchema.index(
  { razorpayPaymentId: 1 },
  { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: "string" } } }
);

module.exports = mongoose.model("Payment", paymentSchema);
module.exports.PAYMENT_METHODS = PAYMENT_METHODS;
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;