require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const PricingPlan = require("../modules/admin/models/PricingPlan");

// PLACEHOLDER PRICES (₹) — edit these in Admin → Pricing. Re-running this
// script never overwrites edits (it only inserts plans that don't exist).
const tiers = [
  { key: "trial", name: "Free Trial", monthlyPrice: 0, yearlyPrice: 0, isTrial: true, trialDays: 14, isPublic: false, sortOrder: 0,
    limits: { maxOutlets: 1, maxStaff: 2 }, features: ["Billing, orders & menu", "Customers & suppliers", "Dashboard"] },
  { key: "plus", name: "Plus", description: "Run one location with basic money tracking", monthlyPrice: 499, yearlyPrice: 4990, sortOrder: 1,
    limits: { maxOutlets: 1, maxStaff: 5 }, features: ["Split payments", "Purchases & suppliers", "Accounting overview", "Basic reports", "Email support"] },
  { key: "pro", name: "Pro", description: "Multi-outlet with full accounting", monthlyPrice: 999, yearlyPrice: 9990, sortOrder: 2,
    limits: { maxOutlets: 3, maxStaff: 15 }, features: ["Full financial statements", "Analytics", "Custom staff permissions", "Reports + CSV export", "Priority support"] },
  { key: "promax", name: "Promax", description: "No limits, for growing chains", monthlyPrice: 1999, yearlyPrice: 19990, sortOrder: 3,
    limits: { maxOutlets: 50, maxStaff: 500 }, features: ["Everything in Pro", "Unlimited history", "Dedicated support"] },
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const appType of ["restaurant", "retail"]) {
    for (const t of tiers) {
      const r = await PricingPlan.updateOne({ appType, key: t.key }, { $setOnInsert: { appType, ...t } }, { upsert: true });
      console.log(`${appType}/${t.key}: ${r.upsertedCount ? "created" : "already exists"}`);
    }
  }
  await mongoose.disconnect();
}
run().catch((e) => { console.error(e); process.exit(1); });