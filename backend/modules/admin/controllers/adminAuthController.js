const AdminUser = require("../models/AdminUser");
const { ADMIN_ROLES, ADMIN_PERMISSIONS, DEFAULT_PERMISSIONS_BY_ADMIN_ROLE } = require("../models/AdminUser");
const { generateAdminToken } = require("../utils/generateAdminToken");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function adminPayload(a) {
  return {
    id: a._id,
    name: a.name,
    email: a.email,
    phone: a.phone,
    role: a.role,
    permissions: a.role === "superadmin" ? ADMIN_PERMISSIONS : a.permissions,
    isActive: a.isActive,
    lastLogin: a.lastLogin,
  };
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

  try {
    const admin = await AdminUser.findOne({ email: String(email).toLowerCase().trim() }).select("+password");
    // Same message for unknown email / wrong password / inactive — don't
    // reveal which admin emails exist.
    const valid = admin && admin.isActive && (await admin.comparePassword(password));
    if (!valid) return res.status(401).json({ message: "Invalid email or password" });

    admin.lastLogin = new Date();
    await admin.save();

    res.json({ message: "Login successful", token: generateAdminToken(admin._id), admin: adminPayload(admin) });
  } catch (err) {
    console.error("ADMIN LOGIN ERROR:", err);
    res.status(500).json({ message: "Login failed" });
  }
}

async function getMe(req, res) {
  res.json({ admin: adminPayload(req.admin) });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ message: "Current and new password are required" });
  if (newPassword.length < 8) return res.status(400).json({ message: "New password must be at least 8 characters" });

  try {
    const admin = await AdminUser.findById(req.admin._id).select("+password");
    if (!(await admin.comparePassword(currentPassword))) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }
    admin.password = newPassword; // hashed by pre-save hook
    await admin.save();
    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update password", error: err.message });
  }
}

// ── Admin-user management (MANAGE_ADMIN_USERS) ──────────────────────────

async function listAdmins(req, res) {
  try {
    const admins = await AdminUser.find().sort({ createdAt: 1 });
    res.json({ admins: admins.map(adminPayload) });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch admin users", error: err.message });
  }
}

async function getAccessOptions(req, res) {
  res.json({ roles: ADMIN_ROLES, permissions: ADMIN_PERMISSIONS, defaultsByRole: DEFAULT_PERMISSIONS_BY_ADMIN_ROLE });
}

async function createAdmin(req, res) {
  try {
    const { name, email, phone, password, role, permissions } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ message: "name, email, password and role are required" });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ message: "Please enter a valid email address" });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
    if (!ADMIN_ROLES.includes(role)) return res.status(400).json({ message: "Invalid role" });
    // Only a superadmin can mint another superadmin.
    if (role === "superadmin" && req.admin.role !== "superadmin") {
      return res.status(403).json({ message: "Only a superadmin can create another superadmin" });
    }

    const perms = permissions?.length ? permissions : DEFAULT_PERMISSIONS_BY_ADMIN_ROLE[role] || [];
    if (perms.some((p) => !ADMIN_PERMISSIONS.includes(p))) return res.status(400).json({ message: "Unknown permission in list" });
    // Non-superadmins can't grant permissions they don't hold themselves.
    const overreach = perms.filter((p) => !req.admin.hasPermission(p));
    if (overreach.length) return res.status(403).json({ message: `You can't grant permissions you don't have: ${overreach.join(", ")}` });

    const admin = await AdminUser.create({ name, email, phone, password, role, permissions: perms });
    res.status(201).json({ message: "Admin user created", admin: adminPayload(admin) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "An admin with this email already exists" });
    res.status(500).json({ message: "Failed to create admin user", error: err.message });
  }
}

async function otherActiveSuperadmins(excludeId) {
  return AdminUser.countDocuments({ role: "superadmin", isActive: true, _id: { $ne: excludeId } });
}

async function updateAdmin(req, res) {
  try {
    const target = await AdminUser.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "Admin user not found" });

    const { name, phone, role, permissions, isActive, password } = req.body;
    const isSelf = String(target._id) === String(req.admin._id);

    if (target.role === "superadmin" && req.admin.role !== "superadmin") {
      return res.status(403).json({ message: "Only a superadmin can modify a superadmin" });
    }
    if (role !== undefined) {
      if (!ADMIN_ROLES.includes(role)) return res.status(400).json({ message: "Invalid role" });
      if (role === "superadmin" && req.admin.role !== "superadmin") {
        return res.status(403).json({ message: "Only a superadmin can grant the superadmin role" });
      }
      // Never allow the last active superadmin to be demoted.
      if (target.role === "superadmin" && role !== "superadmin" && (await otherActiveSuperadmins(target._id)) === 0) {
        return res.status(400).json({ message: "Can't demote the last active superadmin" });
      }
      target.role = role;
    }
    if (isActive !== undefined) {
      if (isSelf && !isActive) return res.status(400).json({ message: "You can't deactivate your own account" });
      if (!isActive && target.role === "superadmin" && (await otherActiveSuperadmins(target._id)) === 0) {
        return res.status(400).json({ message: "Can't deactivate the last active superadmin" });
      }
      target.isActive = isActive;
    }
    if (permissions !== undefined) {
      if (permissions.some((p) => !ADMIN_PERMISSIONS.includes(p))) return res.status(400).json({ message: "Unknown permission in list" });
      const overreach = permissions.filter((p) => !req.admin.hasPermission(p));
      if (overreach.length) return res.status(403).json({ message: `You can't grant permissions you don't have: ${overreach.join(", ")}` });
      target.permissions = permissions;
    }
    if (name !== undefined) target.name = name;
    if (phone !== undefined) target.phone = phone;
    if (password) {
      // Admin-initiated reset — a new password is set; the old hash is never readable.
      if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
      target.password = password;
    }

    await target.save();
    res.json({ message: "Admin user updated", admin: adminPayload(target) });
  } catch (err) {
    res.status(500).json({ message: "Failed to update admin user", error: err.message });
  }
}

module.exports = { login, getMe, changePassword, listAdmins, getAccessOptions, createAdmin, updateAdmin };