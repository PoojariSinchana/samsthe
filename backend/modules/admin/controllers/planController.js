const PricingPlan = require("../models/PricingPlan");

const EDITABLE = ["name", "description", "monthlyPrice", "yearlyPrice", "isTrial", "trialDays", "features", "modules", "isPublic", "isActive", "sortOrder"];

function cleanBody(body) {
  const data = {};
  for (const f of EDITABLE) if (body[f] !== undefined) data[f] = body[f];
  if (body.limits) {
    data["limits.maxOutlets"] = Number(body.limits.maxOutlets) || 1;
    data["limits.maxStaff"] = Number(body.limits.maxStaff) || 1;
  }
  for (const f of ["monthlyPrice", "yearlyPrice", "trialDays", "sortOrder"]) if (data[f] !== undefined) data[f] = Number(data[f]);
  if (typeof data.features === "string") data.features = data.features.split("\n").map((s) => s.trim()).filter(Boolean);
  return data;
}

// Only one active trial plan per app, so signup knows which to use.
async function clearOtherTrials(appType, exceptId) {
  await PricingPlan.updateMany({ appType, isTrial: true, _id: { $ne: exceptId } }, { $set: { isTrial: false } });
}

const planController = {
  async listPlans(req, res) {
    try {
      const filter = req.query.appType ? { appType: req.query.appType } : {};
      const plans = await PricingPlan.find(filter).sort({ appType: 1, sortOrder: 1, monthlyPrice: 1 });
      res.json({ plans });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch plans", error: err.message });
    }
  },

  async createPlan(req, res) {
    try {
      const { appType, key, name } = req.body;
      if (!appType || !key || !name) return res.status(400).json({ message: "App, key and name are required" });
      if (!/^[a-z0-9_-]+$/i.test(key)) return res.status(400).json({ message: "Key can only contain letters, numbers, - and _" });
      const plan = await PricingPlan.create({ appType, key: key.toLowerCase(), ...cleanBody({ ...req.body, limits: undefined }), limits: req.body.limits });
      if (plan.isTrial) await clearOtherTrials(appType, plan._id);
      res.status(201).json({ message: "Plan created", plan });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ message: "This app already has a plan with that key" });
      res.status(400).json({ message: err.message || "Failed to create plan" });
    }
  },

  async updatePlan(req, res) {
    try {
      const plan = await PricingPlan.findByIdAndUpdate(req.params.id, { $set: cleanBody(req.body) }, { new: true, runValidators: true });
      if (!plan) return res.status(404).json({ message: "Plan not found" });
      if (plan.isTrial) await clearOtherTrials(plan.appType, plan._id);
      res.json({ message: "Plan updated", plan });
    } catch (err) {
      res.status(400).json({ message: err.message || "Failed to update plan" });
    }
  },

  // Public: for pricing sections on the marketing pages.
  async publicPlans(req, res) {
  try {
    const { appType } = req.query;
    const filter = { isActive: true, isPublic: true, isTrial: false };
    if (appType) filter.appType = appType;
    const [plans, trial] = await Promise.all([
      PricingPlan.find(filter, "-createdAt -updatedAt -__v").sort({ sortOrder: 1, monthlyPrice: 1 }),
      appType ? PricingPlan.findOne({ appType, isActive: true, isTrial: true }, "-createdAt -updatedAt -__v") : null,
    ]);
    res.json({ plans, trial });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch plans" });
  }
},
};

module.exports = planController;