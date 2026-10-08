const mongoose = require("mongoose");

// Replaces MenuItem + Product + InventoryItem.
//   type "menu"       -> something a restaurant sells (dish)
//   type "product"    -> something a shop sells (SKU-based)
//   type "ingredient" -> something a restaurant buys and stocks
// EVERY item has >= 1 variant, so stock, POS and purchases work off one shape.
// A dish with no sizes gets one variant labelled "Regular".
const ITEM_TYPES = ["menu", "product", "ingredient"];
const UNITS = ["kg", "g", "l", "ml", "pcs", "packet", "box"];

const attributeSchema = new mongoose.Schema(
  { name: { type: String, required: true, trim: true }, value: { type: String, required: true, trim: true } },
  { _id: false }
);

const variantSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: "Regular" },   // "Small", "M / Black"
    sku: { type: String, trim: true },                          // shops; leave undefined if unused
    barcode: { type: String, trim: true },
    attributes: { type: [attributeSchema], default: [] },
    price: { type: Number, required: true, min: 0 },            // selling price
    costPrice: { type: Number, default: 0, min: 0 },            // last purchase cost
    image: { type: String, default: "" },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const addOnSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  isActive: { type: Boolean, default: true },
});

const itemSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    type: { type: String, enum: ITEM_TYPES, required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    brandId: { type: mongoose.Schema.Types.ObjectId, ref: "Brand" },
    images: [{ type: String }],
    tags: [{ type: String, trim: true }],
    unit: { type: String, enum: UNITS },                        // ingredients only
    variants: { type: [variantSchema], validate: (v) => v.length > 0 },

    // Only meaningful when type === "menu"
    menu: {
      isVeg: { type: Boolean, default: true },
      addOns: { type: [addOnSchema], default: [] },
      pricingByOrderType: {
        dineIn: { type: Number, min: 0 },
        takeaway: { type: Number, min: 0 },
        delivery: { type: Number, min: 0 },
      },
    },

    isAvailable: { type: Boolean, default: true },              // "sold out today" toggle
    isActive: { type: Boolean, default: true },                 // soft delete
  },
  { timestamps: true }
);

// Mongo treats "" as a real value in a unique index, so empty SKUs/barcodes must be undefined.
itemSchema.pre("validate", function (next) {
  for (const v of this.variants) {
    if (!v.sku) v.sku = undefined;
    if (!v.barcode) v.barcode = undefined;
  }
  next();
});

itemSchema.index({ businessId: 1, type: 1, categoryId: 1, name: 1 });
// SKU unique per business across every item (unique multikey index; enforced across documents).
itemSchema.index(
  { businessId: 1, "variants.sku": 1 },
  { unique: true, partialFilterExpression: { "variants.sku": { $type: "string" } } }
);

module.exports = mongoose.model("Item", itemSchema);
module.exports.ITEM_TYPES = ITEM_TYPES;
module.exports.UNITS = UNITS;