const mongoose = require("mongoose");

const ENTRY_TYPES = ["INCOME", "EXPENSE", "INVENTORY", "PURCHASE", "ASSET", "LIABILITY", "EQUITY", "TRANSFER"];
const PAYMENT_METHODS = ["cash", "bank", "upi", "card", "credit"];
const SOURCES = ["MANUAL", "ORDER"];
const STATUSES = ["CONFIRMED", "CANCELLED"];
const DIRECTIONS = ["in", "out"];

const CATEGORIES_BY_TYPE = {
  INCOME: ["FOOD_SALES", "BEVERAGE_SALES", "DELIVERY_SALES", "PRODUCT_SALES", "OTHER_INCOME"],
  EXPENSE: ["RENT", "ELECTRICITY", "INTERNET", "SALARY", "MARKETING", "REPAIRS", "OTHER"],
  INVENTORY: ["RAW_MATERIAL", "BEVERAGES", "PACKAGING", "CONSUMABLES", "OTHER"],
  PURCHASE: ["PACKAGING", "EQUIPMENT_SUPPLIES", "OTHER"],
  ASSET: ["KITCHEN_EQUIPMENT", "FURNITURE", "ELECTRONICS", "VEHICLE"],
  LIABILITY: ["LOAN", "TAX", "OTHER"],
  EQUITY: ["OWNER_CAPITAL", "OWNER_WITHDRAWAL"],
  TRANSFER: ["TRANSFER"],
};

const entrySchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet" },
    entryType: { type: String, enum: ENTRY_TYPES, required: true },
    category: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    quantity: { type: Number, min: 0 },
    unit: { type: String, trim: true },
    supplierName: { type: String, trim: true, default: "" },
    direction: { type: String, enum: DIRECTIONS },
    transferFrom: { type: String, enum: PAYMENT_METHODS },
    transferTo: { type: String, enum: PAYMENT_METHODS },
    paymentMethod: { type: String, enum: PAYMENT_METHODS },
    date: { type: Date, required: true, default: Date.now },
    source: { type: String, enum: SOURCES, default: "MANUAL" },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    paymentId: { type: mongoose.Schema.Types.ObjectId },
    status: { type: String, enum: STATUSES, default: "CONFIRMED" },
    notes: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

entrySchema.index({ businessId: 1, date: -1 });
entrySchema.index({ businessId: 1, entryType: 1 });
entrySchema.index({ businessId: 1, paymentId: 1 }, { unique: true, partialFilterExpression: { paymentId: { $exists: true } } });

module.exports = mongoose.model("Entry", entrySchema);
module.exports.ENTRY_TYPES = ENTRY_TYPES;
module.exports.PAYMENT_METHODS = PAYMENT_METHODS;
module.exports.CATEGORIES_BY_TYPE = CATEGORIES_BY_TYPE;
module.exports.DIRECTIONS = DIRECTIONS;