import { useCallback, useEffect, useState } from "react";
import * as reportsApi from "../api/adminReportsApi";
import { human } from "../utils/human";

const inputCls = "rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const rupees = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;
const monthLabel = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
const AGING = { notDue: "Not yet due", d1_7: "1 to 7 days late", d8_30: "8 to 30 days late", d31plus: "Over 30 days late" };
const AGING_TONE = { notDue: "bg-sage", d1_7: "bg-saffron", d8_30: "bg-brick/70", d31plus: "bg-brick" };
const FUNNEL_ORDER = ["NEW", "CONTACTED", "DEMO_SCHEDULED", "PROPOSAL_SENT", "NEGOTIATION", "CONVERTED", "LOST"];

function rangeFor(months) {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth() - (months - 1), 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function AdminReportsSection() {
  const [months, setMonths] = useState(12);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setData(await reportsApi.getSummary(rangeFor(months))); }
    catch (err) { setError(err.response?.data?.message || "Couldn't load the report."); }
    finally { setLoading(false); }
  }, [months]);
  useEffect(() => { load(); }, [load]);

  async function exportCsv() {
    setExporting(true);
    try { await reportsApi.downloadPaymentsCsv(rangeFor(months)); }
    catch { setError("Couldn't export payments."); }
    finally { setExporting(false); }
  }

  const t = data?.totals;
  const maxRev = Math.max(1, ...(data?.revenueByMonth || []).map((r) => r.amount));
  const maxClients = Math.max(1, ...(data?.newClientsByMonth || []).map((r) => r.count));
  const maxTop = Math.max(1, ...(data?.topClients || []).map((r) => r.amount));
  const agingTotal = Math.max(1, (data?.invoiceAging || []).reduce((s, r) => s + r.amount, 0));
  const funnel = data?.leadFunnel;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Reports</h1>
          <p className="mt-1 text-sm text-muted">Revenue, growth and collections across all clients.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="Report period" className={inputCls}>
            <option value={3}>Last 3 months</option><option value={6}>Last 6 months</option><option value={12}>Last 12 months</option>
          </select>
          <button onClick={exportCsv} disabled={exporting} className="rounded-sm border border-saffron px-4 py-2.5 text-sm font-medium text-saffron hover:bg-saffron hover:text-charcoal disabled:opacity-50">
            {exporting ? "Exporting…" : "Export payments CSV"}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-brick">{error}</p>}
      {loading || !data ? <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">Loading…</div> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Collected" value={rupees(t.collected)} sub={`${t.payments} payments`} accent="text-sage" />
            <Stat label="MRR now" value={rupees(t.mrr)} sub={`ARR ${rupees(t.mrr * 12)}`} />
            <Stat label="New clients" value={t.newClients} accent="text-saffron" />
            <Stat label="Cancellations" value={t.cancelled} accent={t.cancelled ? "text-brick" : "text-cream"} />
            <Stat label="Outstanding" value={rupees(t.outstanding)} accent="text-brick" />
          </div>

          <Card title="Revenue collected by month">
            <Columns rows={data.revenueByMonth.map((r) => ({ label: monthLabel(r.month), value: r.amount, display: rupees(r.amount) }))} max={maxRev} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="New clients by month">
              <Columns rows={data.newClientsByMonth.map((r) => ({ label: monthLabel(r.month), value: r.count, display: r.count }))} max={maxClients} tone="bg-sage" />
            </Card>

            <Card title="Invoice aging (money still owed)">
              <div className="space-y-3">
                {data.invoiceAging.map((r) => (
                  <div key={r.bucket}>
                    <div className="flex justify-between text-sm"><span className="text-muted">{AGING[r.bucket]} <span className="text-xs">({r.count})</span></span><span className="text-cream">{rupees(r.amount)}</span></div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-charcoal-lighter"><div className={`h-full rounded-full ${AGING_TONE[r.bucket]}`} style={{ width: `${(r.amount / agingTotal) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Subscriptions by plan">
              {data.planMix.length === 0 ? <p className="text-sm text-muted">No active subscriptions.</p> : (
                <table className="w-full text-sm"><tbody>
                  {data.planMix.map((p, i) => (
                    <tr key={i} className="border-b border-charcoal-lighter/50 last:border-0">
                      <td className="py-2 text-cream">{p.name}<span className="ml-2 text-xs text-muted">{human(p.appType)}</span></td>
                      <td className="py-2 text-right text-muted">{p.count} subs</td>
                      <td className="py-2 text-right text-cream">{rupees(p.mrr)}<span className="text-xs text-muted"> /mo</span></td>
                    </tr>
                  ))}
                </tbody></table>
              )}
            </Card>

            <Card title={`Lead funnel · ${funnel.conversionPct}% converted`}>
              {funnel.total === 0 ? <p className="text-sm text-muted">No leads in this period.</p> : (
                <div className="space-y-2">
                  {FUNNEL_ORDER.map((s) => {
                    const n = funnel.byStatus[s] || 0;
                    return (
                      <div key={s} className="flex items-center gap-3 text-sm">
                        <span className="w-32 shrink-0 truncate text-muted">{human(s)}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-charcoal-lighter"><div className={`h-full rounded-full ${s === "LOST" ? "bg-brick" : s === "CONVERTED" ? "bg-sage" : "bg-saffron"}`} style={{ width: `${(n / funnel.total) * 100}%` }} /></div>
                        <span className="w-8 shrink-0 text-right text-cream">{n}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          <Card title="Top clients by revenue">
            {data.topClients.length === 0 ? <p className="text-sm text-muted">No payments in this period.</p> : (
              <div className="space-y-2">
                {data.topClients.map((c) => (
                  <div key={c._id} className="flex items-center gap-3 text-sm">
                    <span className="w-32 shrink-0 truncate text-cream sm:w-48" title={c.name}>{c.name}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-charcoal-lighter"><div className="h-full rounded-full bg-saffron" style={{ width: `${(c.amount / maxTop) * 100}%` }} /></div>
                    <span className="w-24 shrink-0 text-right text-cream">{rupees(c.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, accent = "text-cream" }) {
  return (
    <div className="receipt-card relative rounded-sm px-4 pb-4 pt-7">
      <span className="receipt-notch left-6" />
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 font-display text-xl ${accent}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="receipt-card relative rounded-sm px-5 pb-6 pt-8">
      <span className="receipt-notch left-6" />
      <h2 className="mb-4 font-display text-lg text-cream">{title}</h2>
      {children}
    </div>
  );
}

function Columns({ rows, max, tone = "bg-saffron" }) {
  if (rows.every((r) => r.value === 0)) return <p className="text-sm text-muted">No data in this period.</p>;
  return (
    <div className="overflow-x-auto">
      <div className="flex h-44 min-w-[360px] items-end gap-2">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${r.label}: ${r.display}`}>
            <span className="text-[10px] text-muted">{r.value ? r.display : ""}</span>
            <div className={`w-full rounded-t-sm ${r.value ? tone : "bg-charcoal-lighter"}`} style={{ height: r.value ? `${Math.max((r.value / max) * 100, 4)}%` : "2px" }} />
            <span className="text-[10px] text-muted">{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}