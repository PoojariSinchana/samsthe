const express = require("express");
const { createOutlet, getOutlets, updateOutlet, deleteOutlet } = require("../controllers/outletController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");
const { enforceOutletLimit, enforceOutletReactivation } = require("../middleware/planLimits");

const router = express.Router();

router.get("/", protect, getOutlets);
router.post("/", protect, authorize("owner", "manager"), enforceOutletLimit, createOutlet);
router.put("/:id", protect, authorize("owner", "manager"), enforceOutletReactivation, updateOutlet);
router.delete("/:id", protect, authorize("owner", "manager"), deleteOutlet);

module.exports = router;