const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Login identity for YOUR company's own staff — completely separate from
// the customer-facing User model (shared/models/User.js), which belongs to
// a Restaurant/retail business. An AdminUser never has a restaurantId.
const ADMIN_ROLES = ["superadmin", "admin", "sales", "support", "developer", "accountant"];

// Mirrors constants/permissions.js's shape (flat string keys) so the same
// checkbox-UI pattern used for customer staff can be reused here.
const ADMIN_PERMISSIONS = [
  "VIEW_DASHBOARD",
  "VIEW_CLIENTS", "MANAGE_CLIENTS",
  "VIEW_LEADS", "MANAGE_LEADS",
  "VIEW_SUBSCRIPTIONS", "MANAGE_SUBSCRIPTIONS",
  "VIEW_INVOICES", "MANAGE_INVOICES",
  "VIEW_PAYMENTS", "MANAGE_PAYMENTS",
  "VIEW_PROJECTS", "MANAGE_PROJECTS",
  "VIEW_TASKS", "MANAGE_TASKS",
  "VIEW_SUPPORT", "MANAGE_SUPPORT",
  "VIEW_EMPLOYEES", "MANAGE_EMPLOYEES",
  "VIEW_REPORTS",
  "VIEW_ANALYTICS",
  "MANAGE_PRODUCTS",
  "MANAGE_ADMIN_USERS",
  "MANAGE_SETTINGS",
];

const DEFAULT_PERMISSIONS_BY_ADMIN_ROLE = {
  superadmin: [...ADMIN_PERMISSIONS],
  admin: ADMIN_PERMISSIONS.filter((p) => p !== "MANAGE_ADMIN_USERS"),
  sales: ["VIEW_DASHBOARD", "VIEW_CLIENTS", "VIEW_LEADS", "MANAGE_LEADS", "VIEW_SUBSCRIPTIONS"],
  support: ["VIEW_DASHBOARD", "VIEW_CLIENTS", "VIEW_SUPPORT", "MANAGE_SUPPORT"],
  developer: ["VIEW_DASHBOARD", "VIEW_PROJECTS", "MANAGE_PROJECTS", "VIEW_TASKS", "MANAGE_TASKS"],
  accountant: ["VIEW_DASHBOARD", "VIEW_INVOICES", "MANAGE_INVOICES", "VIEW_PAYMENTS", "MANAGE_PAYMENTS", "VIEW_SUBSCRIPTIONS"],
};

const adminUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ADMIN_ROLES, required: true, default: "support" },
    permissions: [{ type: String, enum: ADMIN_PERMISSIONS }],
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    // Link to the HR-style record — mirrors Staff.userId on the customer
    // side. Optional: a superadmin created directly may have no Employee row.
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  },
  { timestamps: true, collection: "admin_users" }
);

adminUserSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

adminUserSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

adminUserSchema.methods.hasPermission = function hasPermission(key) {
  if (this.role === "superadmin") return true;
  return (this.permissions || []).includes(key);
};

module.exports = mongoose.model("AdminUser", adminUserSchema);
module.exports.ADMIN_ROLES = ADMIN_ROLES;
module.exports.ADMIN_PERMISSIONS = ADMIN_PERMISSIONS;
module.exports.DEFAULT_PERMISSIONS_BY_ADMIN_ROLE = DEFAULT_PERMISSIONS_BY_ADMIN_ROLE;