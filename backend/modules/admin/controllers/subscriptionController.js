const Subscription = require("../models/Subscription");
const { SUBSCRIPTION_STATUSES } = require("../models/Subscription");
const Business = require("../../../shared/models/Business");
const { appMaps, withAppType, shapeSub, createRenewalInvoice } = require("../utils/billing");

const DAY = 864e5;
const escapeRe = (s) => s.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const endOf = (s) => (s.status === "TRIAL" ? s.trialEndsAt || s.currentPeriodEnd : s.currentPeriodEnd);

function newPeriod(sub) {
  const now = new Date(), end = new Date(now);
  sub.billingCycle === "yearly" ? end.setFullYear(end.getFullYear() + 1) : end.setMonth(end.getMonth() + 1);
  sub.currentPeriodStart = now;
  sub.currentPeriodEnd = end;
}

module.exports = {
  async getMeta(req, res) {
    res.json({ statuses: SUBSCRIPTION_STATUSES });
  },

  async getSubscriptions(req, res) {
    try {
      const { status, appType, expiring, search, page = 1, limit = 20 } = req.query;
      const maps = await appMaps();
      const and = [];
      if (status) and.push({ status });
      if (appType || search) {
        const bf = {};
        if (appType) bf.appId = maps.idBySlug.get(appType) || { $in: [] };
        if (search) bf.name = new RegExp(escapeRe(search), "i");
        const ids = await Business.find(bf, "_id").limit(500).lean();
        and.push({ businessId: { $in: ids.map((b) => b._id) } });
      }
      if (expiring) {
        const until = new Date(Date.now() + Number(expiring) * DAY);
        and.push({ $or: [{ status: "TRIAL", trialEndsAt: { $lte: until } }, { status: "ACTIVE", currentPeriodEnd: { $lte: until } }] });
      }
      const filter = and.length ? { $and: and } : {};
      const p = Math.max(1, parseInt(page, 10) || 1);
      const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const in7 = new Date(Date.now() + 7 * DAY);

      const [subs, total, byStatus, mrrAgg, expiringSoon] = await Promise.all([
        Subscription.find(filter).populate("planId", "key name").populate("pendingPlanId", "key name")
  .populate("businessId", "name appId city")
          .sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).lean(),
        Subscription.countDocuments(filter),
        Subscription.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        Subscription.aggregate([
          { $match: { status: "ACTIVE" } },
          { $group: { _id: null, mrr: { $sum: { $cond: [{ $eq: ["$billingCycle", "yearly"] }, { $divide: ["$amount", 12] }, "$amount"] } } } },
        ]),
        Subscription.countDocuments({ $or: [{ status: "TRIAL", trialEndsAt: { $lte: in7 } }, { status: "ACTIVE", currentPeriodEnd: { $lte: in7 } }] }),
      ]);

      res.json({
        subscriptions: subs.map((s) => ({ ...shapeSub(s), client: withAppType(s.businessId, maps), businessId: s.businessId?._id })),
        total, page: p, pages: Math.max(1, Math.ceil(total / l)),
        summary: { mrr: Math.round(mrrAgg[0]?.mrr || 0), byStatus: Object.fromEntries(byStatus.map((r) => [r._id, r.count])), expiringSoon },
      });
    } catch (err) { res.status(500).json({ message: "Failed to fetch subscriptions", error: err.message }); }
  },

  async updateStatus(req, res) {
    try {
      const { status, cancelReason } = req.body;
      if (!SUBSCRIPTION_STATUSES.includes(status)) return res.status(400).json({ message: "Invalid status" });
      const sub = await Subscription.findById(req.params.id);
      if (!sub) return res.status(404).json({ message: "Subscription not found" });
      sub.status = status;
      if (status === "CANCELLED") { sub.cancelledAt = sub.cancelledAt || new Date(); sub.cancelReason = cancelReason || ""; }
      else { sub.cancelledAt = null; sub.cancelReason = ""; }
      // Reviving an expired period would otherwise be flipped straight back by the sweep job.
      if (status === "ACTIVE" && (!sub.currentPeriodEnd || sub.currentPeriodEnd < new Date())) newPeriod(sub);
      await sub.save();
      res.json({ message: "Status updated", subscription: sub });
    } catch (err) { res.status(400).json({ message: err.message || "Failed to update status" }); }
  },

  async extend(req, res) {
    try {
      const days = Number(req.body.days);
      if (!(days >= 1 && days <= 365)) return res.status(400).json({ message: "Days must be between 1 and 365" });
      const sub = await Subscription.findById(req.params.id);
      if (!sub) return res.status(404).json({ message: "Subscription not found" });
      if (sub.status === "CANCELLED") return res.status(400).json({ message: "Cancelled subscriptions can't be extended" });

      const cur = endOf(sub);
      const base = cur && cur > new Date() ? new Date(cur) : new Date();
      base.setDate(base.getDate() + days);
      if (sub.trialEndsAt) sub.trialEndsAt = base;
      sub.currentPeriodEnd = base;
      if (sub.status === "EXPIRED" && sub.trialEndsAt) sub.status = "TRIAL";
      else if (sub.status === "PAST_DUE" || (sub.status === "EXPIRED" && !sub.trialEndsAt)) sub.status = "ACTIVE";
      await sub.save();
      res.json({ message: `Extended by ${days} days`, subscription: sub });
    } catch (err) { res.status(400).json({ message: err.message || "Failed to extend" }); }
  },

  async renewalInvoice(req, res) {
    try {
      const sub = await Subscription.findById(req.params.id);
      if (!sub) return res.status(404).json({ message: "Subscription not found" });
      const { invoice, skipped } = await createRenewalInvoice(sub, req.admin._id, "draft");
      if (skipped) return res.status(409).json({ message: `No invoice created: ${skipped}` });
      res.status(201).json({ message: `Draft invoice ${invoice.invoiceNumber} created`, invoice });
    } catch (err) { res.status(400).json({ message: err.message || "Failed to create invoice" }); }
  },

  async generateRenewals(req, res) {
    try {
      const days = Math.min(90, Math.max(1, Number(req.body.days) || 7));
      const until = new Date(Date.now() + days * DAY);
      const subs = await Subscription.find({ $or: [{ status: "ACTIVE", currentPeriodEnd: { $lte: until } }, { status: "PAST_DUE" }] }).limit(500);
      let created = 0, skipped = 0;
      for (const s of subs) {
        const r = await createRenewalInvoice(s, req.admin._id, "draft");
        r.invoice ? created++ : skipped++;
      }
      res.json({ message: `Created ${created} draft invoice(s), skipped ${skipped}.` });
    } catch (err) { res.status(500).json({ message: "Failed to generate invoices", error: err.message }); }
  },
};