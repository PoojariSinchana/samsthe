const express = require("express");
const {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  uploadStaffPhoto,
} = require("../controllers/Staffcontroller"); // double-check this filename matches exactly, case included
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");
const { enforceStaffLoginIfRequested } = require("../middleware/planLimits");
const upload = require("../middleware/upload"); // shared multer instance used elsewhere in the app

const router = express.Router();

router.use(protect);
// Staff management (including viewing salaries) is an owner/manager function
// only — matches the Sidebar's existing "Staff" nav item restriction.
router.use(authorize("owner", "manager"));

router.post("/upload-photo", upload.single("photo"), uploadStaffPhoto);

router.route("/:id").get(getStaffById).put(updateStaff).delete(deleteStaff);
router.route("/").get(getAllStaff).post(enforceStaffLoginIfRequested, createStaff);

module.exports = router;