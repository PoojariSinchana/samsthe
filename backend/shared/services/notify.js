const Notification = require("../models/Notification");

// Never throws: a failed notification must not break the action that triggered it.
async function notify({ businessId, userId, type = "general", title, message = "", section, taskId }) {
  if (!userId) return;
  try {
    await Notification.create({ businessId, userId, type, title, message, link: { section }, taskId });
  } catch (e) {
    console.error("notify failed:", e.message);
  }
}

module.exports = { notify };