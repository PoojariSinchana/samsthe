const Business = require("../../../shared/models/Business");
const User = require("../../../shared/models/User");
const Order = require("../../../shared/models/Order");
const Purchase = require("../../../shared/models/Purchase");
const Entry = require("../../../shared/models/Entry");
const Task = require("../../../shared/models/Task");
const Outlet = require("../../../shared/models/Outlet");
const Subscription = require("../models/Subscription");
const Payment = require("../models/Payment");
const Ticket = require("../models/Ticket");
const { appMaps } = require("../utils/billing");

const DAY = 864e5;
const TZ = "Asia/Kolkata";
const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthGroup = (f) => ({ $dateToString: { format: "%Y-%m", date: `$${f}`, timezone: TZ } });
const MRR = { $cond: [{ $eq: ["$billingCycle", "yearly"] }, { $divide: ["$amount", 12] }, "$amount"] };
const mrrOf = (s) => (s.billingCycle === "yearly" ? s.amount / 12 : s.amount);
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const countMap = (rows) => new Map(rows.map((r) => [String(r._id), r.n]));

function fillMonths(from, to, rows, fields) {
  const by = new Map(rows.map((r) => [r._id, r]));
  const out = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  while (cur <= to) {
    const k = ym(cur), r = by.get(k);
    out.push({ month: k, ...Object.fromEntries(fields.map((f) => [f, r?.[f] || 0])) });
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

async function getAnalytics(req, res) {
  try {
    const months = Math.min(24, Math.max(1, parseInt(req.query.months, 10) || 6));
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    const range = { $gte: from, $lte: now };
    const d7 = new Date(now - 7 * DAY), d14 = new Date(now - 14 * DAY), d30 = new Date(now - 30 * DAY);
    const maps = await appMaps();
    const orderOk = { status: { $ne: "cancelled" } };

    const [
      signupRows, trialBiz, newBiz, cancelled, expiredTrials, activeNow,
      mrrRows, volRows, engRows, totalBiz, topRows, paying, adopt,
    ] = await Promise.all([
      Business.aggregate([{ $match: { createdAt: range } }, { $group: { _id: "$appId", n: { $sum: 1 } } }]),
      Business.find({ trialUsedAt: range }, "_id").lean(),
      Business.find({ createdAt: range }, "_id").lean(),
      Subscription.countDocuments({ cancelledAt: range }),
      Subscription.countDocuments({ status: "EXPIRED", trialEndsAt: range }),
      Subscription.countDocuments({ status: "ACTIVE", amount: { $gt: 0 } }),
      Subscription.aggregate([
        { $match: { status: "ACTIVE", amount: { $gt: 0 } } },
        { $lookup: { from: "pricingplans", localField: "planId", foreignField: "_id", as: "plan" } },
        { $unwind: { path: "$plan", preserveNullAndEmptyArrays: true } },
        { $group: { _id: { $ifNull: ["$plan.appType", "unknown"] }, count: { $sum: 1 }, mrr: { $sum: MRR } } },
      ]),
      Order.aggregate([
        { $match: { createdAt: range, ...orderOk } },
        { $group: { _id: monthGroup("createdAt"), orders: { $sum: 1 }, volume: { $sum: "$total" } } },
      ]),
      // Last login per business -> engagement buckets
      User.aggregate([
        { $match: { businessId: { $ne: null } } },
        { $group: { _id: "$businessId", last: { $max: "$lastLogin" } } },
        { $group: {
            _id: null, total: { $sum: 1 },
            active7: { $sum: { $cond: [{ $gte: ["$last", d7] }, 1, 0] } },
            active30: { $sum: { $cond: [{ $gte: ["$last", d30] }, 1, 0] } },
            never: { $sum: { $cond: [{ $eq: ["$last", null] }, 1, 0] } },
        } },
      ]),
      Business.countDocuments(),
      Order.aggregate([
        { $match: { createdAt: range, ...orderOk } },
        { $group: { _id: "$businessId", orders: { $sum: 1 }, volume: { $sum: "$total" } } },
        { $sort: { volume: -1 } }, { $limit: 10 },
        { $lookup: { from: "businesses", localField: "_id", foreignField: "_id", as: "b" } },
        { $project: { orders: 1, volume: 1,
            name: { $ifNull: [{ $arrayElemAt: ["$b.name", 0] }, "Deleted business"] },
            appId: { $arrayElemAt: ["$b.appId", 0] } } },
      ]),
      Subscription.find({ status: { $in: ["ACTIVE", "PAST_DUE"] }, amount: { $gt: 0 } },
        "businessId amount billingCycle status planId limits")
        .populate("planId", "name").populate("businessId", "name appId").limit(2000).lean(),
      // Feature adoption: distinct businesses that used each area in the last 30 days
      Promise.all([
        Order.distinct("businessId", { createdAt: { $gte: d30 } }),
        Purchase.distinct("businessId", { createdAt: { $gte: d30 } }),
        Entry.distinct("businessId", { source: "MANUAL", createdAt: { $gte: d30 } }),
        Task.distinct("businessId", { createdAt: { $gte: d30 } }),
        User.distinct("businessId", { role: { $ne: "owner" }, status: "active" }),
        Ticket.distinct("businessId", { source: "client", createdAt: { $gte: d30 } }),
      ]),
    ]);

    // ── Acquisition ──
    const trialIds = trialBiz.map((b) => b._id);
    const converted = trialIds.length
      ? (await Payment.distinct("businessId", { businessId: { $in: trialIds }, status: "paid" })).length : 0;
    const newIds = newBiz.map((b) => b._id);
    const chosen = newIds.length
      ? await Subscription.countDocuments({ businessId: { $in: newIds }, status: { $ne: "PENDING" } }) : 0;
    const signups = signupRows.reduce((s, r) => s + r.n, 0);

    // ── Revenue ──
    const byApp = mrrRows.map((r) => ({ appType: r._id, count: r.count, mrr: Math.round(r.mrr), arpa: r.count ? Math.round(r.mrr / r.count) : 0 }));
    const mrrTotal = byApp.reduce((s, r) => s + r.mrr, 0);

    // ── Engagement ──
    const e = engRows[0] || { total: 0, active7: 0, active30: 0, never: 0 };

    // ── At risk + upsell, from the paying clients ──
    const ids = paying.map((s) => s.businessId?._id).filter(Boolean);
    const [lastRows, orderRows, outletRows, staffRows] = await Promise.all([
      User.aggregate([{ $match: { businessId: { $in: ids } } }, { $group: { _id: "$businessId", last: { $max: "$lastLogin" } } }]),
      Order.aggregate([{ $match: { businessId: { $in: ids }, createdAt: { $gte: d30 }, ...orderOk } }, { $group: { _id: "$businessId", n: { $sum: 1 } } }]),
      Outlet.aggregate([{ $match: { businessId: { $in: ids }, isActive: true } }, { $group: { _id: "$businessId", n: { $sum: 1 } } }]),
      User.aggregate([{ $match: { businessId: { $in: ids }, role: { $ne: "owner" }, status: "active" } }, { $group: { _id: "$businessId", n: { $sum: 1 } } }]),
    ]);
    const lastBy = new Map(lastRows.map((r) => [String(r._id), r.last]));
    const ordersBy = countMap(orderRows), outletsBy = countMap(outletRows), staffBy = countMap(staffRows);

    const atRisk = [], upsell = [];
    for (const s of paying) {
      const b = s.businessId;
      if (!b) continue;
      const key = String(b._id);
      const last = lastBy.get(key) || null;
      const idleDays = last ? Math.floor((now - new Date(last)) / DAY) : null;
      const base = { _id: b._id, name: b.name, appType: maps.slugById.get(String(b.appId)) || null, plan: s.planId?.name, mrr: Math.round(mrrOf(s)) };

      const pastDue = s.status === "PAST_DUE";
      const quiet = !last || new Date(last) < d14;
      if (pastDue || quiet) {
        atRisk.push({ ...base, status: s.status, lastLogin: last, idleDays, orders30: ordersBy.get(key) || 0,
          reason: pastDue ? "Payment overdue" : !last ? "Never logged in" : `No login for ${idleDays} days` });
      }
      const o = outletsBy.get(key) || 0, st = staffBy.get(key) || 0;
      const maxO = s.limits?.maxOutlets, maxS = s.limits?.maxStaff;
      if ((maxO && o >= maxO) || (maxS && st >= maxS)) {
        upsell.push({ ...base, outlets: { used: o, max: maxO }, staff: { used: st, max: maxS } });
      }
    }
    atRisk.sort((a, b) => (b.status === "PAST_DUE") - (a.status === "PAST_DUE") || b.mrr - a.mrr);
    upsell.sort((a, b) => b.mrr - a.mrr);

    const labels = [["orders", "Orders / sales"], ["purchases", "Purchases"], ["transactions", "Transactions"], ["tasks", "Tasks"], ["staff", "Staff logins"], ["support", "Support tickets"]];

    res.json({
      range: { from, to: now }, months,
      acquisition: {
        signups, byApp: Object.fromEntries(signupRows.map((r) => [maps.slugById.get(String(r._id)) || "unknown", r.n])),
        trials: trialIds.length, trialConverted: converted, trialConversionPct: pct(converted, trialIds.length),
        stalled: newIds.length - chosen,   // signed up in range but never picked a plan
      },
      retention: { cancelled, expiredTrials, activeNow, churnPct: pct(cancelled, activeNow + cancelled) },
      revenue: { mrr: mrrTotal, payingClients: activeNow, arpa: activeNow ? Math.round(mrrTotal / activeNow) : 0, byApp },
      engagement: { total: e.total, active7: e.active7, active30: e.active30, idle: e.total - e.active30 - e.never, never: e.never },
      volume: {
        orders: volRows.reduce((s, r) => s + r.orders, 0), gmv: volRows.reduce((s, r) => s + r.volume, 0),
        byMonth: fillMonths(from, now, volRows, ["orders", "volume"]),
      },
      adoption: labels.map(([k, label], i) => ({ key: k, label, clients: adopt[i].length, pct: pct(adopt[i].length, totalBiz) })),
      topClients: topRows.map((r) => ({ _id: r._id, name: r.name, appType: maps.slugById.get(String(r.appId)) || null, orders: r.orders, volume: r.volume })),
      atRisk: { count: atRisk.length, mrr: atRisk.reduce((s, r) => s + r.mrr, 0), list: atRisk.slice(0, 10) },
      upsell: { count: upsell.length, list: upsell.slice(0, 10) },
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to build analytics", error: err.message });
  }
}

module.exports = { getAnalytics };