const express = require("express");
const router = express.Router();
const { adminProtect, requireAdminPermission } = require("../middleware/adminAuthMiddleware");
const c = require("../controllers/dashboardController");

router.get("/summary", adminProtect, requireAdminPermission("VIEW_DASHBOARD"), c.getSummary);
module.exports = router;