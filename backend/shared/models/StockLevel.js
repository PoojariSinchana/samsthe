const mongoose = require("mongoose");

// Replaces InventoryItem.currentStock + ProductStock. One row per (outlet, item, variant).
// Never edit currentStock directly: go through services/stockService.recordMovement.
const stockLevelSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    outletId: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, required: true },   // Item.variants[i]._id
    currentStock: { type: Number, required: true, default: 0 },
    minStock: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

stockLevelSchema.index({ outletId: 1, itemId: 1, variantId: 1 }, { unique: true });

module.exports = mongoose.model("StockLevel", stockLevelSchema);