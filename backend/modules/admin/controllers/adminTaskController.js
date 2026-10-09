const mongoose = require("mongoose");
const AdminTask = require("../models/AdminTask");
const { TASK_STATUSES, TASK_PRIORITIES } = require("../models/AdminTask");
const AdminUser = require("../models/AdminUser");
const Business = require("../../../shared/models/Business");

const escapeRe = (s) => s.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const manages = (req) => req.admin.hasPermission("MANAGE_TASKS");
const populate = (q) => q.populate("assignedTo", "name role").populate("createdBy", "name").populate("businessId", "name");

// Managers see and edit everything. View-only admins see only tasks assigned to them,
// and can change only the status of those.
const taskController = {
  async getMeta(req, res) {
    try {
      const admins = await AdminUser.find({ isActive: true }, "name role").sort({ name: 1 });
      const clients = manages(req) ? await Business.find({}, "name").sort({ name: 1 }).limit(500).lean() : [];
      res.json({
        statuses: TASK_STATUSES,
        priorities: TASK_PRIORITIES,
        canManage: manages(req),
        admins: admins.map((a) => ({ id: a._id, name: a.name, role: a.role })),
        clients,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to load task options", error: err.message });
    }
  },

  async getTasks(req, res) {
    try {
      const { status, assignedTo, scope, overdue, search, page = 1, limit = 30 } = req.query;
      const base = manages(req) ? {} : { assignedTo: req.admin._id };
      const filter = { ...base };
      if (scope === "mine") filter.assignedTo = req.admin._id;
      else if (assignedTo && mongoose.isValidObjectId(assignedTo) && manages(req)) filter.assignedTo = assignedTo;
      if (status) filter.status = status;
      if (overdue === "true") Object.assign(filter, { status: { $ne: "done" }, dueDate: { $lt: new Date() } });
      if (search) filter.title = new RegExp(escapeRe(search), "i");

      const p = Math.max(1, parseInt(page, 10) || 1);
      const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
      const now = new Date();
      const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(now); dayEnd.setHours(23, 59, 59, 999);

      const [tasks, total, open, late, today, done] = await Promise.all([
        populate(AdminTask.find(filter)).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l),
        AdminTask.countDocuments(filter),
        AdminTask.countDocuments({ ...base, status: { $ne: "done" } }),
        AdminTask.countDocuments({ ...base, status: { $ne: "done" }, dueDate: { $lt: now } }),
        AdminTask.countDocuments({ ...base, status: { $ne: "done" }, dueDate: { $gte: dayStart, $lte: dayEnd } }),
        AdminTask.countDocuments({ ...base, status: "done" }),
      ]);

      res.json({ tasks, total, page: p, pages: Math.max(1, Math.ceil(total / l)), summary: { open, overdue: late, dueToday: today, done } });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch tasks", error: err.message });
    }
  },

  async createTask(req, res) {
    try {
      const { title, description, priority, dueDate, assignedTo, businessId } = req.body;
      if (!title?.trim()) return res.status(400).json({ message: "Title is required" });
      if (priority && !TASK_PRIORITIES.includes(priority)) return res.status(400).json({ message: "Invalid priority" });

      const assignee = assignedTo || req.admin._id;
      if (!(await AdminUser.exists({ _id: assignee, isActive: true }))) return res.status(400).json({ message: "Invalid assignee" });
      if (businessId && !(await Business.exists({ _id: businessId }))) return res.status(400).json({ message: "Client not found" });

      const task = await AdminTask.create({
        title: title.trim(), description: description || "", priority: priority || "medium",
        dueDate: dueDate ? new Date(dueDate) : null, assignedTo: assignee,
        businessId: businessId || null, createdBy: req.admin._id,
      });
      res.status(201).json({ message: "Task created", task: await populate(AdminTask.findById(task._id)) });
    } catch (err) {
      res.status(400).json({ message: err.message || "Failed to create task" });
    }
  },

  async updateTask(req, res) {
    try {
      const task = await AdminTask.findById(req.params.id);
      if (!task) return res.status(404).json({ message: "Task not found" });

      const { status, title, description, priority, dueDate, assignedTo, businessId } = req.body;
      const isAssignee = String(task.assignedTo) === String(req.admin._id);

      if (!manages(req)) {
        if (!isAssignee) return res.status(403).json({ message: "Not allowed" });
        const others = [title, description, priority, dueDate, assignedTo, businessId].some((v) => v !== undefined);
        if (others) return res.status(403).json({ message: "You can only change the status of your own tasks" });
      } else {
        if (title !== undefined) { if (!title.trim()) return res.status(400).json({ message: "Title is required" }); task.title = title.trim(); }
        if (description !== undefined) task.description = description;
        if (priority !== undefined) {
          if (!TASK_PRIORITIES.includes(priority)) return res.status(400).json({ message: "Invalid priority" });
          task.priority = priority;
        }
        if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
        if (assignedTo !== undefined) {
          if (!(await AdminUser.exists({ _id: assignedTo, isActive: true }))) return res.status(400).json({ message: "Invalid assignee" });
          task.assignedTo = assignedTo;
        }
        if (businessId !== undefined) task.businessId = businessId || null;
      }

      if (status !== undefined && status !== task.status) {
        if (!TASK_STATUSES.includes(status)) return res.status(400).json({ message: "Invalid status" });
        task.status = status;
        task.completedAt = status === "done" ? new Date() : null;
      }

      await task.save();
      res.json({ message: "Task updated", task: await populate(AdminTask.findById(task._id)) });
    } catch (err) {
      res.status(400).json({ message: err.message || "Failed to update task" });
    }
  },

  async deleteTask(req, res) {
    try {
      const task = await AdminTask.findByIdAndDelete(req.params.id);
      if (!task) return res.status(404).json({ message: "Task not found" });
      res.json({ message: "Task deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete task", error: err.message });
    }
  },
};

module.exports = taskController;