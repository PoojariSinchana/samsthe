const Business = require("../../../shared/models/Business");
const Subscription = require("../models/Subscription");
const Lead = require("../models/Lead");
const Invoice = require("../models/Invoice");
const Payment = require("../models/Payment");
const { appMaps, withAppType, sweepOverdue } = require("../utils/billing");

const DAY = 864e5;

async function getSummary(req, res) {
  try {
    const can = (k) => req.admin.hasPermission(k);
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * DAY);
    const weekAgo = new Date(now.getTime() - 7 * DAY);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const out = {};

    if (can("VIEW_CLIENTS") || can("MANAGE_CLIENTS")) {
      const maps = await appMaps();
      const [total, byApp, newThisMonth, recent] = await Promise.all([
        Business.countDocuments(),
        Business.aggregate([{ $group: { _id: "$appId", count: { $sum: 1 } } }]),
        Business.countDocuments({ createdAt: { $gte: monthStart } }),
        Business.find({}, "name appId createdAt").sort({ createdAt: -1 }).limit(5).lean(),
      ]);
      out.clients = {
        total, newThisMonth,
        byType: Object.fromEntries(byApp.map((r) => [maps.slugById.get(String(r._id)) || "unknown", r.count])),
        recent: recent.map((b) => withAppType(b, maps)),
      };
    }

    if (can("VIEW_SUBSCRIPTIONS") || can("MANAGE_SUBSCRIPTIONS")) {
      const [byStatus, mrrAgg, trials, renewals] = await Promise.all([
        Subscription.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        Subscription.aggregate([
          { $match: { status: "ACTIVE" } },
          { $group: { _id: null, mrr: { $sum: { $cond: [{ $eq: ["$billingCycle", "yearly"] }, { $divide: ["$amount", 12] }, "$amount"] } } } },
        ]),
        Subscription.find({ status: "TRIAL", trialEndsAt: { $gte: now, $lte: in7 } }).populate("businessId", "name").sort({ trialEndsAt: 1 }).limit(5).lean(),
        Subscription.find({ status: "ACTIVE", currentPeriodEnd: { $gte: now, $lte: in7 } }).populate("businessId", "name").populate("planId", "key").sort({ currentPeriodEnd: 1 }).limit(5).lean(),
      ]);
      const mrr = Math.round(mrrAgg[0]?.mrr || 0);
      out.subscriptions = {
        mrr, arr: mrr * 12,
        byStatus: Object.fromEntries(byStatus.map((r) => [r._id, r.count])),
        // restaurantId kept as the key because the current admin UI reads it
        trialsEnding: trials.map((s) => ({ businessId: s.businessId, trialEndsAt: s.trialEndsAt })),
        renewalsDue: renewals.map((s) => ({ businessId: s.businessId, plan: s.planId?.key, currentPeriodEnd: s.currentPeriodEnd })),
      };
    }

    if (can("VIEW_LEADS") || can("MANAGE_LEADS")) {
      const [byStatus, newThisWeek] = await Promise.all([
        Lead.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        Lead.countDocuments({ createdAt: { $gte: weekAgo } }),
      ]);
      const map = Object.fromEntries(byStatus.map((r) => [r._id, r.count]));
      const open = byStatus.filter((r) => !["CONVERTED", "LOST"].includes(r._id)).reduce((s, r) => s + r.count, 0);
      out.leads = { open, newThisWeek, byStatus: map };
    }

    if (can("VIEW_INVOICES") || can("MANAGE_INVOICES") || can("VIEW_PAYMENTS") || can("MANAGE_PAYMENTS")) {
      await sweepOverdue();
      const sum = (match) => Invoice.aggregate([{ $match: match }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$total" } } }]);
      const [overdue, outstanding, month, recent] = await Promise.all([
        sum({ status: "overdue" }),
        sum({ status: { $in: ["sent", "overdue"] } }),
        Payment.aggregate([{ $match: { status: "paid", paidAt: { $gte: monthStart } } }, { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } }]),
        Payment.find({ status: "paid" }).sort({ paidAt: -1 }).limit(5).populate("businessId", "name").lean(),
      ]);
      out.finance = {
        overdue: { count: overdue[0]?.count || 0, amount: overdue[0]?.amount || 0 },
        outstanding: { count: outstanding[0]?.count || 0, amount: outstanding[0]?.amount || 0 },
        collectedThisMonth: month[0]?.amount || 0, paymentsThisMonth: month[0]?.count || 0,
        recentPayments: recent.map((p) => ({ business: p.businessId?.name, amount: p.amount, paidAt: p.paidAt })),
      };
    }

    res.json(out);
  } catch (err) {
    res.status(500).json({ message: "Failed to load dashboard", error: err.message });
  }
}

module.exports = { getSummary };