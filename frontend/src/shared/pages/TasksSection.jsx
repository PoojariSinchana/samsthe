import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import StatCard from "../components/StatCard";
import * as tasksApi from "../api/tasksApi";

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const labelCls = "mb-1 block text-xs text-muted";
const PRIORITY_STYLE = { high: "bg-brick/10 text-brick", medium: "bg-saffron/10 text-saffron", low: "bg-charcoal-lighter text-muted" };
const STATUS_LABEL = { todo: "To do", in_progress: "In progress", done: "Done" };
const REMIND_OPTIONS = [["", "No reminder"], [0, "At due time"], [15, "15 minutes before"], [60, "1 hour before"], [1440, "1 day before"]];

const isOverdue = (t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < new Date();
const dueLabel = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const BIG = 8.64e15;

export default function TasksSection() {
  const { user } = useAuth();
  const manager = ["owner", "manager"].includes(user.role);
  const [tasks, setTasks] = useState([]);
  const [scope, setScope] = useState(manager ? "all" : "mine");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (scope === "mine") params.scope = "mine";
      if (scope === "overdue") params.overdue = "true";
      if (status) params.status = status;
      if (search) params.search = search;
      setTasks((await tasksApi.getTasks(params)).tasks);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load tasks");
    } finally { setLoading(false); }
  }, [scope, status, search]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  async function run(fn, fail) {
    setError("");
    try { await fn(); load(); } catch (err) { setError(err.response?.data?.message || fail); }
  }

  const sorted = useMemo(() => [...tasks].sort((a, b) =>
    (a.status === "done") - (b.status === "done") ||
    (a.dueDate ? +new Date(a.dueDate) : BIG) - (b.dueDate ? +new Date(b.dueDate) : BIG)), [tasks]);

  const open = tasks.filter((t) => t.status !== "done").length;
  const overdue = tasks.filter(isOverdue).length;
  const today = tasks.filter((t) => t.status !== "done" && t.dueDate && new Date(t.dueDate).toDateString() === new Date().toDateString()).length;
  const done = tasks.filter((t) => t.status === "done").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Tasks</h1>
          <p className="mt-1 text-sm text-muted">Plan, assign and track work. You'll be notified when something is assigned, due or overdue.</p>
        </div>
        <button onClick={() => setModal({})} className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark">New task</button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Open" value={open} accent="saffron" />
        <StatCard label="Overdue" value={overdue} accent={overdue ? "brick" : "sage"} />
        <StatCard label="Due today" value={today} accent="saffron" />
        <StatCard label="Completed" value={done} accent="sage" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[...(manager ? [["all", "All tasks"]] : []), ["mine", "Assigned to me"], ["overdue", "Overdue"]].map(([k, l]) => (
          <button key={k} onClick={() => setScope(k)}
            className={`rounded-sm border px-3 py-1.5 text-sm ${scope === k ? "border-saffron text-saffron" : "border-charcoal-lighter text-muted hover:text-cream"}`}>{l}</button>
        ))}
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" className={`${inputCls} w-auto`}>
          <option value="">Any status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks" aria-label="Search tasks" className={`${inputCls} max-w-xs`} />
      </div>

      {error && <p role="alert" className="text-sm text-brick">{error}</p>}

      <div className="space-y-3">
        {loading ? <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">Loading…</div>
        : sorted.length === 0 ? <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">No tasks here. Create one with New task.</div>
        : sorted.map((t) => {
          const canEdit = manager || t.createdBy?._id === user.id;
          const done = t.status === "done";
          return (
            <div key={t._id} className="receipt-card relative rounded-sm px-4 pb-4 pt-6 sm:px-5">
              <span className="receipt-notch left-6" />
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={done} aria-label={`Mark "${t.title}" ${done ? "not done" : "done"}`}
                  onChange={() => run(() => tasksApi.updateTask(t._id, { status: done ? "todo" : "done" }), "Couldn't update the task")}
                  className="mt-1 h-4 w-4 accent-saffron" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`font-medium ${done ? "text-muted line-through" : "text-cream"}`}>{t.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${PRIORITY_STYLE[t.priority]}`}>{t.priority}</span>
                    {isOverdue(t) && <span className="rounded-full bg-brick/10 px-2 py-0.5 text-xs text-brick">Overdue</span>}
                  </div>
                  {t.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{t.description}</p>}
                  <p className="mt-2 text-xs text-muted">
                    {t.dueDate ? `Due ${dueLabel(t.dueDate)}` : "No due date"} · {t.assignedTo?.name || "Unassigned"}
                    {t.createdBy && t.createdBy._id !== t.assignedTo?._id ? ` · by ${t.createdBy.name}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <select value={t.status} aria-label="Status"
                    onChange={(e) => run(() => tasksApi.updateTask(t._id, { status: e.target.value }), "Couldn't update the task")}
                    className="rounded-sm border border-charcoal-lighter bg-charcoal-light px-2 py-1 text-xs text-cream outline-none focus:border-saffron">
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  {canEdit && (
                    <div className="text-xs">
                      <button onClick={() => setModal(t)} className="text-saffron hover:underline">Edit</button>
                      <span className="mx-2 text-charcoal-lighter">·</span>
                      <button onClick={() => window.confirm(`Delete "${t.title}"?`) && run(() => tasksApi.deleteTask(t._id), "Couldn't delete the task")} className="text-brick hover:underline">Delete</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modal && <TaskModal existing={modal._id ? modal : null} manager={manager} me={user} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

function TaskModal({ existing, manager, me, onClose, onSaved }) {
  const [users, setUsers] = useState([]);
  const [f, setF] = useState({
    title: existing?.title || "", description: existing?.description || "",
    priority: existing?.priority || "medium", dueDate: toLocalInput(existing?.dueDate),
    remindBeforeMinutes: existing ? (existing.remindBeforeMinutes ?? "") : 60,
    assignedTo: existing?.assignedTo?._id || me.id,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => { tasksApi.getAssignees().then((d) => setUsers(d.users)).catch(() => {}); }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const body = {
      title: f.title, description: f.description, priority: f.priority,
      dueDate: f.dueDate ? new Date(f.dueDate).toISOString() : null,
      remindBeforeMinutes: f.dueDate ? f.remindBeforeMinutes : "",
      assignedTo: f.assignedTo,
    };
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
            <select value={f.priority} onChange={set("priority")} className={inputCls}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
          <div><label className={labelCls}>Assign to</label>
            <select value={f.assignedTo} onChange={set("assignedTo")} disabled={!manager} className={`${inputCls} disabled:opacity-60`}>
              {users.length === 0 && <option value={me.id}>Me</option>}
              {users.map((u) => <option key={u._id} value={u._id}>{u.name}{u._id === me.id ? " (me)" : ""} · {u.role}</option>)}
            </select></div>
          <div><label className={labelCls}>Due date & time</label><input type="datetime-local" value={f.dueDate} onChange={set("dueDate")} className={inputCls} /></div>
          <div><label className={labelCls}>Remind</label>
            <select value={f.remindBeforeMinutes} onChange={set("remindBeforeMinutes")} disabled={!f.dueDate} className={`${inputCls} disabled:opacity-60`}>
              {REMIND_OPTIONS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}</select></div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
          <button disabled={saving} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">{saving ? "Saving…" : existing ? "Save changes" : "Create task"}</button>
        </div>
      </form>
    </div>
  );
}