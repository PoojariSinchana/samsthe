const Notification = require("../models/Notification");
const { send } = require("../utils/httpError");

module.exports = {
  async list(req, res) {
    try {
      const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
      const [notifications, unreadCount] = await Promise.all([
        Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(limit),
        Notification.countDocuments({ userId: req.user._id, readAt: null }),
      ]);
      res.json({ notifications, unreadCount });
    } catch (err) { send(res, err, "Failed to load notifications"); }
  },
  async markRead(req, res) {
    try {
      await Notification.updateOne({ _id: req.params.id, userId: req.user._id }, { readAt: new Date() });
      res.json({ ok: true });
    } catch (err) { send(res, err, "Failed to update notification"); }
  },
  async markAllRead(req, res) {
    try {
      await Notification.updateMany({ userId: req.user._id, readAt: null }, { readAt: new Date() });
      res.json({ ok: true });
    } catch (err) { send(res, err, "Failed to update notifications"); }
  },
};