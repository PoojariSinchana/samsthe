const express = require("express");
const router = express.Router();
const { adminProtect, requireAdminPermission } = require("../middleware/adminAuthMiddleware");
const c = require("../controllers/planController");

router.use(adminProtect);
router.get("/", requireAdminPermission("VIEW_SUBSCRIPTIONS", "VIEW_CLIENTS", "MANAGE_PRODUCTS"), c.listPlans);
router.post("/", requireAdminPermission("MANAGE_PRODUCTS"), c.createPlan);
router.put("/:id", requireAdminPermission("MANAGE_PRODUCTS"), c.updatePlan);

module.exports = router;