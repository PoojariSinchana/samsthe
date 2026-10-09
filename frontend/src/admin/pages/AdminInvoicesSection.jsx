import { useCallback, useEffect, useState } from "react";
import * as invApi from "../api/adminInvoicesApi";
import * as payApi from "../api/adminPaymentsApi";
import { useAdminAuth } from "../context/AdminAuthContext";
import RecordPaymentModal from "../components/RecordPaymentModal";
import { human } from "../utils/human";

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const labelCls = "mb-1 block text-xs text-muted";
const rupees = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;
const dateStr = (d) => (d ? new Date(d).toLocaleDateString("en-IN") : "—");
const inDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

const STYLE = {
  draft: "bg-charcoal-lighter text-muted", sent: "bg-saffron/10 text-saffron", overdue: "bg-brick/10 text-brick",
  paid: "bg-sage/10 text-sage", cancelled: "bg-charcoal-lighter text-muted",
};

export default function AdminInvoicesSection() {
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission("MANAGE_INVOICES");
  const canPay = hasPermission("MANAGE_PAYMENTS");

  const [meta, setMeta] = useState(null);
  const [payMethods, setPayMethods] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [viewId, setViewId] = useState(null);
  const [paying, setPaying] = useState(null);

  useEffect(() => {
    invApi.getMeta().then(setMeta).catch((e) => setError(e.response?.data?.message || "Couldn't load options."));
    if (hasPermission("MANAGE_PAYMENTS") || hasPermission("VIEW_PAYMENTS")) payApi.getMeta().then((m) => setPayMethods(m.methods)).catch(() => {});
  }, [hasPermission]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, limit: 20 };
      if (status) params.status = status;
      if (search) params.search = search;
      const d = await invApi.getInvoices(params);
      setInvoices(d.invoices); setSummary(d.summary); setPages(d.pages); setTotal(d.total);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't load invoices.");
    } finally {
      setLoading(false);
    }
  }, [page, status, search]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  async function act(fn, fail) {
    try { await fn(); load(); } catch (err) { setError(err.response?.data?.message || fail); }
  }
  const send = (i) => act(() => invApi.updateInvoice(i._id, { status: "sent" }), "Couldn't send the invoice.");
  const cancel = (i) => window.confirm(`Cancel ${i.invoiceNumber}?`) && act(() => invApi.updateInvoice(i._id, { status: "cancelled" }), "Couldn't cancel the invoice.");
  const remove = (i) => window.confirm(`Delete draft ${i.invoiceNumber}?`) && act(() => invApi.deleteInvoice(i._id), "Couldn't delete the invoice.");

  const S = (k) => summary?.[k] || { count: 0, amount: 0 };
  const outstanding = S("sent").amount + S("overdue").amount;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Invoices</h1>
          <p className="mt-1 text-sm text-muted">Bill clients for their subscriptions and custom work.</p>
        </div>
        {canManage && <button onClick={() => setCreating(true)} disabled={!meta} className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">New invoice</button>}
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Outstanding" value={rupees(outstanding)} sub={`${S("sent").count + S("overdue").count} invoices`} />
          <Stat label="Overdue" value={rupees(S("overdue").amount)} sub={`${S("overdue").count} invoices`} accent="text-brick" />
          <Stat label="Paid" value={rupees(S("paid").amount)} sub={`${S("paid").count} invoices`} accent="text-sage" />
          <Stat label="Drafts" value={S("draft").count} />
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Chip active={status === ""} onClick={() => { setStatus(""); setPage(1); }} label="All" />
        {meta?.statuses.map((s) => <Chip key={s} active={status === s} onClick={() => { setStatus(s); setPage(1); }} label={human(s)} count={S(s).count} />)}
      </div>

      <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search invoice number or client" aria-label="Search invoices" className={`${inputCls} max-w-md`} />
      {error && <p role="alert" className="text-sm text-brick">{error}</p>}

      <div className="receipt-card relative overflow-x-auto rounded-sm">
        <span className="receipt-notch left-6" />
        {loading ? <p className="p-8 text-center text-sm text-muted">Loading…</p>
        : invoices.length === 0 ? <p className="p-8 text-center text-sm text-muted">{search || status ? "No invoices match these filters." : "No invoices yet."}</p>
        : (
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-charcoal-lighter text-xs text-muted">
                {["Invoice", "Client", "Issued / Due", "Total", "Paid", "Status"].map((h) => <th key={h} className="px-5 pb-3 pt-7 font-medium">{h}</th>)}
                <th className="px-5 pb-3 pt-7"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i._id} className="border-b border-charcoal-lighter last:border-0 hover:bg-charcoal">
                  <td className="px-5 py-3 text-cream">{i.invoiceNumber}</td>
                  <td className="px-5 py-3 text-cream">{i.client?.name || "—"}<p className="text-xs text-muted">{human(i.client?.appType)}</p></td>
                  <td className="px-5 py-3 text-muted">{dateStr(i.issueDate)}<p className="text-xs">Due {dateStr(i.dueDate)}</p></td>
                  <td className="px-5 py-3 text-cream">{rupees(i.total)}</td>
                  <td className="px-5 py-3 text-muted">{rupees(i.amountPaid)}</td>
                  <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STYLE[i.status]}`}>{human(i.status)}</span></td>
                  <td className="whitespace-nowrap px-5 py-3 text-right text-xs">
                    <button onClick={() => setViewId(i._id)} className="text-saffron hover:underline">View</button>
                    {canManage && i.status === "draft" && <><Dot /><button onClick={() => send(i)} className="text-sage hover:underline">Send</button><Dot /><button onClick={() => remove(i)} className="text-brick hover:underline">Delete</button></>}
                    {canPay && ["sent", "overdue"].includes(i.status) && <><Dot /><button onClick={() => setPaying(i)} className="text-sage hover:underline">Record payment</button></>}
                    {canManage && ["sent", "overdue"].includes(i.status) && <><Dot /><button onClick={() => cancel(i)} className="text-brick hover:underline">Cancel</button></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>Page {page} of {pages} · {total} invoices</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-sm border border-charcoal-lighter px-3 py-1.5 hover:text-cream disabled:opacity-40">Previous</button>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="rounded-sm border border-charcoal-lighter px-3 py-1.5 hover:text-cream disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {creating && meta && <InvoiceModal meta={meta} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
      {viewId && <InvoiceDetail id={viewId} onClose={() => setViewId(null)} />}
      {paying && <RecordPaymentModal invoice={paying} methods={payMethods} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); load(); }} />}
    </div>
  );
}

const Dot = () => <span className="mx-2 text-charcoal-lighter">·</span>;

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

function InvoiceModal({ meta, onClose, onSaved }) {
  const [restaurantId, setRestaurantId] = useState("");
  const [lines, setLines] = useState([{ description: "", quantity: 1, unitPrice: "" }]);
  const [tax, setTax] = useState(0);
  const [dueDate, setDueDate] = useState(inDays(meta.defaults?.dueDays ?? 7));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const subtotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const setLine = (i, k, v) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));

  function pickClient(id) {
    setRestaurantId(id);
    const sub = meta.clients.find((c) => c._id === id)?.subscription;
    // Pre-fill from the client's subscription, but never overwrite lines the admin already typed.
    if (sub && lines.length === 1 && !lines[0].description && !lines[0].unitPrice) {
      setLines([{ description: `${human(sub.plan)} plan (${sub.billingCycle})`, quantity: 1, unitPrice: sub.amount }]);
    }
  }

  async function save(status) {
    setError("");
    setSaving(true);
    try {
      await invApi.createInvoice({ restaurantId, lineItems: lines, tax, dueDate, notes, status });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't save the invoice.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <form onSubmit={(e) => { e.preventDefault(); save("sent"); }} className="receipt-card relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-sm">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between px-5 pb-3 pt-8 sm:px-6">
          <h2 className="font-display text-xl text-cream">New invoice</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-cream">✕</button>
        </div>
        {error && <p role="alert" className="px-5 text-sm text-brick sm:px-6">{error}</p>}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-3 sm:px-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className={labelCls}>Client *</label>
              <select value={restaurantId} onChange={(e) => pickClient(e.target.value)} required className={inputCls}>
                <option value="">Select client…</option>
                {meta.clients.map((c) => <option key={c._id} value={c._id}>{c.name} ({human(c.appType)})</option>)}
              </select></div>
            <div><label className={labelCls}>Due date *</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required className={inputCls} /></div>
          </div>

          <div>
            <p className={labelCls}>Line items</p>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_64px_96px_24px] items-center gap-2">
                  <input value={l.description} onChange={(e) => setLine(i, "description", e.target.value)} placeholder="Description" required className={inputCls} />
                  <input type="number" min="1" value={l.quantity} onChange={(e) => setLine(i, "quantity", e.target.value)} aria-label="Quantity" className={inputCls} />
                  <input type="number" min="0" step="0.01" value={l.unitPrice} onChange={(e) => setLine(i, "unitPrice", e.target.value)} placeholder="Price" required aria-label="Unit price" className={inputCls} />
                  {lines.length > 1 && <button type="button" onClick={() => setLines((ls) => ls.filter((_, x) => x !== i))} aria-label="Remove line" className="text-muted hover:text-brick">✕</button>}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setLines((ls) => [...ls, { description: "", quantity: 1, unitPrice: "" }])} className="mt-2 text-sm text-saffron hover:underline">+ Add line</button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className={labelCls}>Tax / GST amount (₹)</label>
              <input type="number" min="0" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} className={inputCls} /></div>
            <div className="self-end text-right text-sm">
              <p className="text-muted">Subtotal {rupees(subtotal)}</p>
              <p className="font-display text-lg text-cream">Total {rupees(subtotal + (Number(tax) || 0))}</p>
            </div>
          </div>
          <div><label className={labelCls}>Notes</label><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-charcoal-lighter px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
          <button type="button" disabled={saving} onClick={() => save("draft")} className="rounded-sm border border-saffron px-4 py-2 text-saffron hover:bg-saffron hover:text-charcoal disabled:opacity-50">Save as draft</button>
          <button disabled={saving} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">{saving ? "Saving…" : "Save & send"}</button>
        </div>
      </form>
    </div>
  );
}

function InvoiceDetail({ id, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { invApi.getInvoice(id).then(setData).catch((e) => setError(e.response?.data?.message || "Couldn't load this invoice.")); }, [id]);
  const i = data?.invoice;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="receipt-card relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-sm">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between px-5 pb-3 pt-8 sm:px-6">
          <h2 className="font-display text-xl text-cream">{i?.invoiceNumber || "Invoice"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-cream">✕</button>
        </div>
        {error && <p role="alert" className="px-5 text-sm text-brick sm:px-6">{error}</p>}
        {!i ? !error && <p className="p-8 text-center text-sm text-muted">Loading…</p> : (
          <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-5 sm:px-6">
            <div className="flex items-start justify-between text-sm">
              <div><p className="text-cream">{i.client?.name}</p><p className="text-xs text-muted">{i.client?.email || i.client?.phone}</p></div>
              <div className="text-right"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STYLE[i.status]}`}>{human(i.status)}</span>
                <p className="mt-1 text-xs text-muted">Issued {dateStr(i.issueDate)} · Due {dateStr(i.dueDate)}</p></div>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {i.lineItems.map((l, idx) => (
                  <tr key={idx} className="border-b border-charcoal-lighter">
                    <td className="py-2 text-cream">{l.description}<p className="text-xs text-muted">{l.quantity} × {rupees(l.unitPrice)}</p></td>
                    <td className="py-2 text-right text-cream">{rupees(l.amount)}</td>
                  </tr>
                ))}
                <tr><td className="pt-2 text-muted">Subtotal</td><td className="pt-2 text-right text-muted">{rupees(i.subtotal)}</td></tr>
                <tr><td className="text-muted">Tax</td><td className="text-right text-muted">{rupees(i.tax)}</td></tr>
                <tr><td className="font-medium text-cream">Total</td><td className="text-right font-medium text-cream">{rupees(i.total)}</td></tr>
                <tr><td className="text-sage">Paid</td><td className="text-right text-sage">{rupees(i.amountPaid)}</td></tr>
                <tr><td className="text-brick">Balance due</td><td className="text-right text-brick">{rupees(i.amountDue)}</td></tr>
              </tbody>
            </table>
            {i.notes && <p className="text-sm text-muted">{i.notes}</p>}
            <div>
              <p className="mb-1 text-xs text-muted">Payments</p>
              {data.payments.length === 0 ? <p className="text-sm text-muted">None yet.</p> : (
                <ul className="space-y-1 text-sm">
                  {data.payments.map((p) => (
                    <li key={p._id} className="flex justify-between">
                      <span className="text-cream">{rupees(p.amount)} · {human(p.method)}<span className="ml-2 text-xs text-muted">{dateStr(p.paidAt || p.createdAt)}</span></span>
                      <span className={`text-xs ${p.status === "paid" ? "text-sage" : "text-muted"}`}>{human(p.status)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}