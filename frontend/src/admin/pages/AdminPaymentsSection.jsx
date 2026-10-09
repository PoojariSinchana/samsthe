import { useCallback, useEffect, useState } from "react";
import * as payApi from "../api/adminPaymentsApi";
import { useAdminAuth } from "../context/AdminAuthContext";
import RecordPaymentModal from "../components/RecordPaymentModal";
import { human } from "../utils/human";

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const rupees = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;
const dateStr = (d) => (d ? new Date(d).toLocaleDateString("en-IN") : "—");
const STYLE = { paid: "bg-sage/10 text-sage", pending: "bg-saffron/10 text-saffron", failed: "bg-brick/10 text-brick", refunded: "bg-charcoal-lighter text-muted" };

export default function AdminPaymentsSection() {
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission("MANAGE_PAYMENTS");

  const [meta, setMeta] = useState(null);
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState("");
  const [method, setMethod] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);

  const loadMeta = useCallback(() => payApi.getMeta().then(setMeta).catch((e) => setError(e.response?.data?.message || "Couldn't load options.")), []);
  useEffect(() => { loadMeta(); }, [loadMeta]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, limit: 20 };
      if (status) params.status = status;
      if (method) params.method = method;
      if (search) params.search = search;
      const d = await payApi.getPayments(params);
      setPayments(d.payments); setSummary(d.summary); setPages(d.pages); setTotal(d.total);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't load payments.");
    } finally {
      setLoading(false);
    }
  }, [page, status, method, search]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  async function change(p, next) {
    let rejectReason;
    if (next === "failed") {
      rejectReason = window.prompt("Why is this payment being rejected? (shown to the client)", "Payment not received");
      if (rejectReason === null) return;
    } else {
      const warn = next === "refunded" ? "Mark this payment as refunded? This can't be undone and reopens its invoice." : `Mark this payment as ${next}?`;
      if (!window.confirm(warn)) return;
    }
    try { await payApi.updatePaymentStatus(p._id, next, rejectReason); load(); loadMeta(); }
    catch (err) { setError(err.response?.data?.message || "Couldn't update the payment."); }
  }

  const S = (k) => summary?.[k] || { count: 0, amount: 0 };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Payments</h1>
          <p className="mt-1 text-sm text-muted">Money received from clients for Samsthe itself.</p>
        </div>
        {canManage && <button onClick={() => setRecording(true)} disabled={!meta} className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">Record payment</button>}
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Received this month" value={rupees(summary.thisMonth)} accent="text-sage" />
          <Stat label="Received all-time" value={rupees(S("paid").amount)} sub={`${S("paid").count} payments`} />
          <Stat label="Pending" value={rupees(S("pending").amount)} sub={`${S("pending").count} payments`} accent="text-saffron" />
          <Stat label="Refunded" value={rupees(S("refunded").amount)} sub={`${S("refunded").count} payments`} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search client or reference" aria-label="Search payments" className={`${inputCls} max-w-xs`} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status" className={`${inputCls} w-auto`}>
          <option value="">All statuses</option>{meta?.statuses.map((s) => <option key={s} value={s}>{human(s)}</option>)}
        </select>
        <select value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }} aria-label="Filter by method" className={`${inputCls} w-auto`}>
          <option value="">All methods</option>{meta?.methods.map((m) => <option key={m} value={m}>{human(m)}</option>)}
        </select>
      </div>

      {error && <p role="alert" className="text-sm text-brick">{error}</p>}

      <div className="receipt-card relative overflow-x-auto rounded-sm">
        <span className="receipt-notch left-6" />
        {loading ? <p className="p-8 text-center text-sm text-muted">Loading…</p>
        : payments.length === 0 ? <p className="p-8 text-center text-sm text-muted">{search || status || method ? "No payments match these filters." : "No payments recorded yet."}</p>
        : (
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-charcoal-lighter text-xs text-muted">
                {["Date", "Client", "Invoice", "Method", "Amount", "Status"].map((h) => <th key={h} className="px-5 pb-3 pt-7 font-medium">{h}</th>)}
                {canManage && <th className="px-5 pb-3 pt-7"></th>}
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p._id} className="border-b border-charcoal-lighter last:border-0 hover:bg-charcoal">
                  <td className="px-5 py-3 text-muted">{dateStr(p.paidAt || p.createdAt)}</td>
                  <td className="px-5 py-3 text-cream">{p.client?.name || "—"}
                    {(p.utr || p.gatewayReference) && <p className="text-xs text-muted">Ref {p.utr || p.gatewayReference}</p>}
                  </td>
                  <td className="px-5 py-3 text-muted">{p.invoice?.invoiceNumber || "—"}</td>
                  <td className="px-5 py-3 text-muted">{human(p.method)}</td>
                  <td className="px-5 py-3 text-cream">{rupees(p.amount)}</td>
                  <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STYLE[p.status]}`}>{human(p.status)}</span></td>
                  {canManage && (
                    <td className="whitespace-nowrap px-5 py-3 text-right text-xs">
                      {p.status === "pending" && <><button onClick={() => change(p, "paid")} className="text-sage hover:underline">Mark paid</button><span className="mx-2 text-charcoal-lighter">·</span><button onClick={() => change(p, "failed")} className="text-brick hover:underline">Failed</button></>}
                      {p.status === "paid" && <button onClick={() => change(p, "refunded")} className="text-brick hover:underline">Refund</button>}
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
          <span>Page {page} of {pages} · {total} payments</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-sm border border-charcoal-lighter px-3 py-1.5 hover:text-cream disabled:opacity-40">Previous</button>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="rounded-sm border border-charcoal-lighter px-3 py-1.5 hover:text-cream disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {recording && meta && (
        <RecordPaymentModal openInvoices={meta.openInvoices} clients={meta.clients} methods={meta.methods}
          onClose={() => setRecording(false)} onSaved={() => { setRecording(false); load(); loadMeta(); }} />
      )}
    </div>
  );
}

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