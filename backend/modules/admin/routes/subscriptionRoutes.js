const express = require("express");
const router = express.Router();
const { adminProtect, requireAdminPermission } = require("../middleware/adminAuthMiddleware");
const c = require("../controllers/subscriptionController");

router.use(adminProtect);
const view = requireAdminPermission("VIEW_SUBSCRIPTIONS", "MANAGE_SUBSCRIPTIONS");
const manage = requireAdminPermission("MANAGE_SUBSCRIPTIONS");
const invoice = requireAdminPermission("MANAGE_INVOICES");

router.get("/meta", view, c.getMeta);
router.get("/", view, c.getSubscriptions);
router.post("/generate-renewals", invoice, c.generateRenewals);   // before "/:id" routes
router.put("/:id/status", manage, c.updateStatus);
router.post("/:id/extend", manage, c.extend);
router.post("/:id/renewal-invoice", invoice, c.renewalInvoice);

module.exports = router;