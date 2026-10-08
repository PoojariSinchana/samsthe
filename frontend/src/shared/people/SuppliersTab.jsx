import { useEffect, useState } from "react";
import * as sup from "../api/suppliersApi";

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";

export default function SuppliersTab() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await sup.getSuppliers();
      setSuppliers(res.suppliers);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivate(id, name) {
    if (!window.confirm(`Remove supplier "${name}"?`)) return;
    try {
      await sup.deactivateSupplier(id);
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to remove supplier");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{suppliers.length} suppliers</p>
        <button onClick={() => setModal({})} className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark">
          + Add Supplier
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-brick">{error}</p>}

      <div className="receipt-card relative mt-4 rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : suppliers.length === 0 ? (
          <p className="text-muted">No suppliers yet.</p>
        ) : (
          <ul className="divide-y divide-charcoal-lighter">
            {suppliers.map((s) => (
              <li key={s._id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="text-cream">{s.name}</p>
                  {s.phone && <p className="text-xs text-muted">{s.phone}</p>}
                  {s.notes && <p className="text-xs text-muted">{s.notes}</p>}
                </div>
                <div className="flex gap-3 text-xs">
                  <button onClick={() => setModal(s)} className="text-saffron hover:text-saffron-dark">Edit</button>
                  <button onClick={() => handleDeactivate(s._id, s.name)} className="text-brick hover:underline">Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modal !== null && (
        <SupplierFormModal existing={modal._id ? modal : null} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
    </div>
  );
}

function SupplierFormModal({ existing, onClose, onSaved }) {
  const [name, setName] = useState(existing?.name || "");
  const [phone, setPhone] = useState(existing?.phone || "");
  const [notes, setNotes] = useState(existing?.notes || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Name is required");
    setSaving(true);
    try {
      if (existing) await sup.updateSupplier(existing._id, { name, phone, notes });
      else await sup.createSupplier({ name, phone, notes });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save supplier");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={handleSubmit} className="receipt-card w-full max-w-sm rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-cream">{existing ? "Edit" : "Add"} Supplier</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-cream">✕</button>
        </div>
        {error && <p className="mt-2 text-sm text-brick">{error}</p>}
        <div className="mt-4 space-y-3">
          <div><label className="mb-1 block text-xs text-muted">Name</label><input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} /></div>
          <div><label className="mb-1 block text-xs text-muted">Phone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} /></div>
          <div><label className="mb-1 block text-xs text-muted">Notes</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
          <button disabled={saving} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}