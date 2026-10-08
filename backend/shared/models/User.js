const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { Schema } = mongoose;

const SYSTEM_ROLES = ["owner", "manager", "investor", "partner", "cashier", "waiter", "kitchen"];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, sparse: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    accountId: { type: Schema.Types.ObjectId, ref: "Account", index: true },
    password: { type: String, required: true, minlength: 4, select: false },
    profileImage: { type: String, default: "" },
    status: { type: String, enum: ["active", "inactive", "suspended"], default: "active" },
    lastLogin: { type: Date },

    businessId: { type: Schema.Types.ObjectId, ref: "Business", index: true },
    employeeId: { type: String, trim: true },
    role: { type: String, enum: SYSTEM_ROLES, default: "owner" },
    permissions: [{ type: String }],
    outletAccess: [{ type: Schema.Types.ObjectId, ref: "Outlet" }],
    mustChangePassword: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "users" }
);

// staffLogin looks users up by (businessId, employeeId)
userSchema.index({ businessId: 1, employeeId: 1 }, { unique: true, partialFilterExpression: { employeeId: { $type: "string" } } });

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, await bcrypt.genSalt(10));
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Owners can do everything; everyone else needs the key in their permissions list.
userSchema.methods.hasPermission = function (key) {
  if (this.role === "owner") return true;
  return (this.permissions || []).includes(key);
};

module.exports = mongoose.model("User", userSchema);
module.exports.SYSTEM_ROLES = SYSTEM_ROLES;