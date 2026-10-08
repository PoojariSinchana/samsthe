const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");
const entriesController = require("../controllers/entriesController");
const uploadAudio = require("../middleware/uploadAudio");
const { requireFeature } = require("../middleware/planLimits");

router.use(protect, authorize("owner", "manager"), requireFeature("transactions"));

router.get("/meta", entriesController.getMeta);
router.get("/inventory-snapshot", entriesController.getInventorySnapshot);

router.get("/", entriesController.getEntries);
router.post("/", entriesController.createEntry);
router.put("/:id", entriesController.updateEntry);
router.patch("/:id/cancel", entriesController.cancelEntry);

router.post("/smart/analyze", entriesController.analyzeSmartEntry);
router.post("/smart/transcribe", uploadAudio.single("audio"), entriesController.transcribeVoice);

module.exports = router;