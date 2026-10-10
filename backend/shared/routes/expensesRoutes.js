const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");
const Entry = require("../models/Entry");
const c = require("../controllers/entriesController");

router.use(protect, authorize("owner", "manager"));

const force = (where) => (req, res, next) => { req[where].entryType = "EXPENSE"; next(); };

router.get("/meta", c.getMeta);
router.get("/", force("query"), c.getEntries);
router.post("/", force("body"), c.createEntry);

// Only expenses can be cancelled through this route.
router.patch("/:id/cancel", async (req, res, next) => {
  try {
    const ok = await Entry.exists({ _id: req.params.id, businessId: req.user.businessId, entryType: "EXPENSE" });
    if (!ok) return res.status(404).json({ message: "Expense not found" });
    next();
  } catch (err) { next(err); }
}, c.cancelEntry);

module.exports = router;