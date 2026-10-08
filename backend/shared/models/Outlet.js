const mongoose = require("mongoose");

const outletSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    name: { type: String, required: [true, "Outlet name is required"], trim: true },
    address: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Outlet", outletSchema);