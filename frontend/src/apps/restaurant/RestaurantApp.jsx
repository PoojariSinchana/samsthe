import { useEffect, useState } from "react";
import DashboardHeader from "../../shared/components/DashboardHeader";
import api from "../../shared/api/axios";
import Sidebar from "./components/Sidebar";
import MyProfileModal from "../../shared/components/MyProfileModal";
import MenuSection from "./pages/MenuSection";
import StatCard from "../../shared/components/StatCard";
import OutletsSection from "../../shared/pages/OutletsSection";
import SettingsSection from "../../shared/pages/SettingsSection";
import EntriesSection from "../../shared/pages/EntriesSection";
import OrderSection from "./pages/OrderSection";
import TablesSection from "./pages/TablesSection";
import PeopleSection from "./pages/people/PeopleSection";
import BillingSection from "./pages/BillingSection";
import PurchasesSection from "./pages/PurchasesSection";
import ExpensesSection from "../../shared/pages/ExpensesSection";
import AccountingSection from "../../shared/pages/AccountingSection";
import ReportsSection from "./pages/ReportsSection";
import AnalyticsSection from "../../shared/pages/AnalyticsSection";
import AccessSection from "../../shared/pages/AccessSection";
import { rupeesCompact } from "../../shared/utils/format";
import { adaptDashboard } from "../../shared/api/dashboardAdapter";
import { useAuth } from "../../shared/context/AuthContext";
import { OrderBuilderProvider } from "./context/OrderBuilderContext";
import { Receipt, FileStack, UserPlus } from "lucide-react";
import useNotifications from "../../shared/hooks/useNotifications";
import NotificationsSection from "../../shared/pages/NotificationsSection";
import TasksSection from "../../shared/pages/TasksSection";
import CalculatorSection from "../../shared/pages/CalculatorSection";
import SubscriptionSection from "../../shared/pages/SubscriptionSection";
import SupportSection from "../../shared/pages/SupportSection";

const PERIOD_TITLE = {
  today: "today",
  week: "the last 7 days",
  month: "this month",
  year: "this year",
};

export default function Dashboard() {
  const { restaurant } = useAuth();
  const [section, setSection] = useState("dashboard");
  const [peopleInitialTab, setPeopleInitialTab] = useState(null);
  const [entriesInitialTab, setEntriesInitialTab] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [period, setPeriod] = useState("month");
  const notif = useNotifications("restaurant");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
  if (section !== "dashboard") return;
  let ignore = false; // drops stale responses when the period changes quickly
  setError("");
  api
    .get("/dashboard/summary", { params: { period } })
    .then(({ data: raw }) => {
  if (ignore) return;
  const data = adaptDashboard(raw, period);
  if (!data?.kpis) {
    setSummary(null);
    setError("The dashboard returned data in an unexpected format.");
    return;
  }
  setSummary(data);
})
    .catch(() => !ignore && setError("Couldn't load the dashboard summary."));
  return () => { ignore = true; };
}, [section, period]);

useEffect(() => {
  const go = (e) => setSection(e.detail);
  window.addEventListener("nav:section", go);
  return () => window.removeEventListener("nav:section", go);
}, []);

  // Sidebar always lands on a section's default view.
  function handleSidebarNavigate(key) {
    setPeopleInitialTab(null);
    setEntriesInitialTab(null);
    setSection(key);
  }

  // Quick Actions can also jump to a specific sub-tab.
  function handleQuickAction(action) {
    if (action === "bill") {
      setSection("billing");
    } else if (action === "transaction") {
      setEntriesInitialTab("Add Transaction");
      setSection("entries");
    } else if (action === "customer") {
      setPeopleInitialTab("customers");
      setSection("people");
    }
  }

  const knownSections = [
    "dashboard", "outlets", "settings", "people", "menu", "orders", "tables",
    "billing", "inventory", "purchases", "expenses", "accounting", "reports", "entries",
    "analytics", "access", "notifications", "tasks", "calculator", "subscription", "support"
  ];

    return (
    <OrderBuilderProvider>
      <div className="flex min-h-screen flex-col bg-charcoal">
        <DashboardHeader
          appType="restaurant"
          appName="Restaurant Manager"
          onMenu={() => setMenuOpen(true)}
          onNavigate={handleSidebarNavigate}
        />

        <div className="flex min-w-0 flex-1">
          <Sidebar
            active={section}
            onNavigate={handleSidebarNavigate}
            restaurant={restaurant}
            onOpenProfile={() => setProfileModalOpen(true)}
            badges={{ notifications: notif.unread }}
            mobileOpen={menuOpen}
            onMobileOpen={() => setMenuOpen(true)}
            onMobileClose={() => setMenuOpen(false)}
          />

          <main className="min-w-0 flex-1 px-4 py-6 pb-24 sm:px-6 sm:py-8 md:pb-8 lg:px-8">
            {section === "dashboard" && (
              <DashboardHome
                summary={summary}
                error={error}
                onQuickAction={handleQuickAction}
                period={period}
                onPeriodChange={setPeriod}
              />
            )}
            {section === "notifications" && <NotificationsSection n={notif} onNavigate={setSection} />}
            {section === "settings" && <SettingsSection />}
            {section === "people" && <PeopleSection initialTab={peopleInitialTab} />}
            {section === "tasks" && <TasksSection />}
            {section === "calculator" && <CalculatorSection />}
            {section === "menu" && <MenuSection onNavigate={setSection} />}
            {section === "orders" && <OrderSection onNavigate={setSection} />}
            {section === "tables" && <TablesSection />}
            {section === "billing" && <BillingSection />}
            {section === "outlets" && <OutletsSection />}
            {section === "entries" && <EntriesSection initialTab={entriesInitialTab} />}
            {section === "purchases" && <PurchasesSection />}
            {section === "expenses" && <ExpensesSection />}
            {section === "accounting" && <AccountingSection />}
            {section === "reports" && <ReportsSection />}
            {section === "analytics" && <AnalyticsSection />}
            {section === "access" && <AccessSection />}
            {section === "subscription" && <SubscriptionSection />}
            {section === "support" && <SupportSection />}
            {!knownSections.includes(section) && <ComingSoon section={section} />}
          </main>
        </div>

        <MyProfileModal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
      </div>
    </OrderBuilderProvider>
  );
}

const PERIOD_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

function DashboardHome({ summary, error, onQuickAction, period, onPeriodChange }) {
  if (!summary && !error) {
  return <p className="text-muted">Loading dashboard…</p>;
  }

  const periodTitle = summary ? PERIOD_TITLE[summary.period] || "this month" : "";
  const changeLabel = { today: "vs yesterday", week: "vs previous 7 days", month: "vs last month", year: "vs last year" }[period] || "vs previous period";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-xl text-cream sm:text-2xl lg:text-3xl">Dashboard</h1>
          {summary && (
            <p className="mt-1 text-sm text-muted">
              Showing {periodTitle}, {summary.periodLabel}.
            </p>
          )}
        </div>

        <div className="flex gap-1 self-start rounded-sm border border-charcoal-lighter p-1 sm:self-auto">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onPeriodChange(opt.key)}
              className={`rounded-sm px-3 py-1.5 text-sm transition-colors ${
                period === opt.key
                  ? "bg-saffron text-charcoal"
                  : "text-muted hover:text-cream"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-brick">{error}</p>}
      {!summary ? null : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 2xl:grid-cols-6">
            <StatCard
              label="Total Sales"
              value={`₹${summary.kpis.totalSales.toLocaleString("en-IN")}`}
              accent="sage"
              change={summary.kpis.totalSalesChangePct} changeLabel={changeLabel}
            />
            <StatCard
              label="Total Expenses"
              value={`₹${summary.kpis.totalExpenses.toLocaleString("en-IN")}`}
              accent="brick"
              change={summary.kpis.totalExpensesChangePct} changeLabel={changeLabel}
            />
            <StatCard
              label="Net Profit"
              value={`₹${summary.kpis.netProfit.toLocaleString("en-IN")}`}
              accent={summary.kpis.netProfit >= 0 ? "sage" : "brick"}
              change={summary.kpis.netProfitChangePct} changeLabel={changeLabel}
            />
            <StatCard
              label="Orders"
              value={summary.kpis.orders}
              accent="saffron"
              change={summary.kpis.ordersChangePct} changeLabel={changeLabel}
            />
            <StatCard
              label="Customers"
              value={summary.kpis.customers}
              accent="saffron"
              change={summary.kpis.customersChangePct} changeLabel={changeLabel}
            />
            <StatCard
              label="Cash / Bank Balance"
              value={rupeesCompact(summary.kpis.cashBankBalance)}
            />
          </div>

          {/* Sales Overview */}
          <div className="receipt-card rounded-sm px-4 pb-6 pt-8 sm:px-5">
            <span className="receipt-notch left-6" />
            <h2 className="font-display text-lg text-cream">Sales Overview</h2>
            <SalesChart data={summary.salesTrend} />
          </div>

          {/* Revenue vs Expenses */}
          <div className="receipt-card rounded-sm px-4 pb-6 pt-8 sm:px-5">
            <span className="receipt-notch left-6" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg text-cream">Revenue vs Expenses</h2>
              <div className="flex items-center gap-4 text-xs text-muted">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-saffron" /> Revenue</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brick" /> Expenses</span>
              </div>
            </div>
            <RevenueExpenseChart data={summary.revenueVsExpenses} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent Transactions */}
            <div className="receipt-card rounded-sm px-4 pb-6 pt-8 sm:px-5">
              <span className="receipt-notch left-6" />
              <h2 className="font-display text-lg text-cream">Recent Transactions</h2>
              {summary.recentTransactions.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Nothing recorded yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {summary.recentTransactions.map((t, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-cream">{t.title}</span>
                      <span className={`shrink-0 ${t.positive ? "text-sage" : "text-brick"}`}>{t.amount}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Outstanding */}
            <div className="receipt-card rounded-sm px-4 pb-6 pt-8 sm:px-5">
              <span className="receipt-notch left-6" />
              <h2 className="font-display text-lg text-cream">Outstanding</h2>
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-cream">Customer Receivables</p>
                    <p className="text-xs text-muted">{summary.outstanding.customerReceivables.count} order(s) with a balance due</p>
                  </div>
                  <p className="shrink-0 font-display text-xl text-brick">
                    ₹{summary.outstanding.customerReceivables.total.toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-charcoal-lighter pt-4">
                  <div className="min-w-0">
                    <p className="text-sm text-cream">Supplier Payables</p>
                    <p className="text-xs text-muted">Owed to suppliers, all-time</p>
                  </div>
                  <p className="shrink-0 font-display text-xl text-brick">
                    ₹{summary.outstanding.supplierPayables.total.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="receipt-card rounded-sm px-4 pb-6 pt-8 sm:px-5">
            <span className="receipt-notch left-6" />
            <h2 className="font-display text-lg text-cream">Quick Actions</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <QuickActionButton icon={Receipt} label="Create Bill" onClick={() => onQuickAction("bill")} />
              <QuickActionButton icon={FileStack} label="Add Transaction" onClick={() => onQuickAction("transaction")} />
              <QuickActionButton icon={UserPlus} label="Add Customer" onClick={() => onQuickAction("customer")} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function QuickActionButton({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-sm border border-charcoal-lighter px-3 py-5 text-center transition-colors hover:border-saffron hover:bg-charcoal-lighter"
    >
      <Icon size={22} strokeWidth={1.75} className="text-saffron" />
      <span className="text-sm text-cream">{label}</span>
    </button>
  );
}

// Buckets from the API are { label, total } — label is already formatted
// for the active period (hour-of-day, "DD Mon", or "Mon"), so we just
// render it directly instead of re-parsing a date.
function SalesChart({ data }) {
  if (!data || data.every((d) => d.total === 0)) return <p className="mt-4 text-sm text-muted">No sales in this period yet.</p>;

  const max = Math.max(...data.map((d) => d.total), 1);
  const rangeTotal = data.reduce((sum, d) => sum + d.total, 0);

  return (
    <div className="mt-4">
      <p className="mb-3 text-sm text-muted">
        Total: <span className="text-cream font-medium">₹{rangeTotal.toLocaleString("en-IN")}</span>
      </p>
      <div className="overflow-x-auto">
        <div className="flex h-40 min-w-[420px] gap-1">
          {data.map((d, i) => {
            const hasSales = d.total > 0;
            return (
              <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className={`text-[10px] ${hasSales ? "text-cream" : "text-muted/50"}`}>
                  {hasSales ? `₹${d.total.toLocaleString("en-IN")}` : "—"}
                </span>
                <div
                  className={`w-full rounded-t-sm ${hasSales ? "bg-saffron" : "bg-charcoal-lighter"}`}
                  style={{ height: hasSales ? `${Math.max((d.total / max) * 100, 4)}%` : "2px" }}
                />
                <span className="text-[10px] text-muted">{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RevenueExpenseChart({ data }) {
  if (!data || data.every((d) => d.revenue === 0 && d.expenses === 0)) {
    return <p className="mt-4 text-sm text-muted">No activity in this period yet.</p>;
  }

  const max = Math.max(...data.map((d) => Math.max(d.revenue, d.expenses)), 1);

  return (
    <div className="mt-4 overflow-x-auto">
      <div className="flex h-40 min-w-[420px] gap-2">
        {data.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
            <div className="flex h-full w-full items-end justify-center gap-0.5">
              <div
                className="w-1/2 rounded-t-sm bg-saffron"
                style={{ height: d.revenue > 0 ? `${Math.max((d.revenue / max) * 100, 3)}%` : "2px" }}
                title={`Revenue ₹${d.revenue.toLocaleString("en-IN")}`}
              />
              <div
                className="w-1/2 rounded-t-sm bg-brick"
                style={{ height: d.expenses > 0 ? `${Math.max((d.expenses / max) * 100, 3)}%` : "2px" }}
                title={`Expenses ₹${d.expenses.toLocaleString("en-IN")}`}
              />
            </div>
            <span className="text-[10px] text-muted">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComingSoon({ section }) {
  const label = section.charAt(0).toUpperCase() + section.slice(1);
  return (
    <div className="receipt-card max-w-md rounded-sm px-6 pb-8 pt-8">
      <h1 className="font-display text-xl text-cream">{label}</h1>
      <p className="mt-2 text-sm text-muted">
        This section isn't built yet — it's next on the list once
        onboarding is solid.
      </p>
    </div>
  );
}