import { useState } from "react";
import * as paymentsApi from "../api/adminPaymentsApi";

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const labelCls = "mb-1 block text-xs text-muted";
const human = (s = "") => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const rupees = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;

// Pass `invoice` (with amountDue) to pay a specific invoice, or `openInvoices` + `clients` for the free-form version.
export default function RecordPaymentModal({ invoice, openInvoices = [], clients = [], methods, onClose, onSaved }) {
  const [invoiceId, setInvoiceId] = useState(invoice?._id || "");
  const [businessId, setBusinessId] = useState("");
  const [amount, setAmount] = useState(invoice ? invoice.amountDue : "");
  const [method, setMethod] = useState("upi");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [gatewayReference, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selected = invoice || openInvoices.find((i) => i._id === invoiceId);

  function pickInvoice(id) {
    setInvoiceId(id);
    const inv = openInvoices.find((i) => i._id === id);
    if (inv) setAmount(inv.amountDue);
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await paymentsApi.createPayment({
        invoiceId: invoiceId || undefined, businessId: invoiceId ? undefined : businessId,
        amount, method, paidAt, gatewayReference, notes,
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't record the payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <form onSubmit={submit} className="receipt-card relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-sm">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between px-5 pb-3 pt-8">
          <h2 className="font-display text-xl text-cream">Record payment</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-cream">✕</button>
        </div>
        {error && <p role="alert" className="px-5 text-sm text-brick">{error}</p>}
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-3">
          {invoice ? (
            <p className="text-sm text-cream">{invoice.invoiceNumber} · {invoice.client?.name}<span className="ml-2 text-xs text-muted">{rupees(invoice.amountDue)} due</span></p>
          ) : (
            <>
              <div><label className={labelCls}>Invoice</label>
                <select value={invoiceId} onChange={(e) => pickInvoice(e.target.value)} className={inputCls}>
                  <option value="">No invoice (standalone payment)</option>
                  {openInvoices.map((i) => <option key={i._id} value={i._id}>{i.invoiceNumber} · {i.clientName} · {rupees(i.amountDue)} due</option>)}
                </select></div>
              {!invoiceId && (
                <div><label className={labelCls}>Client *</label>
                  <select value={businessId} onChange={(e) => setBusinessId(e.target.value)} required className={inputCls}>
                    <option value="">Select client…</option>
                    {clients.map((c) => <option key={c._id} value={c._id}>{c.name} ({human(c.appType)})</option>)}
                  </select></div>
              )}
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Amount (₹) *</label>
              <input type="number" min="0.01" step="0.01" max={selected?.amountDue} value={amount} onChange={(e) => setAmount(e.target.value)} required className={inputCls} /></div>
            <div><label className={labelCls}>Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
                {methods.map((m) => <option key={m} value={m}>{human(m)}</option>)}</select></div>
            <div><label className={labelCls}>Date received</label>
              <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Reference / txn id</label>
              <input value={gatewayReference} onChange={(e) => setRef(e.target.value)} className={inputCls} /></div>
          </div>
          <div><label className={labelCls}>Notes</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-charcoal-lighter px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
          <button disabled={saving} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">{saving ? "Saving…" : "Record payment"}</button>
        </div>
      </form>
    </div>
  );
}