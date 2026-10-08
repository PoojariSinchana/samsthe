const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");
const upload = require("../middleware/upload");
const biz = require("../controllers/businessController");
const sub = require("../controllers/subscribeController");
const rp = require("../controllers/razorpayController");
const { getUsage } = require("../middleware/planLimits");

// Deliberately NOT behind requireActiveSubscription: setup and plan selection happen before a plan exists.
router.use(protect);

router.get("/me", biz.getMyBusiness);
router.put("/me", authorize("owner"), biz.updateMyBusiness);
router.post("/me/logo", authorize("owner"), upload.single("logo"), biz.uploadLogo);
router.post("/me/image", authorize("owner"), upload.single("image"), biz.uploadBannerImage);

router.get("/me/usage", getUsage);
router.get("/me/plans", sub.getPlans);
router.post("/me/subscribe", authorize("owner"), sub.subscribe);

router.get("/me/subscription", authorize("owner"), sub.mySubscription);
router.post("/me/subscription/change", authorize("owner"), sub.changePlan);
router.delete("/me/subscription/change", authorize("owner"), sub.cancelChange);

router.get("/me/pay/info", authorize("owner"), rp.info);
router.post("/me/pay/order", authorize("owner"), rp.createOrder);
router.post("/me/pay/verify", authorize("owner"), rp.verify);

module.exports = router;