const mongoose = require("mongoose");
const Project = require("../models/Project");
const { PROJECT_STATUSES, PROJECT_PRIORITIES } = require("../models/Project");
const AdminUser = require("../models/AdminUser");
const Business = require("../../../shared/models/Business");
const { appMaps, withAppType } = require("../utils/billing");

const escapeRe = (s) => s.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const blank = (v) => (v === "" || v === undefined ? null : v);
const EDITABLE = ["name", "description", "businessId", "status", "priority", "manager", "members", "startDate", "dueDate", "budget", "notes", "milestones", "progress"];

const populate = (q) =>
  q.populate("manager", "name role").populate("members", "name role").populate("businessId", "name appId");

function applyBody(project, body) {
  for (const f of EDITABLE) {
    if (body[f] === undefined) continue;
    if (["businessId", "manager", "startDate", "dueDate"].includes(f)) project[f] = blank(body[f]);
    else if (f === "members") project.members = (body.members || []).filter((id) => mongoose.isValidObjectId(id));
    else if (f === "budget") project.budget = Number(body.budget) || 0;
    else if (f === "progress") project.progress = Math.min(100, Math.max(0, Number(body.progress) || 0));
    else if (f === "milestones") {
      project.milestones = (body.milestones || [])
        .filter((m) => m.title && String(m.title).trim())
        .map((m) => {
          const prev = m._id && project.milestones.id(m._id);
          const done = !!m.done;
          return {
            ...(prev ? { _id: prev._id } : {}),
            title: String(m.title).trim(),
            dueDate: blank(m.dueDate),
            done,
            doneAt: done ? prev?.doneAt || new Date() : null,
          };
        });
    } else project[f] = body[f];
  }
}

const projectController = {
  async getMeta(req, res) {
    try {
      const [admins, clients, maps] = await Promise.all([
        AdminUser.find({ isActive: true }, "name role").sort({ name: 1 }),
        Business.find({}, "name appId").sort({ name: 1 }).limit(500).lean(),
        appMaps(),
      ]);
      res.json({
        statuses: PROJECT_STATUSES,
        priorities: PROJECT_PRIORITIES,
        admins: admins.map((a) => ({ id: a._id, name: a.name, role: a.role })),
        clients: clients.map((c) => withAppType(c, maps)),
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to load project options", error: err.message });
    }
  },

  async getProjects(req, res) {
    try {
      const { status, search, manager, page = 1, limit = 20 } = req.query;
      const filter = {};
      if (status) filter.status = status;
      if (manager && mongoose.isValidObjectId(manager)) filter.manager = manager;
      if (search) {
        const re = new RegExp(escapeRe(search), "i");
        const ids = await Business.find({ name: re }, "_id").limit(50).lean();
        filter.$or = [{ name: re }, { businessId: { $in: ids.map((b) => b._id) } }];
      }

      const p = Math.max(1, parseInt(page, 10) || 1);
      const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const now = new Date();

      const [projects, total, byStatus, overdue] = await Promise.all([
        populate(Project.find(filter)).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).lean(),
        Project.countDocuments(filter),
        Project.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        Project.countDocuments({ status: { $in: ["PLANNING", "IN_PROGRESS", "ON_HOLD"] }, dueDate: { $lt: now } }),
      ]);

      const counts = Object.fromEntries(PROJECT_STATUSES.map((s) => [s, 0]));
      for (const r of byStatus) counts[r._id] = r.count;

      res.json({ projects, total, counts, overdue, page: p, pages: Math.max(1, Math.ceil(total / l)) });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch projects", error: err.message });
    }
  },

  async createProject(req, res) {
    try {
      if (!req.body.name || !String(req.body.name).trim()) return res.status(400).json({ message: "Project name is required" });
      const project = new Project({ createdBy: req.admin._id });
      applyBody(project, req.body);
      if (project.status === "COMPLETED") project.completedAt = new Date();
      await project.save();
      res.status(201).json({ message: "Project created", project: await populate(Project.findById(project._id)) });
    } catch (err) {
      res.status(400).json({ message: err.message || "Failed to create project" });
    }
  },

  async updateProject(req, res) {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid project id" });
      const project = await Project.findById(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (req.body.name !== undefined && !String(req.body.name).trim()) return res.status(400).json({ message: "Project name is required" });

      const prev = project.status;
      applyBody(project, req.body);
      if (project.status !== prev) {
        if (project.status === "COMPLETED") {
          project.completedAt = new Date();
          if (!project.milestones.length) project.progress = 100;
        } else project.completedAt = null;
      }
      await project.save();
      res.json({ message: "Project updated", project: await populate(Project.findById(project._id)) });
    } catch (err) {
      res.status(400).json({ message: err.message || "Failed to update project" });
    }
  },

  async deleteProject(req, res) {
    try {
      const project = await Project.findByIdAndDelete(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      res.json({ message: "Project deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete project", error: err.message });
    }
  },
};

module.exports = projectController;