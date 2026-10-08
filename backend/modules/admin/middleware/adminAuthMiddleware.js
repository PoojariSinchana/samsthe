const jwt = require("jsonwebtoken");
const AdminUser = require("../models/AdminUser");
const { getAdminSecret } = require("../utils/generateAdminToken");

async function adminProtect(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith("Bearer ") ? header.split(" ")[1] : null;
  if (!token) return res.status(401).json({ message: "Not authorized, no token provided" });

  try {
    const decoded = jwt.verify(token, getAdminSecret());
    if (decoded.scope !== "admin" || !decoded.adminId) {
      return res.status(401).json({ message: "Not authorized, invalid token" });
    }

    const admin = await AdminUser.findById(decoded.adminId);
    if (!admin) return res.status(401).json({ message: "Not authorized, account no longer exists" });
    // Checked on every request (not just login) so deactivating someone
    // cuts off their existing token immediately.
    if (!admin.isActive) return res.status(403).json({ message: "This account has been deactivated" });

    req.admin = admin;
    next();
  } catch {
    return res.status(401).json({ message: "Not authorized, token invalid or expired" });
  }
}

// Usage: requireAdminPermission("MANAGE_LEADS")
function requireAdminPermission(...keys) {
  return (req, res, next) => {
    if (keys.some((k) => req.admin.hasPermission(k))) return next();
    return res.status(403).json({ message: `Missing permission: ${keys.join(" or ")}` });
  };
}

// Usage: authorizeAdmin("superadmin", "admin")
function authorizeAdmin(...roles) {
  return (req, res, next) => {
    if (roles.includes(req.admin.role)) return next();
    return res.status(403).json({ message: `Role '${req.admin.role}' is not permitted to perform this action` });
  };
}

module.exports = { adminProtect, requireAdminPermission, authorizeAdmin };