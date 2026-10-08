const mongoose = require("mongoose");
const Order = require("../models/Order");
const { resolveOutletFilter } = require("../middleware/permissionMiddleware");
const { groupExprForPeriod } = require("../utils/dateRanges");
const { lookupCategory, lookupBrand, linesRevenueBy, CUSTOMER_KEY, HAS_CUSTOMER } = require("../utils/orderStats");
const { send } = require("../utils/httpError");

function scope(req) {
  const businessId = new mongoose.Types.ObjectId(req.user.businessId);
  const outletFilter = resolveOutletFilter(req, req.query.outlet, "outletId");
  const to = req.query.to ? new Date(req.query.to) : new Date();
  const from = req.query.from ? new Date(req.query.from) : new Date(to.getTime() - 29 * 864e5);
  const base = { businessId, ...outletFilter };
  return { base, from, to, match: { ...base, status: "completed", createdAt: { $gte: from, $lte: to } } };
}

const reportsController = {
  async getOverview(req, res) {
    try {
      const { base, match, from, to } = scope(req);
      const [tot, due, cust] = await Promise.all([
        Order.aggregate([{ $match: match }, { $group: { _id: null, revenue: { $sum: "$total" }, orders: { $sum: 1 }, discount: { $sum: "$discount" }, tax: { $sum: "$tax" } } }]),
        Order.aggregate([{ $match: { ...base, status: { $ne: "cancelled" }, amountDue: { $gt: 0 } } }, { $group: { _id: null, total: { $sum: "$amountDue" } } }]),
        Order.aggregate([{ $match: { ...match, ...HAS_CUSTOMER } }, { $group: { _id: CUSTOMER_KEY } }, { $count: "n" }]),
      ]);
      const t = tot[0] || { revenue: 0, orders: 0, discount: 0, tax: 0 };
      res.json({
        range: { from, to }, revenue: t.revenue, orders: t.orders, discount: t.discount, tax: t.tax,
        avgOrderValue: t.orders ? t.revenue / t.orders : 0, outstandingDue: due[0]?.total || 0, distinctCustomers: cust[0]?.n || 0,
      });
    } catch (err) { send(res, err, "Failed to fetch overview"); }
  },

  async getSalesReport(req, res) {
    try {
      const { base, match, from, to } = scope(req);
      const [byDay, byChannel, byOutlet, byMethod] = await Promise.all([
        Order.aggregate([{ $match: match }, { $group: { _id: groupExprForPeriod("month", "createdAt"), revenue: { $sum: "$total" }, orders: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
        Order.aggregate([{ $match: match }, { $group: { _id: "$channel", revenue: { $sum: "$total" }, orders: { $sum: 1 } } }, { $sort: { revenue: -1 } }]),
        Order.aggregate([
          { $match: match },
          { $lookup: { from: "outlets", localField: "outletId", foreignField: "_id", as: "o" } },
          { $unwind: { path: "$o", preserveNullAndEmptyArrays: true } },
          { $group: { _id: { $ifNull: ["$o.name", "Unknown outlet"] }, revenue: { $sum: "$total" }, orders: { $sum: 1 } } },
          { $sort: { revenue: -1 } },
        ]),
        Order.aggregate([
          { $match: base }, { $unwind: "$payments" }, { $match: { "payments.paidAt": { $gte: from, $lte: to } } },
          { $group: { _id: "$payments.method", total: { $sum: "$payments.amount" }, count: { $sum: 1 } } }, { $sort: { total: -1 } },
        ]),
      ]);
      res.json({ range: { from, to }, byDay, byChannel, byOutlet, byPaymentMethod: byMethod });
    } catch (err) { send(res, err, "Failed to fetch sales report"); }
  },

  async getProductReport(req, res) {
    try {
      const { match, from, to } = scope(req);
      const [byProduct, byCategory, byBrand] = await Promise.all([
        Order.aggregate(linesRevenueBy(match, "$lines.name", { acc: { quantity: { $sum: "$lines.quantity" } }, limit: 50 })),
        Order.aggregate(linesRevenueBy(match, { $ifNull: ["$categoryDoc.name", "Uncategorized"] }, { pre: lookupCategory, acc: { quantity: { $sum: "$lines.quantity" } } })),
        Order.aggregate(linesRevenueBy(match, { $ifNull: ["$brandDoc.name", "No brand"] }, { pre: lookupBrand, acc: { quantity: { $sum: "$lines.quantity" } } })),
      ]);
      res.json({ range: { from, to }, byProduct, byCategory, byBrand });
    } catch (err) { send(res, err, "Failed to fetch product report"); }
  },
};

module.exports = reportsController;