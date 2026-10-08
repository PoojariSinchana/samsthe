const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");
const partnerController = require("../controllers/partnerController");
const upload = require("../middleware/upload");
const { requireFeature } = require("../middleware/planLimits");

router.use(protect, authorize("owner", "manager"), requireFeature("partners"));

router.get("/", partnerController.getPartners);
router.post("/upload-photo", upload.single("photo"), partnerController.uploadPhoto);
router.post("/", authorize("owner"), partnerController.createPartner);
router.put("/:id", authorize("owner"), partnerController.updatePartner);
router.delete("/:id", authorize("owner"), partnerController.deactivatePartner);

module.exports = router;