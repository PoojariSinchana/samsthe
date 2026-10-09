const mongoose = require("mongoose");

// Singleton: one document, key "platform".
const schema = new mongoose.Schema(
  {
    key: { type: String, default: "platform", unique: true },
    company: {
      name: { type: String, trim: true, default: "Samsthe" },
      supportEmail: { type: String, trim: true, lowercase: true, default: "" },
      supportPhone: { type: String, trim: true, default: "" },
      address: { type: String, trim: true, default: "" },
      gstin: { type: String, trim: true, uppercase: true, default: "" },
    },
    invoicing: {
      prefix: { type: String, trim: true, uppercase: true, default: "INV" }, // letters only, see controller
      defaultDueDays: { type: Number, min: 0, max: 90, default: 7 },
    },
    billing: {
      graceDays: { type: Number, min: 0, max: 30, default: 3 },          // access after a trial/period ends
      renewalLeadDays: { type: Number, min: 1, max: 30, default: 7 },    // auto-send renewal invoice this early
      trialReminderDays: { type: Number, min: 1, max: 14, default: 3 },  // "trial ends soon" notice
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
  },
  { timestamps: true, collection: "platform_settings" }
);

schema.statics.get = async function () {
  try {
    return await this.findOneAndUpdate(
      { key: "platform" }, { $setOnInsert: { key: "platform" } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (e) {
    if (e.code === 11000) return this.findOne({ key: "platform" }); // two requests created it at once
    throw e;
  }
};

module.exports = mongoose.model("PlatformSettings", schema);