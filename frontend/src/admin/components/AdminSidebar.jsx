import { useEffect, useState } from "react";
import {
  LayoutDashboard, Building2, Target, Repeat, FileText, Wallet, FolderKanban, CheckSquare,
  LifeBuoy, Users, BarChart3, TrendingUp, ShieldCheck, Settings, UserCircle, LogOut, Sun, Moon, Menu, X,
  Tag,
} from "lucide-react";
import { useAdminAuth } from "../context/AdminAuthContext";
import { useTheme } from "../../shared/context/ThemeContext";
import Logo from "../../shared/components/Logo";
// `permission` matches ADMIN_PERMISSIONS on the backend. Items the admin
// can't access are hidden, not just disabled.
export const ADMIN_NAV = [
  { key: "dashboard", label: "Dashboard", permission: "VIEW_DASHBOARD", icon: LayoutDashboard },
  { key: "clients", label: "Clients", permission: "VIEW_CLIENTS", icon: Building2 },
  { key: "leads", label: "Leads", permission: "VIEW_LEADS", icon: Target },
  { key: "subscriptions", label: "Subscriptions", permission: "VIEW_SUBSCRIPTIONS", icon: Repeat },
  { key: "plans", label: "Pricing", permission: "MANAGE_PRODUCTS", icon: Tag },
  { key: "invoices", label: "Invoices", permission: "VIEW_INVOICES", icon: FileText },
  { key: "payments", label: "Payments", permission: "VIEW_PAYMENTS", icon: Wallet },
  { key: "projects", label: "Projects", permission: "VIEW_PROJECTS", icon: FolderKanban },
  { key: "tasks", label: "Tasks", permission: "VIEW_TASKS", icon: CheckSquare },
  { key: "support", label: "Support", permission: "VIEW_SUPPORT", icon: LifeBuoy },
  { key: "employees", label: "Employees", permission: "VIEW_EMPLOYEES", icon: Users },
  { key: "reports", label: "Reports", permission: "VIEW_REPORTS", icon: BarChart3 },
  { key: "analytics", label: "Analytics", permission: "VIEW_ANALYTICS", icon: TrendingUp },
  { key: "admins", label: "Admin Users", permission: "MANAGE_ADMIN_USERS", icon: ShieldCheck },
  { key: "settings", label: "Settings", permission: "MANAGE_SETTINGS", icon: Settings },
];

export default function AdminSidebar({ active, onNavigate }) {
  const { admin, logout, hasPermission } = useAdminAuth();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const items = ADMIN_NAV.filter((i) => hasPermission(i.permission));

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  function select(key) {
    onNavigate(key);
    setOpen(false);
  }

  const panel = (
    <>
      <div className="mb-5 flex items-center justify-between px-2">
        <Logo compact />
        <button type="button" onClick={toggleTheme} aria-label="Toggle theme"
          className="flex h-9 w-9 items-center justify-center rounded-sm border border-charcoal-lighter text-muted hover:border-saffron hover:text-cream">
          {theme === "dark" ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
        </button>
      </div>

      <button type="button" onClick={() => select("profile")}
        className={`mb-4 flex w-full items-center gap-2 rounded-sm p-2 text-left transition-colors hover:bg-charcoal-lighter/60 ${active === "profile" ? "bg-charcoal-lighter/60" : ""}`}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-saffron/15 text-saffron">
          <UserCircle size={20} strokeWidth={1.75} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm text-cream">{admin.name}</span>
          <span className="block truncate text-xs capitalize text-muted">{admin.role}</span>
        </span>
      </button>

      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <li key={item.key}>
              <button type="button" onClick={() => select(item.key)} aria-current={isActive ? "page" : undefined}
                className={`flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left text-sm transition-colors ${
                  isActive ? "bg-saffron font-medium text-charcoal" : "text-muted hover:bg-charcoal-lighter hover:text-cream"}`}>
                <Icon size={18} strokeWidth={isActive ? 2.25 : 1.75} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <button type="button" onClick={logout}
        className="mt-3 flex w-full items-center gap-3 rounded-sm border border-charcoal-lighter px-3 py-2.5 text-left text-sm text-muted transition-colors hover:border-brick hover:text-brick">
        <LogOut size={18} strokeWidth={1.75} className="shrink-0" />
        Log out
      </button>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-charcoal-lighter bg-charcoal-light px-3 py-2.5 lg:hidden">
        <Logo compact />
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu"
          className="flex h-10 w-10 items-center justify-center rounded-sm border border-charcoal-lighter text-cream">
          <Menu size={18} />
        </button>
      </div>

      {/* Mobile drawer */}
      <div className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-200 ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`} aria-hidden={!open}>
        <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
        <nav className={`absolute left-0 top-0 flex h-full w-[80vw] max-w-72 flex-col bg-charcoal-light p-4 shadow-xl transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"}`}>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="mb-2 self-end text-muted hover:text-cream">
            <X size={18} />
          </button>
          {panel}
        </nav>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-charcoal-lighter bg-charcoal-light p-4 lg:sticky lg:top-0 lg:flex xl:w-64">
        {panel}
      </aside>
    </>
  );
}