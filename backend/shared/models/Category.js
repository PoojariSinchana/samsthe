const mongoose = require("mongoose");

// Replaces MenuCategory + ProductCategory + InventoryCategory (all were just { name, sortOrder }).
const CATEGORY_KINDS = ["menu", "product", "ingredient"];

const categorySchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    kind: { type: String, enum: CATEGORY_KINDS, required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.index({ businessId: 1, kind: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Category", categorySchema);
module.exports.CATEGORY_KINDS = CATEGORY_KINDS;