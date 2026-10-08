const mongoose = require("mongoose");

// Restaurant-only. Keeps the `outlet` field name (resolveOutletFilter's default).
const tableSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", required: true, index: true },
    tableNumber: { type: String, required: true, trim: true },
    name: { type: String, trim: true, default: "" },
    capacity: { type: Number, required: true, min: 1 },
    shape: { type: String, enum: ["square", "round", "rectangle"], default: "square" },
    position: { x: { type: Number, default: 0 }, y: { type: Number, default: 0 } },
    status: { type: String, enum: ["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"], default: "AVAILABLE", index: true },
    cleaningUntil: { type: Date, default: null },
    location: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true },
    currentOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
  },
  { timestamps: true }
);

tableSchema.index({ outlet: 1, tableNumber: 1 }, { unique: true });

module.exports = mongoose.model("Table", tableSchema);