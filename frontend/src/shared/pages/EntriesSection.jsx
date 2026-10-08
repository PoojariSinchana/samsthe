import { useEffect, useState, useCallback } from "react";
import * as entriesApi from "../api/entriesApi";
import * as partnersApi from "../api/partnersApi";
import { startOfLocalDay, endOfLocalDay } from "../utils/dateRange";

const TABS = ["All Transactions", "Add Transaction"];
const TYPE_COLOR = { INCOME: "text-sage", EXPENSE: "text-brick", INVENTORY: "text-saffron", PURCHASE: "text-saffron", ASSET: "text-cream", LIABILITY: "text-brick", EQUITY: "text-cream", TRANSFER: "text-muted" };

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const labelCls = "mb-1 block text-xs text-muted";

function humanize(s) {
  return s ? s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : "";
}

// The 12 plain-language choices — each maps to a fixed entryType (and a
// fixedCategory or direction, for loans/equity) so the person never sees
// accounting terminology. "fields" lists which simple inputs this kind
// actually needs; everything else stays hidden.
//
// IMPORTANT: category OPTIONS are never hardcoded here — they're always
// pulled from `meta.categoriesByType` (fetched from the backend), the same
// single source of truth the old Manual Entry form used. A kind either
// lists "category" in its `fields` (to show a picker sourced from meta)
// or sets `fixedCategory` (no picker needed at all). Never both silently
// defaulting from a local list — that's what caused "paid_someone" to
// mis-save every entry as PACKAGING.
const TRANSACTION_KINDS = [
  { key: "sale", label: "I made a sale", emoji: "💰", entryType: "INCOME", fields: ["category", "amount", "paymentMethod", "date", "notes"] },
  { key: "bought_stock", label: "I bought stock/ingredients", emoji: "🧺", entryType: "INVENTORY", fields: ["category", "description", "quantity", "amount", "supplier", "paymentMethod", "date", "notes"] },
  { key: "expense", label: "I paid an expense", emoji: "🧾", entryType: "EXPENSE", fields: ["category", "description", "amount", "paymentMethod", "date", "notes"] },
  { key: "received_money", label: "I received money", emoji: "📥", entryType: "INCOME", fixedCategory: "OTHER_INCOME", fields: ["description", "amount", "paymentMethod", "date", "notes"] },
  { key: "paid_someone", label: "I paid someone (supplier)", emoji: "🤝", entryType: "PURCHASE", fields: ["category", "description", "amount", "supplier", "paymentMethod", "date", "notes"] },
  { key: "loan_received", label: "I received a loan", emoji: "🏦", entryType: "LIABILITY", fixedCategory: "LOAN", direction: "in", fields: ["description", "amount", "paymentMethod", "date", "notes"] },
  { key: "loan_repaid", label: "I repaid a loan", emoji: "↩️", entryType: "LIABILITY", fixedCategory: "LOAN", direction: "out", fields: ["description", "amount", "paymentMethod", "date", "notes"] },
  { key: "asset", label: "I bought an asset/equipment", emoji: "🧊", entryType: "ASSET", fields: ["category", "description", "amount", "paymentMethod", "date", "notes"] },
  { key: "owner_added", label: "Owner added money", emoji: "➕", entryType: "EQUITY", fixedCategory: "OWNER_CAPITAL", direction: "in", fields: ["partner", "amount", "paymentMethod", "date", "notes"] },
  { key: "owner_withdrew", label: "Owner withdrew money", emoji: "➖", entryType: "EQUITY", fixedCategory: "OWNER_WITHDRAWAL", direction: "out", fields: ["partner", "amount", "paymentMethod", "date", "notes"] },
  { key: "transfer", label: "Transfer between accounts", emoji: "🔁", entryType: "TRANSFER", fields: ["transfer", "amount", "date", "notes"] },
  { key: "other", label: "Other", emoji: "📌", entryType: "EXPENSE", fields: ["entryType", "category", "description", "amount", "paymentMethod", "date", "notes"] },
];

export default function EntriesSection({ initialTab }) {
  const [tab, setTab] = useState(initialTab || "All Transactions");
  const [meta, setMeta] = useState({ entryTypes: [], paymentMethods: [], categoriesByType: {} });

  useEffect(() => {
    entriesApi.getMeta().then(setMeta).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-cream sm:text-3xl">Transactions</h1>
        <p className="mt-1 text-sm text-muted">Every sale, expense, purchase and payment — in one place.</p>
      </div>

      <div className="flex gap-2 border-b border-charcoal-lighter">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm ${tab === t ? "border-b-2 border-saffron text-saffron" : "text-muted hover:text-cream"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "All Transactions" && <AllEntriesTab meta={meta} />}
      {tab === "Add Transaction" && (
        <AddTransactionTab meta={meta} onSaved={() => setTab("All Transactions")} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Add Transaction — pick what happened, then only the relevant fields show.
// ─────────────────────────────────────────────────────────────────────────
function AddTransactionTab({ meta, onSaved }) {
  const [kind, setKind] = useState(null);

  if (!kind) {
    return (
      <div>
        <p className="mb-4 text-sm text-muted">What happened?</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {TRANSACTION_KINDS.map((k) => (
            <button
              key={k.key}
              onClick={() => setKind(k)}
              className="receipt-card relative rounded-sm px-4 pb-5 pt-7 text-left transition-colors hover:border-saffron"
            >
              <span className="receipt-notch left-6" />
              <span className="text-2xl">{k.emoji}</span>
              <p className="mt-2 text-sm text-cream">{k.label}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return <TransactionForm kind={kind} meta={meta} onBack={() => setKind(null)} onSaved={onSaved} />;
}

function TransactionForm({ kind, meta, onBack, onSaved }) {
  const has = (field) => kind.fields.includes(field);

  const [entryType, setEntryType] = useState(kind.entryType);
  const [category, setCategory] = useState(kind.fixedCategory || "");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [transferFrom, setTransferFrom] = useState("cash");
  const [transferTo, setTransferTo] = useState("bank");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [partners, setPartners] = useState([]);
  const [partnerId, setPartnerId] = useState("");

  useEffect(() => {
    if (!kind.fields.includes("partner")) return;
    partnersApi.getPartners().then((res) => setPartners(res.partners)).catch(() => {});
  }, [kind]);

  // Category OPTIONS always come from meta (the backend's own enum) — never
  // a locally hardcoded list. If a kind fixes its entryType, we look up that
  // type's categories in meta; "other" lets the person change entryType, so
  // it looks up whichever type is currently selected.
  const categoryChoices = has("entryType")
    ? meta.categoriesByType[entryType] || []
    : meta.categoriesByType[kind.entryType] || [];

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    let finalDescription = description.trim() || humanize(category) || kind.label;
    if (!amount) return setError("Amount is required");
    if (kind.entryType === "TRANSFER" && transferFrom === transferTo) return setError("Pick two different accounts");
    if ((has("category") || has("entryType")) && !category) return setError("Pick a category");
    if (has("partner")) {
      if (!partnerId) return setError("Select who is adding/withdrawing money");
      const partner = partners.find((p) => p._id === partnerId);
      finalDescription = partner
        ? `${kind.key === "owner_withdrew" ? "Withdrawal by" : "Investment by"} ${partner.name} (${partner.role})`
        : finalDescription;
    }

    setSaving(true);
    try {
      await entriesApi.createEntry({
        entryType,
        category: has("category") || has("entryType") ? category : kind.fixedCategory,
        direction: kind.direction,
        description: finalDescription,
        amount,
        quantity: has("quantity") ? quantity || undefined : undefined,
        unit: has("quantity") ? unit || undefined : undefined,
        supplierName: has("supplier") ? supplierName : "",
        paymentMethod: has("paymentMethod") ? paymentMethod : undefined,
        transferFrom: has("transfer") ? transferFrom : undefined,
        transferTo: has("transfer") ? transferTo : undefined,
        date,
        notes: has("partner") && partnerId ? `${notes ? notes + " · " : ""}partnerId:${partnerId}` : notes,
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="receipt-card relative max-w-md rounded-sm px-5 pb-6 pt-8">
      <span className="receipt-notch left-6" />
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg text-cream">{kind.emoji} {kind.label}</h2>
        <button type="button" onClick={onBack} className="text-xs text-muted hover:text-cream">← Change</button>
      </div>

      {error && <p className="mb-3 text-sm text-brick">{error}</p>}

      <div className="space-y-3">
        {has("entryType") && (
          <div>
            <label className={labelCls}>Type</label>
            <select value={entryType} onChange={(e) => { setEntryType(e.target.value); setCategory(""); }} className={inputCls}>
              {meta.entryTypes.filter((t) => t !== "TRANSFER").map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
            </select>
          </div>
        )}

        {(has("category") || has("entryType")) && (
          <div>
            <label className={labelCls}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} required className={inputCls}>
              <option value="">Select…</option>
              {categoryChoices.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
            </select>
          </div>
        )}
        {has("partner") && (
          <div>
            <label className={labelCls}>Who is {kind.key === "owner_withdrew" ? "withdrawing" : "adding"} money?</label>
            <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} required className={inputCls}>
              <option value="">Select…</option>
              {partners.map((p) => (
                <option key={p._id} value={p._id}>{p.name} ({p.role})</option>
              ))}
            </select>
            {partners.length === 0 && (
              <p className="mt-1 text-xs text-muted">
                No owners/partners recorded yet — add them under People → Owner/Partners first.
              </p>
            )}
          </div>
        )}


        {has("description") && (
          <div>
            <label className={labelCls}>{kind.entryType === "INVENTORY" ? "What did you buy?" : "Description"}</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={kind.entryType === "INVENTORY" ? "e.g. Rice" : "e.g. September rent"} className={inputCls} />
          </div>
        )}

        {has("quantity") && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Quantity</label><input type="number" min="0" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Unit</label><input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg" className={inputCls} /></div>
          </div>
        )}

        {has("supplier") && (
          <div><label className={labelCls}>Supplier (optional)</label><input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className={inputCls} /></div>
        )}

        <div><label className={labelCls}>Amount (₹) *</label><input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required className={inputCls} /></div>

        {has("transfer") && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>From</label>
              <select value={transferFrom} onChange={(e) => setTransferFrom(e.target.value)} className={inputCls}>
                {meta.paymentMethods.map((m) => <option key={m} value={m}>{humanize(m)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>To</label>
              <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)} className={inputCls}>
                {meta.paymentMethods.map((m) => <option key={m} value={m}>{humanize(m)}</option>)}
              </select>
            </div>
          </div>
        )}

        {has("paymentMethod") && (
          <div>
            <label className={labelCls}>Paid through</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputCls}>
              {meta.paymentMethods.map((m) => <option key={m} value={m}>{humanize(m)}</option>)}
            </select>
          </div>
        )}

        <div><label className={labelCls}>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Notes (optional)</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></div>
      </div>

      <button disabled={saving} className="mt-5 w-full rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// All Entries and EntryEditModal — copied unchanged from your existing file.
// ─────────────────────────────────────────────────────────────────────────

function AllEntriesTab({ meta }) {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);

  const [search, setSearch] = useState("");
  const [entryType, setEntryType] = useState("");
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (entryType) params.entryType = entryType;
      if (category) params.category = category;
      // Local-day boundaries (see utils/dateRange) — otherwise the end date
      // gets cut off partway through the day for anyone not on UTC.
      if (from) params.from = startOfLocalDay(from);
      if (to) params.to = endOfLocalDay(to);
      if (paymentMethod) params.paymentMethod = paymentMethod;
      const data = await entriesApi.getEntries(params);
      setEntries(data.entries);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load entries");
    } finally {
      setLoading(false);
    }
  }, [page, search, entryType, category, from, to, paymentMethod]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  function resetPage(setter) {
    return (v) => { setter(v); setPage(1); };
  }

  async function handleCancel(id) {
    if (!confirm("Cancel this entry? It will be marked cancelled and reversed from Accounting.")) return;
    try {
      await entriesApi.cancelEntry(id);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to cancel entry");
    }
  }

  const categoryOptions = entryType ? meta.categoriesByType[entryType] || [] : [];

  return (
    <div className="space-y-4">
      <div className="receipt-card relative rounded-sm px-5 pb-4 pt-7">
        <span className="receipt-notch left-6" />
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className={labelCls}>Search</label>
            <input value={search} onChange={(e) => resetPage(setSearch)(e.target.value)} placeholder="Description, supplier…" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Type</label>
            <select value={entryType} onChange={(e) => { resetPage(setEntryType)(e.target.value); setCategory(""); }} className={inputCls}>
              <option value="">All types</option>
              {meta.entryTypes.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
            </select>
          </div>
          {entryType && (
            <div>
              <label className={labelCls}>Category</label>
              <select value={category} onChange={(e) => resetPage(setCategory)(e.target.value)} className={inputCls}>
                <option value="">All categories</option>
                {categoryOptions.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className={labelCls}>Payment</label>
            <select value={paymentMethod} onChange={(e) => resetPage(setPaymentMethod)(e.target.value)} className={inputCls}>
              <option value="">All methods</option>
              {meta.paymentMethods.map((m) => <option key={m} value={m} className="capitalize">{humanize(m)}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>From</label>
            <input type="date" value={from} onChange={(e) => resetPage(setFrom)(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>To</label>
            <input type="date" value={to} onChange={(e) => resetPage(setTo)(e.target.value)} className={inputCls} />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-brick">{error}</p>}

      <div className="receipt-card relative overflow-x-auto rounded-sm">
        <span className="receipt-notch left-6" />
        {loading ? (
          <p className="p-8 text-center text-sm text-muted">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">No entries match this filter.</p>
        ) : (
                    <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-charcoal-lighter text-xs uppercase tracking-wide text-muted">
                <th className="px-5 pb-3 pt-7 font-medium">Date</th>
                <th className="px-5 pb-3 pt-7 font-medium">Description</th>
                <th className="px-5 pb-3 pt-7 font-medium">Type</th>
                <th className="px-5 pb-3 pt-7 font-medium">Category</th>
                <th className="px-5 pb-3 pt-7 font-medium">Outlet / Table</th>
                <th className="px-5 pb-3 pt-7 font-medium">Payment</th>
                <th className="px-5 pb-3 pt-7 font-medium">Recorded by</th>
                <th className="px-5 pb-3 pt-7 text-right font-medium">Amount</th>
                <th className="px-5 pb-3 pt-7 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e._id} className="border-b border-charcoal-lighter transition-colors last:border-0 hover:bg-charcoal">
                  <td className="px-5 py-3 text-muted">{new Date(e.date).toLocaleDateString("en-IN")}</td>
                  <td className="px-5 py-3 text-cream">
                    {e.description}
                    {e.source === "ORDER" && <span className="ml-2 rounded-full bg-sage/10 px-2 py-0.5 text-xs text-sage">From Order</span>}
                  </td>
                  <td className={`px-5 py-3 ${TYPE_COLOR[e.entryType]}`}>{humanize(e.entryType)}</td>
                  <td className="px-5 py-3 text-muted">{humanize(e.category)}</td>
                  <td className="px-5 py-3 text-muted">
                    {e.outlet?.name || "—"}
                    {e.orderId?.table ? ` · ${e.orderId.table.name || e.orderId.table.tableNumber}` : ""}
                    {e.orderId?.orderNumber ? <span className="ml-1 text-xs">({e.orderId.orderNumber})</span> : ""}
                  </td>
                  <td className="px-5 py-3 capitalize text-muted">{e.paymentMethod ? humanize(e.paymentMethod) : "—"}</td>
                  <td className="px-5 py-3 text-muted">{e.createdBy?.name || "—"}</td>
                  <td className="px-5 py-3 text-right font-medium text-cream">₹{e.amount.toLocaleString("en-IN")}</td>
                  <td className="px-5 py-3 text-right">
                    {e.source === "ORDER" ? (
                      <span className="text-xs text-muted">Managed via Orders</span>
                    ) : (
                      <>
                        <button onClick={() => setEditing(e)} className="text-xs text-saffron hover:underline">Edit</button>
                        <span className="mx-2 text-charcoal-lighter">·</span>
                        <button onClick={() => handleCancel(e._id)} className="text-xs text-brick hover:underline">Cancel</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>Page {page} of {pages} · {total} entries</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-sm border border-charcoal-lighter px-3 py-1.5 hover:text-cream disabled:opacity-40">Previous</button>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="rounded-sm border border-charcoal-lighter px-3 py-1.5 hover:text-cream disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {editing && (
        <EntryEditModal meta={meta} entry={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

function EntryEditModal({ meta, entry, onClose, onSaved }) {
  const [form, setForm] = useState({
    entryType: entry.entryType,
    category: entry.category,
    description: entry.description,
    amount: entry.amount,
    quantity: entry.quantity || "",
    unit: entry.unit || "",
    supplierName: entry.supplierName || "",
    paymentMethod: entry.paymentMethod || "",
    date: entry.date.slice(0, 10),
    notes: entry.notes || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await entriesApi.updateEntry(entry._id, form);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update entry");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={handleSubmit} className="receipt-card w-full max-w-md rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-cream">Edit Entry</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-cream">✕</button>
        </div>
        {error && <p className="mt-2 text-sm text-brick">{error}</p>}
        <div className="mt-4 space-y-3">
          <div><label className={labelCls}>Description</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required className={inputCls} /></div>
          <div><label className={labelCls}>Amount (₹)</label><input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required className={inputCls} /></div>
          <div><label className={labelCls}>Payment Method</label>
            <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} className={inputCls}>
              <option value="">—</option>
              {meta.paymentMethods.map((m) => <option key={m} value={m}>{humanize(m)}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>Date</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} /></div>
          <div><label className={labelCls}>Notes</label><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} /></div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
          <button disabled={saving} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">{saving ? "Saving…" : "Update Entry"}</button>
        </div>
      </form>
    </div>
  );
}