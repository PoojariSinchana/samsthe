const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");
const supplierController = require("../controllers/supplierController");

router.use(protect, authorize("owner", "manager"));

router.get("/", supplierController.getSuppliers);
router.post("/", supplierController.createSupplier);
router.put("/:id", supplierController.updateSupplier);
router.delete("/:id", supplierController.deactivateSupplier);

module.exports = router;