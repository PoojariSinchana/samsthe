// Run once after setting up the samsthe DB: node scripts/seedApps.js
// Safe to re-run — upserts by slug instead of duplicating.
require("dotenv").config();
const mongoose = require("mongoose");
const App = require("../shared/models/app")

const APPS = [
  {
    name: "Restaurant Manager",
    slug: "restaurant",
    description: "Billing, tables, menu, inventory, staff and full accounting for restaurants, cafés and cloud kitchens.",
    icon: "🍽️",
    tags: ["POS", "Accounting", "Multi-outlet"],
    // Marketing page — where clicking the product card on / and /products lands.
    frontendPath: "/products/restaurant",
    apiPrefix: "/api/restaurant",
    status: "live",
    sortOrder: 1,
  },
  {
  name: "Retail Shop",              // was "Clothing Shop"
  slug: "retail",
  description: "Retail management for apparel businesses — catalog, orders and storefront operations.",
  icon: "👕",
  tags: ["Retail", "Inventory"],
  frontendPath: "/products/retail",
  apiPrefix: "/api/shop",
  status: "live",
  sortOrder: 2,
},
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/samsthe");
  console.log("Connected to", mongoose.connection.name);

  for (const app of APPS) {
    await App.findOneAndUpdate({ slug: app.slug }, app, { upsert: true, new: true, setDefaultsOnInsert: true });
    console.log(`Upserted app: ${app.slug}`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});