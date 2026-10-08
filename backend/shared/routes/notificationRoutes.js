const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const c = require("../controllers/notificationController");

router.use(protect);
router.get("/", c.list);
router.patch("/read-all", c.markAllRead);   // before "/:id/read"
router.patch("/:id/read", c.markRead);

module.exports = router;