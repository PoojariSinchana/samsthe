const mongoose = require("mongoose");

// Replaces Order + ShopSale. Restaurants use dineIn/takeaway/delivery; shops use "counter".
// Stats should group by customerId; customerSnapshot keeps walk-in name/phone as typed.
const CHANNELS = ["dineIn", "takeaway", "delivery", "counter"];
const LINE_STATUSES = ["pending", "preparing", "ready", "served", "cancelled", "returned"];
const ORDER_STATUSES = ["pending", "preparing", "ready", "served", "completed", "cancelled"];

const lineSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },                 // snapshots: survive later edits
    sku: { type: String },
    variantLabel: { type: String },
    basePrice: { type: Number },
    addOns: [{ name: { type: String, required: true }, price: { type: Number, required: true } }],
    price: { type: Number, required: true },                // unit price incl. add-ons
    quantity: { type: Number, required: true, min: 1 },
    discount: { type: Number, default: 0 },                 // per-line, absolute
    notes: { type: String, default: "" },
    status: { type: String, enum: LINE_STATUSES, default: "pending" },
  },
  { _id: true }
);

const paymentSchema = new mongoose.Schema(
  {
    method: { type: String, enum: ["cash", "card", "upi", "wallet", "other"], required: true },
    amount: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, default: Date.now },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { _id: true }
);

const orderSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    outletId: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", required: true },
    number: { type: String, required: true },               // daily counter, so NOT unique on its own
    channel: { type: String, enum: CHANNELS, required: true },
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: "Table" },
    guestCount: { type: Number, min: 1 },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", index: true },
    customerSnapshot: { name: { type: String, default: "" }, phone: { type: String, default: "" } },
    deliveryAddress: { type: String, default: "" },
    lines: { type: [lineSchema], validate: (v) => v.length > 0 },
    status: { type: String, enum: ORDER_STATUSES, default: "pending", index: true },
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    payments: { type: [paymentSchema], default: [] },
    amountPaid: { type: Number, default: 0 },
    amountDue: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ["unpaid", "partial", "paid"], default: "unpaid", index: true },
    billGenerated: { type: Boolean, default: false },
    notes: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

orderSchema.methods.recalculate = function () {
  this.subtotal = this.lines
    .filter((l) => !["cancelled", "returned"].includes(l.status))
    .reduce((s, l) => s + l.price * l.quantity - (l.discount || 0), 0);
  this.total = Math.max(this.subtotal - (this.discount || 0) + (this.tax || 0), 0);
  this.amountPaid = this.payments.reduce((s, p) => s + p.amount, 0);
  this.amountDue = Math.max(this.total - this.amountPaid, 0);
  this.paymentStatus = this.amountPaid <= 0 ? "unpaid" : this.amountPaid < this.total ? "partial" : "paid";
};

orderSchema.index({ businessId: 1, outletId: 1, createdAt: -1 });
orderSchema.index({ businessId: 1, number: 1 });

module.exports = mongoose.model("Order", orderSchema);
module.exports.CHANNELS = CHANNELS;