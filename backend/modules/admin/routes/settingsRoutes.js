const express = require("express");
const router = express.Router();
const { adminProtect, requireAdminPermission } = require("../middleware/adminAuthMiddleware");
const c = require("../controllers/settingsController");
const { settings } = require("./settings");

async function nextInvoiceNumber() {
  const last = await Invoice.findOne({}, "invoiceNumber").sort({ createdAt: -1 }).lean();
  const n = last ? parseInt(last.invoiceNumber.replace(/\D/g, ""), 10) || 0 : 0;
  return `${settings().invoicing.prefix}-${String(n + 1).padStart(4, "0")}`;
}


router.use(adminProtect, requireAdminPermission("MANAGE_SETTINGS"));
router.get("/", c.getSettings);
router.put("/", c.updateSettings);

module.exports = router;