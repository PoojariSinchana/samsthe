const express = require("express");
const { authorize } = require("../middleware/roleMiddleware");
const { enforceStaffLimit } = require("../middleware/planLimits");

const {
  registerRestaurant, login, continueLogin, staffLogin, getMe, changePassword,
  getAccessOptions, getStaffUsers, createStaffUser, updateStaffAccess, deleteStaffUser,
  deleteAccount,
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();


router.get("/access-options", protect, authorize("owner", "manager"), getAccessOptions);
router.get("/staff", protect, authorize("owner", "manager"), getStaffUsers);
router.put("/staff/:id/access", protect, authorize("owner", "manager"), updateStaffAccess);
router.delete("/staff/:id", protect, authorize("owner", "manager"), deleteStaffUser);
router.post("/register", registerRestaurant);

router.post("/login", login);

router.post("/login/continue", continueLogin);

router.post("/staff-login", staffLogin);

router.post("/staff", protect, authorize("owner", "manager"), enforceStaffLimit, createStaffUser);

router.get("/me", protect, getMe);

router.put("/password", protect, changePassword);
router.delete("/account", protect, authorize("owner"), deleteAccount);

module.exports = router;