const mongoose = require("mongoose");

const brandSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    name: { type: String, required: true, trim: true },
    logo: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

brandSchema.index({ businessId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Brand", brandSchema);