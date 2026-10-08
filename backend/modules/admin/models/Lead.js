const mongoose = require("mongoose");

const LEAD_STATUSES = ["NEW", "CONTACTED", "DEMO_SCHEDULED", "PROPOSAL_SENT", "NEGOTIATION", "CONVERTED", "LOST"];
const LEAD_SOURCES = ["website", "referral", "cold_call", "social_media", "walk_in", "other"];
const BUSINESS_TYPES = ["restaurant", "retail", "other"]; // matches App.slug

const leadSchema = new mongoose.Schema(
  {
    businessName: { type: String, required: true, trim: true },
    contactPerson: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    businessType: { type: String, enum: BUSINESS_TYPES, default: "restaurant" },
    source: { type: String, enum: LEAD_SOURCES, default: "other" },
    status: { type: String, enum: LEAD_STATUSES, default: "NEW", index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
    notes: { type: String, trim: true, default: "" },
    convertedToBusiness: { type: mongoose.Schema.Types.ObjectId, ref: "Business", default: null },
    convertedAt: { type: Date, default: null },
    lastContactedAt: { type: Date },
  },
  { timestamps: true }
);

leadSchema.index({ status: 1, createdAt: -1 });
leadSchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model("Lead", leadSchema);
module.exports.LEAD_STATUSES = LEAD_STATUSES;
module.exports.LEAD_SOURCES = LEAD_SOURCES;
module.exports.BUSINESS_TYPES = BUSINESS_TYPES;