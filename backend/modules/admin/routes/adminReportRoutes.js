const express = require("express");
const router = express.Router();
const { adminProtect, requireAdminPermission } = require("../middleware/adminAuthMiddleware");
const c = require("../controllers/adminReportController");

router.use(adminProtect, requireAdminPermission("VIEW_REPORTS"));
router.get("/summary", c.getSummary);
router.get("/payments.csv", c.paymentsCsv);

module.exports = router;