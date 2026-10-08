const mongoose = require("mongoose");

// Replaces Purchase + ShopPurchase.
const lineSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    sku: { type: String },
    quantity: { type: Number, required: true, min: 0.01 },
    price: { type: Number, required: true, min: 0 },         // cost per unit
    lineTotal: { type: Number, required: true },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    method: { type: String, enum: ["cash", "card", "upi", "bank", "other"], required: true },
    amount: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, default: Date.now },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { _id: true }
);

const purchaseSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    outletId: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", required: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    date: { type: Date, default: Date.now },
    lines: { type: [lineSchema], validate: (v) => v.length > 0 },
    totalAmount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ["cash", "card", "upi", "bank", "other", "credit"], default: "cash" },
    payments: { type: [paymentSchema], default: [] },
    amountPaid: { type: Number, default: 0 },
    amountDue: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ["unpaid", "partial", "paid"], default: "unpaid", index: true },
    notes: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

purchaseSchema.methods.recalculate = function () {
  this.amountPaid = this.payments.reduce((s, p) => s + p.amount, 0);
  this.amountDue = Math.max(this.totalAmount - this.amountPaid, 0);
  this.paymentStatus = this.amountPaid <= 0 ? "unpaid" : this.amountPaid < this.totalAmount ? "partial" : "paid";
};

purchaseSchema.index({ businessId: 1, outletId: 1, date: -1 });

module.exports = mongoose.model("Purchase", purchaseSchema);