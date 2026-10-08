const Lead = require("../models/Lead");
const { LEAD_STATUSES, LEAD_SOURCES, BUSINESS_TYPES } = require("../models/Lead");
const AdminUser = require("../models/AdminUser");

const EDITABLE = ["businessName", "contactPerson", "phone", "email", "businessType", "source", "status", "assignedTo", "notes"];
const escapeRe = (s) => s.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const leadController = {
  // Dropdown values + the admins a lead can be assigned to.
  async getMeta(req, res) {
    try {
      const admins = await AdminUser.find({ isActive: true }, "name role").sort({ name: 1 });
      res.json({
        statuses: LEAD_STATUSES,
        sources: LEAD_SOURCES,
        businessTypes: BUSINESS_TYPES,
        admins: admins.map((a) => ({ id: a._id, name: a.name, role: a.role })),
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to load lead options", error: err.message });
    }
  },

  async getLeads(req, res) {
    try {
      const { status, search, assignedTo, page = 1, limit = 20 } = req.query;
      const filter = {};
      if (status) filter.status = status;
      if (assignedTo) filter.assignedTo = assignedTo;
      if (search) {
        const re = new RegExp(escapeRe(search), "i");
        filter.$or = [{ businessName: re }, { contactPerson: re }, { phone: re }, { email: re }];
      }

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

      const [leads, total, countsRaw] = await Promise.all([
        Lead.find(filter).populate("assignedTo", "name").sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
        Lead.countDocuments(filter),
        Lead.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      ]);

      const counts = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0]));
      for (const c of countsRaw) counts[c._id] = c.count;

      res.json({ leads, total, counts, page: pageNum, pages: Math.max(1, Math.ceil(total / limitNum)) });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch leads", error: err.message });
    }
  },

  async createLead(req, res) {
    try {
      const { businessName, contactPerson, phone } = req.body;
      if (!businessName || !contactPerson || !phone) {
        return res.status(400).json({ message: "Business name, contact person and phone are required" });
      }
      const data = {};
      for (const f of EDITABLE) if (req.body[f] !== undefined && req.body[f] !== "") data[f] = req.body[f];
      const lead = await Lead.create(data);
      res.status(201).json({ message: "Lead created", lead });
    } catch (err) {
      res.status(400).json({ message: err.message || "Failed to create lead" });
    }
  },

  async updateLead(req, res) {
    try {
      const lead = await Lead.findById(req.params.id);
      if (!lead) return res.status(404).json({ message: "Lead not found" });

      const previousStatus = lead.status;
      for (const f of EDITABLE) {
        if (req.body[f] === undefined) continue;
        // an empty assignedTo means "unassign"
        lead[f] = f === "assignedTo" && req.body[f] === "" ? undefined : req.body[f];
      }

      if (lead.status !== previousStatus) {
        if (lead.status !== "NEW") lead.lastContactedAt = new Date();
        lead.convertedAt = lead.status === "CONVERTED" ? new Date() : null;
      }

      await lead.save();
      await lead.populate("assignedTo", "name");
      res.json({ message: "Lead updated", lead });
    } catch (err) {
      res.status(400).json({ message: err.message || "Failed to update lead" });
    }
  },

  async deleteLead(req, res) {
    try {
      const lead = await Lead.findByIdAndDelete(req.params.id);
      if (!lead) return res.status(404).json({ message: "Lead not found" });
      res.json({ message: "Lead deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete lead", error: err.message });
    }
  },
};

module.exports = leadController;