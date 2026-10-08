import { useEffect, useState, useCallback } from "react";
import * as customersApi from "../api/customersApi";

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const labelCls = "mb-1 block text-xs text-muted";

export default function CustomersTab() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await customersApi.getCustomers(search ? { search } : {});
      setCustomers(res.customers);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  async function handleRemove(id, name) {
    if (!window.confirm(`Remove ${name} from customers?`)) return;
    try {
      await customersApi.deactivateCustomer(id);
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to remove");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone, email…"
          className={`${inputCls} max-w-xs`}
        />
        <button onClick={() => setModal({})} className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark">
          + Add Customer
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-brick">{error}</p>}

      <div className="receipt-card relative mt-4 overflow-x-auto rounded-sm">
        <span className="receipt-notch left-6" />
        {loading ? (
          <p className="p-8 text-center text-sm text-muted">Loading…</p>
        ) : customers.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">
            No customers recorded yet — add repeat walk-ins, phone or delivery customers here to track their order history.
          </p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-charcoal-lighter text-xs uppercase tracking-wide text-muted">
                <th className="px-5 pb-3 pt-7 font-medium">Name</th>
                <th className="px-5 pb-3 pt-7 font-medium">Phone</th>
                <th className="px-5 pb-3 pt-7 font-medium">Email</th>
                <th className="px-5 pb-3 pt-7 font-medium">Orders</th>
                <th className="px-5 pb-3 pt-7 font-medium">Total Spent</th>
                <th className="px-5 pb-3 pt-7 font-medium">Last Order</th>
                <th className="px-5 pb-3 pt-7 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c._id} className="border-b border-charcoal-lighter transition-colors last:border-0 hover:bg-charcoal">
                  <td className="px-5 py-3 text-cream">{c.name}</td>
                  <td className="px-5 py-3 text-muted">{c.phone}</td>
                  <td className="px-5 py-3 text-muted">{c.email || "—"}</td>
                  <td className="px-5 py-3 text-muted">{c.orderCount}</td>
                  <td className="px-5 py-3 text-cream">₹{c.totalSpent.toLocaleString("en-IN")}</td>
                  <td className="px-5 py-3 text-muted">{c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString("en-IN") : "—"}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => setModal(c)} className="text-xs text-saffron hover:underline">Edit</button>
                    <span className="mx-2 text-charcoal-lighter">·</span>
                    <button onClick={() => handleRemove(c._id, c.name)} className="text-xs text-brick hover:underline">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal !== null && (
        <CustomerFormModal existing={modal._id ? modal : null} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
    </div>
  );
}

function CustomerFormModal({ existing, onClose, onSaved }) {
  const [name, setName] = useState(existing?.name || "");
  const [phone, setPhone] = useState(existing?.phone || "");
  const [email, setEmail] = useState(existing?.email || "");
  const [address, setAddress] = useState(existing?.address || "");
  const [notes, setNotes] = useState(existing?.notes || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !phone.trim()) return setError("Name and phone are required");
    setSaving(true);
    try {
      if (existing) await customersApi.updateCustomer(existing._id, { name, phone, email, address, notes });
      else await customersApi.createCustomer({ name, phone, email, address, notes });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save customer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <form onSubmit={handleSubmit} className="receipt-card max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-cream">{existing ? "Edit" : "Add"} Customer</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-cream">✕</button>
        </div>
        {error && <p className="mt-2 text-sm text-brick">{error}</p>}
        <div className="mt-4 space-y-3">
          <div><label className={labelCls}>Name</label><input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} /></div>
          <div><label className={labelCls}>Phone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} required className={inputCls} /></div>
          <div><label className={labelCls}>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Address</label><input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Notes</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
          <button disabled={saving} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}