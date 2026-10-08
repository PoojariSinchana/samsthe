const mongoose = require("mongoose");

const journalLineSchema = new mongoose.Schema(
  {
    account: { type: mongoose.Schema.Types.ObjectId, ref: "ChartOfAccount", required: true },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const SOURCE_TYPES = ["manual", "order_payment", "entry", "payroll", "purchase", "adjustment"];

const journalEntrySchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet" },
    date: { type: Date, required: true, default: Date.now },
    description: { type: String, required: true, trim: true },
    lines: {
      type: [journalLineSchema],
      required: true,
      validate: { validator: (l) => l.length >= 2, message: "A journal entry needs at least two lines" },
    },
    sourceType: { type: String, enum: SOURCE_TYPES, default: "manual" },
    sourceId: { type: mongoose.Schema.Types.ObjectId },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

journalEntrySchema.pre("validate", function (next) {
  const d = this.lines.reduce((s, l) => s + (l.debit || 0), 0);
  const c = this.lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (Math.abs(d - c) > 0.01) return next(new Error(`Entry does not balance: debit ₹${d.toFixed(2)} vs credit ₹${c.toFixed(2)}`));
  if (d === 0) return next(new Error("Entry has no amount"));
  next();
});

journalEntrySchema.index({ businessId: 1, date: -1 });
journalEntrySchema.index(
  { businessId: 1, sourceType: 1, sourceId: 1 },
  { unique: true, partialFilterExpression: { sourceId: { $exists: true } } }
);

module.exports = mongoose.model("JournalEntry", journalEntrySchema);
module.exports.SOURCE_TYPES = SOURCE_TYPES;