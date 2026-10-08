import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { getOutlets } from "../api/outlets";
import StatCard from "../components/StatCard";
import { todayStr, startOfLocalDay, endOfLocalDay } from "../utils/dateRange"
import * as analyticsApi from "../api/analyticsApi";

const TABS = ["Revenue", "Sales", "Profit", "Expense", "Customers", "KPIs"];

function thirtyDaysAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal px-3 py-2 text-sm text-cream focus:border-saffron focus:outline-none";
const labelCls = "mb-1 block text-xs text-muted";

export default function AnalyticsSection() {
  const [tab, setTab] = useState("Revenue");
  const [outlets, setOutlets] = useState([]);
  const [outlet, setOutlet] = useState("");
  const [from, setFrom] = useState(thirtyDaysAgoStr());
  const [to, setTo] = useState(todayStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getOutlets().then((res) => setOutlets((res.outlets || []).filter((o) => o.isActive))).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { from: startOfLocalDay(from), to: endOfLocalDay(to) };
      if (outlet) params.outlet = outlet;
      const res = await analyticsApi.getAnalytics(params);
      setData(res);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [from, to, outlet]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl text-cream sm:text-2xl lg:text-3xl">Analytics</h1>
        <p className="mt-1 text-sm text-muted">Trends and growth signals, computed from your sales, expenses, and orders.</p>
      </div>

      <div className="receipt-card relative rounded-sm px-4 pb-4 pt-7 sm:px-5">
        <span className="receipt-notch left-6" />
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end sm:gap-4">
          <div>
            <label className={labelCls}>From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} w-full`} />
          </div>
          <div>
            <label className={labelCls}>To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} w-full`} />
          </div>
          {outlets.length > 1 && (
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Outlet</label>
              <select value={outlet} onChange={(e) => setOutlet(e.target.value)} className={`${inputCls} w-full`}>
                <option value="">All outlets</option>
                {outlets.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-brick">{error}</p>}

      <div className="flex flex-wrap gap-2 overflow-x-auto border-b border-charcoal-lighter">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap px-3 py-2 text-sm ${tab === t ? "border-b-2 border-saffron text-saffron" : "text-muted hover:text-cream"}`}>
            {t}
          </button>
        ))}
      </div>

      {loading || !data ? (
        <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">Loading…</div>
      ) : (
        <>
          {tab === "Revenue" && <RevenueTab d={data.revenue} />}
          {tab === "Sales" && <SalesTab d={data.sales} />}
          {tab === "Profit" && <ProfitTab d={data.profit} revenueTotal={data.revenue.total} />}
          {tab === "Expense" && <ExpenseTab d={data.expense} />}
          {tab === "Customers" && <CustomersTab d={data.customers} />}
          {tab === "KPIs" && <KpisTab d={data.kpis} />}
        </>
      )}
    </div>
  );
}

function RevenueTab({ d }) {
  const max = Math.max(1, ...d.trend.map((r) => r.total));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:grid-cols-3 sm:gap-4">
        <StatCard label="Revenue this period" value={`₹${d.total.toLocaleString("en-IN")}`} />
        <StatCard label="Previous period" value={`₹${d.previousTotal.toLocaleString("en-IN")}`} accent="sage" />
        <StatCard label="Growth" value={`${d.growthPct >= 0 ? "▲" : "▼"} ${Math.abs(d.growthPct)}%`} accent={d.growthPct >= 0 ? "sage" : "brick"} />
      </div>
      <div className="receipt-card relative rounded-sm px-4 pb-6 pt-8 sm:px-5">
        <span className="receipt-notch left-6" />
        <h2 className="mb-4 font-display text-lg text-cream">Revenue trend</h2>
        {d.trend.length === 0 ? <p className="text-sm text-muted">No revenue in this range.</p> : (
          <div className="space-y-2">{d.trend.map((r) => <BarRow key={r.date} label={r.date} value={r.total} max={max} />)}</div>
        )}
      </div>
    </div>
  );
}

function SalesTab({ d }) {
  const [view, setView] = useState("byCategory");
  const rows = d[view] || [];
  const max = Math.max(1, ...rows.map((r) => r.revenue));
  const hourMax = Math.max(1, ...d.byHour.map((h) => h.revenue));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard label="Peak hour" value={`${d.peakHour.hour}:00`} accent="sage" />
        <StatCard label="Peak day" value={d.peakDay.day} accent="sage" />
      </div>
      <div className="flex flex-wrap gap-2">
        {["byCategory", "byProduct", "byOutlet"].map((v) => (
          <button key={v} onClick={() => setView(v)} className={`rounded-sm border px-3 py-1.5 text-sm ${view === v ? "border-saffron text-saffron" : "border-charcoal-lighter text-muted hover:text-cream"}`}>
            {v === "byCategory" ? "By Category" : v === "byProduct" ? "By Product" : "By Outlet"}
          </button>
        ))}
      </div>
      <div className="receipt-card relative rounded-sm px-4 pb-6 pt-8 sm:px-5">
        <span className="receipt-notch left-6" />
        {rows.length === 0 ? <p className="text-sm text-muted">No data.</p> : (
          <div className="space-y-2">{rows.map((r) => <BarRow key={r._id} label={r._id} value={r.revenue} max={max} sub={r.quantity !== undefined ? `${r.quantity} sold` : r.orders !== undefined ? `${r.orders} orders` : null} />)}</div>
        )}
      </div>
      <div className="receipt-card relative rounded-sm px-4 pb-6 pt-8 sm:px-5">
        <span className="receipt-notch left-6" />
        <h2 className="mb-4 font-display text-lg text-cream">Revenue by hour of day</h2>
        <div className="overflow-x-auto">
          <div className="flex h-32 min-w-[480px] items-end gap-1">
            {d.byHour.map((h) => (
              <div key={h.hour} className="flex flex-1 flex-col items-center gap-1" title={`${h.hour}:00 — ₹${h.revenue.toLocaleString("en-IN")}`}>
                <div className="w-full rounded-t-sm bg-saffron" style={{ height: `${Math.max((h.revenue / hourMax) * 100, 2)}%` }} />
                {h.hour % 4 === 0 && <span className="text-[9px] text-muted">{h.hour}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfitTab({ d, revenueTotal }) {
  const max = Math.max(1, ...d.trend.map((r) => Math.max(r.revenue, r.expense)));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:grid-cols-3 sm:gap-4">
        <StatCard label="Gross profit" value={`₹${d.grossProfit.toLocaleString("en-IN")}`} accent="sage" />
        <StatCard label="Net profit" value={`₹${d.netProfit.toLocaleString("en-IN")}`} accent={d.netProfit >= 0 ? "sage" : "brick"} />
        <StatCard label="Profit margin" value={`${d.profitMarginPct}%`} accent="sage" />
      </div>
      <p className="text-xs text-muted">{d.cogsNote}</p>
      <div className="receipt-card relative rounded-sm px-4 pb-6 pt-8 sm:px-5">
        <span className="receipt-notch left-6" />
        <h2 className="mb-4 font-display text-lg text-cream">Revenue vs Expense</h2>
        {d.trend.length === 0 ? <p className="text-sm text-muted">No data.</p> : (
          <div className="space-y-3">
            {d.trend.map((r) => (
              <div key={r.date} className="space-y-1">
                <div className="flex justify-between text-xs text-muted"><span>{r.date}</span><span className={r.profit >= 0 ? "text-sage" : "text-brick"}>₹{r.profit.toLocaleString("en-IN")}</span></div>
                <div className="flex gap-1">
                  <div className="h-2 rounded-full bg-sage" style={{ width: `${(r.revenue / max) * 100}%` }} />
                  <div className="h-2 rounded-full bg-brick" style={{ width: `${(r.expense / max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ExpenseTab({ d }) {
  const max = Math.max(1, ...d.byCategory.map((c) => c.total));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:grid-cols-3 sm:gap-4">
        <StatCard label="Total expenses" value={`₹${d.total.toLocaleString("en-IN")}`} accent="brick" />
        <StatCard label="Previous period" value={`₹${d.previousTotal.toLocaleString("en-IN")}`} />
        <StatCard label="Growth" value={`${d.growthPct >= 0 ? "▲" : "▼"} ${Math.abs(d.growthPct)}%`} accent={d.growthPct <= 0 ? "sage" : "brick"} />
      </div>
      <div className="receipt-card relative rounded-sm px-4 pb-6 pt-8 sm:px-5">
        <span className="receipt-notch left-6" />
        <h2 className="mb-4 font-display text-lg text-cream">By category</h2>
        {d.byCategory.length === 0 ? <p className="text-sm text-muted">No expenses.</p> : (
          <div className="space-y-2">{d.byCategory.map((c) => <BarRow key={c.name} label={c.name} value={c.total} max={max} />)}</div>
        )}
      </div>
      <div className="receipt-card relative rounded-sm px-4 pb-6 pt-8 sm:px-5">
        <span className="receipt-notch left-6" />
        <h2 className="mb-4 font-display text-lg text-cream">Highest single expenses</h2>
        {d.topExpenses.length === 0 ? <p className="text-sm text-muted">No expenses.</p> : (
          <ul className="space-y-2 text-sm">
            {d.topExpenses.map((e) => (
              <li key={e._id} className="flex justify-between gap-2"><span className="truncate text-cream">{e.description}</span><span className="shrink-0 text-brick">₹{e.amount.toLocaleString("en-IN")}</span></li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CustomersTab({ d }) {
  const max = Math.max(1, ...d.topCustomers.map((c) => c.spend));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:grid-cols-3 sm:gap-4">
        <StatCard label="Customers this period" value={d.distinctInPeriod} />
        <StatCard label="Repeat customers" value={d.repeatCount} accent="sage" />
        <StatCard label="Repeat rate" value={`${d.repeatRatePct}%`} accent="sage" />
      </div>
      <p className="text-xs text-muted">{d.note}</p>
      <div className="receipt-card relative rounded-sm px-4 pb-6 pt-8 sm:px-5">
        <span className="receipt-notch left-6" />
        <h2 className="mb-4 font-display text-lg text-cream">Top customers</h2>
        {d.topCustomers.length === 0 ? <p className="text-sm text-muted">No customers with a phone number yet.</p> : (
          <div className="space-y-2">{d.topCustomers.map((c) => <BarRow key={c.phone} label={c.name !== "—" ? c.name : c.phone} value={c.spend} max={max} sub={`${c.orders} orders`} />)}</div>
        )}
      </div>
    </div>
  );
}

function KpisTab({ d }) {
  return (
    <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:grid-cols-3 sm:gap-4">
      <StatCard label="Avg. order value" value={`₹${d.avgOrderValue.toFixed(0)}`} />
      <StatCard label="Gross margin" value={`${d.grossMarginPct}%`} accent="sage" />
      <StatCard label="Net margin" value={`${d.netMarginPct}%`} accent={d.netMarginPct >= 0 ? "sage" : "brick"} />
      <StatCard label="Customer retention" value={`${d.customerRetentionPct}%`} accent="sage" />
      <StatCard label="Revenue growth" value={`${d.revenueGrowthPct >= 0 ? "▲" : "▼"} ${Math.abs(d.revenueGrowthPct)}%`} accent={d.revenueGrowthPct >= 0 ? "sage" : "brick"} />
    </div>
  );
}

function BarRow({ label, value, max, sub }) {
  const pct = max ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-sm sm:gap-3">
      <span className="w-20 shrink-0 truncate text-muted sm:w-28" title={label}>{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-charcoal-lighter">
        <div className="h-full rounded-full bg-saffron" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-20 shrink-0 text-right text-cream sm:w-24">₹{value.toLocaleString("en-IN")}</span>
      {sub && <span className="hidden w-20 shrink-0 text-right text-xs text-muted sm:block">{sub}</span>}
    </div>
  );
}