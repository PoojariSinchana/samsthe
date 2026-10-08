const mongoose = require("mongoose");

const PARTNER_ROLES = ["Owner", "Partner", "Investor"];

const partnerSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: PARTNER_ROLES, default: "Partner" },
    sharePercentage: { type: Number, min: 0, max: 100 },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    photo: { type: String, default: "" },
    joinedDate: { type: Date },
    notes: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Partner", partnerSchema);
module.exports.PARTNER_ROLES = PARTNER_ROLES;