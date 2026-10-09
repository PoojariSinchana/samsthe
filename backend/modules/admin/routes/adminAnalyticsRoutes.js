const express = require("express");
const router = express.Router();
const { adminProtect, requireAdminPermission } = require("../middleware/adminAuthMiddleware");
const c = require("../controllers/adminAnalyticsController");

router.use(adminProtect, requireAdminPermission("VIEW_ANALYTICS"));
router.get("/", c.getAnalytics);

module.exports = router;