const express = require("express");
const router = express.Router();
const { adminProtect, requireAdminPermission } = require("../middleware/adminAuthMiddleware");
const c = require("../controllers/clientController");

router.use(adminProtect);

router.get("/meta", requireAdminPermission("VIEW_CLIENTS", "MANAGE_CLIENTS"), c.getMeta);
router.get("/", requireAdminPermission("VIEW_CLIENTS", "MANAGE_CLIENTS"), c.getClients);
router.get("/:id", requireAdminPermission("VIEW_CLIENTS", "MANAGE_CLIENTS"), c.getClient);
router.put("/:id/subscription", requireAdminPermission("MANAGE_CLIENTS", "MANAGE_SUBSCRIPTIONS"), c.upsertSubscription);

module.exports = router;