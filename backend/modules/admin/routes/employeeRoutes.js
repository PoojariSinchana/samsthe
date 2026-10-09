const express = require("express");
const router = express.Router();
const { adminProtect, requireAdminPermission } = require("../middleware/adminAuthMiddleware");
const c = require("../controllers/employeeController");

router.use(adminProtect);
const view = requireAdminPermission("VIEW_EMPLOYEES", "MANAGE_EMPLOYEES");
const manage = requireAdminPermission("MANAGE_EMPLOYEES");

router.get("/meta", view, c.getMeta);
router.get("/", view, c.getEmployees);
router.post("/", manage, c.createEmployee);
router.post("/:id/login", manage, c.createLogin);
router.put("/:id", manage, c.updateEmployee);
router.delete("/:id", manage, c.deleteEmployee);

module.exports = router;