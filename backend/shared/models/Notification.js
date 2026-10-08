const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["task_assigned", "task_due", "task_overdue", "task_done", "subscription", "general"], default: "general" },
    title: { type: String, required: true },
    message: { type: String, default: "" },
    link: { section: { type: String } },     // sidebar section key to open on click
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 3600 }); // auto-clean after 60 days

module.exports = mongoose.model("Notification", notificationSchema);