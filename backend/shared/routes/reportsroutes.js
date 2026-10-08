const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");
const { scopeToOutletAccess } = require("../middleware/permissionMiddleware");
const c = require("../controllers/reportsController");
const { requireFeature } = require("../middleware/planLimits");

router.use(protect, authorize("owner", "manager", "investor", "partner"), scopeToOutletAccess, requireFeature("reports"));

router.get("/overview", c.getOverview);
router.get("/sales", c.getSalesReport);
router.get("/products", c.getProductReport);

module.exports = router;