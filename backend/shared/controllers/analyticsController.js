const mongoose = require("mongoose");
const Order = require("../models/Order");
const Entry = require("../models/Entry");
const JournalEntry = require("../models/JournalEntry");
const { resolveOutletFilter } = require("../middleware/permissionMiddleware");
const { pctChange } = require("../utils/dateRanges");
const { JOIN_ACCOUNT, inRange } = require("../utils/journalStats");
const { lookupCategory, lookupBrand, linesRevenueBy, CUSTOMER_KEY, HAS_CUSTOMER } = require("../utils/orderStats");

const DAY = 24 * 60 * 60 * 1000;
const DOW_LABEL = { 1: "Sun", 2: "Mon", 3: "Tue", 4: "Wed", 5: "Thu", 6: "Fri", 7: "Sat" };

// The period immediately before [from, to], same length.
function previousPeriod(from, to) {
  const lengthMs = Math.max(to - from, DAY);
  const prevTo = new Date(from.getTime() - 1);
  return { prevFrom: new Date(prevTo.getTime() - lengthMs), prevTo };
}

const dayGroup = (field) => ({ $dateToString: { format: "%Y-%m-%d", date: `$${field}` } });

async function revenueTotalFor(match) {
  const [agg] = await Order.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: "$total" } } }]);
  return agg?.total || 0;
}

// Expense postings for one journal range (shared by total / trend / by-category).
const expensePipeline = (businessId, from, to, journalFilter) => [
  { $match: { businessId, date: { $gte: from, $lte: to }, ...journalFilter } }, ...JOIN_ACCOUNT, { $match: { "acct.type": "expense" } },
];

// Replaces analyticsController (restaurant) + shopAnalyticsController.
const analyticsController = {
  async getAnalytics(req, res) {
    try {
      const businessId = new mongoose.Types.ObjectId(req.user.businessId);
      let outletFilter, journalFilter;
      try {
        outletFilter = resolveOutletFilter(req, req.query.outlet, "outletId");
        journalFilter = resolveOutletFilter(req, req.query.outlet, "outlet");
      } catch (err) { return res.status(err.status || 400).json({ message: err.message }); }

      const to = req.query.to ? new Date(req.query.to) : new Date();
      const from = req.query.from ? new Date(req.query.from) : new Date(to.getTime() - 29 * DAY);
      const { prevFrom, prevTo } = previousPeriod(from, to);
      const base = { businessId, status: "completed", ...outletFilter };
      const match = { ...base, createdAt: { $gte: from, $lte: to } };
      const prevMatch = { ...base, createdAt: { $gte: prevFrom, $lte: prevTo } };

      const expTotal = async (f, t) => (await JournalEntry.aggregate([...expensePipeline(businessId, f, t, journalFilter), { $group: { _id: null, total: { $sum: "$lines.debit" } } }]))[0]?.total || 0;

      const [
        revenueTrendRaw, revenueTotal, revenuePrevTotal, orderCount,
        byCategory, byProduct, byBrand, byOutlet, byHourRaw, byDowRaw,
        expenseTrendRaw, expenseByCatRaw, expenseTotal, expensePrevTotal, cogsAgg, topExpenses,
        allTimeCust, periodCust,
      ] = await Promise.all([
        Order.aggregate([{ $match: match }, { $group: { _id: dayGroup("createdAt"), total: { $sum: "$total" } } }, { $sort: { _id: 1 } }]),
        revenueTotalFor(match), revenueTotalFor(prevMatch), Order.countDocuments(match),

        Order.aggregate(linesRevenueBy(match, { $ifNull: ["$categoryDoc.name", "Uncategorized"] }, { pre: lookupCategory })),
        Order.aggregate(linesRevenueBy(match, "$lines.name", { acc: { quantity: { $sum: "$lines.quantity" } }, limit: 10 })),
        Order.aggregate(linesRevenueBy(match, { $ifNull: ["$brandDoc.name", "No brand"] }, { pre: lookupBrand })),
        Order.aggregate([
          { $match: match },
          { $lookup: { from: "outlets", localField: "outletId", foreignField: "_id", as: "o" } },
          { $unwind: { path: "$o", preserveNullAndEmptyArrays: true } },
          { $group: { _id: { $ifNull: ["$o.name", "Unknown outlet"] }, revenue: { $sum: "$total" }, orders: { $sum: 1 } } },
          { $sort: { revenue: -1 } },
        ]),
        // Hour / weekday are UTC-based, same convention as before (no server tz conversion).
        Order.aggregate([{ $match: match }, { $group: { _id: { $hour: "$createdAt" }, revenue: { $sum: "$total" }, orders: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
        Order.aggregate([{ $match: match }, { $group: { _id: { $dayOfWeek: "$createdAt" }, revenue: { $sum: "$total" }, orders: { $sum: 1 } } }, { $sort: { _id: 1 } }]),

        JournalEntry.aggregate([...expensePipeline(businessId, from, to, journalFilter), { $group: { _id: dayGroup("date"), total: { $sum: "$lines.debit" } } }, { $sort: { _id: 1 } }]),
        JournalEntry.aggregate([...expensePipeline(businessId, from, to, journalFilter), { $group: { _id: { code: "$acct.code", name: "$acct.name" }, total: { $sum: "$lines.debit" } } }, { $sort: { total: -1 } }]),
        expTotal(from, to), expTotal(prevFrom, prevTo),
        // COGS (5000): nothing posts to it yet, so this is ~0 and Gross Profit == Revenue until purchases are expensed on consumption.
        JournalEntry.aggregate([{ $match: { businessId, date: { $gte: from, $lte: to }, ...journalFilter } }, ...JOIN_ACCOUNT, { $match: { "acct.code": "5000" } }, { $group: { _id: null, total: { $sum: "$lines.debit" } } }]),
        Entry.find({ businessId, entryType: "EXPENSE", status: "CONFIRMED", date: { $gte: from, $lte: to }, ...journalFilter }).sort({ amount: -1 }).limit(10),

        Order.aggregate([{ $match: { ...base, ...HAS_CUSTOMER } }, { $group: { _id: CUSTOMER_KEY, allTimeOrders: { $sum: 1 }, firstOrderDate: { $min: "$createdAt" } } }]),
        Order.aggregate([
          { $match: { ...match, ...HAS_CUSTOMER } },
          { $group: { _id: CUSTOMER_KEY, periodOrders: { $sum: 1 }, periodSpend: { $sum: "$total" }, name: { $last: "$customerSnapshot.name" }, phone: { $last: "$customerSnapshot.phone" } } },
          { $sort: { periodSpend: -1 } },
        ]),
      ]);

      // ---- Sales shape ----
      const hourMap = new Map(byHourRaw.map((h) => [h._id, h]));
      const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: hourMap.get(h)?.revenue || 0, orders: hourMap.get(h)?.orders || 0 }));
      const peakHour = hourly.reduce((m, h) => (h.revenue > m.revenue ? h : m), hourly[0]);
      const dow = byDowRaw.map((d) => ({ day: DOW_LABEL[d._id], revenue: d.revenue, orders: d.orders }));
      const peakDay = dow.reduce((m, d) => (d.revenue > m.revenue ? d : m), dow[0] || { day: "—", revenue: 0 });

      // ---- Profit ----
      const revenueTrend = revenueTrendRaw.map((d) => ({ date: d._id, total: d.total }));
      const expMap = new Map(expenseTrendRaw.map((d) => [d._id, d.total]));
      const profitTrend = revenueTrend.map((d) => { const expense = expMap.get(d.date) || 0; return { date: d.date, revenue: d.total, expense, profit: d.total - expense }; });
      const cogs = cogsAgg[0]?.total || 0;
      const grossProfit = revenueTotal - cogs;
      const netProfit = revenueTotal - expenseTotal;
      const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

      // ---- Customers ----
      const allMap = new Map(allTimeCust.map((p) => [String(p._id), p]));
      const distinct = periodCust.length;
      const repeatCount = periodCust.filter((p) => (allMap.get(String(p._id))?.allTimeOrders || 0) > 1).length;
      const repeatRatePct = pct(repeatCount, distinct);
      const buckets = new Map();
      for (const p of allTimeCust) {
        const d = new Date(p.firstOrderDate);
        if (d < from || d > to) continue;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        buckets.set(key, (buckets.get(key) || 0) + 1);
      }

      res.json({
        range: { from, to },
        revenue: { trend: revenueTrend, total: revenueTotal, previousTotal: revenuePrevTotal, growthPct: pctChange(revenueTotal, revenuePrevTotal, 1) },
        sales: {
          byCategory: byCategory.map((r) => ({ _id: r._id, revenue: r.revenue })), byProduct, byBrand, byOutlet,
          byHour: hourly, byDayOfWeek: dow, peakHour, peakDay,
        },
        profit: { trend: profitTrend, grossProfit, netProfit, profitMarginPct: pct(netProfit, revenueTotal), cogs, cogsNote: "COGS is currently always ~0, purchases aren't expensed on consumption yet." },
        expense: {
          trend: expenseTrendRaw.map((d) => ({ date: d._id, total: d.total })),
          byCategory: expenseByCatRaw.map((e) => ({ name: e._id.name, total: e.total })),
          total: expenseTotal, previousTotal: expensePrevTotal, growthPct: pctChange(expenseTotal, expensePrevTotal, 1), topExpenses,
        },
        customers: {
          distinctInPeriod: distinct, repeatCount, repeatRatePct,
          growthTrend: [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, newCustomers]) => ({ month, newCustomers })),
          topCustomers: periodCust.slice(0, 10).map((p) => ({ phone: p.phone || "—", name: p.name || "—", orders: p.periodOrders, spend: p.periodSpend })),
          note: "Saved customers are matched by id; walk-ins are grouped by phone number. Walk-ins with no phone aren't tracked.",
        },
        kpis: {
          avgOrderValue: orderCount ? revenueTotal / orderCount : 0, avgSaleValue: orderCount ? revenueTotal / orderCount : 0,
          grossMarginPct: pct(grossProfit, revenueTotal), netMarginPct: pct(netProfit, revenueTotal),
          customerRetentionPct: repeatRatePct, revenueGrowthPct: pctChange(revenueTotal, revenuePrevTotal, 1),
        },
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch analytics", error: err.message });
    }
  },
};

module.exports = analyticsController;