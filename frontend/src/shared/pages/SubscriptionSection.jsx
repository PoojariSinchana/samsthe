import { useCallback, useEffect, useState } from "react";
import { Check, Lock } from "lucide-react";
import api from "../api/axios";
import { usePlan } from "../context/PlanContext";
import { FEATURE_LABELS } from "../constants/features";
import PayByUpi from "../../marketing/PayByUpi";

const rupees = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
const dateStr = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const human = (s = "") => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const STATUS_STYLE = {
  ACTIVE: "bg-sage/10 text-sage", TRIAL: "bg-saffron/10 text-saffron", PENDING: "bg-saffron/10 text-saffron",
  PAST_DUE: "bg-brick/10 text-brick", SUSPENDED: "bg-brick/10 text-brick",
  EXPIRED: "bg-charcoal-lighter text-muted", CANCELLED: "bg-charcoal-lighter text-muted",
  draft: "bg-charcoal-lighter text-muted", sent: "bg-saffron/10 text-saffron", overdue: "bg-brick/10 text-brick",
  paid: "bg-sage/10 text-sage", cancelled: "bg-charcoal-lighter text-muted", refunded: "bg-charcoal-lighter text-muted",
};
const daysLeft = (d) => (d ? Math.ceil((new Date(d) - Date.now()) / 864e5) : null);

export default function SubscriptionSection() {
  const { refresh: refreshPlan } = usePlan();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try { setData((await api.get("/business/me/subscription")).data); setError(""); }
    catch (e) { setError(e.response?.data?.message || "Couldn't load your subscription."); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Called after a payment: re-reads the plan context (unlocks features) and this page.
  const afterPay = useCallback(() => Promise.all([refreshPlan(), load()]), [refreshPlan, load]);

  async function choose(plan, cycle) {
    setBusy(plan.key); setError(""); setNotice("");
    try {
      const { data: res } = await api.post("/business/me/subscription/change", { planKey: plan.key, billingCycle: cycle });
      setNotice(res.message);
      setPicking(false);
      await afterPay();
    } catch (e) { setError(e.response?.data?.message || "Couldn't change your plan."); }
    finally { setBusy(""); }
  }

  async function discard() {
    if (!window.confirm("Discard this plan change? Your current plan stays as it is.")) return;
    setError(""); setNotice("");
    try { await api.delete("/business/me/subscription/change"); setNotice("Plan change cancelled."); await afterPay(); }
    catch (e) { setError(e.response?.data?.message || "Couldn't cancel the plan change."); }
  }

  if (!data) return error ? <p role="alert" className="text-sm text-brick">{error}</p> : <p className="text-muted">Loading subscription…</p>;

  const { subscription: sub, usage, openInvoice, invoices, payments, plans } = data;
  if (!sub) return (
    <div className="receipt-card max-w-md rounded-sm p-8 text-center text-sm text-muted">
      You don't have a plan yet. <a href="/choose-plan" className="text-saffron hover:underline">Choose one</a>.
    </div>
  );

  const left = daysLeft(sub.endsAt);
  const suspended = sub.status === "SUSPENDED";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Subscription</h1>
          <p className="mt-1 text-sm text-muted">Your plan, usage and billing history.</p>
        </div>
        <button onClick={() => setPicking(true)} disabled={suspended}
          className="rounded-sm bg-saffron px-4 py-2.5 text-sm font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">
          {sub.isTrial || sub.status === "TRIAL" ? "Choose a plan" : "Upgrade plan"}
        </button>
      </div>

      {error && <p role="alert" className="text-sm text-brick">{error}</p>}
      {notice && <p className="text-sm text-sage">{notice}</p>}
      {suspended && <p className="text-sm text-brick">This account is suspended. Please contact support.</p>}

      {openInvoice && (
        <div className="receipt-card relative rounded-sm px-5 pb-5 pt-7">
          <span className="receipt-notch left-6" />
          <p className="font-display text-lg text-saffron">
            {sub.pending ? `${sub.pending.planName} (${sub.pending.billingCycle}) is waiting for payment` : "Payment due"}
          </p>
          <p className="mt-1 text-sm text-muted">
            Invoice {openInvoice.invoiceNumber} · {rupees(openInvoice.total)} · due {dateStr(openInvoice.dueDate)}.
            {sub.pending && " Your current plan stays active until you pay."}
          </p>
          <PayByUpi refresh={afterPay} />
          {sub.pending && <button onClick={discard} className="mt-3 text-sm text-brick hover:underline">Discard this plan change</button>}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="receipt-card relative rounded-sm px-5 pb-6 pt-8 lg:col-span-2">
          <span className="receipt-notch left-6" />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted">Current plan</p>
              <h2 className="font-display text-2xl text-cream">{sub.planName}</h2>
              {sub.description && <p className="mt-1 text-sm text-muted">{sub.description}</p>}
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[sub.status]}`}>{human(sub.status)}</span>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Info label="Price" value={sub.amount > 0 ? `${rupees(sub.amount)} / ${sub.billingCycle === "yearly" ? "year" : "month"}` : "Free"} />
            <Info label="Billing cycle" value={human(sub.billingCycle)} />
            <Info label="Member since" value={dateStr(sub.memberSince)} />
            <Info label="Current period" value={sub.currentPeriodStart ? `${dateStr(sub.currentPeriodStart)} →` : "—"} />
            <Info label={sub.status === "TRIAL" ? "Trial ends" : "Renews / ends"} value={dateStr(sub.endsAt)} />
            <Info label="Time left"
              value={left === null ? "—" : left < 0 ? `${-left} day(s) overdue` : left === 0 ? "Ends today" : `${left} day(s)`}
              tone={left !== null && left <= 7 ? (left < 0 ? "text-brick" : "text-saffron") : ""} />
          </dl>
          {sub.cancelReason && <p className="mt-4 text-xs text-muted">Note: {sub.cancelReason}</p>}
        </div>

        <div className="receipt-card relative rounded-sm px-5 pb-6 pt-8">
          <span className="receipt-notch left-6" />
          <h2 className="font-display text-lg text-cream">Usage</h2>
          <Meter label="Outlets" {...usage.outlets} />
          <Meter label="Staff logins" {...usage.staff} />
        </div>
      </div>

      <div className="receipt-card relative rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <h2 className="font-display text-lg text-cream">What's included</h2>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(FEATURE_LABELS).map(([key, label]) => {
            const on = sub.modules === null || sub.modules.includes(key);
            return (
              <li key={key} className={`flex items-center gap-2 ${on ? "text-cream" : "text-muted"}`}>
                {on ? <Check size={15} className="text-sage" /> : <Lock size={14} />}{label}
              </li>
            );
          })}
          {sub.features.map((f) => <li key={f} className="flex items-center gap-2 text-cream"><Check size={15} className="text-sage" />{f}</li>)}
        </ul>
      </div>

      <Table title="Invoices" empty="No invoices yet."
        heads={["Invoice", "Issued", "Due", "Total", "Paid", "Status"]}
        rows={invoices.map((i) => [i.invoiceNumber, dateStr(i.issueDate), dateStr(i.dueDate), rupees(i.total), rupees(i.amountPaid),
          <span key="s" className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[i.status]}`}>{human(i.status)}</span>])} />
      <Table title="Payments" empty="No payments yet."
        heads={["Date", "Invoice", "Method", "Reference", "Amount", "Status"]}
        rows={payments.map((p) => [dateStr(p.paidAt), p.invoiceNumber || "—", human(p.method), p.reference || "—", rupees(p.amount),
          <span key="s" className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[p.status]}`}>{human(p.status)}</span>])} />

      {picking && <PlanPicker sub={sub} plans={plans} busy={busy} onChoose={choose} onClose={() => setPicking(false)} />}
    </div>
  );
}

function Info({ label, value, tone = "" }) {
  return <div><dt className="text-xs text-muted">{label}</dt><dd className={`mt-0.5 text-cream ${tone}`}>{value}</dd></div>;
}

function Meter({ label, used, max }) {
  const pct = max ? Math.min(100, (used / max) * 100) : 0;
  return (
    <div className="mt-4">
      <div className="flex justify-between text-sm"><span className="text-muted">{label}</span><span className="text-cream">{used} of {max ?? "∞"}</span></div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-charcoal-lighter">
        <div className={`h-full rounded-full ${pct >= 100 ? "bg-brick" : "bg-saffron"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Table({ title, heads, rows, empty }) {
  return (
    <div className="receipt-card relative overflow-x-auto rounded-sm">
      <span className="receipt-notch left-6" />
      <h2 className="px-5 pb-2 pt-8 font-display text-lg text-cream">{title}</h2>
      {rows.length === 0 ? <p className="px-5 pb-6 text-sm text-muted">{empty}</p> : (
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead><tr className="border-y border-charcoal-lighter text-xs text-muted">{heads.map((h) => <th key={h} className="px-5 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-charcoal-lighter last:border-0 hover:bg-charcoal">
                {r.map((c, j) => <td key={j} className="px-5 py-3 text-cream">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PlanPicker({ sub, plans, busy, onChoose, onClose }) {
  const [cycle, setCycle] = useState(sub.billingCycle === "yearly" ? "yearly" : "monthly");
  const hasYearly = plans.some((p) => p.yearlyPrice > 0);
  const price = (p) => (cycle === "yearly" ? p.yearlyPrice : p.monthlyPrice);

  function label(p) {
    if (p.key === sub.planKey && cycle === sub.billingCycle) return sub.status === "ACTIVE" ? "Renew now" : "Choose";
    if (price(p) > sub.amount) return `Upgrade to ${p.name}`;
    return `Switch to ${p.name}`;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="receipt-card relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-sm">
        <span className="receipt-notch left-6" />
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-8 sm:px-6">
          <div>
            <h2 className="font-display text-xl text-cream">Choose your plan</h2>
            <p className="mt-1 text-sm text-muted">You're on {sub.planName}. The new plan starts as soon as the invoice is paid; until then nothing changes.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-cream">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5 sm:px-6">
          {hasYearly && (
            <div className="mb-4 inline-flex gap-1 rounded-sm border border-charcoal-lighter p-1">
              {["monthly", "yearly"].map((c) => (
                <button key={c} onClick={() => setCycle(c)} className={`rounded-sm px-3 py-1.5 text-sm capitalize ${cycle === c ? "bg-saffron text-charcoal" : "text-muted hover:text-cream"}`}>{c}</button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((p) => {
              const current = p.key === sub.planKey;
              return (
                <div key={p._id} className={`flex flex-col rounded-sm border p-4 ${current ? "border-saffron" : "border-charcoal-lighter"}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-display text-lg text-cream">{p.name}</p>
                    {current && <span className="rounded-full bg-saffron/15 px-2 py-0.5 text-[10px] text-saffron">Current</span>}
                  </div>
                  <p className="mt-1 font-display text-2xl text-cream">
                    {rupees(cycle === "yearly" ? p.yearlyPrice / 12 : p.monthlyPrice)}<span className="text-xs text-muted"> /month</span>
                  </p>
                  <p className="min-h-[1.2em] text-xs text-muted">{cycle === "yearly" ? `Billed ${rupees(p.yearlyPrice)} yearly` : ""}</p>
                  <ul className="mt-3 flex-1 space-y-1 text-xs text-muted">
                    <li>✓ {p.limits.maxOutlets} outlet{p.limits.maxOutlets > 1 ? "s" : ""}</li>
                    <li>✓ {p.limits.maxStaff} staff logins</li>
                    {(p.features || []).map((f) => <li key={f}>✓ {f}</li>)}
                  </ul>
                  {p.blocked && <p className="mt-3 text-xs text-brick">{p.blocked}</p>}
                  <button onClick={() => onChoose(p, cycle)} disabled={!!busy || !!p.blocked}
                    className="mt-4 rounded-sm bg-saffron px-3 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">
                    {busy === p.key ? "Please wait…" : label(p)}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}