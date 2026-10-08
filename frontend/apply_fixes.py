#!/usr/bin/env python3
"""
Run from the frontend root (the folder containing package.json and src/):

    python apply_fixes.py

Applies the fixes in place. Commit first (git) so you can review with `git diff`.
Every edit prints OK / SKIP (already applied) / MISS (text not found, check by hand).
"""
import os
import re
import sys

if not os.path.isdir("src"):
    sys.exit("Run this from the frontend root (the folder that contains src/).")

stats = {"ok": 0, "skip": 0, "miss": 0}


def read(path):
    with open(path, "r", encoding="utf-8", newline="") as f:
        return f.read()


def write(path, text):
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)


def rep(path, old, new, label, count=None):
    """Replace `old` with `new` in file. Handles CRLF files."""
    if not os.path.exists(path):
        print(f"MISS  {label}: {path} not found")
        stats["miss"] += 1
        return
    text = read(path)
    crlf = "\r\n" in text
    o, n = (old.replace("\n", "\r\n"), new.replace("\n", "\r\n")) if crlf else (old, new)
    if o not in text:
        if n in text:
            print(f"SKIP  {label} (already applied)")
            stats["skip"] += 1
        else:
            print(f"MISS  {label}: expected text not found in {path}")
            stats["miss"] += 1
        return
    text = text.replace(o, n) if count is None else text.replace(o, n, count)
    write(path, text)
    print(f"OK    {label}")
    stats["ok"] += 1


def rep_re(path, pattern, repl, label):
    if not os.path.exists(path):
        print(f"MISS  {label}: {path} not found")
        stats["miss"] += 1
        return
    text = read(path)
    new, n = re.subn(pattern, repl, text)
    if n == 0:
        print(f"SKIP  {label} (nothing to change)")
        stats["skip"] += 1
        return
    write(path, new)
    print(f"OK    {label} ({n} change{'s' if n != 1 else ''})")
    stats["ok"] += 1


S = "src"

# ---------------------------------------------------------------------------
# 1. Admin file renames (case-safe on every OS) + import rewrite
# ---------------------------------------------------------------------------
RENAMES = {
    "admin/Adminapp.jsx": "AdminApp.jsx",
    "admin/Adminroot.jsx": "AdminRoot.jsx",
    "admin/context/Adminauthcontext.jsx": "AdminAuthContext.jsx",
    "admin/components/Adminsidebar.jsx": "AdminSidebar.jsx",
    "admin/components/Adminprotectedroute.jsx": "AdminProtectedRoute.jsx",
    "admin/pages/Adminlogin.jsx": "AdminLogin.jsx",
    "admin/pages/Adminprofile.jsx": "AdminProfile.jsx",
    "admin/pages/Adminuserssection.jsx": "AdminUsersSection.jsx",
    "admin/pages/Admincomingsoon.jsx": "AdminComingSoon.jsx",
    "admin/api/adminaxios.js": "adminAxios.js",
    "admin/api/adminAuthapi.js": "adminAuthApi.js",
}

for rel, new_name in RENAMES.items():
    src = os.path.join(S, rel)
    dst = os.path.join(os.path.dirname(src), new_name)
    if os.path.exists(src) and os.path.basename(src) != new_name:
        tmp = src + ".tmp_rename"
        os.rename(src, tmp)      # two-step so it works on case-insensitive disks
        os.rename(tmp, dst)
        print(f"OK    renamed {rel} -> {new_name}")
        stats["ok"] += 1
    else:
        print(f"SKIP  rename {rel}")
        stats["skip"] += 1

canon = {os.path.splitext(v)[0].lower(): os.path.splitext(v)[0] for v in RENAMES.values()}
spec_re = re.compile(r"""(["'])(\.{1,2}/[^"']*)\1""")


def fix_spec(m):
    q, spec = m.group(1), m.group(2)
    head, _, last = spec.rpartition("/")
    stem, ext = os.path.splitext(last)
    if stem.lower() in canon:
        return f"{q}{head}/{canon[stem.lower()]}{ext}{q}"
    return m.group(0)


changed = 0
for root, _, files in os.walk(S):
    for fn in files:
        if fn.endswith((".js", ".jsx")):
            p = os.path.join(root, fn)
            t = read(p)
            nt = spec_re.sub(fix_spec, t)
            if nt != t:
                write(p, nt)
                changed += 1
print(f"OK    rewrote admin imports in {changed} file(s)")
stats["ok"] += 1

# ---------------------------------------------------------------------------
# 2. Crashes
# ---------------------------------------------------------------------------
RA = f"{S}/apps/retail/RetailApp.jsx"
rep(RA, '  const [period, setPeriod] = useState("month");\n',
    '  const [period, setPeriod] = useState("month");\n  const [profileModalOpen, setProfileModalOpen] = useState(false);\n',
    "RetailApp: define profileModalOpen")
rep(RA, "<ShopSidebar active={section} onNavigate={setSection} restaurant={restaurant} />",
    "<ShopSidebar active={section} onNavigate={setSection} restaurant={restaurant} onOpenProfile={() => setProfileModalOpen(true)} />",
    "RetailApp: pass onOpenProfile to sidebar")

rep(f"{S}/marketing/LoginForm.jsx",
    "continueToken: chooser.continueToken,\n        restaurantId,",
    "continueToken: chooser.continueToken,\n        restaurantId: businessId,",
    "LoginForm: business picker uses businessId")

# ---------------------------------------------------------------------------
# 3. Import paths
# ---------------------------------------------------------------------------
AN = f"{S}/shared/pages/AnalyticsSection.jsx"
rep(AN, '"../../../shared/context/AuthContext"', '"../context/AuthContext"', "AnalyticsSection: AuthContext path")
rep(AN, '"../../../shared/api/outlets"', '"../api/outlets"', "AnalyticsSection: outlets path")
rep(AN, '"../../../shared/components/StatCard"', '"../components/StatCard"', "AnalyticsSection: StatCard path")
rep(AN, '"../../../shared/utils/dateRange"', '"../utils/dateRange"', "AnalyticsSection: dateRange path")

rep(f"{S}/shared/people/CustomersTab.jsx", '"../../api/customersApi"', '"../api/customersApi"',
    "CustomersTab: customersApi path")

# ---------------------------------------------------------------------------
# 4. Wrong behaviour
# ---------------------------------------------------------------------------
RS = f"{S}/apps/restaurant/RestaurantApp.jsx"
rep(RS, "<Sidebar active={section} onNavigate={setSection}",
    "<Sidebar active={section} onNavigate={handleSidebarNavigate}",
    "RestaurantApp: use handleSidebarNavigate")
rep(RS, '"billing", "inventory", "purchases", "expenses", "accounting", "reports", "entries",\n  ];',
    '"billing", "inventory", "purchases", "expenses", "accounting", "reports", "entries",\n    "analytics", "access",\n  ];',
    "RestaurantApp: add analytics/access to knownSections")

rep(f"{S}/apps/restaurant/pages/marketing/Landing.jsx", 'to="/create-restaurant"', 'to="/restaurant/signup"',
    "Landing: fix CTA link")
rep(f"{S}/apps/retail/marketing/RetailLanding.jsx", '<Link to="/products">', '<Link to="/">',
    "RetailLanding: fix footer link")

# StatCard: configurable comparison label
SC = f"{S}/shared/components/StatCard.jsx"
rep(SC, 'accent = "saffron", change })', 'accent = "saffron", change, changeLabel = "vs yesterday" })',
    "StatCard: add changeLabel prop")
rep(SC, "{Math.abs(change)}% vs yesterday", "{Math.abs(change)}% {changeLabel}",
    "StatCard: use changeLabel")

LABEL_DEF = (
    '  const periodTitle = summary ? PERIOD_TITLE[summary.period] || "this month" : "";\n'
    '  const changeLabel = { today: "vs yesterday", week: "vs previous 7 days", month: "vs last month", year: "vs last year" }[period] || "vs previous period";\n'
)
OLD_DEF = '  const periodTitle = summary ? PERIOD_TITLE[summary.period] || "this month" : "";\n'
for path in (RS, RA):
    rep(path, OLD_DEF, LABEL_DEF, f"{os.path.basename(path)}: define changeLabel")
    rep_re(path, r"change=\{(summary\.kpis\.\w+)\}(?! changeLabel)", r"change={\1} changeLabel={changeLabel}",
           f"{os.path.basename(path)}: pass changeLabel to StatCards")

# ---------------------------------------------------------------------------
# 5. Styling / config
# ---------------------------------------------------------------------------
TW = "tailwind.config.js"
rep(TW, '        gold: "rgb(var(--color-warning) / <alpha-value>)",\n        "border-strong": "rgb(var(--color-border-strong) / <alpha-value>)",\n',
    "", "tailwind: remove gold/border-strong from fontFamily")
rep(TW, '        brick: "rgb(var(--color-danger) / <alpha-value>)",\n',
    '        brick: "rgb(var(--color-danger) / <alpha-value>)",\n'
    '        gold: "rgb(var(--color-warning) / <alpha-value>)",\n'
    '        "border-strong": "rgb(var(--color-border-strong) / <alpha-value>)",\n',
    "tailwind: add gold/border-strong to colors")
rep_re(TW, r"extend:\s*\{(?!\s*screens)", 'extend: {\n      screens: { xs: "480px" },', "tailwind: add xs breakpoint")

rep(f"{S}/shared/components/Logo.jsx", "w-30", "w-auto", "Logo: replace invalid w-30")

# ---------------------------------------------------------------------------
# 6. Cleanups
# ---------------------------------------------------------------------------
AC = f"{S}/shared/pages/AccountingSection.jsx"
rep(AC, 'import { useEffect, useState, useCallback } from "react";',
    'import { useEffect, useState, useCallback, useMemo } from "react";', "Accounting: import useMemo")
rep(AC, "  const periodParams = { from: startOfLocalDay(from), to: endOfLocalDay(to) };\n  const asOfParams = { asOf: endOfLocalDay(asOf) };",
    "  const periodParams = useMemo(() => ({ from: startOfLocalDay(from), to: endOfLocalDay(to) }), [from, to]);\n"
    "  const asOfParams = useMemo(() => ({ asOf: endOfLocalDay(asOf) }), [asOf]);",
    "Accounting: memoize period params")

rep(f"{S}/apps/restaurant/pages/BillingSection.jsx", "outlet={activeTable ? outlet : outlet}", "outlet={outlet}",
    "BillingSection: remove redundant ternary")

ACS = f"{S}/shared/pages/AccessSection.jsx"
rep(ACS, 'await import("../api/accessApi").then((m) => m.createStaffUser({ name, email, phone, password, role, permissions, outletAccess }));',
    "await accessApi.createStaffUser({ name, email, phone, password, role, permissions, outletAccess });",
    "AccessSection: static call for createStaffUser")
rep(ACS, 'await import("../api/accessApi").then((m) => m.updateStaffAccess(existing.id, { role, permissions, outletAccess }));',
    "await accessApi.updateStaffAccess(existing.id, { role, permissions, outletAccess });",
    "AccessSection: static call for updateStaffAccess")

print(f"\nDone: {stats['ok']} applied, {stats['skip']} skipped, {stats['miss']} missed.")
print("""
NOT fixable by script (files not in the pack, needs your input):
  - OrderSection.jsx currently contains the Payments page; restore the real Orders page.
  - Missing files: analyticsApi, customersApi, purchasesApi, PeopleSection, PurchasesSection,
    ExpensesSection, ReportsSection, AnalyticsSection (restaurant), shopDashboardApi, StockSection,
    ShopReportsSection, ShopAnalyticsSection, retail PeopleSection.
  - AccountingSection imports apps/restaurant/api/purchasesApi; move it into shared/api.
  - ProductFormModal uploads to /products/upload-image; confirm the backend route (other retail APIs use /shop/...).
""")