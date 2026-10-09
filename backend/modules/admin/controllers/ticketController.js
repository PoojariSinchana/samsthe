const mongoose = require("mongoose");
const Ticket = require("../models/Ticket");
const { TICKET_STATUSES, TICKET_PRIORITIES, TICKET_CATEGORIES } = require("../models/Ticket");
const AdminUser = require("../models/AdminUser");
const Business = require("../../../shared/models/Business");
const { appMaps, withAppType } = require("../utils/billing");

const escapeRe = (s) => s.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const blank = (v) => (v === "" || v === undefined ? null : v);
const CLOSED = ["RESOLVED", "CLOSED"];

const populate = (q) =>
  q.populate("assignedTo", "name role").populate("businessId", "name phone email appId").populate("replies.author", "name role");

async function nextTicketNumber() {
  const last = await Ticket.findOne({}, "ticketNumber").sort({ createdAt: -1 }).lean();
  const n = last ? parseInt(last.ticketNumber.replace(/\D/g, ""), 10) || 0 : 0;
  return `TKT-${String(n + 1).padStart(4, "0")}`;
}

// Resolved/closed tickets stamp resolvedAt; reopening clears it.
function applyStatus(ticket, status) {
  if (status === undefined || status === ticket.status) return;
  ticket.status = status;
  ticket.resolvedAt = CLOSED.includes(status) ? ticket.resolvedAt || new Date() : null;
}

const ticketController = {
  async getMeta(req, res) {
    try {
      const [admins, clients, maps] = await Promise.all([
        AdminUser.find({ isActive: true }, "name role").sort({ name: 1 }),
        Business.find({}, "name appId").sort({ name: 1 }).limit(500).lean(),
        appMaps(),
      ]);
      res.json({
        statuses: TICKET_STATUSES, priorities: TICKET_PRIORITIES, categories: TICKET_CATEGORIES,
        admins: admins.map((a) => ({ id: a._id, name: a.name, role: a.role })),
        clients: clients.map((c) => withAppType(c, maps)),
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to load support options", error: err.message });
    }
  },

  async getTickets(req, res) {
    try {
      const { status, priority, assignedTo, search, page = 1, limit = 20 } = req.query;
      const filter = {};
      if (status) filter.status = status;
      if (priority) filter.priority = priority;
      if (assignedTo === "none") filter.assignedTo = null;
      else if (assignedTo && mongoose.isValidObjectId(assignedTo)) filter.assignedTo = assignedTo;
      if (search) {
        const re = new RegExp(escapeRe(search), "i");
        const ids = await Business.find({ name: re }, "_id").limit(50).lean();
        filter.$or = [{ ticketNumber: re }, { subject: re }, { contactName: re }, { businessId: { $in: ids.map((b) => b._id) } }];
      }

      const p = Math.max(1, parseInt(page, 10) || 1);
      const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const open = { status: { $nin: CLOSED } };

      const [tickets, total, byStatus, unassigned, urgent, maps] = await Promise.all([
        populate(Ticket.find(filter).select("-replies.message")).sort({ updatedAt: -1 }).skip((p - 1) * l).limit(l).lean(),
        Ticket.countDocuments(filter),
        Ticket.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        Ticket.countDocuments({ ...open, assignedTo: null }),
        Ticket.countDocuments({ ...open, priority: "urgent" }),
        appMaps(),
      ]);

      const counts = Object.fromEntries(TICKET_STATUSES.map((s) => [s, 0]));
      for (const r of byStatus) counts[r._id] = r.count;

      res.json({
        tickets: tickets.map((t) => ({ ...t, replyCount: (t.replies || []).length, client: t.businessId ? withAppType(t.businessId, maps) : null })),
        total, counts, unassigned, urgent, page: p, pages: Math.max(1, Math.ceil(total / l)),
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch tickets", error: err.message });
    }
  },

  async getTicket(req, res) {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid ticket id" });
      const ticket = await populate(Ticket.findById(req.params.id)).lean();
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      res.json({ ticket });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch ticket", error: err.message });
    }
  },

  async createTicket(req, res) {
    try {
      const { subject, description, businessId, contactName, contactPhone, category, priority, assignedTo } = req.body;
      if (!subject || !String(subject).trim()) return res.status(400).json({ message: "Subject is required" });
      if (category && !TICKET_CATEGORIES.includes(category)) return res.status(400).json({ message: "Invalid category" });
      if (priority && !TICKET_PRIORITIES.includes(priority)) return res.status(400).json({ message: "Invalid priority" });
      if (businessId && !mongoose.isValidObjectId(businessId)) return res.status(400).json({ message: "Invalid client" });

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const ticket = await Ticket.create({
            ticketNumber: await nextTicketNumber(),
            subject: String(subject).trim(), description: description || "",
            businessId: blank(businessId), contactName: contactName || "", contactPhone: contactPhone || "",
            category: category || "other", priority: priority || "medium",
            assignedTo: blank(assignedTo), createdBy: req.admin._id,
          });
          return res.status(201).json({ message: `Ticket ${ticket.ticketNumber} created`, ticket: await populate(Ticket.findById(ticket._id)) });
        } catch (err) {
          if (err.code !== 11000) throw err; // number collision, retry
        }
      }
      res.status(409).json({ message: "Couldn't allocate a ticket number, please retry" });
    } catch (err) {
      res.status(400).json({ message: err.message || "Failed to create ticket" });
    }
  },

  async updateTicket(req, res) {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid ticket id" });
      const ticket = await Ticket.findById(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      const b = req.body;

      if (b.status !== undefined && !TICKET_STATUSES.includes(b.status)) return res.status(400).json({ message: "Invalid status" });
      if (b.priority !== undefined && !TICKET_PRIORITIES.includes(b.priority)) return res.status(400).json({ message: "Invalid priority" });
      if (b.category !== undefined && !TICKET_CATEGORIES.includes(b.category)) return res.status(400).json({ message: "Invalid category" });
      if (b.subject !== undefined && !String(b.subject).trim()) return res.status(400).json({ message: "Subject is required" });

      for (const f of ["subject", "description", "contactName", "contactPhone", "priority", "category"]) if (b[f] !== undefined) ticket[f] = b[f];
      if (b.assignedTo !== undefined) ticket.assignedTo = blank(b.assignedTo);
      if (b.businessId !== undefined) ticket.businessId = blank(b.businessId);
      applyStatus(ticket, b.status);

      await ticket.save();
      res.json({ message: "Ticket updated", ticket: await populate(Ticket.findById(ticket._id)) });
    } catch (err) {
      res.status(400).json({ message: err.message || "Failed to update ticket" });
    }
  },

  async addReply(req, res) {
    try {
      const { message, internal, status } = req.body;
      if (!message || !String(message).trim()) return res.status(400).json({ message: "Write a message first" });
      if (status !== undefined && status !== "" && !TICKET_STATUSES.includes(status)) return res.status(400).json({ message: "Invalid status" });
      const ticket = await Ticket.findById(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });

      ticket.replies.push({ author: req.admin._id, message: String(message).trim(), internal: !!internal });
      if (status) applyStatus(ticket, status);
      else if (ticket.status === "OPEN" && !internal) applyStatus(ticket, "IN_PROGRESS"); // first public reply = work started
      if (!ticket.assignedTo) ticket.assignedTo = req.admin._id; // replier picks it up

      await ticket.save();
      res.status(201).json({ message: "Reply added", ticket: await populate(Ticket.findById(ticket._id)) });
    } catch (err) {
      res.status(400).json({ message: err.message || "Failed to add reply" });
    }
  },

  async deleteTicket(req, res) {
    try {
      const ticket = await Ticket.findByIdAndDelete(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      res.json({ message: "Ticket deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete ticket", error: err.message });
    }
  },
};

module.exports = ticketController;