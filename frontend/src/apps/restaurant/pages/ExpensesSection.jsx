import { useEffect, useState, useCallback } from "react";
import * as entriesApi from "../../../shared/api/entriesApi";
import { todayStr, startOfLocalDay, endOfLocalDay } from "../../../shared/utils/dateRange";
import StatCard from "../../../shared/components/StatCard";

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const labelCls = "mb-1 block text-xs text-muted";
const human = (s = "") => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const rupees = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;
const LIMIT = 100;

export default function ExpensesSection() {
  const [meta, setMeta] = useState({ paymentMethods: [], categoriesByType: {} });
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  const categories = meta.categoriesByType.EXPENSE || [];

  useEffect(() => { entriesApi.getMeta().then(setMeta).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { entryType: "EXPENSE", page: 1, limit: LIMIT };
      if (category) params.category = category;
      if (from) params.from = startOfLocalDay(from);
      if (to) params.to = endOfLocalDay(to);
      const data = await entriesApi.getEntries(params);
      setEntries(data.entries.filter((e) => e.status !== "cancelled"));
      setTotal(data.total);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, [category, from, to]);

  useEffect(() => { load(); }, [load]);

  async function handleCancel(id) {
    if (!window.confirm("Cancel this expense? It will be reversed in Accounting.")) return;
    try { await entriesApi.cancelEntry(id); load(); }
    catch (err) { setError(err.response?.data?.message || "Failed to cancel the expense"); }
  }

  const sum = entries.reduce((s, e) => s + e.amount, 0);
  const byCategory = Object.entries(
    entries.reduce((acc, e) => ({ ...acc, [e.category]: (acc[e.category] || 0) + e.amount }), {})
  ).sort((a, b) => b[1] - a[1]);
  const max = byCategory[0]?.[1] || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Expenses</h1>
          <p className="mt-1 text-sm text-muted">Rent, utilities, wages and everything else you pay out.</p>
        </div>
        <button onClick={() => setAdding(true)} className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark">Add expense</button>
      </div>

      <div className="receipt-card relative rounded-sm px-5 pb-4 pt-7">
        <span className="receipt-notch left-6" />
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end sm:gap-4">
          <div><label className={labelCls}>From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>To</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} /></div>
          <div className="col-span-2 sm:col-span-1">
            <label className={labelCls}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{human(c)}</option>)}
            </select>
          </div>
          {(from || to || category) && (
            <button onClick={() => { setFrom(""); setTo(""); setCategory(""); }} className="col-span-2 pb-2 text-left text-sm text-muted hover:text-cream sm:col-span-1">Clear filters</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Total spent" value={rupees(sum)} accent="brick" />
        <StatCard label="Expenses" value={entries.length} accent="saffron" />
        <StatCard label="Largest category" value={byCategory[0] ? human(byCategory[0][0]) : "None"} />
      </div>
      {total > LIMIT && <p className="text-xs text-muted">Showing the latest {LIMIT} of {total} expenses. Narrow the dates to see the rest.</p>}

      {error && <p role="alert" className="text-sm text-brick">{error}</p>}

      {byCategory.length > 0 && (
        <div className="receipt-card relative rounded-sm px-5 pb-6 pt-8">
          <span className="receipt-notch left-6" />
          <h2 className="mb-4 font-display text-lg text-cream">By category</h2>
          <div className="space-y-2">
            {byCategory.map(([name, value]) => (
              <div key={name} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 truncate text-muted">{human(name)}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-charcoal-lighter"><div className="h-full rounded-full bg-brick" style={{ width: `${(value / max) * 100}%` }} /></div>
                <span className="w-24 shrink-0 text-right text-cream">{rupees(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="receipt-card relative overflow-x-auto rounded-sm">
        <span className="receipt-notch left-6" />
        {loading ? <p className="p-8 text-center text-sm text-muted">Loading…</p>
        : entries.length === 0 ? <p className="p-8 text-center text-sm text-muted">No expenses recorded for these filters.</p>
        : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-charcoal-lighter text-xs text-muted">
                {["Date", "Description", "Category", "Paid through"].map((h) => <th key={h} className="px-5 pb-3 pt-7 font-medium">{h}</th>)}
                <th className="px-5 pb-3 pt-7 text-right font-medium">Amount</th>
                <th className="px-5 pb-3 pt-7"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e._id} className="border-b border-charcoal-lighter last:border-0 hover:bg-charcoal">
                  <td className="px-5 py-3 text-muted">{new Date(e.date).toLocaleDateString("en-IN")}</td>
                  <td className="px-5 py-3 text-cream">{e.description}</td>
                  <td className="px-5 py-3 text-muted">{human(e.category)}</td>
                  <td className="px-5 py-3 text-muted">{e.paymentMethod ? human(e.paymentMethod) : "—"}</td>
                  <td className="px-5 py-3 text-right font-medium text-cream">{rupees(e.amount)}</td>
                  <td className="px-5 py-3 text-right">
                    {e.source === "ORDER" ? <span className="text-xs text-muted">Via orders</span>
                      : <button onClick={() => handleCancel(e._id)} className="text-xs text-brick hover:underline">Cancel</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {adding && <ExpenseModal meta={meta} categories={categories} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
    </div>
  );
}

function ExpenseModal({ meta, categories, onClose, onSaved }) {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await entriesApi.createEntry({
        entryType: "EXPENSE", category,
        description: description.trim() || human(category),
        amount, paymentMethod, date, notes,
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't save the expense.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <form onSubmit={submit} className="receipt-card relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-cream">Add expense</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-cream">✕</button>
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-brick">{error}</p>}
        <div className="mt-4 space-y-3">
          <div><label className={labelCls}>Category *</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} required className={inputCls}>
              <option value="">Select…</option>
              {categories.map((c) => <option key={c} value={c}>{human(c)}</option>)}
            </select></div>
          <div><label className={labelCls}>Description</label><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. September rent" className={inputCls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Amount (₹) *</label><input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required className={inputCls} /></div>
            <div><label className={labelCls}>Paid through</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputCls}>
                {meta.paymentMethods.map((m) => <option key={m} value={m}>{human(m)}</option>)}
              </select></div>
          </div>
          <div><label className={labelCls}>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Notes</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
          <button disabled={saving} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">{saving ? "Saving…" : "Save expense"}</button>
        </div>
      </form>
    </div>
  );
}
