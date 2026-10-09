const express = require("express");
const router = express.Router();
const { adminProtect, requireAdminPermission } = require("../middleware/adminAuthMiddleware");
const c = require("../controllers/ticketController");

const view = requireAdminPermission("VIEW_SUPPORT", "MANAGE_SUPPORT");
const manage = requireAdminPermission("MANAGE_SUPPORT");

router.use(adminProtect);
router.get("/meta", view, c.getMeta);
router.get("/", view, c.getTickets);
router.get("/:id", view, c.getTicket);
router.post("/", manage, c.createTicket);
router.put("/:id", manage, c.updateTicket);
router.post("/:id/replies", manage, c.addReply);
router.delete("/:id", manage, c.deleteTicket);

module.exports = router;