import { useEffect, useState, useCallback } from "react";
import ordersApi from "../api/orders";
import { getOutlets } from "../../../shared/api/outlets";
import StatCard from "../../../shared/components/StatCard";
import { startOfLocalDay, endOfLocalDay } from "../../../shared/utils/dateRange";

const METHODS = ["cash", "card", "upi", "wallet", "other"];

const inputClass =
  "rounded-sm border border-charcoal-lighter bg-charcoal px-3 py-2 text-sm text-cream focus:border-saffron focus:outline-none";
const labelClass = "mb-1 block text-xs text-muted";

export default function PaymentsSection() {
  const [outlets, setOutlets] = useState([]);
  const [outlet, setOutlet] = useState("");
  const [method, setMethod] = useState("");
  // Default to no date filter at all — this page is the reconciliation
  // ledger, so it should show every payment on first load. Previously this
  // defaulted "From" to today with no "To", which silently hid every past
  // payment until someone manually picked an earlier date.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [payments, setPayments] = useState([]);
  const [totalsByMethod, setTotalsByMethod] = useState({});
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getOutlets()
      .then((res) => setOutlets((res.outlets || []).filter((o) => o.isActive)))
      .catch(() => {});
  }, []);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (outlet) params.outlet = outlet;
      if (method) params.method = method;
      // Both bounds computed in the user's own local time (see
      // utils/dateRange) so a chosen "To" date includes that whole day
      // instead of cutting off partway through it for anyone not on UTC.
      // Left blank, neither bound is sent — meaning no date restriction.
      if (from) params.from = startOfLocalDay(from);
      if (to) params.to = endOfLocalDay(to);

      const data = await ordersApi.getPaymentsReport(params);
      setPayments(data.payments);
      setTotalsByMethod(data.totalsByMethod);
      setGrandTotal(data.grandTotal);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [outlet, method, from, to]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl text-cream sm:text-2xl lg:text-3xl">Payments</h1>
          <p className="mt-1 text-sm text-muted">A ledger of every payment received, for reconciliation.</p>
        </div>
      </div>

      <div className="receipt-card relative mt-6 rounded-sm px-4 pb-4 pt-7 sm:px-5">
        <span className="receipt-notch left-6" />
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end sm:gap-4">
          <div>
            <label className={labelClass}>From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputClass} w-full`} />
          </div>
          <div>
            <label className={labelClass}>To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputClass} w-full`} />
          </div>
          {outlets.length > 1 && (
            <div>
              <label className={labelClass}>Outlet</label>
              <select value={outlet} onChange={(e) => setOutlet(e.target.value)} className={`${inputClass} w-full`}>
                <option value="">All outlets</option>
                {outlets.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className={labelClass}>Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={`${inputClass} w-full`}>
              <option value="">All methods</option>
              {METHODS.map((m) => <option key={m} value={m} className="capitalize">{m}</option>)}
            </select>
          </div>
          {(outlet || method || from || to) && (
            <button
              onClick={() => { setOutlet(""); setMethod(""); setFrom(""); setTo(""); }}
              className="col-span-2 pb-2 text-left text-sm text-muted hover:text-cream sm:col-span-1 sm:text-center"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
        <StatCard label="Total collected" value={`₹${grandTotal.toLocaleString("en-IN")}`} />
        {METHODS.map((m) =>
          totalsByMethod[m] ? (
            <StatCard key={m} label={m.charAt(0).toUpperCase() + m.slice(1)} value={`₹${totalsByMethod[m].toLocaleString("en-IN")}`} accent="sage" />
          ) : null
        )}
      </div>

      {error && <p className="mt-4 text-sm text-brick">{error}</p>}

      {loading ? (
        <div className="receipt-card mt-6 rounded-sm p-10 text-center text-sm text-muted">Loading payments…</div>
      ) : payments.length === 0 ? (
        <div className="receipt-card mt-6 rounded-sm p-10 text-center text-sm text-muted">
          No payments found for this filter.
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:hidden">
            {payments.map((p) => (
              <div key={p._id} className="receipt-card relative rounded-sm px-5 pb-5 pt-7">
                <span className="receipt-notch left-6" />
                <div className="flex items-center justify-between">
                  <p className="font-medium text-cream">{p.orderNumber}</p>
                  <p className="text-cream">₹{p.amount.toFixed(2)}</p>
                </div>
                <p className="mt-1 text-xs capitalize text-muted">
                  {p.method} · {p.receivedByName || "—"}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {new Date(p.paidAt).toLocaleString("en-IN")}
                </p>
                {(p.outletName || p.tableName) && (
                  <p className="mt-1 text-xs text-muted">
                    {p.outletName}
                    {p.tableName ? ` · Table ${p.tableName || p.tableNumber}` : ""}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="receipt-card relative mt-6 hidden overflow-x-auto rounded-sm sm:block">
            <span className="receipt-notch left-6" />
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-charcoal-lighter text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 pb-3 pt-7 font-medium">Date &amp; time</th>
                  <th className="px-5 pb-3 pt-7 font-medium">Order</th>
                  <th className="px-5 pb-3 pt-7 font-medium">Outlet / Table</th>
                  <th className="px-5 pb-3 pt-7 font-medium">Method</th>
                  <th className="px-5 pb-3 pt-7 font-medium">Received by</th>
                  <th className="px-5 pb-3 pt-7 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id} className="border-b border-charcoal-lighter transition-colors last:border-0 hover:bg-charcoal">
                    <td className="px-5 py-3 text-muted">{new Date(p.paidAt).toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3 text-cream">
                      {p.orderNumber}
                      <span className="ml-2 text-xs capitalize text-muted">{p.orderType}</span>
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {p.outletName || "—"}
                      {p.tableName || p.tableNumber ? ` · Table ${p.tableName || p.tableNumber}` : ""}
                    </td>
                    <td className="px-5 py-3 capitalize text-cream">{p.method}</td>
                    <td className="px-5 py-3 text-muted">{p.receivedByName || "—"}</td>
                    <td className="px-5 py-3 text-right font-medium text-cream">₹{p.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}