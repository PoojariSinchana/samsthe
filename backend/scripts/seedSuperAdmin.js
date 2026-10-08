// One-off: creates the first superadmin. Safe to re-run (skips if the email exists).
// Usage: SEED_ADMIN_EMAIL=you@samsthe.app SEED_ADMIN_PASSWORD='long-random' node scripts/seedSuperAdmin.js
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const AdminUser = require("../modules/admin/models/AdminUser");

async function run() {
  const email = (process.env.SEED_ADMIN_EMAIL || "").toLowerCase().trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME || "Super Admin";
  if (!email || !password) throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");

  await mongoose.connect(process.env.MONGODB_URI);
  if (await AdminUser.findOne({ email })) {
    console.log(`Admin ${email} already exists — nothing to do.`);
  } else {
    await AdminUser.create({ name, email, password, role: "superadmin", permissions: [] });
    console.log(`Superadmin created: ${email}`);
  }
  await mongoose.disconnect();
}

run().catch((err) => { console.error("Seed failed:", err.message); process.exit(1); });