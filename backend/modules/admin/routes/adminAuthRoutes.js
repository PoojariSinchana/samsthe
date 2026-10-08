const express = require("express");
const router = express.Router();
const { adminProtect, requireAdminPermission } = require("../middleware/adminAuthMiddleware");
const c = require("../controllers/adminAuthController");

// Public
router.post("/login", c.login);

// Any signed-in admin
router.get("/me", adminProtect, c.getMe);
router.put("/password", adminProtect, c.changePassword);

// Admin-user management
router.get("/access-options", adminProtect, requireAdminPermission("MANAGE_ADMIN_USERS"), c.getAccessOptions);
router.get("/users", adminProtect, requireAdminPermission("MANAGE_ADMIN_USERS"), c.listAdmins);
router.post("/users", adminProtect, requireAdminPermission("MANAGE_ADMIN_USERS"), c.createAdmin);
router.put("/users/:id", adminProtect, requireAdminPermission("MANAGE_ADMIN_USERS"), c.updateAdmin);

module.exports = router;