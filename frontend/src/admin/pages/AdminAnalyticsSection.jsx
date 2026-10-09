import { useCallback, useEffect, useState } from "react";
import * as analyticsApi from "../api/adminAnalyticsApi";
import { human } from "../utils/human";

const inputCls = "rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const rupees = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;
const monthLabel = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

export default function AdminAnalyticsSection() {
  const [months, setMonths] = useState(6);
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setD(await analyticsApi.getAnalytics({ months })); }
    catch (err) { setError(err.response?.data?.message || "Couldn't load analytics."); }
    finally { setLoading(false); }
  }, [months]);
  useEffect(() => { load(); }, [load]);

  const a = d?.acquisition, r = d?.retention, rev = d?.revenue, eng = d?.engagement;
  const maxVol = Math.max(1, ...(d?.volume.byMonth || []).map((m) => m.volume));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Analytics</h1>
          <p className="mt-1 text-sm text-muted">How clients sign up, stay, and use Samsthe.</p>
        </div>
        <select value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="Period" className={inputCls}>
          <option value={3}>Last 3 months</option><option value={6}>Last 6 months</option>
          <option value={12}>Last 12 months</option><option value={24}>Last 24 months</option>
        </select>
      </div>

      {error && <p role="alert" className="text-sm text-brick">{error}</p>}
      {loading || !d ? <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">Loading…</div> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Signups" value={a.signups} sub={Object.entries(a.byApp).map(([k, v]) => `${v} ${k}`).join(" · ") || "none"} accent="text-saffron" />
            <Stat label="Trial to paid" value={`${a.trialConversionPct}%`} sub={`${a.trialConverted} of ${a.trials} trials`} accent="text-sage" />
            <Stat label="Churn" value={`${r.churnPct}%`} sub={`${r.cancelled} cancelled`} accent={r.cancelled ? "text-brick" : "text-cream"} />
            <Stat label="ARPA" value={rupees(rev.arpa)} sub={`${rev.payingClients} paying · MRR ${rupees(rev.mrr)}`} />
            <Stat label="Active (7 days)" value={eng.active7} sub={`of ${eng.total} clients`} accent="text-sage" />
            <Stat label="At-risk MRR" value={rupees(d.atRisk.mrr)} sub={`${d.atRisk.count} clients`} accent={d.atRisk.count ? "text-brick" : "text-cream"} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Signup funnel">
              <Bar label="Trials started" value={a.trials} max={Math.max(1, a.trials)} />
              <Bar label="Paid after trial" value={a.trialConverted} max={Math.max(1, a.trials)} tone="bg-sage" />
              <Bar label="Expired, not paid" value={r.expiredTrials} max={Math.max(1, a.trials)} tone="bg-brick" />
              <p className="mt-3 text-xs text-muted">{a.stalled} new signup(s) never picked a plan, worth a follow-up call.</p>
            </Card>

            <Card title="Engagement (last login)">
              <Bar label="Within 7 days" value={eng.active7} max={Math.max(1, eng.total)} tone="bg-sage" />
              <Bar label="Within 30 days" value={eng.active30} max={Math.max(1, eng.total)} />
              <Bar label="Idle over 30 days" value={eng.idle} max={Math.max(1, eng.total)} tone="bg-brick/70" />
              <Bar label="Never signed in" value={eng.never} max={Math.max(1, eng.total)} tone="bg-brick" />
            </Card>

            <Card title="Feature adoption (last 30 days)">
              {d.adoption.map((x) => <Bar key={x.key} label={x.label} value={x.clients} max={Math.max(1, ...d.adoption.map((y) => y.clients))} display={`${x.clients} · ${x.pct}%`} />)}
            </Card>

            <Card title="MRR by app">
              {rev.byApp.length === 0 ? <p className="text-sm text-muted">No paying subscriptions yet.</p> : (
                <table className="w-full text-sm"><tbody>
                  {rev.byApp.map((x) => (
                    <tr key={x.appType} className="border-b border-charcoal-lighter/50 last:border-0">
                      <td className="py-2 text-cream">{human(x.appType)}</td>
                      <td className="py-2 text-right text-muted">{x.count} clients</td>
                      <td className="py-2 text-right text-muted">ARPA {rupees(x.arpa)}</td>
                      <td className="py-2 text-right text-cream">{rupees(x.mrr)}</td>
                    </tr>
                  ))}
                </tbody></table>
              )}
            </Card>
          </div>

          <Card title={`Business volume through Samsthe · ${d.volume.orders.toLocaleString("en-IN")} orders · ${rupees(d.volume.gmv)}`}>
            <div className="overflow-x-auto">
              <div className="flex h-44 min-w-[360px] items-end gap-2">
                {d.volume.byMonth.map((m) => (
                  <div key={m.month} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${monthLabel(m.month)}: ${rupees(m.volume)} · ${m.orders} orders`}>
                    <span className="text-[10px] text-muted">{m.volume ? rupees(m.volume) : ""}</span>
                    <div className={`w-full rounded-t-sm ${m.volume ? "bg-saffron" : "bg-charcoal-lighter"}`} style={{ height: m.volume ? `${Math.max((m.volume / maxVol) * 100, 4)}%` : "2px" }} />
                    <span className="text-[10px] text-muted">{monthLabel(m.month)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Most active clients">
              {d.topClients.length === 0 ? <p className="text-sm text-muted">No orders in this period.</p> : (
                <table className="w-full text-sm"><tbody>
                  {d.topClients.map((c) => (
                    <tr key={c._id} className="border-b border-charcoal-lighter/50 last:border-0">
                      <td className="py-2 text-cream">{c.name}<span className="ml-2 text-xs text-muted">{human(c.appType)}</span></td>
                      <td className="py-2 text-right text-muted">{c.orders} orders</td>
                      <td className="py-2 text-right text-cream">{rupees(c.volume)}</td>
                    </tr>
                  ))}
                </tbody></table>
              )}
            </Card>

            <Card title="Paying clients at risk">
              {d.atRisk.list.length === 0 ? <p className="text-sm text-sage">Everyone paying is active and up to date.</p> : (
                <ul className="space-y-2 text-sm">
                  {d.atRisk.list.map((c) => (
                    <li key={c._id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-cream">{c.name}<span className="block text-xs text-brick">{c.reason} · {c.orders30} orders in 30d</span></span>
                      <span className="shrink-0 text-xs text-muted">{c.plan} · {rupees(c.mrr)}/mo</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card title={`Upsell candidates · ${d.upsell.count} at a plan limit`}>
            {d.upsell.list.length === 0 ? <p className="text-sm text-muted">Nobody is at their outlet or staff limit.</p> : (
              <ul className="space-y-2 text-sm">
                {d.upsell.list.map((c) => (
                  <li key={c._id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-cream">{c.name}<span className="ml-2 text-xs text-muted">{c.plan}</span></span>
                    <span className="shrink-0 text-xs text-saffron">{c.outlets.used}/{c.outlets.max} outlets · {c.staff.used}/{c.staff.max} staff</span>
                  </li>
                ))}
              </ul>
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
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Bar({ label, value, max, tone = "bg-saffron", display }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-36 shrink-0 truncate text-muted">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-charcoal-lighter"><div className={`h-full rounded-full ${tone}`} style={{ width: `${(value / max) * 100}%` }} /></div>
      <span className="w-20 shrink-0 text-right text-cream">{display ?? value}</span>
    </div>
  );
}