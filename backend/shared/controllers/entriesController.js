const mongoose = require("mongoose");
const Entry = require("../models/Entry");
const { transcribeAudio } = require("../../modules/restaurant/services/voiceTranscriber");
const { postEntry, voidEntryPosting } = require("./accountingController");
const { parseEntryText } = require("../../modules/restaurant/services/aiEntryParser");

const escapeRe = (s) => s.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const entriesController = {
  async getEntries(req, res) {
    try {
      const { entryType, category, from, to, paymentMethod, search, status, page = 1, limit = 25 } = req.query;
      const filter = { businessId: req.user.businessId, status: status || "CONFIRMED" };
      if (entryType) filter.entryType = entryType;
      if (category) filter.category = category;
      if (paymentMethod) filter.paymentMethod = paymentMethod;
      if (from || to) filter.date = { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to) }) };
      if (search) {
        const re = new RegExp(escapeRe(search), "i");
        filter.$or = [{ description: re }, { supplierName: re }];
      }

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

      const [entries, total] = await Promise.all([
        Entry.find(filter)
          .populate("outlet", "name")
          .populate("createdBy", "name")
          // order-sourced entries: order number/channel + table, so the list shows the detail the old Payments ledger did
          .populate({ path: "orderId", select: "number channel tableId", populate: { path: "tableId", select: "name tableNumber" } })
          .sort({ date: -1, createdAt: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum),
        Entry.countDocuments(filter),
      ]);
      res.json({ entries, total, page: pageNum, pages: Math.max(1, Math.ceil(total / limitNum)) });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch entries", error: err.message });
    }
  },

  async getMeta(req, res) {
    const { ENTRY_TYPES, PAYMENT_METHODS, CATEGORIES_BY_TYPE } = require("../models/Entry");
    res.json({ entryTypes: ENTRY_TYPES, paymentMethods: PAYMENT_METHODS, categoriesByType: CATEGORIES_BY_TYPE });
  },

  async createEntry(req, res) {
    try {
      const { entryType, category, description, amount, quantity, unit, supplierName, paymentMethod, direction, transferFrom, transferTo, date, notes } = req.body;
      if (!entryType || !description || !amount) return res.status(400).json({ message: "entryType, description, and amount are required" });
      if (entryType === "TRANSFER") {
        if (!transferFrom || !transferTo || transferFrom === transferTo) return res.status(400).json({ message: "Transfer needs two different accounts" });
      } else if (!category) {
        return res.status(400).json({ message: "category is required" });
      }
      if ((entryType === "LIABILITY" || entryType === "EQUITY") && !direction) return res.status(400).json({ message: "direction is required for this transaction type" });

      const entry = await Entry.create({
        businessId: req.user.businessId,
        outlet: req.body.outlet || undefined,
        entryType,
        category: entryType === "TRANSFER" ? "TRANSFER" : category,
        description,
        amount: Number(amount),
        quantity: quantity !== undefined && quantity !== null && quantity !== "" ? Number(quantity) : undefined,
        unit: unit || undefined,
        supplierName: supplierName || "",
        paymentMethod: paymentMethod || undefined,
        direction: direction || undefined,
        transferFrom: transferFrom || undefined,
        transferTo: transferTo || undefined,
        date: date || Date.now(),
        notes: notes || "",
        source: "MANUAL",
        createdBy: req.user._id,
      });

      try { await postEntry(entry); }
      catch (e) { console.error("Accounting auto-post failed for entry", entry._id, e.message); }

      res.status(201).json({ message: "Entry created", entry });
    } catch (err) {
      res.status(400).json({ message: err.message || "Failed to create entry" });
    }
  },

  async updateEntry(req, res) {
    try {
      const entry = await Entry.findOne({ _id: req.params.id, businessId: req.user.businessId });
      if (!entry) return res.status(404).json({ message: "Entry not found" });
      if (entry.status === "CANCELLED") return res.status(400).json({ message: "Cannot edit a cancelled entry" });
      if (entry.source === "ORDER") return res.status(400).json({ message: "This entry is tied to an order payment, edit it from Orders or Billing/POS instead" });

      for (const f of ["entryType", "category", "description", "amount", "quantity", "unit", "supplierName", "paymentMethod", "date", "notes"]) {
        if (req.body[f] !== undefined) entry[f] = req.body[f];
      }
      await entry.save();
      try { await postEntry(entry); } // replaces the previous posting
      catch (e) { console.error("Accounting re-post failed for entry", entry._id, e.message); }

      res.json({ message: "Entry updated", entry });
    } catch (err) {
      res.status(400).json({ message: err.message || "Failed to update entry" });
    }
  },

  // Soft delete only: financial records are marked cancelled, never removed.
  async cancelEntry(req, res) {
    try {
      const entry = await Entry.findOne({ _id: req.params.id, businessId: req.user.businessId });
      if (!entry) return res.status(404).json({ message: "Entry not found" });
      if (entry.source === "ORDER") return res.status(400).json({ message: "This entry is tied to an order payment, cancel the order instead" });
      entry.status = "CANCELLED";
      await entry.save();
      await voidEntryPosting(entry);
      res.json({ message: "Entry cancelled", entry });
    } catch (err) {
      res.status(500).json({ message: "Failed to cancel entry", error: err.message });
    }
  },

  async analyzeSmartEntry(req, res) {
    try {
      const { text } = req.body;
      if (!text || !text.trim()) return res.status(400).json({ message: "Text is required" });
      res.json({ suggestion: await parseEntryText(text.trim()) });
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message || "Failed to analyze text" });
    }
  },

  async transcribeVoice(req, res) {
    try {
      if (!req.file) return res.status(400).json({ message: "No audio file uploaded" });
      res.json({ text: await transcribeAudio(req.file.buffer, req.file.mimetype, req.file.originalname) });
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message || "Failed to transcribe audio" });
    }
  },

  // Lightweight stand-in for the old Inventory tab (INVENTORY-type entries only, so it can only go up).
  async getInventorySnapshot(req, res) {
    try {
      const rows = await Entry.aggregate([
        { $match: { businessId: new mongoose.Types.ObjectId(req.user.businessId), entryType: "INVENTORY", status: "CONFIRMED" } },
        { $group: { _id: { description: "$description", unit: "$unit" }, totalQuantity: { $sum: "$quantity" }, totalSpent: { $sum: "$amount" }, lastPurchased: { $max: "$date" } } },
        { $sort: { "_id.description": 1 } },
      ]);
      res.json({ items: rows.map((r) => ({ name: r._id.description, unit: r._id.unit, totalQuantity: r.totalQuantity || 0, totalSpent: r.totalSpent, lastPurchased: r.lastPurchased })) });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch inventory snapshot", error: err.message });
    }
  },
};

module.exports = entriesController;