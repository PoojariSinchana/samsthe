require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const Business = require("../shared/models/Business");
const Subscription = require("../modules/admin/models/Subscription");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const subs = await Subscription.find({ trialEndsAt: { $ne: null } }, "businessId createdAt").lean();
  for (const s of subs) {
    await Business.updateOne({ _id: s.businessId, trialUsedAt: null }, { $set: { trialUsedAt: s.createdAt } });
  }
  console.log("Backfilled", subs.length);
  await mongoose.disconnect();
})();