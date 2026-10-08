const Task = require("../models/Task");
const User = require("../models/User");
const { notify } = require("../services/notify");
const { fail, send } = require("../utils/httpError");

const escapeRe = (s) => s.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isManager = (u) => ["owner", "manager"].includes(u.role);
const same = (a, b) => a && b && String(a._id || a) === String(b._id || b);
const populate = (q) => q.populate("assignedTo", "name role").populate("createdBy", "name");

function schedule(task, body) {
  if ("dueDate" in body) task.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if ("remindBeforeMinutes" in body) {
    const v = body.remindBeforeMinutes;
    task.remindBeforeMinutes = v === "" || v == null ? null : Number(v);
  }
  if ("dueDate" in body || "remindBeforeMinutes" in body) {
    task.remindAt = task.dueDate && task.remindBeforeMinutes != null
      ? new Date(task.dueDate.getTime() - task.remindBeforeMinutes * 60000) : null;
    task.reminderSentAt = null;
    task.overdueNotifiedAt = null;
  }
}

async function assertAssignee(req, assigneeId) {
  if (!assigneeId || same(assigneeId, req.user._id)) return;
  if (!isManager(req.user)) throw fail(403, "Only an owner or manager can assign tasks to others");
  if (!(await User.exists({ _id: assigneeId, businessId: req.user.businessId }))) throw fail(400, "Invalid assignee");
}

const taskController = {
  async getAssignees(req, res) {
    try {
      const users = isManager(req.user)
        ? await User.find({ businessId: req.user.businessId, status: "active" }, "name role").sort({ name: 1 })
        : [{ _id: req.user._id, name: req.user.name, role: req.user.role }];
      res.json({ users });
    } catch (err) { send(res, err, "Failed to load users"); }
  },

  async getTasks(req, res) {
    try {
      const { user, query: q } = req;
      const and = [{ businessId: user.businessId }];
      if (q.scope === "mine") and.push({ assignedTo: user._id });
      else if (!isManager(user)) and.push({ $or: [{ assignedTo: user._id }, { createdBy: user._id }] });
      if (q.status) and.push({ status: q.status });
      if (q.overdue === "true") and.push({ status: { $ne: "done" }, dueDate: { $lt: new Date() } });
      if (q.search) and.push({ title: new RegExp(escapeRe(q.search), "i") });
      const tasks = await populate(Task.find({ $and: and }).sort({ createdAt: -1 }).limit(300));
      res.json({ tasks });
    } catch (err) { send(res, err, "Failed to fetch tasks"); }
  },

  async createTask(req, res) {
    try {
      const { user, body } = req;
      if (!body.title?.trim()) throw fail(400, "Title is required");
      const assignedTo = body.assignedTo || user._id;
      await assertAssignee(req, assignedTo);

      const task = new Task({
        businessId: user.businessId, title: body.title.trim(), description: body.description || "",
        priority: body.priority || "medium", assignedTo, createdBy: user._id,
      });
      schedule(task, { dueDate: body.dueDate, remindBeforeMinutes: body.remindBeforeMinutes ?? 60 });
      await task.save();

      if (!same(assignedTo, user._id)) {
        await notify({ businessId: user.businessId, userId: assignedTo, type: "task_assigned",
          title: "New task assigned", message: `${user.name} assigned you: ${task.title}`, section: "tasks", taskId: task._id });
      }
      res.status(201).json({ message: "Task created", task: await populate(Task.findById(task._id)) });
    } catch (err) { send(res, err, "Failed to create task"); }
  },

  async updateTask(req, res) {
    try {
      const { user, body } = req;
      const task = await Task.findOne({ _id: req.params.id, businessId: user.businessId });
      if (!task) throw fail(404, "Task not found");

      const canEditAll = isManager(user) || same(task.createdBy, user._id);
      const isAssignee = same(task.assignedTo, user._id);
      if (!canEditAll && !isAssignee) throw fail(403, "Not allowed");
      const { status, ...details } = body;
      if (Object.keys(details).length && !canEditAll) throw fail(403, "Only the creator or a manager can edit task details");

      if (details.title !== undefined) {
        if (!details.title.trim()) throw fail(400, "Title is required");
        task.title = details.title.trim();
      }
      if (details.description !== undefined) task.description = details.description;
      if (details.priority !== undefined) task.priority = details.priority;
      schedule(task, details);

      const previousAssignee = task.assignedTo;
      if (details.assignedTo !== undefined && !same(details.assignedTo, previousAssignee)) {
        await assertAssignee(req, details.assignedTo);
        task.assignedTo = details.assignedTo;
        task.reminderSentAt = null;
        task.overdueNotifiedAt = null;
        await notify({ businessId: user.businessId, userId: details.assignedTo, type: "task_assigned",
          title: "Task assigned to you", message: `${user.name} assigned you: ${task.title}`, section: "tasks", taskId: task._id });
      }

      if (status !== undefined && status !== task.status) {
        if (!Task.STATUSES.includes(status)) throw fail(400, "Invalid status");
        task.status = status;
        task.completedAt = status === "done" ? new Date() : null;
        if (status === "done" && !same(task.createdBy, user._id)) {
          await notify({ businessId: user.businessId, userId: task.createdBy, type: "task_done",
            title: "Task completed", message: `${user.name} completed: ${task.title}`, section: "tasks", taskId: task._id });
        }
      }

      await task.save();
      res.json({ message: "Task updated", task: await populate(Task.findById(task._id)) });
    } catch (err) { send(res, err, "Failed to update task"); }
  },

  async deleteTask(req, res) {
    try {
      const task = await Task.findOne({ _id: req.params.id, businessId: req.user.businessId });
      if (!task) throw fail(404, "Task not found");
      if (!isManager(req.user) && !same(task.createdBy, req.user._id)) throw fail(403, "Only the creator or a manager can delete this task");
      await task.deleteOne();
      res.json({ message: "Task deleted" });
    } catch (err) { send(res, err, "Failed to delete task"); }
  },
};

module.exports = taskController;