const express = require("express");
const router = express.Router();
const { adminProtect, requireAdminPermission } = require("../middleware/adminAuthMiddleware");
const c = require("../controllers/adminTaskController");

router.use(adminProtect);
const view = requireAdminPermission("VIEW_TASKS", "MANAGE_TASKS");
const manage = requireAdminPermission("MANAGE_TASKS");

router.get("/meta", view, c.getMeta);
router.get("/", view, c.getTasks);
router.post("/", manage, c.createTask);
router.put("/:id", view, c.updateTask); // controller restricts view-only admins to status changes on their own tasks
router.delete("/:id", manage, c.deleteTask);

module.exports = router;