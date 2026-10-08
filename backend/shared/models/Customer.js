const mongoose = require("mongoose");

// Replaces Customer + ShopCustomer. A business is either restaurant or retail, so no collisions.
const customerSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    address: { type: String, trim: true, default: "" },
    tags: [{ type: String, trim: true }],
    notes: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

customerSchema.index({ businessId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model("Customer", customerSchema);