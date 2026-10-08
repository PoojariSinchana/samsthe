const express = require("express");
const router = express.Router();
const { adminProtect, requireAdminPermission } = require("../middleware/adminAuthMiddleware");
const c = require("../controllers/paymentController");

router.use(adminProtect);
router.get("/meta", requireAdminPermission("VIEW_PAYMENTS", "MANAGE_PAYMENTS"), c.getMeta);
router.get("/", requireAdminPermission("VIEW_PAYMENTS", "MANAGE_PAYMENTS"), c.getPayments);
router.post("/", requireAdminPermission("MANAGE_PAYMENTS"), c.createPayment);
router.put("/:id/status", requireAdminPermission("MANAGE_PAYMENTS"), c.updateStatus);

module.exports = router;