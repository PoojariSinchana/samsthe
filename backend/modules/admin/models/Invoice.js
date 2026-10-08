const mongoose = require("mongoose");

const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue", "cancelled"];

const invoiceLineItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 1, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription" },
    lineItems: { type: [invoiceLineItemSchema], required: true, validate: (v) => v.length > 0 },
    subtotal: { type: Number, required: true, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true, default: 0 },
    status: { type: String, enum: INVOICE_STATUSES, default: "draft", index: true },
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    paidAt: { type: Date, default: null },
    notes: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
    kind: { type: String, enum: ["subscription", "custom"], default: "custom", index: true },
  },
  { timestamps: true }
);

invoiceSchema.methods.recalculate = function () {
  this.subtotal = this.lineItems.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  this.total = Math.max(this.subtotal + (this.tax || 0), 0);
};

invoiceSchema.index({ businessId: 1, issueDate: -1 });
invoiceSchema.index({ status: 1, dueDate: 1 });

module.exports = mongoose.model("Invoice", invoiceSchema);
module.exports.INVOICE_STATUSES = INVOICE_STATUSES;