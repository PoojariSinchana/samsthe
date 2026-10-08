const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");
const { scopeToOutletAccess } = require("../middleware/permissionMiddleware");
const c = require("../controllers/analyticsController");
const { requireFeature } = require("../middleware/planLimits");

router.use(protect, authorize("owner", "manager", "investor", "partner"), scopeToOutletAccess, requireFeature("analytics"));
router.get("/", c.getAnalytics);

module.exports = router;