const express = require("express");
const router = express.Router();
const { adminProtect, requireAdminPermission } = require("../middleware/adminAuthMiddleware");
const c = require("../controllers/leadController");

router.use(adminProtect);

// Dropdown values + assignable admins (needs at least view access)
router.get("/meta", requireAdminPermission("VIEW_LEADS", "MANAGE_LEADS"), c.getMeta);

router.get("/", requireAdminPermission("VIEW_LEADS", "MANAGE_LEADS"), c.getLeads);
router.post("/", requireAdminPermission("MANAGE_LEADS"), c.createLead);
router.put("/:id", requireAdminPermission("MANAGE_LEADS"), c.updateLead);
router.delete("/:id", requireAdminPermission("MANAGE_LEADS"), c.deleteLead);

module.exports = router;