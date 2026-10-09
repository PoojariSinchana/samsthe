const mongoose = require("mongoose");
const Invoice = require("../models/Invoice");
const { INVOICE_STATUSES } = require("../models/Invoice");
const Payment = require("../models/Payment");
const Business = require("../../../shared/models/Business");
const Subscription = require("../models/Subscription");
const { paidTotals, nextInvoiceNumber, sweepOverdue, clientOptions, appMaps, withAppType } = require("../utils/billing");
const { settings } = require("../utils/settings");

const escapeRe = (s) => s.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function cleanLines(lineItems) {
  if (!Array.isArray(lineItems) || lineItems.length === 0) return { error: "Add at least one line item" };
  const lines = [];
  for (const l of lineItems) {
    const quantity = Number(l.quantity) || 1;
    const unitPrice = Number(l.unitPrice);
    if (!l.description || !String(l.description).trim()) return { error: "Every line needs a description" };
    if (Number.isNaN(unitPrice) || unitPrice < 0 || quantity < 1) return { error: "Line prices must be 0 or more and quantity at least 1" };
    lines.push({ description: String(l.description).trim(), quantity, unitPrice, amount: quantity * unitPrice });
  }
  return { lines };
}

const withPaid = (invoices, paidMap) =>
  invoices.map((i) => {
    const amountPaid = paidMap.get(String(i._id)) || 0;
    return { ...i, amountPaid, amountDue: Math.max(0, i.total - amountPaid) };
  });

// restaurantId is kept in the response as a TEMPORARY alias so the current admin frontend keeps working.
const shapeInvoice = (i, maps) => ({
  ...i,
  client: withAppType(i.businessId, maps),
  businessId: i.businessId?._id,
  restaurantId: i.businessId?._id,
});

const invoiceController = {
  async getMeta(req, res) {
    try {
      res.json({ statuses: INVOICE_STATUSES, clients: await clientOptions(), defaults: { dueDays: settings().invoicing.defaultDueDays } });
    } catch (err) {
      res.status(500).json({ message: "Failed to load options", error: err.message });
    }
  },

  async getInvoices(req, res) {
    try {
      await sweepOverdue();
      const { status, search, page = 1, limit = 20 } = req.query;
      const businessId = req.query.businessId || req.query.restaurantId;
      const filter = {};
      if (status) filter.status = status;
      if (businessId && mongoose.isValidObjectId(businessId)) filter.businessId = businessId;
      if (search) {
        const re = new RegExp(escapeRe(search), "i");
        const ids = await Business.find({ name: re }, "_id").limit(50).lean();
        filter.$or = [{ invoiceNumber: re }, { businessId: { $in: ids.map((b) => b._id) } }];
      }

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

      const [invoices, total, byStatus, maps] = await Promise.all([
        Invoice.find(filter).populate("businessId", "name appId").sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
        Invoice.countDocuments(filter),
        Invoice.aggregate([{ $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$total" } } }]),
        appMaps(),
      ]);

      const paidMap = await paidTotals(invoices.map((i) => i._id));
      const summary = Object.fromEntries(INVOICE_STATUSES.map((s) => [s, { count: 0, amount: 0 }]));
      for (const r of byStatus) summary[r._id] = { count: r.count, amount: r.amount };

      res.json({
        invoices: withPaid(invoices, paidMap).map((i) => shapeInvoice(i, maps)),
        total, summary, page: pageNum, pages: Math.max(1, Math.ceil(total / limitNum)),
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch invoices", error: err.message });
    }
  },

  async getInvoice(req, res) {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid invoice id" });
      const [invoice, maps] = await Promise.all([
        Invoice.findById(req.params.id).populate("businessId", "name appId phone email").lean(),
        appMaps(),
      ]);
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });
      const payments = await Payment.find({ invoiceId: invoice._id }).sort({ createdAt: -1 }).lean();
      const paid = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
      res.json({
        invoice: { ...shapeInvoice(invoice, maps), amountPaid: paid, amountDue: Math.max(0, invoice.total - paid) },
        payments,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch invoice", error: err.message });
    }
  },

  async createInvoice(req, res) {
    try {
      const { subscriptionId, lineItems, tax, dueDate, notes, status } = req.body;
      const businessId = req.body.businessId || req.body.restaurantId; // restaurantId accepted until the frontend is renamed
      if (!mongoose.isValidObjectId(businessId)) return res.status(400).json({ message: "Select a client" });
      if (!dueDate) return res.status(400).json({ message: "Due date is required" });
      if (status && !["draft", "sent"].includes(status)) return res.status(400).json({ message: "New invoices can only be draft or sent" });
      if (tax !== undefined && (Number.isNaN(Number(tax)) || Number(tax) < 0)) return res.status(400).json({ message: "Tax must be 0 or more" });

      const { lines, error } = cleanLines(lineItems);
      if (error) return res.status(400).json({ message: error });
      if (!(await Business.exists({ _id: businessId }))) return res.status(404).json({ message: "Client not found" });

      const sub = subscriptionId || (await Subscription.findOne({ businessId }, "_id").lean())?._id;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const invoice = new Invoice({
            invoiceNumber: await nextInvoiceNumber(),
            businessId, subscriptionId: sub || undefined, lineItems: lines,
            tax: Number(tax) || 0, dueDate, notes: notes || "", status: status || "draft", createdBy: req.admin._id,
          });
          invoice.recalculate();
          await invoice.save();
          return res.status(201).json({ message: "Invoice created", invoice });
        } catch (err) {
          if (err.code !== 11000) throw err; // number collision, retry
        }
      }
      res.status(409).json({ message: "Couldn't allocate an invoice number, please retry" });
    } catch (err) {
      res.status(400).json({ message: err.message || "Failed to create invoice" });
    }
  },

  async updateInvoice(req, res) {
    try {
      const invoice = await Invoice.findById(req.params.id);
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });
      const { lineItems, tax, dueDate, notes, status } = req.body;

      if (invoice.status === "cancelled") return res.status(400).json({ message: "Cancelled invoices can't be changed" });
      if ((lineItems !== undefined || tax !== undefined) && invoice.status !== "draft") {
        return res.status(400).json({ message: "Only drafts can change line items or tax" });
      }
      if (lineItems !== undefined) {
        const { lines, error } = cleanLines(lineItems);
        if (error) return res.status(400).json({ message: error });
        invoice.lineItems = lines;
      }
      if (tax !== undefined) invoice.tax = Number(tax) || 0;
      if (dueDate !== undefined) invoice.dueDate = dueDate;
      if (notes !== undefined) invoice.notes = notes;

      if (status !== undefined && status !== invoice.status) {
        if (status === "sent" && invoice.status === "draft") invoice.status = "sent";
        else if (status === "cancelled" && ["draft", "sent", "overdue"].includes(invoice.status)) {
          if (await Payment.exists({ invoiceId: invoice._id, status: "paid" })) {
            return res.status(400).json({ message: "This invoice has payments, refund them before cancelling" });
          }
          invoice.status = "cancelled";
        } else return res.status(400).json({ message: `Can't change status from ${invoice.status} to ${status}` });
      }

      invoice.recalculate();
      await invoice.save();
      res.json({ message: "Invoice updated", invoice });
    } catch (err) {
      res.status(400).json({ message: err.message || "Failed to update invoice" });
    }
  },

  async deleteInvoice(req, res) {
    try {
      const invoice = await Invoice.findById(req.params.id);
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });
      if (invoice.status !== "draft") return res.status(400).json({ message: "Only drafts can be deleted, cancel it instead" });
      await invoice.deleteOne();
      res.json({ message: "Invoice deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete invoice", error: err.message });
    }
  },
};

module.exports = invoiceController;