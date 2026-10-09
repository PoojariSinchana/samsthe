const express = require("express");
const router = express.Router();
const c = require("../controllers/supportController");

router.get("/meta", c.getMeta);          // before "/:id"
router.get("/", c.list);
router.post("/", c.create);
router.get("/:id", c.getOne);
router.post("/:id/replies", c.reply);

module.exports = router;