const mongoose = require("mongoose");

const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"];
const NORMAL_BALANCE = { asset: "debit", expense: "debit", liability: "credit", equity: "credit", revenue: "credit" };

const chartOfAccountSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ACCOUNT_TYPES, required: true },
    isSystemAccount: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

chartOfAccountSchema.index({ businessId: 1, code: 1 }, { unique: true });
chartOfAccountSchema.methods.normalBalance = function () { return NORMAL_BALANCE[this.type]; };

module.exports = mongoose.model("ChartOfAccount", chartOfAccountSchema);
module.exports.ACCOUNT_TYPES = ACCOUNT_TYPES;
module.exports.NORMAL_BALANCE = NORMAL_BALANCE;