const mongoose = require("mongoose");

// One doc per (app, plan). Prices are rupees per billing cycle.
// Plans are never hard-deleted (subscriptions reference `key`), only deactivated.
const pricingPlanSchema = new mongoose.Schema(
  {
    appType: { type: String, enum: ["restaurant", "retail"], required: true },
    key: { type: String, required: true, trim: true, lowercase: true }, // e.g. "starter"
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    monthlyPrice: { type: Number, required: true, min: 0, default: 0 },
    yearlyPrice: { type: Number, required: true, min: 0, default: 0 },
    isTrial: { type: Boolean, default: false }, // the plan new signups start on
    trialDays: { type: Number, min: 0, default: 0 },
    modules: { type: [String], default: undefined }, // enabled feature keys; undefined = everything (old plans stay unlocked)
    limits: {
      maxOutlets: { type: Number, min: 1, default: 1 },
      maxStaff: { type: Number, min: 1, default: 5 },
    },
    features: [{ type: String, trim: true }], // shown on the pricing page
    isPublic: { type: Boolean, default: true }, // false = custom/negotiated plan
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

pricingPlanSchema.index({ appType: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("PricingPlan", pricingPlanSchema);