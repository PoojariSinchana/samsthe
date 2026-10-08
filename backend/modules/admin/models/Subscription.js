const mongoose = require("mongoose");

const BILLING_CYCLES = ["monthly", "yearly"];
const SUBSCRIPTION_STATUSES = ["PENDING", "TRIAL", "ACTIVE", "PAST_DUE", "CANCELLED", "SUSPENDED", "EXPIRED"];

// One subscription per business. `planId` replaces the old free-text `plan` key.
const subscriptionSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, unique: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "PricingPlan", required: true },
    billingCycle: { type: String, enum: BILLING_CYCLES, default: "monthly" },
    status: { type: String, enum: SUBSCRIPTION_STATUSES, default: "TRIAL", index: true },
    amount: { type: Number, required: true, default: 0 },
    trialEndsAt: { type: Date },
    currentPeriodStart: { type: Date, default: Date.now },
    currentPeriodEnd: { type: Date },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, trim: true, default: "" },
    limits: { maxOutlets: { type: Number, default: 1 }, maxStaff: { type: Number, default: 5 } },
    notes: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
    pendingPlanId: { type: mongoose.Schema.Types.ObjectId, ref: "PricingPlan", default: undefined },
    pendingBillingCycle: { type: String, enum: BILLING_CYCLES, default: undefined },
    trialReminderSentAt: { type: Date, default: null }, // used by the sweep job in step 5
  },
  { timestamps: true }
);

subscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });

module.exports = mongoose.model("Subscription", subscriptionSchema);
module.exports.BILLING_CYCLES = BILLING_CYCLES;
module.exports.SUBSCRIPTION_STATUSES = SUBSCRIPTION_STATUSES;