import { useEffect, useState, useCallback } from "react";
import { getOutlets } from "../../../shared/api/outlets";
import StatCard from "../../../shared/components/StatCard";
import * as stockApi from "../api/stockApi";

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const labelCls = "mb-1 block text-xs text-muted";
const REASONS = ["correction", "damaged", "wastage", "lost", "theft", "counting_error", "return_to_stock", "spoiled"];

const qtyOf = (r) => r.currentStock ?? 0;
const nameOf = (r) => r.item?.name || r.itemId?.name || "Item";
const levelOf = (r) => r.minStock ?? 0;
const productId = (r) => r.product?._id || r.product;

export default function StockSection() {
  const [tab, setTab] = useState("levels");
  const [outlets, setOutlets] = useState([]);
  const [outlet, setOutlet] = useState("");

  useEffect(() => {
    getOutlets().then((r) => {
      const active = (r.outlets || []).filter((o) => o.isActive);
      setOutlets(active);
      if (active[0]) setOutlet(active[0]._id);
    }).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Stock</h1>
          <p className="mt-1 text-sm text-muted">What's on the shelf at each outlet, and how it got there.</p>
        </div>
        {outlets.length > 1 && (
          <select value={outlet} onChange={(e) => setOutlet(e.target.value)} aria-label="Outlet" className={`${inputCls} w-auto`}>
            {outlets.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
          </select>
        )}
      </div>

      <div className="flex gap-2 border-b border-charcoal-lighter">
        {[["levels", "Stock levels"], ["movements", "Movements"]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 text-sm ${tab === k ? "border-b-2 border-saffron text-saffron" : "text-muted hover:text-cream"}`}>{label}</button>
        ))}
      </div>

      {tab === "levels" ? <Levels outlet={outlet} /> : <Movements outlet={outlet} />}
    </div>
  );
}

function Levels({ outlet }) {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adjusting, setAdjusting] = useState(null);

  const load = useCallback(async () => {
    if (!outlet) return;
    setLoading(true);
    setError("");
    try {
      const params = { outlet };
      if (search) params.search = search;
      const data = await stockApi.getStock(params);
      setRows(data.stock || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load stock");
    } finally {
      setLoading(false);
    }
  }, [outlet, search]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const isLow = (r) => qtyOf(r) <= levelOf(r);
  const low = rows.filter(isLow);
  const visible = lowOnly ? low : rows;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="SKUs tracked" value={rows.length} accent="saffron" />
        <StatCard label="Units in stock" value={rows.reduce((s, r) => s + qtyOf(r), 0).toLocaleString("en-IN")} accent="sage" />
        <StatCard label="Low or out of stock" value={low.length} accent={low.length ? "brick" : "sage"} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, SKU or barcode" aria-label="Search stock" className={`${inputCls} max-w-xs`} />
        <label className="flex items-center gap-2 text-sm text-cream">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="accent-saffron" />Low stock only
        </label>
      </div>

      {error && <p role="alert" className="text-sm text-brick">{error}</p>}

      <div className="receipt-card relative overflow-x-auto rounded-sm">
        <span className="receipt-notch left-6" />
        {loading ? <p className="p-8 text-center text-sm text-muted">Loading…</p>
        : visible.length === 0 ? <p className="p-8 text-center text-sm text-muted">{lowOnly ? "Nothing is running low." : "No stock records for this outlet yet."}</p>
        : (
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead><tr className="border-b border-charcoal-lighter text-xs text-muted">
              <th className="px-5 pb-3 pt-7 font-medium">Product</th><th className="px-5 pb-3 pt-7 font-medium">SKU</th>
              <th className="px-5 pb-3 pt-7 text-right font-medium">In stock</th><th className="px-5 pb-3 pt-7 text-right font-medium">Reorder at</th><th className="px-5 pb-3 pt-7"></th>
            </tr></thead>
            <tbody>
              {visible.map((r, i) => (
                <tr key={r._id || `${r.sku}-${i}`} className="border-b border-charcoal-lighter last:border-0 hover:bg-charcoal">
                  <td className="px-5 py-3 text-cream">{nameOf(r)}{r.variantLabel && <p className="text-xs text-muted">{r.variantLabel}</p>}</td>
                  <td className="px-5 py-3 text-muted">{r.sku || "—"}</td>
                  <td className={`px-5 py-3 text-right font-medium ${qtyOf(r) <= 0 ? "text-brick" : isLow(r) ? "text-saffron" : "text-cream"}`}>{qtyOf(r)}</td>
                  <td className="px-5 py-3 text-right text-muted">{levelOf(r)}</td>
                  <td className="px-5 py-3 text-right"><button onClick={() => setAdjusting(r)} className="text-xs text-saffron hover:underline">Adjust</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {adjusting && <AdjustModal outlet={outlet} row={adjusting} onClose={() => setAdjusting(null)} onSaved={() => { setAdjusting(null); load(); }} />}
    </div>
  );
}

function AdjustModal({ outlet, row, onClose, onSaved }) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("restock");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const change = Number(delta) || 0;

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!change) return setError("Enter a change other than zero");
    if (qtyOf(row) + change < 0) return setError("That would take stock below zero");
    setSaving(true);
    try {
      await   stockApi.adjustStock({ outletId: outlet, itemId: row.item._id, variantId: row.variant._id, quantity: change, reason, notes })
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't adjust the stock.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} className="receipt-card relative w-full max-w-sm rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-cream">Adjust stock</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-cream">✕</button>
        </div>
        <p className="mt-1 text-sm text-muted">{nameOf(row)} · {qtyOf(row)} in stock</p>
        {error && <p role="alert" className="mt-2 text-sm text-brick">{error}</p>}
        <div className="mt-4 space-y-3">
          <div><label className={labelCls}>Change in units (use − to remove)</label>
            <input type="number" step="1" value={delta} onChange={(e) => setDelta(e.target.value)} required autoFocus className={inputCls} />
            {change !== 0 && <p className="mt-1 text-xs text-muted">New total {qtyOf(row) + change}</p>}</div>
          <div><label className={labelCls}>Reason</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputCls} capitalize`}>{REASONS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
          <div><label className={labelCls}>Notes</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
          <button disabled={saving} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">{saving ? "Saving…" : "Save adjustment"}</button>
        </div>
      </form>
    </div>
  );
}

function Movements({ outlet }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!outlet) return;
    setLoading(true);
    setError("");
    stockApi.getMovements({ outlet, limit: 100 })
      .then((d) => setRows(d.movements || []))
      .catch((err) => setError(err.response?.data?.message || "Failed to load movements"))
      .finally(() => setLoading(false));
  }, [outlet]);

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-sm text-brick">{error}</p>}
      <div className="receipt-card relative overflow-x-auto rounded-sm">
        <span className="receipt-notch left-6" />
        {loading ? <p className="p-8 text-center text-sm text-muted">Loading…</p>
        : rows.length === 0 ? <p className="p-8 text-center text-sm text-muted">No stock movements yet. Sales, purchases and adjustments appear here.</p>
        : (
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead><tr className="border-b border-charcoal-lighter text-xs text-muted">
              {["Date", "Product", "Reason"].map((h) => <th key={h} className="px-5 pb-3 pt-7 font-medium">{h}</th>)}
              <th className="px-5 pb-3 pt-7 text-right font-medium">Change</th>
            </tr></thead>
            <tbody>
              {rows.map((m, i) => (
                <tr key={m._id || i} className="border-b border-charcoal-lighter last:border-0 hover:bg-charcoal">
                  <td className="px-5 py-3 text-muted">{new Date(m.createdAt || m.date).toLocaleString("en-IN")}</td>
                  <td className="px-5 py-3 text-cream">{nameOf(m)}{m.sku && <p className="text-xs text-muted">{m.sku}</p>}</td>
                  <td className="px-5 py-3 capitalize text-muted">{(m.reason || m.type || "").replace(/_/g, " ")}</td>
                  <td className={`px-5 py-3 text-right font-medium ${(m.quantity ?? m.change) >= 0 ? "text-sage" : "text-brick"}`}>{(m.quantity ?? m.change) > 0 ? "+" : ""}{m.quantity ?? m.change}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
