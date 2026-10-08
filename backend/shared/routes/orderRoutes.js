const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");
const { scopeToOutletAccess } = require("../middleware/permissionMiddleware");
const c = require("../controllers/orderController");

// One router for restaurant orders AND shop sales. Mount at /api/orders.
// (The retail app used /api/shop/sales; point its frontend api file here and pass channel: "counter".)
router.use(protect);

router.get("/", scopeToOutletAccess, c.getOrders);
router.get("/reports/payments", authorize("owner", "manager", "cashier"), c.getPaymentsReport);   // before "/:id"
router.get("/:id", c.getOrderById);

const sellers = ["owner", "manager", "cashier", "waiter"];
router.post("/", authorize(...sellers), c.createOrder);
router.post("/:id/items", authorize(...sellers), c.addItems);
router.patch("/:id/items", authorize(...sellers), c.replaceLines);
router.patch("/:id/status", authorize(...sellers), c.updateOrderStatus);
router.patch("/:id/lines/:lineId/status", authorize("owner", "manager", "kitchen"), c.updateLineStatus);

router.post("/:id/payments", authorize("owner", "manager", "cashier"), c.addPayment);
router.patch("/:id/generate-bill", authorize("owner", "manager", "cashier"), c.markBillGenerated);
router.post("/:id/returns", authorize("owner", "manager", "cashier"), c.returnLines);
router.patch("/:id/cancel", authorize("owner", "manager"), c.cancelOrder);

module.exports = router;