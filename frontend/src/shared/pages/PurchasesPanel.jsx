import { useEffect, useState, useCallback } from "react";
import { getOutlets } from "../api/outlets";
import { getSuppliers } from "../api/suppliersApi";
import { todayStr } from "../utils/dateRange";
import StatCard from "../components/StatCard";

// mode "ingredient": lines are free text (name, qty, unit, cost) — restaurant.
// mode "variant":    lines pick a product variant (SKU) — retail.
const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const labelCls = "mb-1 block text-xs text-muted";
const rupees = (n) => `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const METHODS = ["cash", "card", "upi", "bank", "other"];
const FILTERS = [["all", "All"], ["due", "Unpaid"], ["paid", "Paid"]];

export default function PurchasesPanel({ api, mode, loadVariants }) {
  const [purchases, setPurchases] = useState([]);
  const [filter, setFilter] = useState("due");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState(null);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getAll({ page: 1, limit: 100 });
      setPurchases((data.purchases || []).filter((p) => p.status !== "cancelled"));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load purchases");
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => { load(); }, [load]);

  const visible = purchases.filter((p) => filter === "all" || (filter === "due" ? p.amountDue > 0 : p.amountDue <= 0));
  const owed = purchases.reduce((s, p) => s + (p.amountDue || 0), 0);
  const spent = purchases.reduce((s, p) => s + (p.totalAmount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Purchases</h1>
          <p className="mt-1 text-sm text-muted">Stock you buy from suppliers, paid now or on credit.</p>
        </div>
        <button onClick={() => setCreating(true)} className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark">New purchase</button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Owed to suppliers" value={rupees(owed)} accent="brick" />
        <StatCard label="Total purchased" value={rupees(spent)} accent="saffron" />
        <StatCard label="Purchases" value={purchases.length} />
      </div>

      <div className="flex gap-2">
        {FILTERS.map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-sm border px-3 py-1.5 text-sm ${filter === k ? "border-saffron text-saffron" : "border-charcoal-lighter text-muted hover:text-cream"}`}>{label}</button>
        ))}
      </div>

      {error && <p role="alert" className="text-sm text-brick">{error}</p>}

      <div className="receipt-card relative overflow-x-auto rounded-sm">
        <span className="receipt-notch left-6" />
        {loading ? <p className="p-8 text-center text-sm text-muted">Loading…</p>
        : visible.length === 0 ? <p className="p-8 text-center text-sm text-muted">{purchases.length === 0 ? "No purchases yet. Record one with New purchase." : "No purchases in this view."}</p>
        : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-charcoal-lighter text-xs text-muted">
                {["Date", "Supplier", "Outlet"].map((h) => <th key={h} className="px-5 pb-3 pt-7 font-medium">{h}</th>)}
                {["Total", "Paid", "Due"].map((h) => <th key={h} className="px-5 pb-3 pt-7 text-right font-medium">{h}</th>)}
                <th className="px-5 pb-3 pt-7"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <FragmentRow key={p._id} p={p} open={openId === p._id} onToggle={() => setOpenId(openId === p._id ? null : p._id)} onPay={() => setPaying(p)} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && <NewPurchaseModal api={api} mode={mode} loadVariants={loadVariants} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
      {paying && <PayModal api={api} purchase={paying} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); load(); }} />}
    </div>
  );
}

function FragmentRow({ p, open, onToggle, onPay }) {
  return (
    <>
      <tr className="border-b border-charcoal-lighter last:border-0 hover:bg-charcoal">
        <td className="px-5 py-3 text-muted">{new Date(p.date).toLocaleDateString("en-IN")}</td>
        <td className="px-5 py-3 text-cream">{p.supplier?.name || "—"}</td>
        <td className="px-5 py-3 text-muted">{p.outlet?.name || "—"}</td>
        <td className="px-5 py-3 text-right text-cream">{rupees(p.totalAmount)}</td>
        <td className="px-5 py-3 text-right text-sage">{rupees(p.amountPaid)}</td>
        <td className={`px-5 py-3 text-right ${p.amountDue > 0 ? "text-brick" : "text-muted"}`}>{rupees(p.amountDue)}</td>
        <td className="whitespace-nowrap px-5 py-3 text-right text-xs">
          <button onClick={onToggle} className="text-saffron hover:underline">{open ? "Hide items" : "Items"}</button>
          {p.amountDue > 0 && <><span className="mx-2 text-charcoal-lighter">·</span><button onClick={onPay} className="text-sage hover:underline">Pay</button></>}
        </td>
      </tr>
      {open && (
        <tr className="border-b border-charcoal-lighter bg-charcoal">
          <td colSpan={7} className="px-5 py-3">
            <ul className="space-y-1 text-sm">
              {(p.items || []).map((i, idx) => (
                <li key={i._id || idx} className="flex justify-between gap-3">
                  <span className="text-cream">{i.quantity}{i.unit ? ` ${i.unit}` : ""} × {i.name || i.sku}</span>
                  <span className="text-muted">{rupees(i.unitCost)} each</span>
                </li>
              ))}
              {(!p.items || p.items.length === 0) && <li className="text-muted">No line items recorded.</li>}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}

function NewPurchaseModal({ api, mode, loadVariants, onClose, onSaved }) {
  const blank = () => (mode === "variant" ? { choice: "", quantity: 1, unitCost: "" } : { name: "", quantity: 1, unit: "", unitCost: "" });
  const [outlets, setOutlets] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [variants, setVariants] = useState([]);
  const [outlet, setOutlet] = useState("");
  const [supplier, setSupplier] = useState("");
  const [date, setDate] = useState(todayStr());
  const [lines, setLines] = useState([blank()]);
  const [amountPaid, setAmountPaid] = useState(0);
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getOutlets().then((r) => {
      const active = (r.outlets || []).filter((o) => o.isActive);
      setOutlets(active);
      if (active[0]) setOutlet(active[0]._id);
    }).catch(() => {});
    getSuppliers().then((r) => setSuppliers(r.suppliers || [])).catch(() => {});
    if (mode === "variant" && loadVariants) loadVariants().then(setVariants).catch(() => setError("Couldn't load products"));
  }, [mode, loadVariants]);

  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);
  const setLine = (i, patch) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  function pickVariant(i, choice) {
    const v = variants.find((x) => x.value === choice);
    setLine(i, { choice, unitCost: v && v.costPrice ? v.costPrice : lines[i].unitCost });
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!supplier) return setError("Select a supplier");
    if (Number(amountPaid) > total) return setError("Amount paid can't be more than the total");
    const items = lines.map((l) => {
      if (mode === "variant") {
        const [product, variantId] = l.choice.split("|");
        return { product, variantId, quantity: Number(l.quantity), unitCost: Number(l.unitCost) };
      }
      return { name: l.name, quantity: Number(l.quantity), unit: l.unit || undefined, unitCost: Number(l.unitCost) };
    });
    if (mode === "variant" && lines.some((l) => !l.choice)) return setError("Pick a product for every line");

    setSaving(true);
    try {
      await api.create({
        outlet, supplier, date, items, notes,
        amountPaid: Number(amountPaid) || 0,
        paymentMethod: Number(amountPaid) > 0 ? method : undefined,
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't save the purchase.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <form onSubmit={submit} className="receipt-card relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-sm">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between px-5 pb-3 pt-8 sm:px-6">
          <h2 className="font-display text-xl text-cream">New purchase</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-cream">✕</button>
        </div>
        {error && <p role="alert" className="px-5 text-sm text-brick sm:px-6">{error}</p>}

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-3 sm:px-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><label className={labelCls}>Supplier *</label>
              <select value={supplier} onChange={(e) => setSupplier(e.target.value)} required className={inputCls}>
                <option value="">Select…</option>
                {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
              {suppliers.length === 0 && <p className="mt-1 text-xs text-muted">Add suppliers under People first.</p>}</div>
            {outlets.length > 1 && (
              <div><label className={labelCls}>Outlet</label>
                <select value={outlet} onChange={(e) => setOutlet(e.target.value)} className={inputCls}>
                  {outlets.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
                </select></div>
            )}
            <div><label className={labelCls}>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></div>
          </div>

          <div>
            <p className={labelCls}>Items</p>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className={`grid items-center gap-2 ${mode === "variant" ? "grid-cols-[1fr_64px_88px_24px]" : "grid-cols-[1fr_64px_64px_88px_24px]"}`}>
                  {mode === "variant" ? (
                    <select value={l.choice} onChange={(e) => pickVariant(i, e.target.value)} required aria-label="Product" className={inputCls}>
                      <option value="">Select product…</option>
                      {variants.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </select>
                  ) : (
                    <input value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} placeholder="Item name" required aria-label="Item name" className={inputCls} />
                  )}
                  <input type="number" min="0.01" step="0.01" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} required aria-label="Quantity" className={inputCls} />
                  {mode !== "variant" && <input value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} placeholder="kg" aria-label="Unit" className={inputCls} />}
                  <input type="number" min="0" step="0.01" value={l.unitCost} onChange={(e) => setLine(i, { unitCost: e.target.value })} placeholder="Cost" required aria-label="Unit cost" className={inputCls} />
                  {lines.length > 1 ? <button type="button" onClick={() => setLines((ls) => ls.filter((_, x) => x !== i))} aria-label="Remove line" className="text-muted hover:text-brick">✕</button> : <span />}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setLines((ls) => [...ls, blank()])} className="mt-2 text-sm text-saffron hover:underline">+ Add item</button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><label className={labelCls}>Paid now (₹)</label>
              <div className="flex gap-2">
                <input type="number" min="0" step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className={inputCls} />
                <button type="button" onClick={() => setAmountPaid(total)} className="rounded-sm border border-charcoal-lighter px-3 text-sm text-cream hover:border-saffron">Full</button>
              </div></div>
            <div><label className={labelCls}>Paid through</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} disabled={!(Number(amountPaid) > 0)} className={`${inputCls} disabled:opacity-50`}>
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select></div>
            <div className="self-end text-right text-sm">
              <p className="text-muted">Balance on credit {rupees(Math.max(total - (Number(amountPaid) || 0), 0))}</p>
              <p className="font-display text-lg text-cream">Total {rupees(total)}</p>
            </div>
          </div>
          <div><label className={labelCls}>Notes</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-charcoal-lighter px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
          <button disabled={saving} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">{saving ? "Saving…" : "Save purchase"}</button>
        </div>
      </form>
    </div>
  );
}

function PayModal({ api, purchase, onClose, onSaved }) {
  const [amount, setAmount] = useState(purchase.amountDue.toFixed(2));
  const [method, setMethod] = useState("cash");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try { await api.addPayment(purchase._id, { method, amount: Number(amount) }); onSaved(); }
    catch (err) { setError(err.response?.data?.message || "Couldn't record the payment."); setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} className="receipt-card relative w-full max-w-sm rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-cream">Pay {purchase.supplier?.name || "supplier"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-cream">✕</button>
        </div>
        <p className="mt-1 text-xs text-muted">Outstanding {rupees(purchase.amountDue)}</p>
        {error && <p role="alert" className="mt-2 text-sm text-brick">{error}</p>}
        <div className="mt-4 space-y-3">
          <div><label className={labelCls}>Amount</label><input type="number" min="0.01" step="0.01" max={purchase.amountDue} value={amount} onChange={(e) => setAmount(e.target.value)} required className={inputCls} /></div>
          <div><label className={labelCls}>Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>{METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
          <button disabled={saving} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">{saving ? "Saving…" : "Record payment"}</button>
        </div>
      </form>
    </div>
  );
}
