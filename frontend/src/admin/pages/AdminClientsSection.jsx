import { useCallback, useEffect, useState } from "react";
import * as clientsApi from "../api/adminClientsApi";
import { useAdminAuth } from "../context/AdminAuthContext";
import { human } from "../utils/human";

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const labelCls = "mb-1 block text-xs text-muted";
const dateStr = (d) => (d ? new Date(d).toLocaleDateString("en-IN") : "—");
const dateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

const SUB_STYLE = {
  ACTIVE: "bg-sage/10 text-sage",
  TRIAL: "bg-saffron/10 text-saffron",
  PAST_DUE: "bg-brick/10 text-brick",
  SUSPENDED: "bg-brick/10 text-brick",
  CANCELLED: "bg-charcoal-lighter text-muted",
  EXPIRED: "bg-charcoal-lighter text-muted",
  NONE: "bg-charcoal-lighter text-muted",
  PENDING: "bg-saffron/10 text-saffron",
};

export default function AdminClientsSection() {
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission("MANAGE_CLIENTS") || hasPermission("MANAGE_SUBSCRIPTIONS");

  const [meta, setMeta] = useState(null);
  const [clients, setClients] = useState([]);
  const [summary, setSummary] = useState(null);
  const [appType, setAppType] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    clientsApi.getMeta().then(setMeta).catch((e) => setError(e.response?.data?.message || "Couldn't load options."));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, limit: 20 };
      if (appType) params.appType = appType;
      if (search) params.search = search;
      const data = await clientsApi.getClients(params);
      setClients(data.clients);
      setSummary(data.summary);
      setPages(data.pages);
      setTotal(data.total);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't load clients.");
    } finally {
      setLoading(false);
    }
  }, [page, appType, search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const sub = summary?.bySubscription || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-cream sm:text-3xl">Clients</h1>
        <p className="mt-1 text-sm text-muted">Every business using Samsthe, with its owner and subscription.</p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total clients" value={summary.total} />
          <Stat label="Restaurant / Retail" value={`${summary.byType.restaurant || 0} / ${summary.byType.retail || 0}`} />
          <Stat label="Active subscriptions" value={sub.ACTIVE || 0} accent="text-sage" />
          <Stat label="No subscription" value={sub.NONE || 0} accent="text-brick" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search name, phone, email or city" aria-label="Search clients" className={`${inputCls} max-w-md`} />
        <select value={appType} onChange={(e) => { setAppType(e.target.value); setPage(1); }} className={`${inputCls} w-auto`} aria-label="Filter by app">
          <option value="">All apps</option>
          <option value="restaurant">Restaurant</option>
          <option value="retail">Retail</option>
        </select>
      </div>

      {error && <p role="alert" className="text-sm text-brick">{error}</p>}

      <div className="receipt-card relative overflow-x-auto rounded-sm">
        <span className="receipt-notch left-6" />
        {loading ? (
          <p className="p-8 text-center text-sm text-muted">Loading…</p>
        ) : clients.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">{search || appType ? "No clients match these filters." : "No clients yet. They appear here when a business signs up."}</p>
        ) : (
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-charcoal-lighter text-xs text-muted">
                <th className="px-5 pb-3 pt-7 font-medium">Business</th>
                <th className="px-5 pb-3 pt-7 font-medium">Owner</th>
                <th className="px-5 pb-3 pt-7 font-medium">App</th>
                <th className="px-5 pb-3 pt-7 font-medium">Subscription</th>
                <th className="px-5 pb-3 pt-7 font-medium">Outlets / Users</th>
                <th className="px-5 pb-3 pt-7 font-medium">Joined</th>
                <th className="px-5 pb-3 pt-7"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const st = c.subscription?.status || "NONE";
                return (
                  <tr key={c._id} className="border-b border-charcoal-lighter last:border-0 hover:bg-charcoal">
                    <td className="px-5 py-3 text-cream">{c.name}<p className="text-xs text-muted">{[c.city, c.phone].filter(Boolean).join(" · ")}</p></td>
                    <td className="px-5 py-3 text-cream">{c.owner?.name || "—"}<p className="text-xs text-muted">{c.owner?.email || ""}</p></td>
                    <td className="px-5 py-3 text-muted">{human(c.appType)}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${SUB_STYLE[st]}`}>{st === "NONE" ? "None" : human(st)}</span>
                      {c.subscription && <p className="mt-1 text-xs text-muted">{human(c.subscription.plan)}</p>}
                    </td>
                    <td className="px-5 py-3 text-muted">{c.outletCount} / {c.userCount}</td>
                    <td className="px-5 py-3 text-muted">{dateStr(c.createdAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => setOpenId(c._id)} className="text-xs text-saffron hover:underline">View</button>
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
          <span>Page {page} of {pages} · {total} clients</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-sm border border-charcoal-lighter px-3 py-1.5 hover:text-cream disabled:opacity-40">Previous</button>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="rounded-sm border border-charcoal-lighter px-3 py-1.5 hover:text-cream disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {openId && meta && (
        <ClientModal id={openId} meta={meta} canManage={canManage} onClose={() => setOpenId(null)} onSaved={load} />
      )}
    </div>
  );
}

function Stat({ label, value, accent = "text-cream" }) {
  return (
    <div className="receipt-card relative rounded-sm px-4 pb-4 pt-7">
      <span className="receipt-notch left-6" />
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 font-display text-xl ${accent}`}>{value}</p>
    </div>
  );
}

function ClientModal({ id, meta, canManage, onClose, onSaved }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const fill = useCallback((d) => {
    const s = d.subscription;
    setForm({
      plan: s?.plan || "trial",
      billingCycle: s?.billingCycle || "monthly",
      status: s?.status || "TRIAL",
      amount: s?.amount ?? 0,
      trialEndsAt: dateInput(s?.trialEndsAt),
      currentPeriodEnd: dateInput(s?.currentPeriodEnd),
      maxOutlets: s?.limits?.maxOutlets ?? 1,
      maxStaff: s?.limits?.maxStaff ?? 5,
      notes: s?.notes || "",
    });
  }, []);

  useEffect(() => {
    clientsApi.getClient(id).then((d) => { setData(d); fill(d); })
      .catch((e) => setError(e.response?.data?.message || "Couldn't load this client."));
  }, [id, fill]);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setSaved(false); };

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await clientsApi.saveSubscription(id, {
        plan: form.plan, billingCycle: form.billingCycle, status: form.status, amount: form.amount,
        trialEndsAt: form.trialEndsAt, currentPeriodEnd: form.currentPeriodEnd, notes: form.notes,
        limits: { maxOutlets: form.maxOutlets, maxStaff: form.maxStaff },
      });
      const fresh = await clientsApi.getClient(id);
      setData(fresh);
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't save the subscription.");
    } finally {
      setSaving(false);
    }
  }

  const c = data?.client; 

  const appPlans = c ? meta.plans.filter((p) => p.appType === c.appType) : [];
const priceFor = (p, cycle) => (cycle === "yearly" ? p.yearlyPrice : p.monthlyPrice);

function changePlan(e) {
  const p = appPlans.find((x) => x.key === e.target.value);
  setForm((f) => ({ ...f, plan: e.target.value, ...(p ? { amount: priceFor(p, f.billingCycle), maxOutlets: p.limits.maxOutlets, maxStaff: p.limits.maxStaff } : {}) }));
  setSaved(false);
}
function changeCycle(e) {
  const p = appPlans.find((x) => x.key === form.plan);
  setForm((f) => ({ ...f, billingCycle: e.target.value, ...(p ? { amount: priceFor(p, e.target.value) } : {}) }));
  setSaved(false);
}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="receipt-card relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-sm">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between px-5 pb-3 pt-8 sm:px-6">
          <h2 className="font-display text-xl text-cream">{c?.name || "Client"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-cream">✕</button>
        </div>
        {error && <p role="alert" className="px-5 text-sm text-brick sm:px-6">{error}</p>}

        {!data || !form ? (
          !error && <p className="p-8 text-center text-sm text-muted">Loading…</p>
        ) : (
          <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-3 sm:px-6">
              <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Info label="App" value={human(c.appType)} />
                <Info label="Business type" value={human(c.businessType)} />
                <Info label="Owner" value={c.owner ? `${c.owner.name} · ${c.owner.phone || ""}` : "—"} />
                <Info label="Owner email" value={c.owner?.email || "—"} />
                <Info label="Location" value={[c.address, c.city, c.state, c.country].filter(Boolean).join(", ") || "—"} />
                <Info label="GST" value={c.gst?.registered ? c.gst.number : "Not registered"} />
                <Info label="Joined" value={dateStr(c.createdAt)} />
                <Info label="Last login" value={dateStr(data.lastActivity)} />
                <Info label="Outlets" value={data.outlets.length ? data.outlets.map((o) => o.name).join(", ") : "None"} />
                <Info label="Users" value={Object.entries(data.usersByRole).map(([r, n]) => `${n} ${r}`).join(", ") || "None"} />
              </div>

              <div className="border-t border-charcoal-lighter pt-4">
                <p className="mb-3 font-display text-lg text-cream">Subscription {!data.subscription && <span className="text-xs text-muted">(none yet, saving will create one)</span>}</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><label className={labelCls}>Plan</label>
                    <select value={form.plan} onChange={changePlan} disabled={!canManage} className={inputCls}>
                        {appPlans.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                        {!appPlans.some((p) => p.key === form.plan) && <option value={form.plan}>{human(form.plan)} (retired)</option>}
                    </select></div>
                    <Sel label="Billing cycle" value={form.billingCycle} onChange={changeCycle} options={meta.billingCycles} disabled={!canManage} />
                  <Sel label="Status" value={form.status} onChange={set("status")} options={meta.statuses} disabled={!canManage} />
                  <div><label className={labelCls}>Amount per cycle (₹)</label>
                    <input type="number" min="0" value={form.amount} onChange={set("amount")} disabled={!canManage} className={inputCls} /></div>
                  <div><label className={labelCls}>Trial ends</label>
                    <input type="date" value={form.trialEndsAt} onChange={set("trialEndsAt")} disabled={!canManage} className={inputCls} /></div>
                  <div><label className={labelCls}>Current period ends</label>
                    <input type="date" value={form.currentPeriodEnd} onChange={set("currentPeriodEnd")} disabled={!canManage} className={inputCls} /></div>
                  <div><label className={labelCls}>Max outlets</label>
                    <input type="number" min="1" value={form.maxOutlets} onChange={set("maxOutlets")} disabled={!canManage} className={inputCls} /></div>
                  <div><label className={labelCls}>Max staff</label>
                    <input type="number" min="1" value={form.maxStaff} onChange={set("maxStaff")} disabled={!canManage} className={inputCls} /></div>
                  <div className="sm:col-span-2"><label className={labelCls}>Notes</label>
                    <textarea rows={2} value={form.notes} onChange={set("notes")} disabled={!canManage} className={inputCls} /></div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse items-center gap-2 border-t border-charcoal-lighter px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              {saved && <span className="text-sm text-sage sm:mr-auto">Saved.</span>}
              <button type="button" onClick={onClose} className="w-full rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron sm:w-auto">Close</button>
              {canManage && (
                <button disabled={saving} className="w-full rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50 sm:w-auto">
                  {saving ? "Saving…" : "Save subscription"}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return <p><span className="text-xs text-muted">{label}</span><br /><span className="text-cream">{value}</span></p>;
}

function Sel({ label, value, onChange, options, disabled }) {
  return (
    <div><label className={labelCls}>{label}</label>
      <select value={value} onChange={onChange} disabled={disabled} className={inputCls}>
        {options.map((o) => <option key={o} value={o}>{human(o)}</option>)}
      </select></div>
  );
}