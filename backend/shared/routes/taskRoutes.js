const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const c = require("../controllers/taskController");

router.use(protect);
router.get("/assignees", c.getAssignees);   // before "/:id"
router.get("/", c.getTasks);
router.post("/", c.createTask);
router.put("/:id", c.updateTask);
router.delete("/:id", c.deleteTask);

module.exports = router;