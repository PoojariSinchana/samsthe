const express = require("express");
const { getSummary } = require("../controllers/dashboardController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");
const { scopeToOutletAccess } = require("../middleware/permissionMiddleware");

const router = express.Router();
router.get("/summary", protect, authorize("owner", "manager", "investor", "partner", "cashier"), scopeToOutletAccess, getSummary);
module.exports = router;