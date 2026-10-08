const mongoose = require("mongoose");

// Replaces StockMovement + ShopStockMovement. The audit trail behind every StockLevel change.
// refType/refId replace the separate `purchase` and `sale` fields.
const ADJUST_REASONS = ["wastage", "damaged", "spoiled", "theft", "lost", "counting_error", "return_to_stock", "correction"];
const REF_TYPES = ["purchase", "order", "manual", "opening"];

const stockMovementSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    outletId: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true, index: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    type: { type: String, enum: ["IN", "OUT", "ADJUST"], required: true },
    quantity: { type: Number, required: true },                 // signed
    reason: { type: String, default: "" },
    costPerUnit: { type: Number },
    supplierName: { type: String, trim: true, default: "" },
    refType: { type: String, enum: REF_TYPES, default: "manual" },
    refId: { type: mongoose.Schema.Types.ObjectId },
    notes: { type: String, default: "" },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

stockMovementSchema.index({ businessId: 1, outletId: 1, createdAt: -1 });
stockMovementSchema.index({ refType: 1, refId: 1 });

module.exports = mongoose.model("StockMovement", stockMovementSchema);
module.exports.ADJUST_REASONS = ADJUST_REASONS;