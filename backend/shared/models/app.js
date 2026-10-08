const mongoose = require("mongoose");

// One document per app shown on the Samsthe portal / sidebar switcher.
// This is data now, not a hardcoded array in frontend code — adding a new
// app (or hiding one) is a DB write, not a redeploy.
const appSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // "Restaurant Manager"
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true }, // "restaurant"
    description: { type: String, default: "" },
    icon: { type: String, default: "📦" }, // emoji, cheap to render, no asset pipeline needed
    tags: [{ type: String, trim: true }],
    frontendPath: { type: String, required: true }, // "/restaurant" — client-side route
    apiPrefix: { type: String, required: true }, // "/api/restaurant" — backend route prefix
    status: { type: String, enum: ["live", "soon"], default: "soon" },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("App", appSchema);