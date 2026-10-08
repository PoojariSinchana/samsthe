const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    notes: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

supplierSchema.index({ businessId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Supplier", supplierSchema);