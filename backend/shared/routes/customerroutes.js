const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");
const c = require("../controllers/customerController");

router.use(protect, authorize("owner", "manager", "cashier", "waiter"));

router.get("/", c.getCustomers);
router.post("/", c.createCustomer);
router.put("/:id", c.updateCustomer);
router.delete("/:id", authorize("owner", "manager"), c.deactivateCustomer);

module.exports = router;