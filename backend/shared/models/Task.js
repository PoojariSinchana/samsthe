const mongoose = require("mongoose");
const STATUSES = ["todo", "in_progress", "done"];
const PRIORITIES = ["low", "medium", "high"];

const taskSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    status: { type: String, enum: STATUSES, default: "todo" },
    priority: { type: String, enum: PRIORITIES, default: "medium" },
    dueDate: { type: Date, default: null },
    remindBeforeMinutes: { type: Number, default: 60 },   // null = no reminder
    remindAt: { type: Date, default: null },               // computed: dueDate - remindBeforeMinutes
    reminderSentAt: { type: Date, default: null },
    overdueNotifiedAt: { type: Date, default: null },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

taskSchema.index({ businessId: 1, status: 1, dueDate: 1 });
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ remindAt: 1, reminderSentAt: 1, status: 1 });

module.exports = mongoose.model("Task", taskSchema);
module.exports.STATUSES = STATUSES;
module.exports.PRIORITIES = PRIORITIES;