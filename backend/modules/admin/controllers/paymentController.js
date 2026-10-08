const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const { PAYMENT_METHODS, PAYMENT_STATUSES } = require("../models/Payment");
const Invoice = require("../models/Invoice");
const Business = require("../../../shared/models/Business");
const { paidTotals, syncInvoice, sweepOverdue, clientOptions, appMaps, withAppType } = require("../utils/billing");

const escapeRe = (s) => s.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const paymentController = {
  async getMeta(req, res) {
    try {
      await sweepOverdue();
      const open = await Invoice.find({ status: { $in: ["sent", "overdue"] } }, "invoiceNumber businessId total dueDate status")
        .populate("businessId", "name").sort({ dueDate: 1 }).limit(200).lean();
      const paidMap = await paidTotals(open.map((i) => i._id));
      res.json({
        methods: PAYMENT_METHODS, statuses: PAYMENT_STATUSES, clients: await clientOptions(),
        openInvoices: open.map((i) => ({
          _id: i._id, invoiceNumber: i.invoiceNumber, status: i.status, total: i.total,
          businessId: i.businessId?._id, restaurantId: i.businessId?._id, // restaurantId: temporary alias
          clientName: i.businessId?.name || "-", amountDue: Math.max(0, i.total - (paidMap.get(String(i._id)) || 0)),
        })).filter((i) => i.amountDue > 0),
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to load options", error: err.message });
    }
  },

  async getPayments(req, res) {
    try {
      const { status, method, search, from, to, page = 1, limit = 20 } = req.query;
      const filter = {};
      if (status) filter.status = status;
      if (method) filter.method = method;
      if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to) filter.createdAt.$lte = new Date(to);
      }
      if (search) {
        const re = new RegExp(escapeRe(search), "i");
        const ids = await Business.find({ name: re }, "_id").limit(50).lean();
        filter.$or = [{ gatewayReference: re }, { businessId: { $in: ids.map((b) => b._id) } }];
      }

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

      const [payments, total, byStatus, monthAgg, maps] = await Promise.all([
        Payment.find(filter).populate("businessId", "name appId").populate("invoiceId", "invoiceNumber")
          .sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
        Payment.countDocuments(filter),
        Payment.aggregate([{ $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" } } }]),
        Payment.aggregate([{ $match: { status: "paid", paidAt: { $gte: monthStart } } }, { $group: { _id: null, amount: { $sum: "$amount" } } }]),
        appMaps(),
      ]);

      const summary = Object.fromEntries(PAYMENT_STATUSES.map((s) => [s, { count: 0, amount: 0 }]));
      for (const r of byStatus) summary[r._id] = { count: r.count, amount: r.amount };
      summary.thisMonth = monthAgg[0]?.amount || 0;

      res.json({
        payments: payments.map((p) => ({
          ...p,
          client: withAppType(p.businessId, maps),
          invoice: p.invoiceId,
          businessId: p.businessId?._id,
          restaurantId: p.businessId?._id, // temporary alias
          invoiceId: p.invoiceId?._id,
        })),
        total, summary, page: pageNum, pages: Math.max(1, Math.ceil(total / limitNum)),
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch payments", error: err.message });
    }
  },

  async createPayment(req, res) {
    try {
      const { invoiceId, amount, method, status = "paid", paidAt, gatewayReference, notes } = req.body;
      let businessId = req.body.businessId || req.body.restaurantId; // restaurantId accepted until the frontend is renamed
      const amt = Number(amount);
      if (!amt || amt <= 0) return res.status(400).json({ message: "Amount must be more than 0" });
      if (!PAYMENT_METHODS.includes(method)) return res.status(400).json({ message: "Choose a payment method" });
      if (!PAYMENT_STATUSES.includes(status)) return res.status(400).json({ message: "Invalid status" });

      let invoice = null;
      if (invoiceId) {
        invoice = await Invoice.findById(invoiceId);
        if (!invoice) return res.status(404).json({ message: "Invoice not found" });
        if (!["sent", "overdue"].includes(invoice.status)) {
          return res.status(400).json({ message: `A ${invoice.status} invoice can't take payments` });
        }
        const due = invoice.total - ((await paidTotals([invoice._id])).get(String(invoice._id)) || 0);
        if (status === "paid" && amt > due + 0.01) return res.status(400).json({ message: `Amount exceeds the balance due (₹${due.toFixed(2)})` });
        businessId = invoice.businessId;
      }
      if (!mongoose.isValidObjectId(businessId)) return res.status(400).json({ message: "Select a client or an invoice" });
      if (!(await Business.exists({ _id: businessId }))) return res.status(404).json({ message: "Client not found" });

      const payment = await Payment.create({
        businessId, invoiceId: invoice?._id, subscriptionId: invoice?.subscriptionId,
        amount: amt, method, status, paidAt: status === "paid" ? paidAt || new Date() : undefined,
        gatewayReference: gatewayReference || "", notes: notes || "", recordedBy: req.admin._id,
      });
      if (invoice) await syncInvoice(invoice._id);
      res.status(201).json({ message: "Payment recorded", payment });
    } catch (err) {
      res.status(400).json({ message: err.message || "Failed to record payment" });
    }
  },

  // paid | failed | refunded. Refunding/failing a payment reopens its invoice automatically.
  async updateStatus(req, res) {
  try {
    const { status, rejectReason } = req.body;
    if (!PAYMENT_STATUSES.includes(status)) return res.status(400).json({ message: "Invalid status" });
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    if (payment.status === "refunded") return res.status(400).json({ message: "Refunded payments can't be changed" });

    if (status === "paid" && payment.invoiceId) {
      const inv = await Invoice.findById(payment.invoiceId, "status");
      if (!inv || inv.status === "cancelled") return res.status(400).json({ message: "This invoice is cancelled, so it can't take payments" });
    }

    payment.status = status;
    if (status === "paid") {
      payment.paidAt = payment.paidAt || new Date();
      payment.verifiedBy = req.admin._id;
      payment.rejectReason = "";
    } else if (status === "failed") {
      payment.rejectedUtr = payment.utr;
      payment.rejectReason = rejectReason || "Payment not received";
      payment.verifiedBy = req.admin._id;
    }
    await payment.save();
    if (payment.invoiceId) await syncInvoice(payment.invoiceId);
    res.json({ message: "Payment updated", payment });
  } catch (err) {
    res.status(400).json({ message: err.message || "Failed to update payment" });
  }
},
};

module.exports = paymentController;