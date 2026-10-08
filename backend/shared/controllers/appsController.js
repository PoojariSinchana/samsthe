const App = require("../models/app");

const appsController = {
  // GET /api/apps — public, powers the portal home page and the sidebar app-switcher.
  async getApps(req, res) {
    try {
      const apps = await App.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
      res.json({ apps });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch apps", error: err.message });
    }
  },

  // GET /api/apps/all — everything, including inactive/soon — for an admin screen later.
  async getAllApps(req, res) {
    try {
      const apps = await App.find().sort({ sortOrder: 1, name: 1 });
      res.json({ apps });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch apps", error: err.message });
    }
  },

  async createApp(req, res) {
    try {
      const app = await App.create(req.body);
      res.status(201).json({ message: "App created", app });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ message: `An app with slug "${req.body.slug}" already exists` });
      res.status(400).json({ message: err.message });
    }
  },

  async updateApp(req, res) {
    try {
      const app = await App.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
      if (!app) return res.status(404).json({ message: "App not found" });
      res.json({ message: "App updated", app });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  async deleteApp(req, res) {
    try {
      const app = await App.findByIdAndDelete(req.params.id);
      if (!app) return res.status(404).json({ message: "App not found" });
      res.json({ message: "App removed" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
};

module.exports = appsController;