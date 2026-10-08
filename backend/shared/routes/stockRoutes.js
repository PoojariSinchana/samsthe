const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");
const c = require("../controllers/stockController");

// Mount at /api/stock. Replaces /api/inventory (stock parts) and /api/shop/stock.
router.use(protect, authorize("owner", "manager"));

router.get("/meta", c.getMeta);
router.get("/overview", c.getOverview);
router.get("/history", c.getHistory);
router.get("/", c.getStock);

router.put("/min-stock", c.setMinStock);
router.post("/stock-out", c.stockOut);
router.post("/stock-adjust", c.stockAdjust);

module.exports = router;