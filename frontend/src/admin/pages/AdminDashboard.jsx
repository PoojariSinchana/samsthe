import { useEffect, useState } from "react";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ADMIN_NAV } from "../components/AdminSidebar";
import * as dashApi from "../api/adminDashboardApi";
import { human } from "../utils/human";

const LIVE = new Set(["admins", "leads", "clients", "plans", "invoices", "payments", "subscriptions", "tasks", "reports", "projects", "support", "employees"]);
const rupees = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;
const dateStr = (d) => new Date(d).toLocaleDateString("en-IN");


function Stat({ label, value, sub, accent = "text-cream", onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className="receipt-card relative rounded-sm px-4 pb-4 pt-7 text-left">
      <span className="receipt-notch left-6" />
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 font-display text-xl ${accent}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </Tag>
  );
}

function ListCard({ title, rows, empty, onOpen }) {
  return (
    <div className="receipt-card relative rounded-sm px-4 pb-5 pt-8 sm:px-5">
      <span className="receipt-notch left-6" />
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-cream">{title}</h2>
        {onOpen && <button onClick={onOpen} className="text-xs text-saffron hover:underline">View all</button>}
      </div>
      {rows.length === 0 ? <p className="mt-3 text-sm text-muted">{empty}</p> : (
        <ul className="mt-3 space-y-2 text-sm">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <span className="truncate text-cream">{r.left}</span>
              <span className="shrink-0 text-xs text-muted">{r.right}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminDashboard({ onNavigate }) {
  const { admin, hasPermission } = useAdminAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    dashApi.getSummary().then(setData).catch((e) => setError(e.response?.data?.message || "Couldn't load the dashboard."));
  }, []);

  const modules = ADMIN_NAV.filter((i) => i.key !== "dashboard" && hasPermission(i.permission));
  const c = data?.clients, s = data?.subscriptions, l = data?.leads, f = data?.finance;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-xl text-cream sm:text-2xl lg:text-3xl">Welcome back, {admin.name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-muted">
          Signed in as {admin.role}{admin.lastLogin ? `. Last login ${new Date(admin.lastLogin).toLocaleString("en-IN")}.` : "."}
        </p>
      </div>

      {error && <p role="alert" className="text-sm text-brick">{error}</p>}

      {(c || s || l) && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {c && <Stat label="Clients" value={c.total} sub={`${c.byType.restaurant || 0} restaurant · ${c.byType.retail || 0} retail · +${c.newThisMonth} this month`} onClick={() => onNavigate("clients")} />}
          {s && <Stat label="MRR" value={rupees(s.mrr)} sub={`ARR ${rupees(s.arr)}`} accent="text-sage" />}
          {s && <Stat label="Active / Trial" value={`${s.byStatus.ACTIVE || 0} / ${s.byStatus.TRIAL || 0}`} sub={`${(s.byStatus.PAST_DUE || 0) + (s.byStatus.SUSPENDED || 0)} need attention`} accent={(s.byStatus.PAST_DUE || 0) > 0 ? "text-brick" : "text-cream"} />}
          {l && <Stat label="Open leads" value={l.open} sub={`+${l.newThisWeek} this week · ${l.byStatus.CONVERTED || 0} converted`} accent="text-saffron" onClick={() => onNavigate("leads")} />}
        </div>
      )}

      {(c || s) && (
        <div className="grid gap-4 lg:grid-cols-3">
          {f && (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <Stat label="Collected this month" value={rupees(f.collectedThisMonth)} sub={`${f.paymentsThisMonth} payments`} accent="text-sage" />
              <Stat label="Outstanding" value={rupees(f.outstanding.amount)} sub={`${f.outstanding.count} invoices`} onClick={() => onNavigate("invoices")} />
              <Stat label="Overdue" value={rupees(f.overdue.amount)} sub={`${f.overdue.count} invoices`} accent={f.overdue.count ? "text-brick" : "text-cream"} onClick={() => onNavigate("invoices")} />
              <Stat label="Awaiting first payment" value={s?.byStatus?.PENDING || 0} sub="signed up, not paid" accent="text-saffron" onClick={() => onNavigate("subscriptions")} />
            </div>
          )}
          {f && <ListCard title="Recent payments" empty="No payments yet."
            rows={f.recentPayments.map((p) => ({ left: p.business || "—", right: `${rupees(p.amount)} · ${dateStr(p.paidAt)}` }))}
            onOpen={() => onNavigate("payments")} />}

          {s && <ListCard title="Trials ending (7 days)" empty="No trials ending soon."
            rows={s.trialsEnding.map((t) => ({ left: t.businessId?.name || "—", right: dateStr(t.trialEndsAt) }))} onOpen={() => onNavigate("clients")} />}
          {s && <ListCard title="Renewals due (7 days)" empty="No renewals due."
            rows={s.renewalsDue.map((t) => ({ left: t.businessId?.name || "—", right: `${human(t.plan)} · ${dateStr(t.currentPeriodEnd)}` }))} onOpen={() => onNavigate("clients")} />}
          {c && <ListCard title="Newest clients" empty="No clients yet."
            rows={c.recent.map((r) => ({ left: r.name, right: `${human(r.appType)} · ${dateStr(r.createdAt)}` }))} onOpen={() => onNavigate("clients")} />}
        </div>
      )}

      <div>
        <h2 className="mb-3 font-display text-lg text-cream">Your workspace</h2>
        {modules.length === 0 ? (
          <div className="receipt-card rounded-sm p-8 text-center text-sm text-muted">You don't have access to any modules yet. Ask a superadmin to grant permissions.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {modules.map((m) => {
              const Icon = m.icon;
              const live = LIVE.has(m.key);
              return (
                <button key={m.key} onClick={() => onNavigate(m.key)} className="receipt-card relative rounded-sm px-4 pb-5 pt-7 text-left">
                  <span className="receipt-notch left-6" />
                  <Icon size={22} strokeWidth={1.75} className="text-saffron" />
                  <p className="mt-3 text-sm text-cream">{m.label}</p>
                  <p className={`mt-1 text-xs ${live ? "text-sage" : "text-muted"}`}>{live ? "Ready" : "Not built yet"}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}