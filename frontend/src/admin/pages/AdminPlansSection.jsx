import { useCallback, useEffect, useState } from "react";
import * as plansApi from "../api/adminPlansApi";
import { useAdminAuth } from "../context/AdminAuthContext";

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const labelCls = "mb-1 block text-xs text-muted";
const rupees = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;

const FEATURES = {
  purchases: "Purchases", transactions: "Transactions", accounting: "Accounting overview",
  accounting_full: "Full accounting & statements", reports: "Reports", analytics: "Analytics",
  access: "System Access", partners: "Owners & partners",
};
const ALL_FEATURES = Object.keys(FEATURES);

export default function AdminPlansSection() {
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission("MANAGE_PRODUCTS");
  const [appType, setAppType] = useState("restaurant");
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // {} = new

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPlans((await plansApi.getPlans({ appType })).plans);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't load plans.");
    } finally {
      setLoading(false);
    }
  }, [appType]);
  useEffect(() => { load(); }, [load]);

  async function toggleActive(p) {
    try {
      await plansApi.updatePlan(p._id, { isActive: !p.isActive });
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't update the plan.");
    }
  }

  // Plans saved before feature gating have no `modules` list, which means "everything unlocked".
  const featureCount = (p) => (Array.isArray(p.modules) ? p.modules.length : ALL_FEATURES.length);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Pricing</h1>
          <p className="mt-1 text-sm text-muted">Plans and prices for each app. Clients are assigned to these under Clients.</p>
        </div>
        {canManage && (
          <button onClick={() => setEditing({})} className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark">Add plan</button>
        )}
      </div>

      <div className="flex gap-2 border-b border-charcoal-lighter">
        {["restaurant", "retail"].map((t) => (
          <button key={t} onClick={() => setAppType(t)}
            className={`px-3 py-2 text-sm capitalize ${appType === t ? "border-b-2 border-saffron text-saffron" : "text-muted hover:text-cream"}`}>{t}</button>
        ))}
      </div>

      {error && <p role="alert" className="text-sm text-brick">{error}</p>}

      <div className="receipt-card relative overflow-x-auto rounded-sm">
        <span className="receipt-notch left-6" />
        {loading ? <p className="p-8 text-center text-sm text-muted">Loading…</p>
        : plans.length === 0 ? <p className="p-8 text-center text-sm text-muted">No plans yet. Run <code>npm run seed:plans</code> or add one.</p>
        : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-charcoal-lighter text-xs text-muted">
                <th className="px-5 pb-3 pt-7 font-medium">Plan</th>
                <th className="px-5 pb-3 pt-7 font-medium">Monthly</th>
                <th className="px-5 pb-3 pt-7 font-medium">Yearly</th>
                <th className="px-5 pb-3 pt-7 font-medium">Limits</th>
                <th className="px-5 pb-3 pt-7 font-medium">Status</th>
                {canManage && <th className="px-5 pb-3 pt-7"></th>}
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p._id} className={`border-b border-charcoal-lighter last:border-0 hover:bg-charcoal ${p.isActive ? "" : "opacity-60"}`}>
                  <td className="px-5 py-3 text-cream">{p.name}
                    <p className="text-xs text-muted">{p.key}{p.isTrial ? ` · trial, ${p.trialDays} days` : ""}{!p.isPublic && !p.isTrial ? " · hidden" : ""}</p></td>
                  <td className="px-5 py-3 text-cream">{rupees(p.monthlyPrice)}</td>
                  <td className="px-5 py-3 text-cream">{rupees(p.yearlyPrice)}</td>
                  <td className="px-5 py-3 text-muted">{p.limits.maxOutlets} outlets · {p.limits.maxStaff} staff
                    <p className="text-xs">{featureCount(p)} of {ALL_FEATURES.length} features</p></td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${p.isActive ? "bg-sage/10 text-sage" : "bg-charcoal-lighter text-muted"}`}>{p.isActive ? "Active" : "Retired"}</span>
                  </td>
                  {canManage && (
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => setEditing(p)} className="text-xs text-saffron hover:underline">Edit</button>
                      <span className="mx-2 text-charcoal-lighter">·</span>
                      <button onClick={() => toggleActive(p)} className={`text-xs hover:underline ${p.isActive ? "text-brick" : "text-sage"}`}>{p.isActive ? "Retire" : "Restore"}</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-muted">Retiring a plan hides it from new assignments; existing subscribers keep it.</p>

      {editing && <PlanModal existing={editing._id ? editing : null} appType={appType} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function PlanModal({ existing, appType, onClose, onSaved }) {
  const isNew = !existing;
  const [f, setF] = useState({
    key: existing?.key || "", name: existing?.name || "", description: existing?.description || "",
    monthlyPrice: existing?.monthlyPrice ?? 0, yearlyPrice: existing?.yearlyPrice ?? 0,
    maxOutlets: existing?.limits.maxOutlets ?? 1, maxStaff: existing?.limits.maxStaff ?? 5,
    isTrial: existing?.isTrial || false, trialDays: existing?.trialDays ?? 14,
    isPublic: existing?.isPublic ?? true, sortOrder: existing?.sortOrder ?? 0,
    features: (existing?.features || []).join("\n"),
    modules: existing?.modules ?? ALL_FEATURES, // old plans without a list start with everything ticked
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const toggleModule = (k) =>
    setF((p) => ({ ...p, modules: p.modules.includes(k) ? p.modules.filter((x) => x !== k) : [...p.modules, k] }));

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const body = {
      name: f.name, description: f.description, monthlyPrice: f.monthlyPrice, yearlyPrice: f.yearlyPrice,
      isTrial: f.isTrial, trialDays: f.trialDays, isPublic: f.isPublic, sortOrder: f.sortOrder,
      features: f.features, modules: f.modules, limits: { maxOutlets: f.maxOutlets, maxStaff: f.maxStaff },
    };
    try {
      if (isNew) await plansApi.createPlan({ ...body, appType, key: f.key });
      else await plansApi.updatePlan(existing._id, body);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't save this plan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <form onSubmit={submit} className="receipt-card relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-sm">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between px-5 pb-3 pt-8 sm:px-6">
          <h2 className="font-display text-xl text-cream">{isNew ? `Add ${appType} plan` : `Edit ${existing.name}`}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-cream">✕</button>
        </div>
        {error && <p role="alert" className="px-5 text-sm text-brick sm:px-6">{error}</p>}
        <div className="flex-1 overflow-y-auto px-5 py-3 sm:px-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className={labelCls}>Name *</label><input value={f.name} onChange={set("name")} required className={inputCls} /></div>
            <div><label className={labelCls}>Key * {!isNew && "(fixed)"}</label>
              <input value={f.key} onChange={set("key")} required disabled={!isNew} placeholder="starter" className={`${inputCls} disabled:opacity-60`} /></div>
            <div><label className={labelCls}>Monthly price (₹)</label><input type="number" min="0" value={f.monthlyPrice} onChange={set("monthlyPrice")} className={inputCls} /></div>
            <div><label className={labelCls}>Yearly price (₹)</label><input type="number" min="0" value={f.yearlyPrice} onChange={set("yearlyPrice")} className={inputCls} /></div>
            <div><label className={labelCls}>Max outlets</label><input type="number" min="1" value={f.maxOutlets} onChange={set("maxOutlets")} className={inputCls} /></div>
            <div><label className={labelCls}>Max staff</label><input type="number" min="1" value={f.maxStaff} onChange={set("maxStaff")} className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Description</label><input value={f.description} onChange={set("description")} className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Features shown on pricing page (one per line)</label><textarea rows={4} value={f.features} onChange={set("features")} className={inputCls} /></div>

            <div className="sm:col-span-2">
              <p className={labelCls}>Unlocked modules (what this plan can actually use)</p>
              <div className="flex flex-wrap gap-2">
                {ALL_FEATURES.map((k) => {
                  const on = f.modules.includes(k);
                  return (
                    <label key={k} className={`cursor-pointer rounded-sm border px-2.5 py-1 text-xs ${on ? "border-saffron text-saffron" : "border-charcoal-lighter text-muted"}`}>
                      <input type="checkbox" className="sr-only" checked={on} onChange={() => toggleModule(k)} />
                      {FEATURES[k]}
                    </label>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-muted">Unticked modules show a lock and an upgrade prompt to this plan's customers.</p>
            </div>

            <label className="flex items-center gap-2 text-sm text-cream"><input type="checkbox" checked={f.isTrial} onChange={set("isTrial")} className="accent-saffron" />New signups start on this plan (trial)</label>
            {f.isTrial && <div><label className={labelCls}>Trial length (days)</label><input type="number" min="0" value={f.trialDays} onChange={set("trialDays")} className={inputCls} /></div>}
            <label className="flex items-center gap-2 text-sm text-cream"><input type="checkbox" checked={f.isPublic} onChange={set("isPublic")} className="accent-saffron" />Show on public pricing</label>
            <div><label className={labelCls}>Sort order</label><input type="number" value={f.sortOrder} onChange={set("sortOrder")} className={inputCls} /></div>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-charcoal-lighter px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
          <button disabled={saving} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">{saving ? "Saving…" : isNew ? "Create plan" : "Save changes"}</button>
        </div>
      </form>
    </div>
  );
}