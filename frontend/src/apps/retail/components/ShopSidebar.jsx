import { useEffect, useState } from "react";
import { useAuth } from "../../../shared/context/AuthContext";
import { useTheme } from "../../../shared/context/ThemeContext";
import { usePlan } from "../../../shared/context/PlanContext";
import Logo from "../../../shared/components/Logo";
import NotificationBell from "../../../shared/components/NotificationBell";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Truck,
  Users,
  Calculator,
  BarChart3,
  TrendingUp,
  Store,
  ShieldCheck,
  Settings,
  Bell,
  LogOut,
  Sun,
  Moon,
  ListChecks,
  Percent,
  Lock,
  MoreHorizontal,
  CreditCard,
  LifeBuoy,
} from "lucide-react";

// Same shape as Sidebar.jsx's NAV_ITEMS, swapped for retail vocabulary.
// `feature` (optional) must match a key in the plan's `modules` list.
const NAV_ITEMS = [
  { label: "Dashboard", key: "dashboard", roles: null, icon: LayoutDashboard },
  { label: "Notifications", key: "notifications", roles: null, icon: Bell },
  { label: "Sales / POS", key: "pos", roles: ["owner", "manager", "cashier"], icon: ShoppingCart },
  { label: "Products", key: "products", roles: ["owner", "manager"], icon: Package },
  { label: "Stock", key: "stock", roles: ["owner", "manager"], icon: Boxes },
  { label: "Purchases", key: "purchases", feature: "purchases", roles: ["owner", "manager"], icon: Truck },
  { label: "People", key: "people", roles: ["owner", "manager"], icon: Users },
  { label: "Tasks", key: "tasks", roles: null, icon: ListChecks },
  { label: "Calculator", key: "calculator", roles: null, icon: Percent },
  { label: "Accounting", key: "accounting", feature: "accounting", roles: ["owner", "manager"], icon: Calculator },
  { label: "Reports", key: "reports", feature: "reports", roles: ["owner", "manager"], icon: BarChart3 },
  { label: "Analytics", key: "analytics", feature: "analytics", roles: ["owner", "manager"], icon: TrendingUp },
  { label: "Outlets", key: "outlets", roles: ["owner", "manager"], icon: Store },
  { label: "System Access", key: "access", feature: "access", roles: ["owner", "manager"], icon: ShieldCheck },
  { label: "Settings", key: "settings", roles: ["owner"], icon: Settings },
  { label: "Subscription", key: "subscription", roles: ["owner"], icon: CreditCard },
  { label: "Help & Support", key: "support", roles: null, icon: LifeBuoy },
];

const BOTTOM_KEYS = ["dashboard", "pos", "products", "stock"];

export default function ShopSidebar({ active, onNavigate, restaurant, onOpenProfile, badges = {}, mobileOpen = false, onMobileOpen, onMobileClose }) {
  const { user, logout } = useAuth();
  const { isLocked, openUpgrade } = usePlan();

  const userRole = user?.role?.toLowerCase();
  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(userRole));
    const bottomItems = BOTTOM_KEYS
    .map((k) => visibleItems.find((i) => i.key === k))
    .filter(Boolean);
  const moreActive = !bottomItems.some((i) => i.key === active);
  // Lock body scroll while the mobile drawer is open
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mobileOpen]);

  // Locked features open the upgrade modal instead of navigating.
  function select(key) {
    const item = NAV_ITEMS.find((i) => i.key === key);
    onMobileClose?.();
    if (item?.feature && isLocked(item.feature)) return openUpgrade(item.feature);
    onNavigate(key);
  }

  return (
    <>
          {/* ===== Mobile bottom bar (< md) ===== */}
      <nav
        aria-label="Quick navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-charcoal-lighter bg-charcoal-light md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="flex h-14 items-stretch">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.key;
            return (
              <li key={item.key} className="flex-1">
                <button
                  type="button"
                  onClick={() => select(item.key)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] transition-colors active:scale-95 ${
                    isActive ? "text-saffron" : "text-muted"
                  }`}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} />
                  <span className="max-w-full truncate px-1">{item.label.split(" ")[0]}</span>
                </button>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={onMobileOpen}
              aria-label="More"
              className={`relative flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] transition-colors active:scale-95 ${
                moreActive ? "text-saffron" : "text-muted"
              }`}
            >
              <MoreHorizontal size={20} strokeWidth={moreActive ? 2.25 : 1.75} />
              <span>More</span>
              {badges.notifications > 0 && (
                <span className="absolute right-1/2 top-1.5 -mr-4 h-2 w-2 rounded-full bg-brick" />
              )}
            </button>
          </li>
        </ul>
      </nav>
      {/* ===== Mobile drawer (< md), opened from the header menu button ===== */}
      <div
        className={`fixed inset-0 z-50 md:hidden transition-opacity duration-200 ${
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!mobileOpen}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onMobileClose} />
        <nav
          className={`absolute left-0 top-0 flex h-full w-[80vw] max-w-72 flex-col bg-charcoal-light p-4 shadow-xl transition-transform duration-200 ease-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-4 flex shrink-0 items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <ShopBadge restaurant={restaurant} role={user?.role} onClick={onOpenProfile} />
            </div>
            <button type="button" onClick={onMobileClose} aria-label="Close menu"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-muted hover:text-cream">
              <CloseIcon />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <SidebarLinks items={visibleItems} active={active} onSelect={select} showLabels badges={badges} />
          </div>
          <div className="mt-3 flex shrink-0 items-center gap-2 border-t border-charcoal-lighter pt-3">
            <ThemeToggle expanded />
          </div>
          <div className="mt-2 shrink-0">
            <LogoutButton onClick={logout} showLabel />
          </div>
        </nav>
      </div>

      {/* ===== Tablet icon rail (md to lg) ===== */}
      <aside className="hidden w-16 shrink-0 flex-col items-center self-start border-r border-charcoal-lighter bg-charcoal-light py-4 md:sticky md:top-16 md:flex md:h-[calc(100vh-4rem)] lg:hidden">
        <div className="mb-4">
          <ShopAvatar restaurant={restaurant} onClick={onOpenProfile} />
        </div>
        <div className="min-h-0 w-full flex-1 overflow-y-auto">
          <SidebarLinks items={visibleItems} active={active} onSelect={select} showLabels={false} badges={badges} />
        </div>
        <div className="mt-3 flex shrink-0 flex-col items-center border-t border-charcoal-lighter pt-3">
          <LogoutButton onClick={logout} showLabel={false} />
        </div>
      </aside>

      {/* ===== Desktop full sidebar (lg+) ===== */}
      <aside className="hidden w-60 shrink-0 flex-col self-start border-r border-charcoal-lighter bg-charcoal-light p-4 lg:sticky lg:top-16 lg:flex lg:h-[calc(100vh-4rem)] xl:w-64">
        <div className="mb-6 shrink-0 px-2">
          <ShopBadge restaurant={restaurant} role={user?.role} onClick={onOpenProfile} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <SidebarLinks items={visibleItems} active={active} onSelect={select} showLabels badges={badges} />
        </div>
        <div className="mt-3 shrink-0">
          <LogoutButton onClick={logout} showLabel />
        </div>
      </aside>
    </>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ThemeToggle({ expanded = false }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  if (expanded) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className="flex flex-1 items-center gap-3 rounded-sm border border-charcoal-lighter px-3 py-2.5 text-left text-sm text-muted hover:border-saffron hover:text-cream"
      >
        {isDark ? <Sun size={18} strokeWidth={1.75} className="shrink-0" /> : <Moon size={18} strokeWidth={1.75} className="shrink-0" />}
        <span>{isDark ? "Light mode" : "Dark mode"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-9 w-9 items-center justify-center rounded-sm border border-charcoal-lighter text-muted hover:border-saffron hover:text-cream"
    >
      {isDark ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
    </button>
  );
}

function ShopBadge({ restaurant, role, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-sm p-1 text-left transition-colors hover:bg-charcoal-lighter/60"
    >
      {restaurant?.logoUrl ? (
        <img
          src={restaurant.logoUrl}
          alt=""
          className="h-9 w-9 shrink-0 rounded-full border border-charcoal-lighter object-cover"
        />
      ) : (
        <span className="text-xl leading-none" aria-hidden="true">
          👕
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate font-display text-base leading-tight text-cream sm:text-lg">
          {restaurant?.name || "My Shop"}
        </p>
        <p className="truncate text-xs capitalize text-muted">{role}</p>
      </div>
    </button>
  );
}

function ShopAvatar({ restaurant, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={restaurant?.name || "My Shop"}
      title={restaurant?.name || "My Shop"}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-charcoal-lighter"
    >
      {restaurant?.logoUrl ? (
        <img src={restaurant.logoUrl} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        <span className="text-lg leading-none" aria-hidden="true">
          👕
        </span>
      )}
    </button>
  );
}

function SidebarLinks({ items, active, onSelect, showLabels, badges = {} }) {
  const { isLocked } = usePlan();
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;
        const count = badges[item.key] || 0;
        const locked = !!item.feature && isLocked(item.feature);
        return (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => onSelect(item.key)}
              title={!showLabels ? `${item.label}${locked ? " (upgrade to unlock)" : ""}` : locked ? "Upgrade to unlock" : undefined}
              aria-label={!showLabels ? item.label : undefined}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex w-full items-center rounded-sm py-2.5 text-sm transition-colors ${
                showLabels ? "gap-3 px-3 text-left" : "justify-center px-2"
              } ${
                isActive
                  ? "bg-saffron font-medium text-charcoal"
                  : "text-muted hover:bg-charcoal-lighter hover:text-cream"
              }`}
            >
              <Icon size={18} strokeWidth={isActive ? 2.25 : 1.75} className="shrink-0" />
              {showLabels && <span className="truncate">{item.label}</span>}
              {locked && (
                <Lock
                  size={13}
                  aria-hidden="true"
                  className={showLabels ? "ml-auto shrink-0 opacity-60" : "absolute right-1 top-1 opacity-60"}
                />
              )}
              {count > 0 && (
                <span
                  className={`${
                    showLabels ? (locked ? "ml-1" : "ml-auto") : "absolute bottom-1 right-1"
                  } flex h-5 min-w-5 items-center justify-center rounded-full bg-brick px-1.5 text-[10px] font-medium text-white`}
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function LogoutButton({ onClick, showLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={!showLabel ? "Logout" : undefined}
      aria-label={!showLabel ? "Logout" : undefined}
      className={`flex w-full items-center rounded-sm border border-charcoal-lighter py-2.5 text-sm text-muted transition-colors hover:border-brick hover:text-brick ${
        showLabel ? "gap-3 px-3 text-left" : "justify-center px-2"
      }`}
    >
      <LogOut size={18} strokeWidth={1.75} className="shrink-0" />
      {showLabel && <span>Logout</span>}
    </button>
  );
}