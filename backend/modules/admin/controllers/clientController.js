const mongoose = require("mongoose");
const Business = require("../../../shared/models/Business");
const Outlet = require("../../../shared/models/Outlet");
const User = require("../../../shared/models/User");
const App = require("../../../shared/models/app");
const Subscription = require("../models/Subscription");
const { SUBSCRIPTION_STATUSES, BILLING_CYCLES } = require("../models/Subscription");
const PricingPlan = require("../models/PricingPlan");
const Invoice = require("../models/Invoice");
const Payment = require("../models/Payment");
const { appMaps, withAppType, shapeSub, paidTotals } = require("../utils/billing");
const { notify } = require("../../../shared/services/notify");

const escapeRe = (s) => s.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toMap = (rows) => new Map(rows.map((r) => [String(r._id), r.n]));
const num = (v) => (v === "" || v == null ? undefined : Number(v));

// Starts a fresh billing period from now (trial length for trial plans).
function startPeriod(sub, isTrial, trialDays = 0) {
  const now = new Date();
  const end = new Date(now);
  if (isTrial) end.setDate(end.getDate() + (trialDays || 0));
  else if (sub.billingCycle === "yearly") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  sub.currentPeriodStart = now;
  sub.currentPeriodEnd = end;
  sub.trialEndsAt = isTrial ? end : undefined;
}

const clientController = {
  async getMeta(req, res) {
    try {
      const [apps, plans] = await Promise.all([
        App.find({}, "slug name").lean(),
        PricingPlan.find({ isActive: true }).sort({ appType: 1, sortOrder: 1 }).lean(),
      ]);
      res.json({ apps: apps.map((a) => ({ slug: a.slug, name: a.name })), plans, statuses: SUBSCRIPTION_STATUSES, billingCycles: BILLING_CYCLES });
    } catch (err) {
      res.status(500).json({ message: "Failed to load options", error: err.message });
    }
  },

  // Every business (client) with its subscription, owner and usage.
  async getClients(req, res) {
    try {
      const { appType, search, status, page = 1, limit = 20 } = req.query;
      const maps = await appMaps();
      const filter = {};
      if (appType) filter.appId = maps.idBySlug.get(appType) || { $in: [] };
      if (search) {
        const re = new RegExp(escapeRe(search), "i");
        filter.$or = [{ name: re }, { phone: re }, { email: re }, { city: re }];
      }
      if (status === "NONE") {
        filter._id = { $nin: await Subscription.distinct("businessId") };
      } else if (status) {
        const ids = await Subscription.find({ status }, "businessId").lean();
        filter._id = { $in: ids.map((s) => s.businessId) };
      }

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

      const [businesses, total, byApp, bySub] = await Promise.all([
        Business.find(filter).populate("ownerId", "name email phone").sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
        Business.countDocuments(filter),
        Business.aggregate([{ $group: { _id: "$appId", count: { $sum: 1 } } }]),
        Subscription.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      ]);

      const ids = businesses.map((b) => b._id);
      const [subs, outletRows, userRows] = await Promise.all([
        Subscription.find({ businessId: { $in: ids } }).populate("planId", "key name").lean(),
        Outlet.aggregate([{ $match: { businessId: { $in: ids }, isActive: true } }, { $group: { _id: "$businessId", n: { $sum: 1 } } }]),
        User.aggregate([{ $match: { businessId: { $in: ids } } }, { $group: { _id: "$businessId", n: { $sum: 1 } } }]),
      ]);
      const subBy = new Map(subs.map((s) => [String(s.businessId), shapeSub(s)]));
      const outletBy = toMap(outletRows);
      const userBy = toMap(userRows);

      const totalAll = byApp.reduce((s, r) => s + r.count, 0);
      const bySubscription = Object.fromEntries(bySub.map((r) => [r._id, r.count]));
      bySubscription.NONE = Math.max(0, totalAll - bySub.reduce((s, r) => s + r.count, 0));

      res.json({
        clients: businesses.map((b) => ({
          ...withAppType(b, maps),
          owner: b.ownerId,
          ownerId: b.ownerId?._id,
          subscription: subBy.get(String(b._id)) || null,
          outletCount: outletBy.get(String(b._id)) || 0,
          userCount: userBy.get(String(b._id)) || 0,
        })),
        total, page: pageNum, pages: Math.max(1, Math.ceil(total / limitNum)),
        summary: {
          total: totalAll,
          byType: Object.fromEntries(byApp.map((r) => [maps.slugById.get(String(r._id)) || "unknown", r.count])),
          bySubscription,
        },
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch clients", error: err.message });
    }
  },

  async getClient(req, res) {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid client id" });
      const maps = await appMaps();
      const b = await Business.findById(req.params.id).populate("ownerId", "name email phone lastLogin").lean();
      if (!b) return res.status(404).json({ message: "Client not found" });

      const [sub, outlets, roleRows, lastLoginUser, invoices, payments] = await Promise.all([
        Subscription.findOne({ businessId: b._id }).populate("planId", "key name monthlyPrice yearlyPrice limits").lean(),
        Outlet.find({ businessId: b._id }, "name isActive").sort({ createdAt: 1 }).lean(),
        User.aggregate([{ $match: { businessId: b._id } }, { $group: { _id: "$role", n: { $sum: 1 } } }]),
        User.findOne({ businessId: b._id, lastLogin: { $ne: null } }, "lastLogin").sort({ lastLogin: -1 }).lean(),
        Invoice.find({ businessId: b._id }).sort({ createdAt: -1 }).limit(10).lean(),
        Payment.find({ businessId: b._id }).sort({ createdAt: -1 }).limit(10).lean(),
      ]);
      const paidMap = await paidTotals(invoices.map((i) => i._id));
      const usersByRole = Object.fromEntries(roleRows.map((r) => [r._id, r.n]));

      res.json({
        client: { ...withAppType(b, maps), owner: b.ownerId, ownerId: b.ownerId?._id },
        subscription: shapeSub(sub) || null,
        outlets,
        usersByRole,
        lastActivity: lastLoginUser?.lastLogin || null,
        usage: {
          outlets: outlets.filter((o) => o.isActive).length,
          users: Object.values(usersByRole).reduce((s, n) => s + n, 0),
          maxOutlets: sub?.limits?.maxOutlets,
          maxStaff: sub?.limits?.maxStaff,
        },
        invoices: invoices.map((i) => {
          const amountPaid = paidMap.get(String(i._id)) || 0;
          return { ...i, amountPaid, amountDue: Math.max(0, i.total - amountPaid) };
        }),
        payments,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch client", error: err.message });
    }
  },

  // Create or change a business's subscription.
  // Accepts planId (preferred) or the plan key. A new plan / billing cycle starts a fresh period
  // with the plan's price and limits; otherwise the admin's amount, limits and dates are kept.
  async upsertSubscription(req, res) {
    try {
      const { planId, plan: planKey, billingCycle = "monthly", status, notes, amount, limits, trialEndsAt, currentPeriodEnd } = req.body;
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid client id" });
      if (!BILLING_CYCLES.includes(billingCycle)) return res.status(400).json({ message: "Invalid billing cycle" });
      if (status !== undefined && !SUBSCRIPTION_STATUSES.includes(status)) return res.status(400).json({ message: "Invalid status" });

      const [business, maps] = await Promise.all([Business.findById(req.params.id), appMaps()]);
      if (!business) return res.status(404).json({ message: "Client not found" });
      const appSlug = maps.slugById.get(String(business.appId));

      const plan = mongoose.isValidObjectId(planId)
        ? await PricingPlan.findById(planId)
        : planKey ? await PricingPlan.findOne({ appType: appSlug, key: String(planKey).toLowerCase() }) : null;
      if (!plan) return res.status(400).json({ message: "Select a plan" });
      if (plan.appType !== appSlug) return res.status(400).json({ message: `That plan is for the ${plan.appType} app, not this client's app` });

      let sub = await Subscription.findOne({ businessId: business._id });
      const isNew = !sub;
      const planChanged = !isNew && (String(sub.planId) !== String(plan._id) || sub.billingCycle !== billingCycle);
      const freshPeriod = isNew || planChanged;
      if (isNew) sub = new Subscription({ businessId: business._id, createdBy: req.admin._id });

      sub.planId = plan._id;
      sub.billingCycle = billingCycle;
      if (freshPeriod) {
        sub.amount = plan.isTrial ? 0 : billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
        sub.limits = { maxOutlets: plan.limits?.maxOutlets, maxStaff: plan.limits?.maxStaff };
      }
      if (planChanged) { sub.pendingPlanId = undefined; sub.pendingBillingCycle = undefined; } // a stale pending upgrade must not override the admin's choice

      // Admin overrides (custom price / limits)
      const amt = num(amount);
      if (amt !== undefined) {
        if (Number.isNaN(amt) || amt < 0) return res.status(400).json({ message: "Amount must be 0 or more" });
        sub.amount = amt;
      }
      const mo = num(limits?.maxOutlets);
      const ms = num(limits?.maxStaff);
      if ((mo !== undefined && !(mo >= 1)) || (ms !== undefined && !(ms >= 1))) return res.status(400).json({ message: "Limits must be at least 1" });
      sub.limits = { maxOutlets: mo ?? sub.limits?.maxOutlets, maxStaff: ms ?? sub.limits?.maxStaff };

      if (notes !== undefined) sub.notes = notes;
      sub.status = status || (freshPeriod ? (plan.isTrial ? "TRIAL" : "ACTIVE") : sub.status);
      if (sub.status === "CANCELLED") sub.cancelledAt = sub.cancelledAt || new Date();
      else { sub.cancelledAt = null; sub.cancelReason = ""; }

      if (freshPeriod) {
        startPeriod(sub, plan.isTrial, plan.trialDays);
      } else {
        if (trialEndsAt !== undefined) sub.trialEndsAt = trialEndsAt || undefined;
        if (currentPeriodEnd !== undefined) sub.currentPeriodEnd = currentPeriodEnd || undefined;
        // Reviving a subscription whose period already ran out: give it a fresh one so the sweep doesn't flip it straight back.
        if (sub.status === "ACTIVE" && (!sub.currentPeriodEnd || sub.currentPeriodEnd < new Date())) startPeriod(sub, false);
      }

      if (plan.isTrial && freshPeriod && !business.trialUsedAt) {
        business.trialUsedAt = new Date();
        await business.save();
      }

      await sub.save();

      if (planChanged) {
        const paidInv = await Payment.distinct("invoiceId", { subscriptionId: sub._id, status: "paid" });
        await Invoice.updateMany(
          { subscriptionId: sub._id, kind: "subscription", status: { $in: ["draft", "sent", "overdue"] }, _id: { $nin: paidInv } },
          { status: "cancelled" }
        );
      }
      if (isNew || planChanged) {
        await notify({ businessId: business._id, userId: business.ownerId, type: "subscription",
          title: "Your plan was updated", message: `You're now on the ${plan.name} plan (${billingCycle}).`, section: "subscription" });
      }

      await sub.populate("planId", "key name");
      res.json({ message: isNew ? "Subscription created" : "Subscription updated", subscription: shapeSub(sub.toObject()) });
    } catch (err) {
      res.status(400).json({ message: err.message || "Failed to save subscription" });
    }
  },
};

module.exports = clientController;