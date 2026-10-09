const Business = require("../../../shared/models/Business");
const Subscription = require("../models/Subscription");
const Invoice = require("../models/Invoice");
const Payment = require("../models/Payment");
const Lead = require("../models/Lead");
const { paidTotals } = require("../utils/billing");

const DAY = 864e5;
const TZ = "Asia/Kolkata";
const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

function range(q) {
  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from ? new Date(q.from) : new Date(to.getFullYear(), to.getMonth() - 11, 1);
  return { from, to };
}

// Every month between from and to, so months with no activity show as 0 instead of being skipped.
function fillMonths(from, to, rows, fields) {
  const byKey = new Map(rows.map((r) => [r._id, r]));
  const out = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  while (cur <= to) {
    const key = ym(cur);
    const r = byKey.get(key);
    out.push({ month: key, ...Object.fromEntries(fields.map((f) => [f, r?.[f] || 0])) });
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

const monthGroup = (field) => ({ $dateToString: { format: "%Y-%m", date: `$${field}`, timezone: TZ } });

async function getSummary(req, res) {
  try {
    const { from, to } = range(req.query);
    const now = new Date();
    const paidMatch = { status: "paid", paidAt: { $gte: from, $lte: to } };

    const [revRows, clientRows, planRows, openInvoices, leadRows, topRows, cancelled, activeMrr] = await Promise.all([
      Payment.aggregate([{ $match: paidMatch }, { $group: { _id: monthGroup("paidAt"), amount: { $sum: "$amount" }, count: { $sum: 1 } } }]),
      Business.aggregate([{ $match: { createdAt: { $gte: from, $lte: to } } }, { $group: { _id: monthGroup("createdAt"), count: { $sum: 1 } } }]),
      Subscription.aggregate([
        { $match: { status: { $in: ["ACTIVE", "TRIAL", "PAST_DUE"] } } },
        { $group: { _id: "$planId", count: { $sum: 1 }, mrr: { $sum: { $cond: [{ $eq: ["$billingCycle", "yearly"] }, { $divide: ["$amount", 12] }, "$amount"] } } } },
        { $lookup: { from: "pricingplans", localField: "_id", foreignField: "_id", as: "plan" } },
        { $unwind: { path: "$plan", preserveNullAndEmptyArrays: true } },
        { $project: { name: { $ifNull: ["$plan.name", "Unknown"] }, appType: "$plan.appType", count: 1, mrr: { $round: ["$mrr", 0] } } },
        { $sort: { mrr: -1 } },
      ]),
      Invoice.find({ status: { $in: ["sent", "overdue"] } }, "total dueDate").lean(),
      Lead.aggregate([{ $match: { createdAt: { $gte: from, $lte: to } } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      Payment.aggregate([
        { $match: paidMatch },
        { $group: { _id: "$businessId", amount: { $sum: "$amount" }, payments: { $sum: 1 } } },
        { $sort: { amount: -1 } }, { $limit: 10 },
        { $lookup: { from: "businesses", localField: "_id", foreignField: "_id", as: "b" } },
        { $project: { name: { $ifNull: [{ $arrayElemAt: ["$b.name", 0] }, "Deleted business"] }, amount: 1, payments: 1 } },
      ]),
      Subscription.countDocuments({ cancelledAt: { $gte: from, $lte: to } }),
      Subscription.aggregate([
        { $match: { status: "ACTIVE" } },
        { $group: { _id: null, mrr: { $sum: { $cond: [{ $eq: ["$billingCycle", "yearly"] }, { $divide: ["$amount", 12] }, "$amount"] } } } },
      ]),
    ]);

    // Invoice aging: how late the money is, by how much is still owed.
    const paid = await paidTotals(openInvoices.map((i) => i._id));
    const buckets = { notDue: 0, d1_7: 0, d8_30: 0, d31plus: 0 };
    const counts = { notDue: 0, d1_7: 0, d8_30: 0, d31plus: 0 };
    for (const i of openInvoices) {
      const due = Math.max(0, i.total - (paid.get(String(i._id)) || 0));
      if (!due) continue;
      const late = Math.floor((now - new Date(i.dueDate)) / DAY);
      const k = late <= 0 ? "notDue" : late <= 7 ? "d1_7" : late <= 30 ? "d8_30" : "d31plus";
      buckets[k] += due;
      counts[k] += 1;
    }

    const revenue = fillMonths(from, to, revRows, ["amount", "count"]);
    const newClients = fillMonths(from, to, clientRows, ["count"]);
    const funnel = Object.fromEntries(leadRows.map((r) => [r._id, r.count]));
    const leadsTotal = leadRows.reduce((s, r) => s + r.count, 0);

    res.json({
      range: { from, to },
      totals: {
        collected: revenue.reduce((s, r) => s + r.amount, 0),
        payments: revenue.reduce((s, r) => s + r.count, 0),
        newClients: newClients.reduce((s, r) => s + r.count, 0),
        cancelled,
        mrr: Math.round(activeMrr[0]?.mrr || 0),
        outstanding: Object.values(buckets).reduce((a, b) => a + b, 0),
      },
      revenueByMonth: revenue,
      newClientsByMonth: newClients,
      planMix: planRows,
      invoiceAging: Object.keys(buckets).map((k) => ({ bucket: k, amount: Math.round(buckets[k]), count: counts[k] })),
      leadFunnel: { total: leadsTotal, byStatus: funnel, conversionPct: leadsTotal ? Math.round(((funnel.CONVERTED || 0) / leadsTotal) * 1000) / 10 : 0 },
      topClients: topRows,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to build report", error: err.message });
  }
}

async function paymentsCsv(req, res) {
  try {
    const { from, to } = range(req.query);
    const rows = await Payment.find({ status: "paid", paidAt: { $gte: from, $lte: to } })
      .populate("businessId", "name").populate("invoiceId", "invoiceNumber").sort({ paidAt: -1 }).limit(5000).lean();
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["Date", "Client", "Invoice", "Method", "Reference", "Amount"].join(",")].concat(
      rows.map((p) => [
        new Date(p.paidAt).toISOString().slice(0, 10), p.businessId?.name, p.invoiceId?.invoiceNumber,
        p.method, p.gatewayReference || p.utr, p.amount,
      ].map(esc).join(","))
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="payments-${ym(from)}-to-${ym(to)}.csv"`);
    res.send(lines.join("\n"));
  } catch (err) {
    res.status(500).json({ message: "Failed to export payments", error: err.message });
  }
}

module.exports = { getSummary, paymentsCsv };