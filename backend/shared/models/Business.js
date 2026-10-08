const mongoose = require("mongoose");

// Replaces Restaurant.js. This was always "the tenant" (retail shops were stored as "restaurants").
// appType is gone: derive it from appId -> App.slug.
const BUSINESS_TYPES = [
  "restaurant", "cafe", "cloud_kitchen", "bar", "food_truck",
  "clothing", "grocery", "electronics", "pharmacy", "general_store", "footwear", "other",
];
const FINANCIAL_YEAR_OPTIONS = ["Apr - Mar", "Jan - Dec", "Jul - Jun", "Oct - Sep"];

const businessSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    appId: { type: mongoose.Schema.Types.ObjectId, ref: "App", required: true, index: true },
    businessType: { type: String, enum: BUSINESS_TYPES, default: "other" },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    address: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "" },
    financialYear: { type: String, enum: FINANCIAL_YEAR_OPTIONS, default: "Apr - Mar" },
    logoUrl: { type: String, trim: true, default: "" },
    imageUrl: { type: String, trim: true, default: "" },
    gst: { registered: { type: Boolean, default: false }, number: { type: String, trim: true, default: "" } },
    trialUsedAt: { type: Date, default: null }, // set once, never cleared: the trial is one per business
    setupCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Business", businessSchema);
module.exports.BUSINESS_TYPES = BUSINESS_TYPES;
module.exports.FINANCIAL_YEAR_OPTIONS = FINANCIAL_YEAR_OPTIONS;