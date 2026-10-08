import { useCallback, useEffect, useState } from "react";
import * as subApi from "../api/adminSubscriptionsApi";
import { useAdminAuth } from "../context/AdminAuthContext";

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const human = (s = "") => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const rupees = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;
const dateStr = (d) => (d ? new Date(d).toLocaleDateString("en-IN") : "—");
const STYLE = {
  ACTIVE: "bg-sage/10 text-sage", TRIAL: "bg-saffron/10 text-saffron", PAST_DUE: "bg-brick/10 text-brick",
  SUSPENDED: "bg-brick/10 text-brick", CANCELLED: "bg-charcoal-lighter text-muted", EXPIRED: "bg-charcoal-lighter text-muted",
  PENDING: "bg-saffron/10 text-saffron",
};

// The date that matters for this row: trial end for trials, period end otherwise.
const endsOn = (s) => (s.status === "TRIAL" ? s.trialEndsAt || s.currentPeriodEnd : s.currentPeriodEnd);
function daysLeft(s) {
  const d = endsOn(s);
  if (!d || ["CANCELLED", "SUSPENDED"].includes(s.status)) return null;
  return Math.ceil((new Date(d) - Date.now()) / 864e5);
}

export default function AdminSubscriptionsSection() {
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission("MANAGE_SUBSCRIPTIONS");
  const canInvoice = hasPermission("MANAGE_INVOICES");

  const [meta, setMeta] = useState(null);
  const [subs, setSubs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState("");
  const [appType, setAppType] = useState("");
  const [expiring, setExpiring] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [extending, setExtending] = useState(null);

  useEffect(() => { subApi.getMeta().then(setMeta).catch((e) => setError(e.response?.data?.message || "Couldn't load options.")); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, limit: 20 };
      if (status) params.status = status;
      if (appType) params.appType = appType;
      if (expiring) params.expiring = expiring;
      if (search) params.search = search;
      const d = await subApi.getSubscriptions(params);
      setSubs(d.subscriptions); setSummary(d.summary); setPages(d.pages); setTotal(d.total);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't load subscriptions.");
    } finally {
      setLoading(false);
    }
  }, [page, status, appType, expiring, search]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  async function run(fn, fail) {
    setError(""); setNotice("");
    try { const r = await fn(); if (r?.message) setNotice(r.message); load(); }
    catch (err) { setError(err.response?.data?.message || fail); }
  }

  function changeStatus(s, next) {
    if (next === s.status) return;
    let cancelReason;
    if (next === "CANCELLED") {
      cancelReason = window.prompt(`Why is ${s.client?.name} cancelling? (optional)`);
      if (cancelReason === null) return;
    } else if (!window.confirm(`Change ${s.client?.name} from ${human(s.status)} to ${human(next)}?`)) return;
    run(() => subApi.updateStatus(s._id, { status: next, cancelReason }), "Couldn't change the status.");
  }

  function bulkRenewals() {
    if (!window.confirm("Create draft renewal invoices for every subscription due in the next 7 days or already past due?")) return;
    run(() => subApi.generateRenewals(7), "Couldn't generate invoices.");
  }

  const by = summary?.byStatus || {};
  const attention = (by.PAST_DUE || 0) + (by.SUSPENDED || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Subscriptions</h1>
          <p className="mt-1 text-sm text-muted">Plans, renewals and trials. Plans and prices are edited under Clients and Pricing.</p>
        </div>
        {canInvoice && <button onClick={bulkRenewals} className="rounded-sm border border-saffron px-4 py-2 text-sm font-medium text-saffron hover:bg-saffron hover:text-charcoal">Generate renewal invoices</button>}
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="MRR" value={rupees(summary.mrr)} sub={`ARR ${rupees(summary.mrr * 12)}`} accent="text-sage" />
          <Stat label="Active" value={by.ACTIVE || 0} accent="text-sage" />
          <Stat label="On trial" value={by.TRIAL || 0} accent="text-saffron" />
          <Stat label="Need attention" value={attention} sub={`${summary.expiringSoon} ending in 7 days`} accent={attention ? "text-brick" : "text-cream"} />
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Chip active={status === ""} onClick={() => { setStatus(""); setPage(1); }} label="All" />
        {meta?.statuses.map((s) => <Chip key={s} active={status === s} onClick={() => { setStatus(s); setPage(1); }} label={human(s)} count={by[s] || 0} />)}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search client name" aria-label="Search subscriptions" className={`${inputCls} max-w-xs`} />
        <select value={appType} onChange={(e) => { setAppType(e.target.value); setPage(1); }} aria-label="Filter by app" className={`${inputCls} w-auto`}>
          <option value="">All apps</option><option value="restaurant">Restaurant</option><option value="retail">Retail</option>
        </select>
        <select value={expiring} onChange={(e) => { setExpiring(e.target.value); setPage(1); }} aria-label="Filter by expiry" className={`${inputCls} w-auto`}>
          <option value="">Any end date</option><option value="7">Ending in 7 days</option><option value="14">Ending in 14 days</option><option value="30">Ending in 30 days</option>
        </select>
      </div>

      {error && <p role="alert" className="text-sm text-brick">{error}</p>}
      {notice && <p className="text-sm text-sage">{notice}</p>}

      <div className="receipt-card relative overflow-x-auto rounded-sm">
        <span className="receipt-notch left-6" />
        {loading ? <p className="p-8 text-center text-sm text-muted">Loading…</p>
        : subs.length === 0 ? <p className="p-8 text-center text-sm text-muted">{search || status || appType || expiring ? "No subscriptions match these filters." : "No subscriptions yet. They're created at signup or from Clients."}</p>
        : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-charcoal-lighter text-xs text-muted">
                {["Client", "Plan", "Amount", "Status", "Ends"].map((h) => <th key={h} className="px-5 pb-3 pt-7 font-medium">{h}</th>)}
                <th className="px-5 pb-3 pt-7"></th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => {
                const left = daysLeft(s);
                return (
                  <tr key={s._id} className="border-b border-charcoal-lighter last:border-0 hover:bg-charcoal">
                    <td className="px-5 py-3 text-cream">{s.client?.name || "—"}<p className="text-xs text-muted">{human(s.client?.appType)}{s.client?.city ? ` · ${s.client.city}` : ""}</p></td>
                      <td className="px-5 py-3 text-muted">{human(s.plan)}<p className="text-xs">{human(s.billingCycle)}</p>
                        {s.pendingPlan && <p className="text-xs text-saffron">→ {s.pendingPlanName} awaiting payment</p>}</td>
                    <td className="px-5 py-3 text-cream">{rupees(s.amount)}</td>
                    <td className="px-5 py-3">
                      {canManage ? (
                        <select value={s.status} onChange={(e) => changeStatus(s, e.target.value)} aria-label={`Status for ${s.client?.name}`}
                          className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium outline-none ${STYLE[s.status]} bg-charcoal-light`}>
                          {meta?.statuses.map((x) => <option key={x} value={x}>{human(x)}</option>)}
                        </select>
                      ) : <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STYLE[s.status]}`}>{human(s.status)}</span>}
                      {s.status === "CANCELLED" && s.cancelReason && <p className="mt-1 text-xs text-muted">{s.cancelReason}</p>}
                    </td>
                    <td className="px-5 py-3 text-muted">{dateStr(endsOn(s))}
                      {left !== null && <p className={`text-xs ${left < 0 ? "text-brick" : left <= 7 ? "text-saffron" : ""}`}>{left < 0 ? `${-left}d overdue` : left === 0 ? "today" : `in ${left}d`}</p>}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right text-xs">
                      {canManage && <button onClick={() => setExtending(s)} className="text-saffron hover:underline">Extend</button>}
                      {canManage && canInvoice && <span className="mx-2 text-charcoal-lighter">·</span>}
                      {canInvoice && <button onClick={() => run(() => subApi.renewalInvoice(s._id), "Couldn't create the invoice.")} className="text-sage hover:underline">Invoice</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>Page {page} of {pages} · {total} subscriptions</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-sm border border-charcoal-lighter px-3 py-1.5 hover:text-cream disabled:opacity-40">Previous</button>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="rounded-sm border border-charcoal-lighter px-3 py-1.5 hover:text-cream disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {extending && <ExtendModal sub={extending} onClose={() => setExtending(null)}
        onDone={(msg) => { setExtending(null); setNotice(msg); load(); }} />}
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

function Chip({ active, onClick, label, count }) {
  return (
    <button onClick={onClick} className={`whitespace-nowrap rounded-sm border px-3 py-1.5 text-sm ${active ? "border-saffron text-saffron" : "border-charcoal-lighter text-muted hover:text-cream"}`}>
      {label}{count !== undefined && <span className="ml-1.5 text-xs text-muted">{count}</span>}
    </button>
  );
}

function ExtendModal({ sub, onClose, onDone }) {
  const [days, setDays] = useState(7);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try { onDone((await subApi.extend(sub._id, days)).message); }
    catch (err) { setError(err.response?.data?.message || "Couldn't extend."); setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <form onSubmit={submit} className="receipt-card relative w-full max-w-sm rounded-sm px-5 pb-5 pt-8">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-cream">Extend {sub.client?.name}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-cream">✕</button>
        </div>
        <p className="mt-1 text-xs text-muted">Currently ends {sub.status === "TRIAL" ? dateStr(sub.trialEndsAt) : dateStr(sub.currentPeriodEnd)}. No invoice is created.</p>
        {error && <p role="alert" className="mt-2 text-sm text-brick">{error}</p>}
        <div className="mt-4">
          <label className="mb-1 block text-xs text-muted">Extra days</label>
          <input type="number" min="1" max="365" value={days} onChange={(e) => setDays(e.target.value)} required className={inputCls} />
          <div className="mt-2 flex gap-2">
            {[7, 14, 30].map((d) => <button key={d} type="button" onClick={() => setDays(d)} className="rounded-sm border border-charcoal-lighter px-2.5 py-1 text-xs text-muted hover:border-saffron hover:text-cream">{d}d</button>)}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
          <button disabled={saving} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">{saving ? "Saving…" : "Extend"}</button>
        </div>
      </form>
    </div>
  );
}