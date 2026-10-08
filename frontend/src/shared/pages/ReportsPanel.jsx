import { useEffect, useState, useCallback } from "react";
import StatCard from "../components/StatCard";
import { getOutlets } from "../api/outlets";
import * as acc from "../api/accountingApi";
import { todayStr, localDateStr, startOfLocalDay, endOfLocalDay } from "../utils/dateRange";

// fetchPayments(params) must resolve to { payments, totalsByMethod, grandTotal }.
const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal px-3 py-2 text-sm text-cream focus:border-saffron focus:outline-none";
const labelCls = "mb-1 block text-xs text-muted";
const rupees = (n) => `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const human = (s = "") => s.charAt(0).toUpperCase() + s.slice(1);

function firstOfMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function downloadCsv(payments) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Date", "Reference", "Method", "Outlet", "Received by", "Amount"]].concat(
    payments.map((p) => [
      new Date(p.paidAt).toLocaleString("en-IN"), p.orderNumber || p.saleNumber || "", p.method,
      p.outletName || "", p.receivedByName || "", p.amount,
    ])
  );
  const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `collections-${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPanel({ fetchPayments }) {
  const [outlets, setOutlets] = useState([]);
  const [outlet, setOutlet] = useState("");
  const [from, setFrom] = useState(firstOfMonthStr());
  const [to, setTo] = useState(todayStr());
  const [pnl, setPnl] = useState(null);
  const [pay, setPay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { getOutlets().then((r) => setOutlets((r.outlets || []).filter((o) => o.isActive))).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const range = { from: startOfLocalDay(from), to: endOfLocalDay(to) };
    const payParams = { ...range };
    if (outlet) payParams.outlet = outlet;
    const [p, c] = await Promise.allSettled([acc.getProfitAndLoss(range), fetchPayments(payParams)]);
    setPnl(p.status === "fulfilled" ? p.value : null);
    setPay(c.status === "fulfilled" ? c.value : null);
    const failed = [p, c].find((r) => r.status === "rejected");
    if (failed) setError(failed.reason?.response?.data?.message || "Part of this report couldn't be loaded.");
    setLoading(false);
  }, [from, to, outlet, fetchPayments]);
  useEffect(() => { load(); }, [load]);

  const byMethod = Object.entries(pay?.totalsByMethod || {}).sort((a, b) => b[1] - a[1]);
  const maxMethod = byMethod[0]?.[1] || 1;

  const daily = Object.entries(
    (pay?.payments || []).reduce((acc2, p) => {
      const day = localDateStr(new Date(p.paidAt));
      const row = acc2[day] || { count: 0, total: 0 };
      return { ...acc2, [day]: { count: row.count + 1, total: row.total + p.amount } };
    }, {})
  ).sort((a, b) => (a[0] < b[0] ? 1 : -1));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Reports</h1>
          <p className="mt-1 text-sm text-muted">What came in, what went out, and what you kept.</p>
        </div>
        <button onClick={() => downloadCsv(pay?.payments || [])} disabled={!pay?.payments?.length}
          className="rounded-sm border border-saffron px-4 py-2 text-sm font-medium text-saffron hover:bg-saffron hover:text-charcoal disabled:opacity-40">
          Download CSV
        </button>
      </div>

      <div className="receipt-card relative rounded-sm px-4 pb-4 pt-7 sm:px-5">
        <span className="receipt-notch left-6" />
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end sm:gap-4">
          <div><label className={labelCls}>From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>To</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} /></div>
          {outlets.length > 1 && (
            <div className="col-span-2 sm:col-span-1"><label className={labelCls}>Outlet (collections only)</label>
              <select value={outlet} onChange={(e) => setOutlet(e.target.value)} className={inputCls}>
                <option value="">All outlets</option>
                {outlets.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
              </select></div>
          )}
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-brick">{error}</p>}

      {loading ? <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">Loading…</div> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Collected" value={rupees(pay?.grandTotal)} accent="sage" />
            <StatCard label="Revenue booked" value={rupees(pnl?.revenue.total)} accent="saffron" />
            <StatCard label="Expenses" value={rupees(pnl?.expenses.total)} accent="brick" />
            <StatCard label="Net profit" value={rupees(pnl?.netProfit)} accent={(pnl?.netProfit || 0) >= 0 ? "sage" : "brick"} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="receipt-card relative rounded-sm px-5 pb-6 pt-8">
              <span className="receipt-notch left-6" />
              <h2 className="mb-4 font-display text-lg text-cream">Collected by method</h2>
              {byMethod.length === 0 ? <p className="text-sm text-muted">No payments in this range.</p> : (
                <div className="space-y-2">
                  {byMethod.map(([m, v]) => (
                    <div key={m} className="flex items-center gap-3 text-sm">
                      <span className="w-16 shrink-0 text-muted">{human(m)}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-charcoal-lighter"><div className="h-full rounded-full bg-saffron" style={{ width: `${(v / maxMethod) * 100}%` }} /></div>
                      <span className="w-24 shrink-0 text-right text-cream">{rupees(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="receipt-card relative rounded-sm px-5 pb-6 pt-8">
              <span className="receipt-notch left-6" />
              <h2 className="mb-4 font-display text-lg text-cream">Profit and loss</h2>
              {!pnl ? <p className="text-sm text-muted">Not available for this range.</p> : (
                <table className="w-full text-sm"><tbody>
                  {[["Revenue", pnl.revenue.total, "text-sage"], ["Expenses", pnl.expenses.total, "text-brick"], ["Net profit", pnl.netProfit, pnl.netProfit >= 0 ? "text-sage" : "text-brick"]].map(([l, v, c]) => (
                    <tr key={l} className="border-b border-charcoal-lighter/50 last:border-0"><td className="py-2 text-cream">{l}</td><td className={`py-2 text-right font-medium ${c}`}>{rupees(v)}</td></tr>
                  ))}
                </tbody></table>
              )}
              <p className="mt-3 text-xs text-muted">Covers all outlets. Full statements are under Accounting.</p>
            </div>
          </div>

          <div className="receipt-card relative overflow-x-auto rounded-sm">
            <span className="receipt-notch left-6" />
            {daily.length === 0 ? <p className="p-8 text-center text-sm text-muted">No collections in this range.</p> : (
              <table className="w-full min-w-[360px] text-left text-sm">
                <thead><tr className="border-b border-charcoal-lighter text-xs text-muted">
                  <th className="px-5 pb-3 pt-7 font-medium">Day</th><th className="px-5 pb-3 pt-7 font-medium">Payments</th><th className="px-5 pb-3 pt-7 text-right font-medium">Collected</th>
                </tr></thead>
                <tbody>
                  {daily.map(([day, r]) => (
                    <tr key={day} className="border-b border-charcoal-lighter last:border-0 hover:bg-charcoal">
                      <td className="px-5 py-3 text-cream">{new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</td>
                      <td className="px-5 py-3 text-muted">{r.count}</td>
                      <td className="px-5 py-3 text-right text-cream">{rupees(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
