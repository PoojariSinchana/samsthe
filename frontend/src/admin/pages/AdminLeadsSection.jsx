import { useCallback, useEffect, useState } from "react";
import * as leadsApi from "../api/adminLeadsApi";
import { useAdminAuth } from "../context/AdminAuthContext";

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const labelCls = "mb-1 block text-xs text-muted";

const human = (s = "") => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const STATUS_STYLE = {
  NEW: "bg-saffron/10 text-saffron",
  CONTACTED: "bg-saffron/10 text-saffron",
  DEMO_SCHEDULED: "bg-saffron/10 text-saffron",
  PROPOSAL_SENT: "bg-saffron/10 text-saffron",
  NEGOTIATION: "bg-saffron/10 text-saffron",
  CONVERTED: "bg-sage/10 text-sage",
  LOST: "bg-brick/10 text-brick",
};

export default function AdminLeadsSection() {
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission("MANAGE_LEADS");

  const [meta, setMeta] = useState(null);
  const [leads, setLeads] = useState([]);
  const [counts, setCounts] = useState({});
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // {} = new, lead = edit

  useEffect(() => {
    leadsApi.getMeta().then(setMeta).catch((err) => setError(err.response?.data?.message || "Couldn't load lead options."));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, limit: 20 };
      if (status) params.status = status;
      if (search) params.search = search;
      const data = await leadsApi.getLeads(params);
      setLeads(data.leads);
      setCounts(data.counts);
      setPages(data.pages);
      setTotal(data.total);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't load leads.");
    } finally {
      setLoading(false);
    }
  }, [page, status, search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  async function changeStatus(lead, next) {
    try {
      await leadsApi.updateLead(lead._id, { status: next });
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't change the status.");
    }
  }

  async function handleDelete(lead) {
    if (!window.confirm(`Delete the lead "${lead.businessName}"? This can't be undone.`)) return;
    try {
      await leadsApi.deleteLead(lead._id);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't delete the lead.");
    }
  }

  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Leads</h1>
          <p className="mt-1 text-sm text-muted">Businesses you're talking to, from first contact to signing up.</p>
        </div>
        {canManage && (
          <button onClick={() => setEditing({})} disabled={!meta}
            className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">
            Add lead
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <FilterChip active={status === ""} onClick={() => { setStatus(""); setPage(1); }} label="All" count={totalAll} />
        {meta?.statuses.map((s) => (
          <FilterChip key={s} active={status === s} onClick={() => { setStatus(s); setPage(1); }} label={human(s)} count={counts[s] ?? 0} />
        ))}
      </div>

      <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        placeholder="Search business, contact, phone or email" aria-label="Search leads" className={`${inputCls} max-w-md`} />

      {error && <p role="alert" className="text-sm text-brick">{error}</p>}

      <div className="receipt-card relative overflow-x-auto rounded-sm">
        <span className="receipt-notch left-6" />
        {loading ? (
          <p className="p-8 text-center text-sm text-muted">Loading…</p>
        ) : leads.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">
            {search || status ? "No leads match these filters." : canManage ? "No leads yet. Add your first one to start the pipeline." : "No leads yet."}
          </p>
        ) : (
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-charcoal-lighter text-xs text-muted">
                <th className="px-5 pb-3 pt-7 font-medium">Business</th>
                <th className="px-5 pb-3 pt-7 font-medium">Contact</th>
                <th className="px-5 pb-3 pt-7 font-medium">Type / Source</th>
                <th className="px-5 pb-3 pt-7 font-medium">Status</th>
                <th className="px-5 pb-3 pt-7 font-medium">Assigned to</th>
                <th className="px-5 pb-3 pt-7 font-medium">Added</th>
                {canManage && <th className="px-5 pb-3 pt-7"></th>}
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l._id} className="border-b border-charcoal-lighter last:border-0 hover:bg-charcoal">
                  <td className="px-5 py-3 text-cream">{l.businessName}</td>
                  <td className="px-5 py-3 text-cream">{l.contactPerson}
                    <p className="text-xs text-muted">{l.phone}{l.email ? ` · ${l.email}` : ""}</p></td>
                  <td className="px-5 py-3 text-muted">{human(l.businessType)}<p className="text-xs">{human(l.source)}</p></td>
                  <td className="px-5 py-3">
                    {canManage ? (
                      <select value={l.status} onChange={(e) => changeStatus(l, e.target.value)} aria-label={`Status for ${l.businessName}`}
                        className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium outline-none ${STATUS_STYLE[l.status]} bg-charcoal-light`}>
                        {meta?.statuses.map((s) => <option key={s} value={s}>{human(s)}</option>)}
                      </select>
                    ) : (
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[l.status]}`}>{human(l.status)}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted">{l.assignedTo?.name || "Unassigned"}</td>
                  <td className="px-5 py-3 text-muted">{new Date(l.createdAt).toLocaleDateString("en-IN")}</td>
                  {canManage && (
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => setEditing(l)} className="text-xs text-saffron hover:underline">Edit</button>
                      <span className="mx-2 text-charcoal-lighter">·</span>
                      <button onClick={() => handleDelete(l)} className="text-xs text-brick hover:underline">Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>Page {page} of {pages} · {total} leads</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-sm border border-charcoal-lighter px-3 py-1.5 hover:text-cream disabled:opacity-40">Previous</button>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="rounded-sm border border-charcoal-lighter px-3 py-1.5 hover:text-cream disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {editing && meta && (
        <LeadModal existing={editing._id ? editing : null} meta={meta} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

function FilterChip({ active, onClick, label, count }) {
  return (
    <button onClick={onClick}
      className={`whitespace-nowrap rounded-sm border px-3 py-1.5 text-sm ${active ? "border-saffron text-saffron" : "border-charcoal-lighter text-muted hover:text-cream"}`}>
      {label}<span className="ml-1.5 text-xs text-muted">{count}</span>
    </button>
  );
}

function LeadModal({ existing, meta, onClose, onSaved }) {
  const [f, setF] = useState({
    businessName: existing?.businessName || "",
    contactPerson: existing?.contactPerson || "",
    phone: existing?.phone || "",
    email: existing?.email || "",
    businessType: existing?.businessType || "restaurant",
    source: existing?.source || "other",
    status: existing?.status || "NEW",
    assignedTo: existing?.assignedTo?._id || "",
    notes: existing?.notes || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (existing) await leadsApi.updateLead(existing._id, f);
      else await leadsApi.createLead(f);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't save this lead.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <form onSubmit={handleSubmit} className="receipt-card relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-sm">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between px-5 pb-3 pt-8 sm:px-6">
          <h2 className="font-display text-xl text-cream">{existing ? "Edit lead" : "Add lead"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-cream">✕</button>
        </div>
        {error && <p role="alert" className="px-5 text-sm text-brick sm:px-6">{error}</p>}

        <div className="flex-1 overflow-y-auto px-5 py-3 sm:px-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className={labelCls}>Business name *</label>
              <input value={f.businessName} onChange={set("businessName")} required className={inputCls} /></div>
            <div><label className={labelCls}>Contact person *</label>
              <input value={f.contactPerson} onChange={set("contactPerson")} required className={inputCls} /></div>
            <div><label className={labelCls}>Phone *</label>
              <input value={f.phone} onChange={set("phone")} required className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Email</label>
              <input type="email" value={f.email} onChange={set("email")} className={inputCls} /></div>
            <div><label className={labelCls}>Business type</label>
              <select value={f.businessType} onChange={set("businessType")} className={inputCls}>
                {meta.businessTypes.map((t) => <option key={t} value={t}>{human(t)}</option>)}</select></div>
            <div><label className={labelCls}>Source</label>
              <select value={f.source} onChange={set("source")} className={inputCls}>
                {meta.sources.map((s) => <option key={s} value={s}>{human(s)}</option>)}</select></div>
            <div><label className={labelCls}>Status</label>
              <select value={f.status} onChange={set("status")} className={inputCls}>
                {meta.statuses.map((s) => <option key={s} value={s}>{human(s)}</option>)}</select></div>
            <div><label className={labelCls}>Assigned to</label>
              <select value={f.assignedTo} onChange={set("assignedTo")} className={inputCls}>
                <option value="">Unassigned</option>
                {meta.admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            <div className="sm:col-span-2"><label className={labelCls}>Notes</label>
              <textarea rows={3} value={f.notes} onChange={set("notes")} className={inputCls} /></div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-charcoal-lighter px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
          <button disabled={saving} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">
            {saving ? "Saving…" : existing ? "Save changes" : "Add lead"}
          </button>
        </div>
      </form>
    </div>
  );
}