const mongoose = require("mongoose");

const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_CLIENT", "RESOLVED", "CLOSED"];
const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"];
const TICKET_CATEGORIES = ["bug", "billing", "how_to", "feature_request", "account", "other"];

const replySchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", required: true },
    message: { type: String, required: true, trim: true },
    internal: { type: Boolean, default: false }, // internal notes are never shown to the client
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, required: true, unique: true },
    subject: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", default: null, index: true },
    contactName: { type: String, trim: true, default: "" },
    contactPhone: { type: String, trim: true, default: "" },
    category: { type: String, enum: TICKET_CATEGORIES, default: "other" },
    priority: { type: String, enum: TICKET_PRIORITIES, default: "medium", index: true },
    status: { type: String, enum: TICKET_STATUSES, default: "OPEN", index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", default: null },
    replies: { type: [replySchema], default: [] },
    resolvedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
  },
  { timestamps: true }
);

ticketSchema.index({ status: 1, createdAt: -1 });
ticketSchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model("Ticket", ticketSchema);
module.exports.TICKET_STATUSES = TICKET_STATUSES;
module.exports.TICKET_PRIORITIES = TICKET_PRIORITIES;
module.exports.TICKET_CATEGORIES = TICKET_CATEGORIES;