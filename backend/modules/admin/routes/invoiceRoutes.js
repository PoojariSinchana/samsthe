const express = require("express");
const router = express.Router();
const { adminProtect, requireAdminPermission } = require("../middleware/adminAuthMiddleware");
const c = require("../controllers/invoiceController");

router.use(adminProtect);
router.get("/meta", requireAdminPermission("VIEW_INVOICES", "MANAGE_INVOICES"), c.getMeta);
router.get("/", requireAdminPermission("VIEW_INVOICES", "MANAGE_INVOICES"), c.getInvoices);
router.get("/:id", requireAdminPermission("VIEW_INVOICES", "MANAGE_INVOICES"), c.getInvoice);
router.post("/", requireAdminPermission("MANAGE_INVOICES"), c.createInvoice);
router.put("/:id", requireAdminPermission("MANAGE_INVOICES"), c.updateInvoice);
router.delete("/:id", requireAdminPermission("MANAGE_INVOICES"), c.deleteInvoice);

module.exports = router;