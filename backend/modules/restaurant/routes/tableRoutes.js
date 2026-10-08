const express = require("express");
const router = express.Router();
const { protect } = require("../../../shared/middleware/authMiddleware")
const { authorize } = require("../../../shared/middleware/roleMiddleware")
const { scopeToOutletAccess } = require("../../../shared/middleware/permissionMiddleware")
const tableController = require("../controllers/tableController");

router.use(protect);

// Scoped to outlet access so restricted staff only ever see their own
// outlets' tables — this must be the ONLY "/" and "/:id" GET handler
// registered (a duplicate unscoped pair here previously ran first and
// silently shadowed this one, since Express matches routes in order).
router.get("/", scopeToOutletAccess, tableController.getTables);
router.get("/:id", tableController.getTableById);

router.post("/", authorize("owner", "manager"), tableController.createTable);
router.put("/:id", authorize("owner", "manager"), tableController.updateTable);
router.patch("/:id/position", authorize("owner", "manager"), tableController.updateTablePosition);
router.delete("/:id", authorize("owner", "manager"), tableController.deleteTable);

router.patch("/:id/status", authorize("owner", "manager", "cashier", "waiter"), tableController.updateTableStatus);

module.exports = router;