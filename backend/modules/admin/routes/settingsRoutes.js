const express = require("express");
const router = express.Router();
const { adminProtect, requireAdminPermission } = require("../middleware/adminAuthMiddleware");
const c = require("../controllers/settingsController");

router.use(adminProtect, requireAdminPermission("MANAGE_SETTINGS"));
router.get("/", c.getSettings);
router.put("/", c.updateSettings);

module.exports = router;