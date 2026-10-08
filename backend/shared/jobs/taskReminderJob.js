const Task = require("../models/Task");
const { notify } = require("../services/notify");

const fmt = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
let lastErrorLogged = 0;

async function sweep() {
  const now = new Date();

  // 1. Reminders
  const reminders = await Task.find({
    status: { $ne: "done" }, assignedTo: { $ne: null }, remindAt: { $lte: now }, reminderSentAt: null,
  }).limit(200);
  for (const t of reminders) {
    t.reminderSentAt = now;
    await t.save();
    await notify({ businessId: t.businessId, userId: t.assignedTo, type: "task_due",
      title: "Task reminder", message: `"${t.title}" is due ${fmt(t.dueDate)}`, section: "tasks", taskId: t._id });
  }

  // 2. Overdue (notify assignee, and the creator if different)
  const overdue = await Task.find({
    status: { $ne: "done" }, dueDate: { $lt: now }, overdueNotifiedAt: null,
  }).limit(200);
  for (const t of overdue) {
    t.overdueNotifiedAt = now;
    await t.save();
    const msg = `"${t.title}" was due ${fmt(t.dueDate)}`;
    await notify({ businessId: t.businessId, userId: t.assignedTo, type: "task_overdue", title: "Task overdue", message: msg, section: "tasks", taskId: t._id });
    if (t.createdBy && String(t.createdBy) !== String(t.assignedTo)) {
      await notify({ businessId: t.businessId, userId: t.createdBy, type: "task_overdue", title: "Task overdue", message: msg, section: "tasks", taskId: t._id });
    }
  }
}

function startTaskReminderJob() {
  setInterval(async () => {
    try { await sweep(); }
    catch (err) {
      if (Date.now() - lastErrorLogged > 5 * 60 * 1000) {
        console.error("Task reminder sweep failed:", err.message);
        lastErrorLogged = Date.now();
      }
    }
  }, 60 * 1000);
}

module.exports = { startTaskReminderJob };