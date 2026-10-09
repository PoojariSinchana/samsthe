import { useCallback, useEffect, useState } from "react";
import * as projApi from "../api/adminProjectsApi";
import { useAdminAuth } from "../context/AdminAuthContext";
import { human } from "../utils/human";

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const labelCls = "mb-1 block text-xs text-muted";
const rupees = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;
const dateStr = (d) => (d ? new Date(d).toLocaleDateString("en-IN") : "—");
const dateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

const STATUS_STYLE = {
  PLANNING: "bg-charcoal-lighter text-muted",
  IN_PROGRESS: "bg-saffron/10 text-saffron",
  ON_HOLD: "bg-brick/10 text-brick",
  COMPLETED: "bg-sage/10 text-sage",
  CANCELLED: "bg-charcoal-lighter text-muted",
};
const PRIORITY_STYLE = { high: "text-brick", medium: "text-saffron", low: "text-muted" };
const isOverdue = (p) => ["PLANNING", "IN_PROGRESS", "ON_HOLD"].includes(p.status) && p.dueDate && new Date(p.dueDate) < new Date();

export default function AdminProjectsSection() {
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission("MANAGE_PROJECTS");

  const [meta, setMeta] = useState(null);
  const [projects, setProjects] = useState([]);
  const [counts, setCounts] = useState({});
  const [overdue, setOverdue] = useState(0);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // {} = new

  useEffect(() => {
    projApi.getMeta().then(setMeta).catch((e) => setError(e.response?.data?.message || "Couldn't load options."));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, limit: 20 };
      if (status) params.status = status;
      if (search) params.search = search;
      const d = await projApi.getProjects(params);
      setProjects(d.projects); setCounts(d.counts); setOverdue(d.overdue); setPages(d.pages); setTotal(d.total);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't load projects.");
    } finally {
      setLoading(false);
    }
  }, [page, status, search]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  async function changeStatus(p, next) {
    try { await projApi.updateProject(p._id, { status: next }); load(); }
    catch (err) { setError(err.response?.data?.message || "Couldn't change the status."); }
  }
  async function remove(p) {
    if (!window.confirm(`Delete "${p.name}"? This can't be undone.`)) return;
    try { await projApi.deleteProject(p._id); load(); }
    catch (err) { setError(err.response?.data?.message || "Couldn't delete the project."); }
  }

  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Projects</h1>
          <p className="mt-1 text-sm text-muted">Client work and internal builds, from kickoff to delivery.</p>
        </div>
        {canManage && (
          <button onClick={() => setEditing({})} disabled={!meta}
            className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">New project</button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total" value={totalAll} />
        <Stat label="In progress" value={counts.IN_PROGRESS || 0} accent="text-saffron" />
        <Stat label="Completed" value={counts.COMPLETED || 0} accent="text-sage" />
        <Stat label="Overdue" value={overdue} accent={overdue ? "text-brick" : "text-cream"} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Chip active={status === ""} onClick={() => { setStatus(""); setPage(1); }} label="All" count={totalAll} />
        {meta?.statuses.map((s) => <Chip key={s} active={status === s} onClick={() => { setStatus(s); setPage(1); }} label={human(s)} count={counts[s] || 0} />)}
      </div>

      <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        placeholder="Search project or client" aria-label="Search projects" className={`${inputCls} max-w-md`} />

      {error && <p role="alert" className="text-sm text-brick">{error}</p>}

      <div className="receipt-card relative overflow-x-auto rounded-sm">
        <span className="receipt-notch left-6" />
        {loading ? <p className="p-8 text-center text-sm text-muted">Loading…</p>
        : projects.length === 0 ? <p className="p-8 text-center text-sm text-muted">{search || status ? "No projects match these filters." : "No projects yet. Create your first one."}</p>
        : (
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-charcoal-lighter text-xs text-muted">
                {["Project", "Client", "Manager", "Status", "Progress", "Due"].map((h) => <th key={h} className="px-5 pb-3 pt-7 font-medium">{h}</th>)}
                {canManage && <th className="px-5 pb-3 pt-7"></th>}
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p._id} className="border-b border-charcoal-lighter last:border-0 hover:bg-charcoal">
                  <td className="px-5 py-3 text-cream">{p.name}
                    <p className={`text-xs capitalize ${PRIORITY_STYLE[p.priority]}`}>{p.priority} priority{p.budget ? ` · ${rupees(p.budget)}` : ""}</p></td>
                  <td className="px-5 py-3 text-muted">{p.businessId?.name || "Internal"}</td>
                  <td className="px-5 py-3 text-muted">{p.manager?.name || "Unassigned"}
                    {p.members?.length > 0 && <p className="text-xs">+{p.members.length} member{p.members.length > 1 ? "s" : ""}</p>}</td>
                  <td className="px-5 py-3">
                    {canManage ? (
                      <select value={p.status} onChange={(e) => changeStatus(p, e.target.value)} aria-label={`Status for ${p.name}`}
                        className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium outline-none ${STATUS_STYLE[p.status]} bg-charcoal-light`}>
                        {meta?.statuses.map((s) => <option key={s} value={s}>{human(s)}</option>)}
                      </select>
                    ) : <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[p.status]}`}>{human(p.status)}</span>}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-charcoal-lighter"><div className="h-full rounded-full bg-saffron" style={{ width: `${p.progress}%` }} /></div>
                      <span className="text-xs text-muted">{p.progress}%</span>
                    </div>
                    {p.milestones?.length > 0 && <p className="mt-0.5 text-xs text-muted">{p.milestones.filter((m) => m.done).length}/{p.milestones.length} milestones</p>}
                  </td>
                  <td className="px-5 py-3 text-muted">{dateStr(p.dueDate)}
                    {isOverdue(p) && <p className="text-xs text-brick">Overdue</p>}</td>
                  {canManage && (
                    <td className="whitespace-nowrap px-5 py-3 text-right text-xs">
                      <button onClick={() => setEditing(p)} className="text-saffron hover:underline">Edit</button>
                      <span className="mx-2 text-charcoal-lighter">·</span>
                      <button onClick={() => remove(p)} className="text-brick hover:underline">Delete</button>
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
          <span>Page {page} of {pages} · {total} projects</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-sm border border-charcoal-lighter px-3 py-1.5 hover:text-cream disabled:opacity-40">Previous</button>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="rounded-sm border border-charcoal-lighter px-3 py-1.5 hover:text-cream disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {editing && meta && (
        <ProjectModal existing={editing._id ? editing : null} meta={meta}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
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

function Chip({ active, onClick, label, count }) {
  return (
    <button onClick={onClick} className={`whitespace-nowrap rounded-sm border px-3 py-1.5 text-sm ${active ? "border-saffron text-saffron" : "border-charcoal-lighter text-muted hover:text-cream"}`}>
      {label}<span className="ml-1.5 text-xs text-muted">{count}</span>
    </button>
  );
}

function ProjectModal({ existing, meta, onClose, onSaved }) {
  const [f, setF] = useState({
    name: existing?.name || "",
    description: existing?.description || "",
    businessId: existing?.businessId?._id || "",
    status: existing?.status || "PLANNING",
    priority: existing?.priority || "medium",
    manager: existing?.manager?._id || "",
    members: (existing?.members || []).map((m) => m._id),
    startDate: dateInput(existing?.startDate),
    dueDate: dateInput(existing?.dueDate),
    budget: existing?.budget ?? 0,
    progress: existing?.progress ?? 0,
    notes: existing?.notes || "",
  });
  const [milestones, setMilestones] = useState(
    (existing?.milestones || []).map((m) => ({ _id: m._id, title: m.title, dueDate: dateInput(m.dueDate), done: m.done }))
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const toggleMember = (id) => setF((p) => ({ ...p, members: p.members.includes(id) ? p.members.filter((x) => x !== id) : [...p.members, id] }));
  const setMs = (i, patch) => setMilestones((ms) => ms.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const hasMilestones = milestones.some((m) => m.title.trim());

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const body = { ...f, milestones };
      if (existing) await projApi.updateProject(existing._id, body);
      else await projApi.createProject(body);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't save this project.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <form onSubmit={submit} className="receipt-card relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-sm">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between px-5 pb-3 pt-8 sm:px-6">
          <h2 className="font-display text-xl text-cream">{existing ? "Edit project" : "New project"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-cream">✕</button>
        </div>
        {error && <p role="alert" className="px-5 text-sm text-brick sm:px-6">{error}</p>}

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-3 sm:px-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className={labelCls}>Project name *</label>
              <input value={f.name} onChange={set("name")} required autoFocus className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Description</label>
              <textarea rows={2} value={f.description} onChange={set("description")} className={inputCls} /></div>
            <div><label className={labelCls}>Client</label>
              <select value={f.businessId} onChange={set("businessId")} className={inputCls}>
                <option value="">Internal (no client)</option>
                {meta.clients.map((c) => <option key={c._id} value={c._id}>{c.name}{c.appType ? ` (${human(c.appType)})` : ""}</option>)}
              </select></div>
            <div><label className={labelCls}>Project manager</label>
              <select value={f.manager} onChange={set("manager")} className={inputCls}>
                <option value="">Unassigned</option>
                {meta.admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select></div>
            <div><label className={labelCls}>Status</label>
              <select value={f.status} onChange={set("status")} className={inputCls}>
                {meta.statuses.map((s) => <option key={s} value={s}>{human(s)}</option>)}</select></div>
            <div><label className={labelCls}>Priority</label>
              <select value={f.priority} onChange={set("priority")} className={inputCls}>
                {meta.priorities.map((s) => <option key={s} value={s}>{human(s)}</option>)}</select></div>
            <div><label className={labelCls}>Start date</label><input type="date" value={f.startDate} onChange={set("startDate")} className={inputCls} /></div>
            <div><label className={labelCls}>Due date</label><input type="date" value={f.dueDate} onChange={set("dueDate")} className={inputCls} /></div>
            <div><label className={labelCls}>Budget (₹)</label><input type="number" min="0" value={f.budget} onChange={set("budget")} className={inputCls} /></div>
            <div><label className={labelCls}>Progress (%)</label>
              <input type="number" min="0" max="100" value={hasMilestones ? "" : f.progress} placeholder={hasMilestones ? "Auto from milestones" : ""}
                disabled={hasMilestones} onChange={set("progress")} className={`${inputCls} disabled:opacity-60`} /></div>
          </div>

          <div>
            <p className={labelCls}>Team members</p>
            <div className="flex flex-wrap gap-2">
              {meta.admins.map((a) => {
                const on = f.members.includes(a.id);
                return (
                  <label key={a.id} className={`cursor-pointer rounded-sm border px-2.5 py-1 text-xs ${on ? "border-saffron text-saffron" : "border-charcoal-lighter text-muted"}`}>
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => toggleMember(a.id)} />{a.name}
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <p className={labelCls}>Milestones</p>
            <div className="space-y-2">
              {milestones.map((m, i) => (
                <div key={i} className="grid grid-cols-[20px_1fr_140px_24px] items-center gap-2">
                  <input type="checkbox" checked={m.done} onChange={(e) => setMs(i, { done: e.target.checked })} aria-label="Done" className="accent-saffron" />
                  <input value={m.title} onChange={(e) => setMs(i, { title: e.target.value })} placeholder="Milestone" className={inputCls} />
                  <input type="date" value={m.dueDate} onChange={(e) => setMs(i, { dueDate: e.target.value })} aria-label="Due date" className={inputCls} />
                  <button type="button" onClick={() => setMilestones((ms) => ms.filter((_, x) => x !== i))} aria-label="Remove milestone" className="text-muted hover:text-brick">✕</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setMilestones((ms) => [...ms, { title: "", dueDate: "", done: false }])} className="mt-2 text-sm text-saffron hover:underline">+ Add milestone</button>
          </div>

          <div><label className={labelCls}>Notes</label><textarea rows={2} value={f.notes} onChange={set("notes")} className={inputCls} /></div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-charcoal-lighter px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
          <button disabled={saving} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">
            {saving ? "Saving…" : existing ? "Save changes" : "Create project"}
          </button>
        </div>
      </form>
    </div>
  );
}