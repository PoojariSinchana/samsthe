const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");
const c = require("../controllers/purchaseController");
const { requireFeature } = require("../middleware/planLimits");

// Mount at /api/purchases. Replaces /api/purchases (restaurant) and /api/shop/purchases (retail).
router.use(protect, authorize("owner", "manager"), requireFeature("purchases"));

router.get("/", c.getPurchases);
router.get("/:id", c.getPurchaseById);
router.post("/", c.createPurchase);
router.post("/:id/payments", c.addPayment);

module.exports = router;