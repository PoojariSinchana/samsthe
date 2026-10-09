const express = require("express");
const router = express.Router();
const { adminProtect, requireAdminPermission } = require("../middleware/adminAuthMiddleware");
const c = require("../controllers/projectController");

router.use(adminProtect);
router.get("/meta", requireAdminPermission("VIEW_PROJECTS", "MANAGE_PROJECTS"), c.getMeta);
router.get("/", requireAdminPermission("VIEW_PROJECTS", "MANAGE_PROJECTS"), c.getProjects);
router.post("/", requireAdminPermission("MANAGE_PROJECTS"), c.createProject);
router.put("/:id", requireAdminPermission("MANAGE_PROJECTS"), c.updateProject);
router.delete("/:id", requireAdminPermission("MANAGE_PROJECTS"), c.deleteProject);

module.exports = router;