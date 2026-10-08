const mongoose = require("mongoose");

// Roles that see every outlet (and "overall"). Everyone else only sees req.user.outletAccess.
const UNRESTRICTED_ROLES = ["owner", "investor", "partner"];

const toIds = (list) => (list || []).map((id) => new mongoose.Types.ObjectId(id));

// Sets req.outletFilter = { outlet: { $in: [...] } } for restricted roles (unrestricted roles get nothing).
function scopeToOutletAccess(req, res, next) {
  if (UNRESTRICTED_ROLES.includes(req.user.role)) return next();
  req.outletFilter = { outlet: { $in: toIds(req.user.outletAccess) } };
  next();
}

// Controllers call this instead of hand-rolling `if (outlet) filter.outlet = outlet`.
//   unrestricted + no ?outlet   -> {}
//   unrestricted + ?outlet=X    -> { [field]: X }
//   restricted   + no ?outlet   -> { [field]: { $in: allowed } }
//   restricted   + ?outlet=X    -> { [field]: X } if X is allowed, else throws 403
// `field` is "outlet" for Entry/JournalEntry/Table, and "outletId" for Order/Purchase/StockLevel.
function resolveOutletFilter(req, requestedOutlet, field = "outlet") {
  if (UNRESTRICTED_ROLES.includes(req.user.role)) {
    return requestedOutlet ? { [field]: new mongoose.Types.ObjectId(requestedOutlet) } : {};
  }
  const allowed = (req.user.outletAccess || []).map(String);
  if (requestedOutlet) {
    if (!allowed.includes(String(requestedOutlet))) {
      throw Object.assign(new Error("You don't have access to that outlet"), { status: 403 });
    }
    return { [field]: new mongoose.Types.ObjectId(requestedOutlet) };
  }
  return { [field]: { $in: toIds(allowed) } };
}

// Requires User.prototype.hasPermission (not on the User model yet).
function requirePermission(key) {
  return (req, res, next) => (req.user.hasPermission(key) ? next() : res.status(403).json({ message: `Missing permission: ${key}` }));
}

module.exports = { requirePermission, scopeToOutletAccess, resolveOutletFilter, UNRESTRICTED_ROLES };