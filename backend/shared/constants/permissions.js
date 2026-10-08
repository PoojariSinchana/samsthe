const PERMISSIONS = [
  "VIEW_DASHBOARD",
  "VIEW_ORDERS", "MANAGE_ORDERS",
  "VIEW_TABLES", "MANAGE_TABLES",
  "VIEW_MENU", "MANAGE_MENU",
  "VIEW_BILLING",
  "VIEW_TRANSACTIONS", "MANAGE_TRANSACTIONS",
  "VIEW_ACCOUNTING",
  "VIEW_REPORTS",
  "VIEW_ANALYTICS",
  "VIEW_STAFF", "MANAGE_STAFF",
  "MANAGE_OUTLETS",
  "MANAGE_SETTINGS",
];

// Human-readable grouping for the assignment UI checkbox list.
const PERMISSION_GROUPS = [
  { label: "Dashboard", keys: ["VIEW_DASHBOARD"] },
  { label: "Orders", keys: ["VIEW_ORDERS", "MANAGE_ORDERS"] },
  { label: "Tables", keys: ["VIEW_TABLES", "MANAGE_TABLES"] },
  { label: "Menu", keys: ["VIEW_MENU", "MANAGE_MENU"] },
  { label: "Billing / POS", keys: ["VIEW_BILLING"] },
  { label: "Transactions", keys: ["VIEW_TRANSACTIONS", "MANAGE_TRANSACTIONS"] },
  { label: "Accounting", keys: ["VIEW_ACCOUNTING"] },
  { label: "Reports", keys: ["VIEW_REPORTS"] },
  { label: "Analytics", keys: ["VIEW_ANALYTICS"] },
  { label: "Staff", keys: ["VIEW_STAFF", "MANAGE_STAFF"] },
  { label: "Outlets", keys: ["MANAGE_OUTLETS"] },
  { label: "Settings", keys: ["MANAGE_SETTINGS"] },
];

// Pre-fills the checkbox UI when creating a new person of a given role —
// owner/manager can still tick/untick anything afterward, this is just a
// sensible starting point, not a hard-coded restriction.
const DEFAULT_PERMISSIONS_BY_ROLE = {
  owner: [...PERMISSIONS],
  manager: PERMISSIONS.filter((p) => p !== "MANAGE_OUTLETS" && p !== "MANAGE_SETTINGS"),
  cashier: ["VIEW_ORDERS", "MANAGE_ORDERS", "VIEW_TABLES", "VIEW_BILLING", "VIEW_TRANSACTIONS"],
  waiter: ["VIEW_ORDERS", "MANAGE_ORDERS", "VIEW_TABLES", "MANAGE_TABLES"],
  kitchen: ["VIEW_ORDERS"],
  investor: ["VIEW_DASHBOARD", "VIEW_REPORTS", "VIEW_ANALYTICS", "VIEW_ACCOUNTING"],
  partner: ["VIEW_DASHBOARD", "VIEW_REPORTS", "VIEW_ANALYTICS", "VIEW_ACCOUNTING", "VIEW_TRANSACTIONS"],
};

// Roles a manager (not owner) is allowed to create/edit. Manager, Owner,
// Investor, and Partner accounts can only be managed by the owner.
const MANAGER_ASSIGNABLE_ROLES = ["cashier", "waiter", "kitchen"];

module.exports = { PERMISSIONS, PERMISSION_GROUPS, DEFAULT_PERMISSIONS_BY_ROLE, MANAGER_ASSIGNABLE_ROLES };