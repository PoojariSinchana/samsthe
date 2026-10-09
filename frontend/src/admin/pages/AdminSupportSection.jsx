import { useCallback, useEffect, useState } from "react";
import * as supApi from "../api/adminSupportApi";
import { useAdminAuth } from "../context/AdminAuthContext";
import { human } from "../utils/human";

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const labelCls = "mb-1 block text-xs text-muted";
const dateTime = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—");

const STATUS_STYLE = {
  OPEN: "bg-brick/10 text-brick",
  IN_PROGRESS: "bg-saffron/10 text-saffron",
  WAITING_CLIENT: "bg-charcoal-lighter text-muted",
  RESOLVED: "bg-sage/10 text-sage",
  CLOSED: "bg-charcoal-lighter text-muted",
};
const PRIORITY_STYLE = { urgent: "bg-brick/10 text-brick", high: "bg-saffron/10 text-saffron", medium: "bg-charcoal-lighter text-cream", low: "bg-charcoal-lighter text-muted" };

function age(d) {
  const h = Math.floor((Date.now() - new Date(d)) / 36e5);
  return h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

export default function AdminSupportSection() {
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission("MANAGE_SUPPORT");

  const [meta, setMeta] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [counts, setCounts] = useState({});
  const [unassigned, setUnassigned] = useState(0);
  const [urgent, setUrgent] = useState(0);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [assignee, setAssignee] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    supApi.getMeta().then(setMeta).catch((e) => setError(e.response?.data?.message || "Couldn't load options."));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, limit: 20 };
      if (status) params.status = status;
      if (priority) params.priority = priority;
      if (assignee) params.assignedTo = assignee;
      if (search) params.search = search;
      const d = await supApi.getTickets(params);
      setTickets(d.tickets); setCounts(d.counts); setUnassigned(d.unassigned); setUrgent(d.urgent); setPages(d.pages); setTotal(d.total);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't load tickets.");
    } finally {
      setLoading(false);
    }
  }, [page, status, priority, assignee, search]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  async function changeStatus(t, next) {
    try { await supApi.updateTicket(t._id, { status: next }); load(); }
    catch (err) { setError(err.response?.data?.message || "Couldn't change the status."); }
  }
  async function remove(t) {
    if (!window.confirm(`Delete ${t.ticketNumber}? This can't be undone.`)) return;
    try { await supApi.deleteTicket(t._id); load(); }
    catch (err) { setError(err.response?.data?.message || "Couldn't delete the ticket."); }
  }

  const openCount = (counts.OPEN || 0) + (counts.IN_PROGRESS || 0) + (counts.WAITING_CLIENT || 0);
  const reset = (setter) => (e) => { setter(e.target.value); setPage(1); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Support</h1>
          <p className="mt-1 text-sm text-muted">Client issues and questions, tracked until they're resolved.</p>
        </div>
        {canManage && (
          <button onClick={() => setCreating(true)} disabled={!meta}
            className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">New ticket</button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Open tickets" value={openCount} accent="text-saffron" />
        <Stat label="Unassigned" value={unassigned} accent={unassigned ? "text-brick" : "text-cream"} />
        <Stat label="Urgent" value={urgent} accent={urgent ? "text-brick" : "text-cream"} />
        <Stat label="Resolved" value={(counts.RESOLVED || 0) + (counts.CLOSED || 0)} accent="text-sage" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Chip active={status === ""} onClick={() => { setStatus(""); setPage(1); }} label="All" />
        {meta?.statuses.map((s) => <Chip key={s} active={status === s} onClick={() => { setStatus(s); setPage(1); }} label={human(s)} count={counts[s] || 0} />)}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input value={search} onChange={reset(setSearch)} placeholder="Search ticket, subject or client" aria-label="Search tickets" className={`${inputCls} max-w-xs`} />
        <select value={priority} onChange={reset(setPriority)} aria-label="Filter by priority" className={`${inputCls} w-auto`}>
          <option value="">Any priority</option>{meta?.priorities.map((p) => <option key={p} value={p}>{human(p)}</option>)}
        </select>
        <select value={assignee} onChange={reset(setAssignee)} aria-label="Filter by assignee" className={`${inputCls} w-auto`}>
          <option value="">Anyone</option><option value="none">Unassigned</option>
          {meta?.admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {error && <p role="alert" className="text-sm text-brick">{error}</p>}

      <div className="receipt-card relative overflow-x-auto rounded-sm">
        <span className="receipt-notch left-6" />
        {loading ? <p className="p-8 text-center text-sm text-muted">Loading…</p>
        : tickets.length === 0 ? <p className="p-8 text-center text-sm text-muted">{search || status || priority || assignee ? "No tickets match these filters." : "No tickets yet. Log the first one with New ticket."}</p>
        : (
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-charcoal-lighter text-xs text-muted">
                {["Ticket", "Client", "Priority", "Status", "Assigned to", "Updated"].map((h) => <th key={h} className="px-5 pb-3 pt-7 font-medium">{h}</th>)}
                <th className="px-5 pb-3 pt-7"></th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t._id} className="border-b border-charcoal-lighter last:border-0 hover:bg-charcoal">
                  <td className="px-5 py-3 text-cream">
                    <button onClick={() => setOpenId(t._id)} className="text-left hover:text-saffron">{t.subject}</button>
                    <p className="text-xs text-muted">{t.ticketNumber} · {human(t.category)}{t.source === "client" ? " · via app" : ""}{t.replyCount ? ` · ${t.replyCount} repl${t.replyCount > 1 ? "ies" : "y"}` : ""}</p></td>
                  <td className="px-5 py-3 text-muted">{t.client?.name || t.contactName || "—"}
                    {t.client?.appType && <p className="text-xs">{human(t.client.appType)}</p>}</td>
                  <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_STYLE[t.priority]}`}>{human(t.priority)}</span></td>
                  <td className="px-5 py-3">
                    {canManage ? (
                      <select value={t.status} onChange={(e) => changeStatus(t, e.target.value)} aria-label={`Status for ${t.ticketNumber}`}
                        className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium outline-none ${STATUS_STYLE[t.status]} bg-charcoal-light`}>
                        {meta?.statuses.map((s) => <option key={s} value={s}>{human(s)}</option>)}
                      </select>
                    ) : <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[t.status]}`}>{human(t.status)}</span>}
                  </td>
                  <td className={`px-5 py-3 ${t.assignedTo ? "text-muted" : "text-brick"}`}>{t.assignedTo?.name || "Unassigned"}</td>
                  <td className="px-5 py-3 text-muted">{age(t.updatedAt)}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right text-xs">
                    <button onClick={() => setOpenId(t._id)} className="text-saffron hover:underline">Open</button>
                    {canManage && <><span className="mx-2 text-charcoal-lighter">·</span><button onClick={() => remove(t)} className="text-brick hover:underline">Delete</button></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>Page {page} of {pages} · {total} tickets</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-sm border border-charcoal-lighter px-3 py-1.5 hover:text-cream disabled:opacity-40">Previous</button>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="rounded-sm border border-charcoal-lighter px-3 py-1.5 hover:text-cream disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {creating && meta && <NewTicketModal meta={meta} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
      {openId && meta && <TicketDetail id={openId} meta={meta} canManage={canManage} onClose={() => setOpenId(null)} onChanged={load} />}
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
      {label}{count !== undefined && <span className="ml-1.5 text-xs text-muted">{count}</span>}
    </button>
  );
}

function NewTicketModal({ meta, onClose, onSaved }) {
  const [f, setF] = useState({ subject: "", description: "", businessId: "", contactName: "", contactPhone: "", category: "other", priority: "medium", assignedTo: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try { await supApi.createTicket(f); onSaved(); }
    catch (err) { setError(err.response?.data?.message || "Couldn't create the ticket."); setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <form onSubmit={submit} className="receipt-card relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-sm">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between px-5 pb-3 pt-8 sm:px-6">
          <h2 className="font-display text-xl text-cream">New ticket</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-cream">✕</button>
        </div>
        {error && <p role="alert" className="px-5 text-sm text-brick sm:px-6">{error}</p>}
        <div className="flex-1 overflow-y-auto px-5 py-3 sm:px-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className={labelCls}>Subject *</label><input value={f.subject} onChange={set("subject")} required autoFocus className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Details</label><textarea rows={3} value={f.description} onChange={set("description")} className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Client</label>
              <select value={f.businessId} onChange={set("businessId")} className={inputCls}>
                <option value="">Not a registered client</option>
                {meta.clients.map((c) => <option key={c._id} value={c._id}>{c.name}{c.appType ? ` (${human(c.appType)})` : ""}</option>)}
              </select></div>
            {!f.businessId && <>
              <div><label className={labelCls}>Contact name</label><input value={f.contactName} onChange={set("contactName")} className={inputCls} /></div>
              <div><label className={labelCls}>Contact phone</label><input value={f.contactPhone} onChange={set("contactPhone")} className={inputCls} /></div>
            </>}
            <div><label className={labelCls}>Category</label>
              <select value={f.category} onChange={set("category")} className={inputCls}>{meta.categories.map((c) => <option key={c} value={c}>{human(c)}</option>)}</select></div>
            <div><label className={labelCls}>Priority</label>
              <select value={f.priority} onChange={set("priority")} className={inputCls}>{meta.priorities.map((p) => <option key={p} value={p}>{human(p)}</option>)}</select></div>
            <div className="sm:col-span-2"><label className={labelCls}>Assign to</label>
              <select value={f.assignedTo} onChange={set("assignedTo")} className={inputCls}>
                <option value="">Unassigned</option>{meta.admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select></div>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-charcoal-lighter px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
          <button disabled={saving} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">{saving ? "Saving…" : "Create ticket"}</button>
        </div>
      </form>
    </div>
  );
}

function TicketDetail({ id, meta, canManage, onClose, onChanged }) {
  const [t, setT] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supApi.getTicket(id).then((d) => setT(d.ticket)).catch((e) => setError(e.response?.data?.message || "Couldn't load this ticket."));
  }, [id]);

  async function patch(body) {
    setError("");
    try { const d = await supApi.updateTicket(id, body); setT(d.ticket); onChanged(); }
    catch (err) { setError(err.response?.data?.message || "Couldn't update the ticket."); }
  }

  async function send(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setError("");
    setSending(true);
    try {
      const d = await supApi.addReply(id, { message, internal });
      setT(d.ticket); setMessage(""); setInternal(false); onChanged();
    } catch (err) { setError(err.response?.data?.message || "Couldn't send the reply."); }
    finally { setSending(false); }
  }

  const client = t?.businessId;
  const closed = t && ["RESOLVED", "CLOSED"].includes(t.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="receipt-card relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-sm">
        <span className="receipt-notch left-6" />
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-8 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs text-muted">{t?.ticketNumber}</p>
            <h2 className="font-display text-xl text-cream">{t?.subject || "Ticket"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-cream">✕</button>
        </div>
        {error && <p role="alert" className="px-5 text-sm text-brick sm:px-6">{error}</p>}

        {!t ? !error && <p className="p-8 text-center text-sm text-muted">Loading…</p> : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-4 sm:px-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div><label className={labelCls}>Status</label>
                  <select value={t.status} disabled={!canManage} onChange={(e) => patch({ status: e.target.value })} className={inputCls}>
                    {meta.statuses.map((s) => <option key={s} value={s}>{human(s)}</option>)}</select></div>
                <div><label className={labelCls}>Priority</label>
                  <select value={t.priority} disabled={!canManage} onChange={(e) => patch({ priority: e.target.value })} className={inputCls}>
                    {meta.priorities.map((s) => <option key={s} value={s}>{human(s)}</option>)}</select></div>
                <div><label className={labelCls}>Category</label>
                  <select value={t.category} disabled={!canManage} onChange={(e) => patch({ category: e.target.value })} className={inputCls}>
                    {meta.categories.map((s) => <option key={s} value={s}>{human(s)}</option>)}</select></div>
                <div><label className={labelCls}>Assigned to</label>
                  <select value={t.assignedTo?._id || ""} disabled={!canManage} onChange={(e) => patch({ assignedTo: e.target.value })} className={inputCls}>
                    <option value="">Unassigned</option>{meta.admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
              </div>

              <div className="rounded-sm border border-charcoal-lighter p-3 text-sm">
                <p className="text-cream">{client?.name || t.contactName || "Unknown requester"}
                  {client?.appType && <span className="ml-2 text-xs text-muted">{human(client.appType)}</span>}</p>
                <p className="text-xs text-muted">{[client?.phone || t.contactPhone, client?.email].filter(Boolean).join(" · ") || "No contact details"}</p>
                <p className="mt-1 text-xs text-muted">Opened {dateTime(t.createdAt)}{t.resolvedAt ? ` · Resolved ${dateTime(t.resolvedAt)}` : ""}</p>
                {t.description && <p className="mt-3 whitespace-pre-wrap text-cream">{t.description}</p>}
              </div>

              <div>
                <p className={labelCls}>Conversation ({t.replies.length})</p>
                {t.replies.length === 0 ? <p className="text-sm text-muted">No replies yet.</p> : (
                  <ul className="space-y-2">
                    {t.replies.map((r) => (
                      <li key={r._id} className={`rounded-sm border p-3 text-sm ${r.internal ? "border-saffron/40 bg-saffron/5" : "border-charcoal-lighter"}`}>
                        <div className="flex items-center justify-between gap-2 text-xs text-muted">
                         <span className="text-cream">{r.author?.name || r.authorName || "Former team member"}</span>
                        <span>
                        {r.fromClient && <span className="mr-2 rounded-full bg-sage/15 px-2 py-0.5 text-sage">Client</span>}
                        {r.internal && <span className="mr-2 rounded-full bg-saffron/15 px-2 py-0.5 text-saffron">Internal note</span>}
                        {dateTime(r.createdAt)}
                        </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-cream">{r.message}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {canManage && (
              <form onSubmit={send} className="border-t border-charcoal-lighter px-5 py-4 sm:px-6">
                <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={internal ? "Add an internal note (only your team sees this)" : "Write a reply"} className={inputCls} />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm text-cream">
                    <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="accent-saffron" />Internal note
                  </label>
                  <div className="flex gap-2">
                    {!closed && <button type="button" onClick={() => patch({ status: "RESOLVED" })} className="rounded-sm border border-sage px-3 py-2 text-sm text-sage hover:bg-sage hover:text-charcoal">Mark resolved</button>}
                    <button disabled={sending || !message.trim()} className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">{sending ? "Sending…" : internal ? "Add note" : "Send reply"}</button>
                  </div>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}