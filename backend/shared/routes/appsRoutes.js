const express = require("express");
const router = express.Router();
const appsController = require("../controllers/appsController");
const { adminProtect, requireAdminPermission } = require("../../modules/admin/middleware/adminAuthMiddleware");

router.get("/", appsController.getApps);
router.get("/all", adminProtect, requireAdminPermission("MANAGE_PRODUCTS"), appsController.getAllApps);
router.post("/", adminProtect, requireAdminPermission("MANAGE_PRODUCTS"), appsController.createApp);
router.put("/:id", adminProtect, requireAdminPermission("MANAGE_PRODUCTS"), appsController.updateApp);
router.delete("/:id", adminProtect, requireAdminPermission("MANAGE_PRODUCTS"), appsController.deleteApp);

module.exports = router;