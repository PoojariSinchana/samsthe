import { useCallback, useEffect, useState } from "react";
import * as supportApi from "../api/supportApi";

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const labelCls = "mb-1 block text-xs text-muted";
const human = (s = "") => String(s).replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const dateTime = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const STATUS_LABEL = { OPEN: "Open", IN_PROGRESS: "In progress", WAITING_CLIENT: "Waiting for you", RESOLVED: "Resolved", CLOSED: "Closed" };
const STATUS_STYLE = {
  OPEN: "bg-saffron/10 text-saffron", IN_PROGRESS: "bg-saffron/10 text-saffron", WAITING_CLIENT: "bg-brick/10 text-brick",
  RESOLVED: "bg-sage/10 text-sage", CLOSED: "bg-charcoal-lighter text-muted",
};

export default function SupportSection() {
  const [tickets, setTickets] = useState([]);
  const [canSeeAll, setCanSeeAll] = useState(false);
  const [filter, setFilter] = useState("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const d = await supportApi.getTickets();
      setTickets(d.tickets); setCanSeeAll(d.canSeeAll);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't load your tickets.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Open the ticket when arriving from a notification
  const isOpenStatus = (t) => !["RESOLVED", "CLOSED"].includes(t.status);
  const visible = tickets.filter((t) => (filter === "all" ? true : filter === "open" ? isOpenStatus(t) : !isOpenStatus(t)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Help & Support</h1>
          <p className="mt-1 text-sm text-muted">Having trouble or a question? Send us a ticket and we'll reply here.</p>
        </div>
        <button onClick={() => setCreating(true)} className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark">New ticket</button>
      </div>

      <div className="flex gap-2">
        {[["open", "Open"], ["resolved", "Resolved"], ["all", "All"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`rounded-sm border px-3 py-1.5 text-sm ${filter === k ? "border-saffron text-saffron" : "border-charcoal-lighter text-muted hover:text-cream"}`}>{l}</button>
        ))}
      </div>
      {canSeeAll && <p className="text-xs text-muted">Showing tickets raised by everyone in your business.</p>}

      {error && <p role="alert" className="text-sm text-brick">{error}</p>}

      {loading ? <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">Loading…</div>
      : visible.length === 0 ? (
        <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">
          {tickets.length === 0 ? "You haven't raised any tickets yet." : "No tickets in this view."}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((t) => (
            <button key={t._id} onClick={() => setOpenId(t._id)} className="receipt-card relative block w-full rounded-sm px-5 pb-4 pt-7 text-left">
              <span className="receipt-notch left-6" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-cream">{t.subject}</p>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[t.status]}`}>{STATUS_LABEL[t.status]}</span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {t.ticketNumber} · {human(t.category)} · Updated {dateTime(t.updatedAt)}
                {t.replyCount ? ` · ${t.replyCount} repl${t.replyCount > 1 ? "ies" : "y"}` : ""}
              </p>
            </button>
          ))}
        </div>
      )}

      {creating && <NewTicketModal onClose={() => setCreating(false)} onSaved={(t) => { setCreating(false); load(); setOpenId(t._id); }} />}
      {openId && <TicketModal id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}

function NewTicketModal({ onClose, onSaved }) {
  const [meta, setMeta] = useState({ categories: [], priorities: [] });
  const [f, setF] = useState({ subject: "", description: "", category: "other", priority: "medium" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  useEffect(() => { supportApi.getMeta().then(setMeta).catch(() => {}); }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try { const d = await supportApi.createTicket(f); onSaved(d.ticket); }
    catch (err) { setError(err.response?.data?.message || "Couldn't create the ticket."); setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <form onSubmit={submit} className="receipt-card relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-cream">New ticket</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-cream">✕</button>
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-brick">{error}</p>}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className={labelCls}>Subject *</label>
            <input value={f.subject} onChange={set("subject")} required maxLength={150} autoFocus placeholder="e.g. Can't print the bill" className={inputCls} /></div>
          <div><label className={labelCls}>Topic</label>
            <select value={f.category} onChange={set("category")} className={inputCls}>
              {meta.categories.map((c) => <option key={c} value={c}>{human(c)}</option>)}</select></div>
          <div><label className={labelCls}>How urgent?</label>
            <select value={f.priority} onChange={set("priority")} className={inputCls}>
              {meta.priorities.map((p) => <option key={p} value={p}>{human(p)}</option>)}</select></div>
          <div className="col-span-2"><label className={labelCls}>Describe the problem</label>
            <textarea rows={5} value={f.description} onChange={set("description")} placeholder="What happened? What did you expect?" className={inputCls} /></div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
          <button disabled={saving} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">{saving ? "Sending…" : "Submit ticket"}</button>
        </div>
      </form>
    </div>
  );
}

function TicketModal({ id, onClose, onChanged }) {
  const [t, setT] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supportApi.getTicket(id).then((d) => setT(d.ticket)).catch((e) => setError(e.response?.data?.message || "Couldn't load this ticket."));
  }, [id]);

  async function send(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setError("");
    setSending(true);
    try { const d = await supportApi.addReply(id, message); setT(d.ticket); setMessage(""); onChanged(); }
    catch (err) { setError(err.response?.data?.message || "Couldn't send your reply."); }
    finally { setSending(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="receipt-card relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-sm">
        <span className="receipt-notch left-6" />
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-8">
          <div className="min-w-0">
            <p className="text-xs text-muted">{t?.ticketNumber}</p>
            <h2 className="font-display text-xl text-cream">{t?.subject || "Ticket"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-cream">✕</button>
        </div>
        {error && <p role="alert" className="px-5 text-sm text-brick">{error}</p>}

        {!t ? !error && <p className="p-8 text-center text-sm text-muted">Loading…</p> : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className={`rounded-full px-2.5 py-1 font-medium ${STATUS_STYLE[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                <span>{human(t.category)}</span><span>· Opened {dateTime(t.createdAt)}</span>
              </div>
              {t.status === "WAITING_CLIENT" && <p className="text-sm text-saffron">We're waiting for your reply.</p>}
              {t.description && <p className="whitespace-pre-wrap rounded-sm border border-charcoal-lighter p-3 text-sm text-cream">{t.description}</p>}

              {t.replies.length === 0 ? <p className="text-sm text-muted">No replies yet. We'll respond here soon.</p> : (
                <ul className="space-y-2">
                  {t.replies.map((r) => (
                    <li key={r._id} className={`rounded-sm border p-3 text-sm ${r.fromClient ? "border-charcoal-lighter" : "border-saffron/40 bg-saffron/5"}`}>
                      <div className="flex justify-between gap-2 text-xs text-muted">
                        <span className="text-cream">{r.authorName}</span><span>{dateTime(r.createdAt)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-cream">{r.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {t.status === "CLOSED" ? (
              <p className="border-t border-charcoal-lighter px-5 py-4 text-sm text-muted">This ticket is closed. Raise a new ticket if you need more help.</p>
            ) : (
              <form onSubmit={send} className="border-t border-charcoal-lighter px-5 py-4">
                <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)}
                  placeholder={t.status === "RESOLVED" ? "Not fixed? Reply to reopen this ticket" : "Write a reply"} className={inputCls} />
                <div className="mt-2 flex justify-end">
                  <button disabled={sending || !message.trim()} className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">
                    {sending ? "Sending…" : "Send reply"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}