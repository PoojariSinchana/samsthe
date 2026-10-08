const mongoose = require("mongoose");
const Order = require("../models/Order");
const Purchase = require("../models/Purchase");
const StockLevel = require("../models/StockLevel");
const { resolveOutletFilter } = require("../middleware/permissionMiddleware");
const {
  VALID_PERIODS, PERIOD_CHANGE_LABEL, localMidnight, addDays, pctChange,
  rangeForPeriod, previousRangeForPeriod, generateBuckets,
} = require("../utils/dateRanges");
const { revenueTotalFor, expenseTotalFor, byBucket, accountBalance } = require("../utils/journalStats");
const { CUSTOMER_KEY, HAS_CUSTOMER } = require("../utils/orderStats");

async function getSummary(req, res) {
  try {
    const period = VALID_PERIODS.includes(req.query.period) ? req.query.period : "month";
    const businessId = new mongoose.Types.ObjectId(req.user.businessId);
    const orderScope = resolveOutletFilter(req, req.query.outlet, "outletId");
    const journalScope = resolveOutletFilter(req, req.query.outlet, "outlet");

    const today0 = localMidnight(new Date());
    const { from, to } = rangeForPeriod(period, today0, addDays(today0, 1));
    const prev = previousRangeForPeriod(period, from, to, today0);

    const ordersIn = (f, t) => ({ businessId, status: "completed", ...orderScope, createdAt: { $gte: f, $lt: t } });
    const customersIn = async (f, t) =>
      (await Order.aggregate([{ $match: { ...ordersIn(f, t), ...HAS_CUSTOMER } }, { $group: { _id: CUSTOMER_KEY } }, { $count: "n" }]))[0]?.n || 0;

    const [
      rev, prevRev, exp, prevExp, orders, prevOrders, custs, prevCusts,
      revTrend, expTrend, cash, bank, due, payables, recent, lowStock,
    ] = await Promise.all([
      revenueTotalFor(businessId, from, to, journalScope), revenueTotalFor(businessId, prev.from, prev.to, journalScope),
      expenseTotalFor(businessId, from, to, journalScope), expenseTotalFor(businessId, prev.from, prev.to, journalScope),
      Order.countDocuments(ordersIn(from, to)), Order.countDocuments(ordersIn(prev.from, prev.to)),
      customersIn(from, to), customersIn(prev.from, prev.to),
      byBucket(businessId, period, from, to, "revenue", "credit", journalScope),
      byBucket(businessId, period, from, to, "expense", "debit", journalScope),
      accountBalance(businessId, ["1000"], "debit"), accountBalance(businessId, ["1010"], "debit"),
      Order.aggregate([
        { $match: { businessId, status: { $ne: "cancelled" }, amountDue: { $gt: 0 }, ...orderScope } },
        { $group: { _id: null, total: { $sum: "$amountDue" }, count: { $sum: 1 } } },
      ]),
      Purchase.aggregate([
        { $match: { businessId, amountDue: { $gt: 0 }, ...orderScope } },
        { $group: { _id: null, total: { $sum: "$amountDue" } } },
      ]),
      Order.find({ businessId, status: { $ne: "cancelled" }, ...orderScope }).sort({ createdAt: -1 }).limit(6)
        .select("number total paymentStatus customerSnapshot").lean(),
      StockLevel.countDocuments({ businessId, ...orderScope, $expr: { $lte: ["$currentStock", "$minStock"] } }),
    ]);

    const revMap = new Map(revTrend.map((r) => [String(r._id), r.total]));
    const expMap = new Map(expTrend.map((r) => [String(r._id), r.total]));
    const trend = generateBuckets(period, from, to).map((b) => ({
      label: b.label, revenue: revMap.get(String(b.key)) || 0, expenses: expMap.get(String(b.key)) || 0,
    }));

    res.json({
      period, range: { from, to }, changeLabel: PERIOD_CHANGE_LABEL[period],
      revenue: { total: rev, changePct: pctChange(rev, prevRev) },
      expenses: { total: exp, changePct: pctChange(exp, prevExp) },
      profit: { total: rev - exp, changePct: pctChange(rev - exp, prevRev - prevExp) },
      orders: { total: orders, changePct: pctChange(orders, prevOrders) },
      customers: { total: custs, changePct: pctChange(custs, prevCusts) },
      balances: { cash, bank },
      trend, recentOrders: recent,
      outstandingDue: due[0]?.total || 0, outstandingCount: due[0]?.count || 0,
      supplierPayables: payables[0]?.total || 0,
      lowStockCount: lowStock,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.status ? err.message : "Failed to load dashboard", ...(err.status ? {} : { error: err.message }) });
  }
}

module.exports = { getSummary };