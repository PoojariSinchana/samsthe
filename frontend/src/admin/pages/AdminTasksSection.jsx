import { useCallback, useEffect, useState } from "react";
import * as tasksApi from "../api/adminTasksApi";
import { useAdminAuth } from "../context/AdminAuthContext";
import { human } from "../utils/human";

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const labelCls = "mb-1 block text-xs text-muted";
const PRIORITY = { high: "bg-brick/10 text-brick", medium: "bg-saffron/10 text-saffron", low: "bg-charcoal-lighter text-muted" };
const dueLabel = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const isOverdue = (t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < new Date();
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function AdminTasksSection() {
  const { admin } = useAdminAuth();
  const [meta, setMeta] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [scope, setScope] = useState("");       // "" = all, "mine", "overdue"
  const [status, setStatus] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);

  useEffect(() => { tasksApi.getMeta().then(setMeta).catch((e) => setError(e.response?.data?.message || "Couldn't load options.")); }, []);
  const canManage = !!meta?.canManage;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, limit: 30 };
      if (scope === "mine") params.scope = "mine";
      if (scope === "overdue") params.overdue = "true";
      if (status) params.status = status;
      if (assignedTo) params.assignedTo = assignedTo;
      if (search) params.search = search;
      const d = await tasksApi.getTasks(params);
      setTasks(d.tasks); setSummary(d.summary); setPages(d.pages);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't load tasks.");
    } finally {
      setLoading(false);
    }
  }, [page, scope, status, assignedTo, search]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  async function run(fn, fail) {
    setError("");
    try { await fn(); load(); } catch (err) { setError(err.response?.data?.message || fail); }
  }

  const reset = (setter) => (v) => { setter(v); setPage(1); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Tasks</h1>
          <p className="mt-1 text-sm text-muted">{canManage ? "Plan and assign work for your team." : "Tasks assigned to you."}</p>
        </div>
        {canManage && <button onClick={() => setModal({})} disabled={!meta} className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">New task</button>}
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Open" value={summary.open} accent="text-saffron" />
          <Stat label="Overdue" value={summary.overdue} accent={summary.overdue ? "text-brick" : "text-sage"} />
          <Stat label="Due today" value={summary.dueToday} accent="text-saffron" />
          <Stat label="Completed" value={summary.done} accent="text-sage" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {[["", canManage ? "All tasks" : "My tasks"], ...(canManage ? [["mine", "Assigned to me"]] : []), ["overdue", "Overdue"]].map(([k, l]) => (
          <button key={k} onClick={() => reset(setScope)(k)}
            className={`rounded-sm border px-3 py-1.5 text-sm ${scope === k ? "border-saffron text-saffron" : "border-charcoal-lighter text-muted hover:text-cream"}`}>{l}</button>
        ))}
        <select value={status} onChange={(e) => reset(setStatus)(e.target.value)} aria-label="Filter by status" className={`${inputCls} w-auto`}>
          <option value="">Any status</option>
          {meta?.statuses.map((s) => <option key={s} value={s}>{human(s)}</option>)}
        </select>
        {canManage && (
          <select value={assignedTo} onChange={(e) => reset(setAssignedTo)(e.target.value)} aria-label="Filter by assignee" className={`${inputCls} w-auto`}>
            <option value="">Anyone</option>
            {meta?.admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
        <input value={search} onChange={(e) => reset(setSearch)(e.target.value)} placeholder="Search tasks" aria-label="Search tasks" className={`${inputCls} max-w-xs`} />
      </div>

      {error && <p role="alert" className="text-sm text-brick">{error}</p>}

      <div className="space-y-3">
        {loading ? <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">Loading…</div>
        : tasks.length === 0 ? <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">No tasks here.</div>
        : tasks.map((t) => {
          const done = t.status === "done";
          const mine = t.assignedTo?._id === admin.id;
          const canChangeStatus = canManage || mine;
          return (
            <div key={t._id} className="receipt-card relative rounded-sm px-4 pb-4 pt-6 sm:px-5">
              <span className="receipt-notch left-6" />
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={done} disabled={!canChangeStatus} aria-label={`Mark "${t.title}" ${done ? "not done" : "done"}`}
                  onChange={() => run(() => tasksApi.updateTask(t._id, { status: done ? "todo" : "done" }), "Couldn't update the task.")}
                  className="mt-1 h-4 w-4 accent-saffron" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`font-medium ${done ? "text-muted line-through" : "text-cream"}`}>{t.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${PRIORITY[t.priority]}`}>{t.priority}</span>
                    {isOverdue(t) && <span className="rounded-full bg-brick/10 px-2 py-0.5 text-xs text-brick">Overdue</span>}
                    {t.businessId && <span className="rounded-full bg-charcoal-lighter px-2 py-0.5 text-xs text-muted">{t.businessId.name}</span>}
                  </div>
                  {t.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{t.description}</p>}
                  <p className="mt-2 text-xs text-muted">
                    {t.dueDate ? `Due ${dueLabel(t.dueDate)}` : "No due date"} · {t.assignedTo?.name || "Unassigned"}
                    {t.createdBy && t.createdBy._id !== t.assignedTo?._id ? ` · by ${t.createdBy.name}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <select value={t.status} disabled={!canChangeStatus} aria-label="Status"
                    onChange={(e) => run(() => tasksApi.updateTask(t._id, { status: e.target.value }), "Couldn't update the task.")}
                    className="rounded-sm border border-charcoal-lighter bg-charcoal-light px-2 py-1 text-xs text-cream outline-none focus:border-saffron disabled:opacity-60">
                    {meta?.statuses.map((s) => <option key={s} value={s}>{human(s)}</option>)}
                  </select>
                  {canManage && (
                    <div className="text-xs">
                      <button onClick={() => setModal(t)} className="text-saffron hover:underline">Edit</button>
                      <span className="mx-2 text-charcoal-lighter">·</span>
                      <button onClick={() => window.confirm(`Delete "${t.title}"?`) && run(() => tasksApi.deleteTask(t._id), "Couldn't delete the task.")} className="text-brick hover:underline">Delete</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>Page {page} of {pages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-sm border border-charcoal-lighter px-3 py-1.5 hover:text-cream disabled:opacity-40">Previous</button>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="rounded-sm border border-charcoal-lighter px-3 py-1.5 hover:text-cream disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {modal && meta && <TaskModal existing={modal._id ? modal : null} meta={meta} me={admin} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="receipt-card relative rounded-sm px-4 pb-4 pt-7">
      <span className="receipt-notch left-6" />
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 font-display text-xl ${accent}`}>{value}</p>
    </div>
  );
}

function TaskModal({ existing, meta, me, onClose, onSaved }) {
  const [f, setF] = useState({
    title: existing?.title || "", description: existing?.description || "",
    priority: existing?.priority || "medium", dueDate: toLocalInput(existing?.dueDate),
    assignedTo: existing?.assignedTo?._id || me.id, businessId: existing?.businessId?._id || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const body = { ...f, dueDate: f.dueDate ? new Date(f.dueDate).toISOString() : null, businessId: f.businessId || null };
    try {
      if (existing) await tasksApi.updateTask(existing._id, body);
      else await tasksApi.createTask(body);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't save the task.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <form onSubmit={submit} className="receipt-card relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-cream">{existing ? "Edit task" : "New task"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-cream">✕</button>
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-brick">{error}</p>}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className={labelCls}>Title *</label><input value={f.title} onChange={set("title")} required autoFocus className={inputCls} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Description</label><textarea rows={3} value={f.description} onChange={set("description")} className={inputCls} /></div>
          <div><label className={labelCls}>Priority</label>
            <select value={f.priority} onChange={set("priority")} className={inputCls}>{meta.priorities.map((p) => <option key={p} value={p}>{human(p)}</option>)}</select></div>
          <div><label className={labelCls}>Assign to</label>
            <select value={f.assignedTo} onChange={set("assignedTo")} className={inputCls}>
              {meta.admins.map((a) => <option key={a.id} value={a.id}>{a.name}{a.id === me.id ? " (me)" : ""} · {a.role}</option>)}</select></div>
          <div><label className={labelCls}>Due date & time</label><input type="datetime-local" value={f.dueDate} onChange={set("dueDate")} className={inputCls} /></div>
          <div><label className={labelCls}>Related client</label>
            <select value={f.businessId} onChange={set("businessId")} className={inputCls}>
              <option value="">None</option>{meta.clients.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
          <button disabled={saving} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">{saving ? "Saving…" : existing ? "Save changes" : "Create task"}</button>
        </div>
      </form>
    </div>
  );
}