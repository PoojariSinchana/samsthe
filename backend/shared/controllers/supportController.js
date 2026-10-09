const mongoose = require("mongoose");
const Ticket = require("../../modules/admin/models/Ticket");
const { TICKET_CATEGORIES } = require("../../modules/admin/models/Ticket");
const { nextTicketNumber } = require("../../modules/admin/controllers/ticketController");
const { fail, send } = require("../utils/httpError");

const isManager = (u) => ["owner", "manager"].includes(u.role);
const CLIENT_PRIORITIES = ["low", "medium", "high"]; // "urgent" is for your team to set

// Owners/managers see every ticket of the business; everyone else only their own.
function scope(user) {
  const f = { businessId: user.businessId };
  if (!isManager(user)) f.requestedBy = user._id;
  return f;
}

// Internal notes and admin identities never leave the server.
function shape(t, withReplies) {
  const o = t.toObject ? t.toObject() : t;
  const replies = (o.replies || []).filter((r) => !r.internal);
  const out = {
    _id: o._id, ticketNumber: o.ticketNumber, subject: o.subject, description: o.description,
    category: o.category, priority: o.priority, status: o.status,
    createdAt: o.createdAt, updatedAt: o.updatedAt, resolvedAt: o.resolvedAt, replyCount: replies.length,
  };
  if (withReplies) {
    out.replies = replies.map((r) => ({
      _id: r._id, message: r.message, fromClient: !!r.fromClient, createdAt: r.createdAt,
      authorName: r.fromClient ? r.authorName || "You" : "Samsthe Support",
    }));
  }
  return out;
}

const getId = (req) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw fail(400, "Invalid ticket id");
  return req.params.id;
};

module.exports = {
  async getMeta(req, res) {
    res.json({ categories: TICKET_CATEGORIES, priorities: CLIENT_PRIORITIES });
  },

  async list(req, res) {
    try {
      const tickets = await Ticket.find(scope(req.user)).sort({ updatedAt: -1 }).limit(100);
      res.json({ tickets: tickets.map((t) => shape(t, false)), canSeeAll: isManager(req.user) });
    } catch (err) { send(res, err, "Failed to load tickets"); }
  },

  async getOne(req, res) {
    try {
      const t = await Ticket.findOne({ _id: getId(req), ...scope(req.user) });
      if (!t) throw fail(404, "Ticket not found");
      res.json({ ticket: shape(t, true) });
    } catch (err) { send(res, err, "Failed to load the ticket"); }
  },

  async create(req, res) {
    try {
      const { user, body } = req;
      const subject = String(body.subject || "").trim();
      if (!subject) throw fail(400, "Please enter a subject");
      if (subject.length > 150) throw fail(400, "Subject is too long (150 characters max)");
      const description = String(body.description || "").trim().slice(0, 5000);

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const t = await Ticket.create({
            ticketNumber: await nextTicketNumber(),
            subject, description,
            businessId: user.businessId, source: "client", requestedBy: user._id,
            contactName: user.name, contactPhone: user.phone || "",
            category: TICKET_CATEGORIES.includes(body.category) ? body.category : "other",
            priority: CLIENT_PRIORITIES.includes(body.priority) ? body.priority : "medium",
          });
          return res.status(201).json({ message: `Ticket ${t.ticketNumber} created`, ticket: shape(t, true) });
        } catch (err) {
          if (err.code !== 11000) throw err; // number collision, retry
        }
      }
      throw fail(409, "Couldn't create the ticket, please try again");
    } catch (err) { send(res, err, "Failed to create the ticket"); }
  },

  async reply(req, res) {
    try {
      const message = String(req.body.message || "").trim();
      if (!message) throw fail(400, "Write a message first");
      if (message.length > 5000) throw fail(400, "Message is too long");
      const t = await Ticket.findOne({ _id: getId(req), ...scope(req.user) });
      if (!t) throw fail(404, "Ticket not found");
      if (t.status === "CLOSED") throw fail(409, "This ticket is closed. Please raise a new one.");

      t.replies.push({ fromClient: true, clientUser: req.user._id, authorName: req.user.name, message });
      // A reply on a resolved / waiting ticket puts it back in the team's queue.
      if (["RESOLVED", "WAITING_CLIENT"].includes(t.status)) {
        t.status = t.assignedTo ? "IN_PROGRESS" : "OPEN";
        t.resolvedAt = null;
      }
      await t.save();
      res.status(201).json({ message: "Reply sent", ticket: shape(t, true) });
    } catch (err) { send(res, err, "Failed to send the reply"); }
  },
};