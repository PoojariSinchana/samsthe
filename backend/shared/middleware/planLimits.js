const Subscription = require("../../modules/admin/models/Subscription");
const Outlet = require("../models/Outlet");
const User = require("../models/User");

const NEEDS_PLAN_STATUSES = ["PENDING", "EXPIRED", "CANCELLED"];
const { settings } = require("../../modules/admin/utils/settings");
const graceDays = () => settings().billing.graceDays;

const getSub = (businessId) =>
  Subscription.findOne({ businessId }, "status limits trialEndsAt currentPeriodEnd planId")
    .populate("planId", "name key modules").lean();

// ── Usage counters ───────────────────────────────────────────────
// Only ACTIVE outlets count, so deactivating one frees a slot.
const countOutlets = (businessId) => Outlet.countDocuments({ businessId, isActive: true });
// Staff logins = every active login except the owner (managers, cashiers, investors, partners...).
const countStaffLogins = (businessId) =>
  User.countDocuments({ businessId, role: { $ne: "owner" }, status: "active" });

// ── Limit guard factory ──────────────────────────────────────────
// `when` (optional, may be async) decides whether this request needs checking at all.
function limitGuard({ key, label, count, when }) {
  return async (req, res, next) => {
    try {
      if (when && !(await when(req))) return next();
      const sub = await getSub(req.user.businessId);
      const max = sub?.limits?.[key];
      if (!max) return next(); // no subscription (older accounts): never lock people out

      const used = await count(req.user.businessId);
      if (used >= max) {
        return res.status(403).json({
          code: "PLAN_LIMIT",
          message: `Your ${sub.planId?.name || "current"} plan allows ${max} ${label}. Upgrade your plan to add more.`,
          limit: max,
          used,
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

const enforceOutletLimit = limitGuard({
  key: "maxOutlets", label: "outlet(s)", count: countOutlets,
});

// Reactivating an inactive outlet takes a slot too, so PUT must check it as well.
const enforceOutletReactivation = limitGuard({
  key: "maxOutlets", label: "outlet(s)", count: countOutlets,
  when: async (req) =>
    req.body.isActive === true &&
    !!(await Outlet.exists({ _id: req.params.id, businessId: req.user.businessId, isActive: false })),
});

const enforceStaffLimit = limitGuard({
  key: "maxStaff", label: "staff login(s)", count: countStaffLogins,
});

// POST /api/staff only creates a login when createLogin is set.
const enforceStaffLoginIfRequested = limitGuard({
  key: "maxStaff", label: "staff login(s)", count: countStaffLogins,
  when: (req) => !!req.body.createLogin,
});

// ── Optional: block writes when the subscription has lapsed ──────
function isLapsed(sub) {
  if (!sub) return false;
  if (["CANCELLED", "SUSPENDED"].includes(sub.status)) return true;
  const end = sub.status === "TRIAL" ? sub.trialEndsAt || sub.currentPeriodEnd : sub.currentPeriodEnd;
  return !!end && Date.now() > new Date(end).getTime() + graceDays() * 864e5;
}

async function requireActiveSubscription(req, res, next) {
  try {
    const endReason = (sub) => (sub?.status === "TRIAL" || sub?.trialEndsAt ? "trial_ended" : "subscription_ended");
    const sub = await getSub(req.user.businessId);
    if (sub?.status === "SUSPENDED") {
      return res.status(403).json({ code: "SUSPENDED", message: "This account is suspended. Please contact support." });
    }
    if (needsPlan(sub)) {
      const isOwner = req.user.role === "owner";
      return res.status(402).json({
        code: isOwner ? "PLAN_REQUIRED" : "PLAN_REQUIRED_STAFF",
        reason: endReason(sub),
        message: isOwner
          ? "Please choose a plan to continue."
          : "Your business's subscription has ended. Please contact your business owner to activate it.",
      });
    }
    next();
  } catch (err) { next(err); }
}

// ── GET /api/business/me/usage: for a "2 of 3 outlets" display in the UI ──
async function getUsage(req, res) {
  try {
    const { businessId } = req.user;
    const [sub, outlets, staff] = await Promise.all([getSub(businessId), countOutlets(businessId), countStaffLogins(businessId)]);
    res.json({
      plan: sub ? { name: sub.planId?.name, key: sub.planId?.key, status: sub.status, endsAt: sub.status === "TRIAL" ? sub.trialEndsAt : sub.currentPeriodEnd } : null,
      modules: Array.isArray(sub?.planId?.modules) ? sub.planId.modules : null, // null = everything unlocked
      lapsed: isLapsed(sub),
      needsPlan: needsPlan(sub),
      usage: {
        outlets: { used: outlets, max: sub?.limits?.maxOutlets ?? null },
        staff: { used: staff, max: sub?.limits?.maxStaff ?? null },
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to load usage", error: err.message });
  }
}

const { FEATURE_LABELS } = require("../constants/features");

// Any-of: passes if the plan includes at least one of the keys.
// No subscription, or a plan with no `modules` list, means allowed (never lock out old accounts).
function planAllows(sub, keys) {
  const mods = sub?.planId?.modules;
  return !sub || !Array.isArray(mods) || keys.some((k) => mods.includes(k));
}

function requireFeature(...keys) {
  return async (req, res, next) => {
    try {
      const sub = await getSub(req.user.businessId);
      if (planAllows(sub, keys)) return next();
      res.status(403).json({
        code: "FEATURE_LOCKED",
        feature: keys[0],
        message: `${FEATURE_LABELS[keys[0]] || "This feature"} isn't included in your ${sub.planId?.name || "current"} plan.`,
      });
    } catch (err) { next(err); }
  };
}

function needsPlan(sub) {
  if (!sub) return true;
  if (NEEDS_PLAN_STATUSES.includes(sub.status)) return true;
  if (sub.status === "SUSPENDED") return false;
  const end = sub.status === "TRIAL" ? sub.trialEndsAt || sub.currentPeriodEnd : sub.currentPeriodEnd;
  return !!end && Date.now() > new Date(end).getTime() + graceDays() * 864e5;
}

module.exports = {
  enforceOutletLimit, enforceOutletReactivation,
  enforceStaffLimit, enforceStaffLoginIfRequested,
  requireActiveSubscription, getUsage, requireFeature, needsPlan,
  countOutlets, countStaffLogins, planAllows,
};