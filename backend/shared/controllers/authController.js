const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Account = require("../models/Account");
const User = require("../models/User");
const Business = require("../models/Business");
const App = require("../models/app");
const generateToken = require("../utils/generateToken");
const { PERMISSIONS, PERMISSION_GROUPS, DEFAULT_PERMISSIONS_BY_ROLE, MANAGER_ASSIGNABLE_ROLES } = require("../constants/permissions");
const Staff = require("../models/Staff");
const Partner = require("../models/Partner");

const PricingPlan = require("../../modules/admin/models/PricingPlan");
const Subscription = require("../../modules/admin/models/Subscription");

const SYSTEM_ROLES_ASSIGNABLE = ["manager", "investor", "partner", "cashier", "waiter", "kitchen"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const APP_TYPES = ["restaurant", "retail"];
const APP_LABEL = { restaurant: "Restaurant", retail: "Retail" };
const appLabel = (type) => APP_LABEL[type] || type;
const escapeRe = (s) => s.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Business no longer stores appType: it's App.slug, looked up through Business.appId.
async function loadApps() {
  const apps = await App.find();
  return {
    byId: new Map(apps.map((a) => [String(a._id), a])),
    bySlug: new Map(apps.map((a) => [a.slug, a])),
  };
}
const slugOf = (business, apps) => apps.byId.get(String(business?.appId))?.slug || null;

function businessPayload(b, apps) {
  if (!b) return null;
  return { id: b._id, name: b.name, logoUrl: b.logoUrl || "", appType: slugOf(b, apps) };
}
function userPayload(user) {
  return {
    id: user._id, name: user.name, email: user.email, phone: user.phone,
    role: user.role, permissions: user.permissions, outletAccess: user.outletAccess,
    businessId: user.businessId,
  };
}
// `restaurant` is a temporary alias so the current frontend keeps working. Remove it when the frontend is migrated.
const authResponse = (message, token, user, business, apps) => {
  const payload = businessPayload(business, apps);
  return { message, token, user: userPayload(user), business: payload, restaurant: payload };
};

// ─────────────────────────────────────────────────────────────────────────
// REGISTER: creates (or reuses) an Account plus a new Business/User membership.
// ─────────────────────────────────────────────────────────────────────────
async function registerBusiness(req, res) {
  const { businessName, restaurantName, ownerName, email, phone, password, confirmPassword, appType, intent = "subscribe" } = req.body;
  const name = (businessName || restaurantName || "").trim(); // restaurantName accepted until the frontend is renamed
  if (!APP_TYPES.includes(appType)) return res.status(400).json({ message: "appType is required" });
  if (!["trial", "subscribe"].includes(intent)) return res.status(400).json({ message: "Invalid intent" });
  if (!name || !ownerName || !email || !phone || !password) return res.status(400).json({ message: "All fields are required" });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ message: "Please enter a valid email address" });
  if (confirmPassword !== undefined && password !== confirmPassword) return res.status(400).json({ message: "Passwords do not match" });
  
  const normalizedEmail = email.toLowerCase().trim();
  const isRetail = appType === "retail";

  try {
    const apps = await loadApps();
    const app = apps.bySlug.get(appType);
    if (!app || !app.isActive) {
      return res.status(500).json({ message: `The ${appType} app isn't set up yet — run the seed script (npm run seed:apps) first.` });
    }

    let account = await Account.findOne({ email: normalizedEmail }).select("+password");

    if (account) {
      // Same email registering again: prove it's them before attaching a second business.
      if (!(await account.comparePassword(password))) {
        return res.status(409).json({
          message: "An account with this email already exists. Enter its password to add this business, or use a different email.",
        });
      }
      const existingUsers = await User.find({ accountId: account._id }).select("businessId");
      if (existingUsers.length) {
        const existing = await Business.find({ _id: { $in: existingUsers.map((u) => u.businessId) } }, "appId");
        if (existing.some((b) => String(b.appId) === String(app._id))) {
          return res.status(409).json({ message: `You already have a ${appLabel(appType)} account with this email — log in instead.` });
        }
      }
    } else if (await User.findOne({ email: normalizedEmail })) {
      // Pre-migration legacy User holding this email with no linked Account.
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    // Built but not saved: Mongoose assigns _id now, so User.businessId can point at it first.
    const business = new Business({
      name, phone: phone.trim(), appId: app._id,
      businessType: isRetail ? "general_store" : "restaurant",
    });

    let user;
    let createdAccount = false;
    let businessSaved = false;
    try {
      if (!account) {
        account = await Account.create({ name: ownerName.trim(), email: normalizedEmail, phone: phone.trim(), password });
        createdAccount = true;
      }
      user = await User.create({
        name: ownerName.trim(), email: normalizedEmail, phone: phone.trim(), password,
        accountId: account._id, businessId: business._id, role: "owner", permissions: PERMISSIONS,
      });
      business.ownerId = user._id;
      await business.save();
      businessSaved = true;

      await Partner.create({
        businessId: business._id, name: ownerName.trim(), role: "Owner",
        phone: phone.trim(), email: normalizedEmail, userId: user._id,
      });
    } catch (innerErr) {
      // Never leave orphans behind.
      if (businessSaved) await Business.findByIdAndDelete(business._id);
      if (user) await User.findByIdAndDelete(user._id);
      if (createdAccount) await Account.findByIdAndDelete(account._id);
      throw innerErr;
    }

    // Start on the free trial. Non-fatal: a missing trial plan must never block signup.
    // NOTE: needs Subscription.businessId + Subscription.planId (item 5 of the plan).
    if (intent === "trial") {
  try {
    const trial = await PricingPlan.findOne({ appType, isTrial: true, isActive: true });
    if (trial) {
      const ends = new Date(Date.now() + trial.trialDays * 864e5);
      await Subscription.create({
        businessId: business._id, planId: trial._id, status: "TRIAL", amount: 0,
        trialEndsAt: ends, currentPeriodEnd: ends, limits: trial.limits,
      });
      business.trialUsedAt = new Date();
      await business.save();
    }
  } catch (subErr) {
    console.error("Trial subscription create failed:", subErr.message);
  }
}

    const token = generateToken({ userId: user._id });
    res.status(201).json(authResponse("Account created successfully", token, user, business, apps));
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Failed to create account", error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// LOGIN: Account first (shared login), falling back to a legacy User login.
// ─────────────────────────────────────────────────────────────────────────
async function login(req, res) {
  const { email, password, appType } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
  if (!APP_TYPES.includes(appType)) return res.status(400).json({ message: "appType is required" });

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const apps = await loadApps();
    const account = await Account.findOne({ email: normalizedEmail }).select("+password");

    if (account) {
      if (!(await account.comparePassword(password))) return res.status(401).json({ message: "Invalid email or password" });
      return await resolveAccountLogin(account, appType, res, apps);
    }

    // Legacy: a User with its own email+password and no linked Account.
    const user = await User.findOne({ email: normalizedEmail }).select("+password");
    if (!user || !(await user.comparePassword(password))) return res.status(401).json({ message: "Invalid email or password" });

    const business = await Business.findById(user.businessId);
    if (!business) return res.status(404).json({ message: "Business associated with this account was not found" });

    const actual = slugOf(business, apps);
    if (actual !== appType) {
      return res.status(403).json({
        message: `No ${appLabel(appType)} account found for this email — this login belongs to a ${appLabel(actual)} business.`,
      });
    }

    user.lastLogin = new Date();
    await user.save();
    const token = generateToken({ userId: user._id });
    return res.json(authResponse("Login successful", token, user, business, apps));
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Login failed", error: err.message });
  }
}

async function resolveAccountLogin(account, appType, res, apps) {
  const users = await User.find({ accountId: account._id });
  const businesses = await Business.find({ _id: { $in: users.map((u) => u.businessId) } });
  const businessById = new Map(businesses.map((b) => [String(b._id), b]));

  if (appType) {
    const match = users.find((u) => slugOf(businessById.get(String(u.businessId)), apps) === appType);
    if (!match) {
      return res.status(404).json({
        code: "NO_BUSINESS_FOR_APP",
        message: `You don't have a ${appLabel(appType)} business yet — create one to get started.`,
      });
    }
    return finishAccountLogin(account, match, businessById.get(String(match.businessId)), res, apps);
  }

  if (users.length === 1) return finishAccountLogin(account, users[0], businessById.get(String(users[0].businessId)), res, apps);
  if (users.length === 0) return res.status(404).json({ code: "NO_BUSINESS_FOR_APP", message: "No business found for this account." });

  const continueToken = jwt.sign({ accountId: account._id, purpose: "select-business" }, process.env.JWT_SECRET, { expiresIn: "5m" });
  return res.json({
    code: "CHOOSE_BUSINESS",
    continueToken,
    businesses: users.map((u) => {
      const b = businessById.get(String(u.businessId));
      return { businessId: b?._id, restaurantId: b?._id, name: b?.name, appType: slugOf(b, apps) }; // restaurantId: temporary alias
    }),
  });
}

async function finishAccountLogin(account, user, business, res, apps) {
  if (!business) return res.status(404).json({ message: "Business associated with this account was not found" });
  user.lastLogin = new Date();
  await user.save();
  account.lastLogin = new Date();
  await account.save();
  const token = generateToken({ userId: user._id });
  res.json(authResponse("Login successful", token, user, business, apps));
}

async function continueLogin(req, res) {
  const { continueToken } = req.body;
  const businessId = req.body.businessId || req.body.restaurantId; // restaurantId accepted until the frontend is renamed
  if (!continueToken || !businessId) return res.status(400).json({ message: "Missing selection" });

  let decoded;
  try {
    decoded = jwt.verify(continueToken, process.env.JWT_SECRET);
    if (decoded.purpose !== "select-business") throw new Error("wrong token purpose");
  } catch {
    return res.status(401).json({ message: "This selection has expired — please log in again" });
  }

  try {
    const account = await Account.findById(decoded.accountId);
    if (!account) return res.status(404).json({ message: "Account not found" });
    const user = await User.findOne({ accountId: account._id, businessId });
    if (!user) return res.status(404).json({ message: "Business not found for this account" });
    const [business, apps] = await Promise.all([Business.findById(businessId), loadApps()]);
    return await finishAccountLogin(account, user, business, res, apps);
  } catch (err) {
    console.error("CONTINUE LOGIN ERROR:", err);
    res.status(500).json({ message: "Login failed", error: err.message });
  }
}

async function staffLogin(req, res) {
  const { employeeId, password, appType } = req.body;
  const businessName = req.body.businessName || req.body.restaurantName; // restaurantName accepted until the frontend is renamed
  if (!businessName || !employeeId || !password) {
    return res.status(400).json({ message: "Business name, employee ID, and password are required" });
  }

  try {
    const apps = await loadApps();
    // Scope by app so a shop and a restaurant sharing a name never collide.
    const filter = { name: { $regex: `^${escapeRe(businessName)}$`, $options: "i" } };
    if (appType) {
      const app = apps.bySlug.get(appType);
      if (!app) return res.status(400).json({ message: "Invalid appType" });
      filter.appId = app._id;
    }

    const matches = await Business.find(filter);
    if (matches.length === 0) {
      return res.status(404).json({ message: appType ? `No ${appLabel(appType)} business found with that name` : "No business found with that name" });
    }
    if (matches.length > 1) {
      return res.status(409).json({ message: "Multiple businesses share this name — ask your owner/manager for help logging in" });
    }
    const business = matches[0];

    const user = await User.findOne({ businessId: business._id, employeeId: String(employeeId).trim() }).select("+password");
    if (!user || !(await user.comparePassword(password))) return res.status(401).json({ message: "Invalid employee ID or password" });

    user.lastLogin = new Date();
    await user.save();
    const token = generateToken({ userId: user._id });
    res.json(authResponse("Login successful", token, user, business, apps));
  } catch (err) {
    console.error("STAFF LOGIN ERROR:", err);
    res.status(500).json({ message: "Login failed", error: err.message });
  }
}

async function getMe(req, res) {
  try {
    const [business, apps] = await Promise.all([Business.findById(req.user.businessId), loadApps()]);
    if (!business) return res.status(404).json({ message: "Business not found" });
    const payload = businessPayload(business, apps);
    res.json({ user: userPayload(req.user), business: payload, restaurant: payload });
  } catch (err) {
    console.error("GET ME ERROR:", err);
    res.status(500).json({ message: "Failed to get user information", error: err.message });
  }
}

// Verifies against and updates whichever password governs the login: the linked Account's, else the User's own.
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ message: "Current and new password are required" });
  if (newPassword.length < 6) return res.status(400).json({ message: "New password must be at least 6 characters" });

  try {
    const user = await User.findById(req.user._id).select("+password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const account = user.accountId ? await Account.findById(user.accountId).select("+password") : null;
    const authority = account || user;
    if (!(await authority.comparePassword(currentPassword))) return res.status(401).json({ message: "Current password is incorrect" });

    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();
    if (account) {
      account.password = newPassword;
      await account.save();
    }
    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err);
    res.status(500).json({ message: "Failed to update password", error: err.message });
  }
}

async function getStaffUsers(req, res) {
  try {
    const users = await User.find({ businessId: req.user.businessId, role: { $ne: "owner" } })
      .populate("outletAccess", "name")
      .select("-password");
    res.json({
      users: users.map((u) => ({
        id: u._id, name: u.name, email: u.email, phone: u.phone,
        role: u.role, permissions: u.permissions, outletAccess: u.outletAccess,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch staff accounts", error: err.message });
  }
}

async function createStaffUser(req, res) {
  try {
    const { name, email, phone, password, dateOfBirth, role, permissions, outletAccess, linkType, linkId } = req.body;
    if (!name || !phone || !role) return res.status(400).json({ message: "name, phone and role are required" });
    if (!SYSTEM_ROLES_ASSIGNABLE.includes(role)) return res.status(400).json({ message: "Invalid role" });
    if (req.user.role !== "owner" && !MANAGER_ASSIGNABLE_ROLES.includes(role)) {
      return res.status(403).json({ message: "Only the owner can grant that role" });
    }

    const finalPermissions = permissions?.length ? permissions : DEFAULT_PERMISSIONS_BY_ROLE[role] || [];
    if (req.user.role !== "owner") {
      const disallowed = finalPermissions.filter((p) => !req.user.hasPermission(p));
      if (disallowed.length) return res.status(403).json({ message: `You can't grant permissions you don't have: ${disallowed.join(", ")}` });
    }

    let finalPassword = password;
    if (!finalPassword && dateOfBirth) {
      const year = new Date(dateOfBirth).getFullYear();
      if (Number.isNaN(year)) return res.status(400).json({ message: "Invalid date of birth" });
      finalPassword = String(year);
    }
    if (!finalPassword) return res.status(400).json({ message: "A password (or date of birth) is required" });

    if (await User.findOne({ businessId: req.user.businessId, phone })) {
      return res.status(409).json({ message: "A login already exists for this phone number" });
    }

    let employeeId;
      if (linkType === "staff" && linkId) {
        employeeId = (await Staff.findOne({ _id: linkId, businessId: req.user.businessId }, "employeeId"))?.employeeId;
      }

    const user = await User.create({
      name, email: email || undefined, phone, password: finalPassword,
      role, permissions: finalPermissions, outletAccess: outletAccess || [],
      businessId: req.user.businessId, mustChangePassword: true, employeeId: employeeId || undefined,
    });

    // Scoped to this business so one tenant can't link another tenant's record.
    if (linkType === "partner" && linkId) {
      await Partner.findOneAndUpdate({ _id: linkId, businessId: req.user.businessId }, { userId: user._id });
    } else if (linkType === "staff" && linkId) {
      await Staff.findOneAndUpdate({ _id: linkId, businessId: req.user.businessId }, { userId: user._id });
    }

    res.status(201).json({ message: "Account created", user: { id: user._id, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: "Failed to create account", error: err.message });
  }
}

async function updateStaffAccess(req, res) {
  try {
    const { role, permissions, outletAccess } = req.body;
    const isOwner = req.user.role === "owner";
    const target = await User.findOne({ _id: req.params.id, businessId: req.user.businessId });
    if (!target) return res.status(404).json({ message: "Account not found" });
    if (target.role === "owner") return res.status(400).json({ message: "Cannot edit the owner account here" });
    if (!isOwner && !MANAGER_ASSIGNABLE_ROLES.includes(target.role)) return res.status(403).json({ message: "Only the owner can edit that account" });

    if (role !== undefined) {
      const allowed = isOwner ? SYSTEM_ROLES_ASSIGNABLE : MANAGER_ASSIGNABLE_ROLES;
      if (!allowed.includes(role)) return res.status(403).json({ message: "You can't grant that role" });
      target.role = role;
    }
    if (permissions !== undefined) {
      if (!isOwner) {
        const bad = permissions.filter((p) => !req.user.hasPermission(p));
        if (bad.length) return res.status(403).json({ message: `You can't grant permissions you don't have: ${bad.join(", ")}` });
      }
      target.permissions = permissions;
    }
    if (outletAccess !== undefined) {
      const Outlet = require("../models/Outlet");
      if ((await Outlet.countDocuments({ _id: { $in: outletAccess }, businessId: req.user.businessId })) !== new Set(outletAccess.map(String)).size) {
        return res.status(400).json({ message: "Invalid outlet in list" });
      }
      target.outletAccess = outletAccess;
    }
    await target.save();
    res.json({ message: "Access updated" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update access", error: err.message });
  }
}

async function getAccessOptions(req, res) {
  res.json({
    groups: PERMISSION_GROUPS,
    defaultsByRole: DEFAULT_PERMISSIONS_BY_ROLE,
    managerAssignableRoles: req.user.role === "owner" ? SYSTEM_ROLES_ASSIGNABLE : MANAGER_ASSIGNABLE_ROLES,
  });
}

async function deleteStaffUser(req, res) {
  try {
    const target = await User.findOneAndDelete({ _id: req.params.id, businessId: req.user.businessId, role: { $ne: "owner" } });
    if (!target) return res.status(404).json({ message: "Account not found" });
    await Staff.updateMany({ userId: target._id }, { userId: null });
    await Partner.updateMany({ userId: target._id }, { userId: null });
    res.json({ message: "Account removed" });
  } catch (err) {
    res.status(500).json({ message: "Failed to remove account", error: err.message });
  }
}
async function deleteAccount(req, res) {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ message: "Password is required" });
    const user = await User.findById(req.user._id).select("+password");
    const account = user.accountId ? await Account.findById(user.accountId).select("+password") : null;
    if (!(await (account || user).comparePassword(password))) return res.status(401).json({ message: "Incorrect password" });

    const { businessId } = user;
    const KEEP = new Set(["Business", "Invoice", "Payment", "Subscription"]); // keep your own billing records
    for (const m of Object.values(mongoose.models)) {
      if (!KEEP.has(m.modelName) && m.schema.path("businessId")) await m.deleteMany({ businessId });
    }
    await Subscription.updateOne({ businessId }, { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Deleted by owner" });
    await Business.findByIdAndDelete(businessId);
    if (account && !(await User.exists({ accountId: account._id }))) await Account.findByIdAndDelete(account._id);
    res.json({ message: "Account deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete account", error: err.message });
  }
}

module.exports = {
  registerBusiness,
  registerRestaurant: registerBusiness, // alias so authRoutes.js keeps working; rename the import there later
  login, continueLogin, staffLogin, getMe, changePassword,
  getAccessOptions, getStaffUsers, createStaffUser, updateStaffAccess, deleteStaffUser, deleteAccount,
};