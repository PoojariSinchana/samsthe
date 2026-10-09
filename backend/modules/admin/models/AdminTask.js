const mongoose = require("mongoose");

const TASK_STATUSES = ["todo", "in_progress", "done"];
const TASK_PRIORITIES = ["low", "medium", "high"];

// Internal to-dos for YOUR team. Separate from shared/models/Task.js (customer-side).
const adminTaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    status: { type: String, enum: TASK_STATUSES, default: "todo", index: true },
    priority: { type: String, enum: TASK_PRIORITIES, default: "medium" },
    dueDate: { type: Date, default: null },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", required: true },
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", default: null }, // optional client link
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "admin_tasks" }
);

adminTaskSchema.index({ assignedTo: 1, status: 1, dueDate: 1 });

module.exports = mongoose.model("AdminTask", adminTaskSchema);
module.exports.TASK_STATUSES = TASK_STATUSES;
module.exports.TASK_PRIORITIES = TASK_PRIORITIES;