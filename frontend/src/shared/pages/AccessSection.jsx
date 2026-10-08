import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getOutlets } from "../api/outlets";
import * as accessApi from "../api/accessApi";

const ROLE_LABEL = { owner: "Owner", manager: "Manager", investor: "Investor", partner: "Partner", cashier: "Cashier", waiter: "Waiter", kitchen: "Kitchen" };
const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const labelCls = "mb-1 block text-xs text-muted";

export default function AccessSection() {
  const { user } = useAuth();
  const [options, setOptions] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // existing user being edited, or {} for new

  const creatableRoles = user.role === "owner"
    ? ["manager", "investor", "partner", "cashier", "waiter", "kitchen"]
    : (options?.managerAssignableRoles || []);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [opts, outletsRes, staffRes] = await Promise.all([
        accessApi.getAccessOptions(),
        getOutlets(),
        accessApi.getStaffUsers(),
      ]);
      setOptions(opts);
      setOutlets((outletsRes.outlets || []).filter((o) => o.isActive));
      setStaffUsers(staffRes.users);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load access data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function handleDelete(id, name) {
    if (!confirm(`Remove ${name}'s account? They will no longer be able to log in.`)) return;
    try {
      await accessApi.deleteStaffUser(id);
      loadAll();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove account");
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">System Access</h1>
          <p className="mt-1 text-sm text-muted">Decide exactly what each person can see and do — per outlet.</p>
        </div>
        <button onClick={() => setEditing({})} className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark">
          + Add Person
        </button>
      </div>

      {error && <p className="text-sm text-brick">{error}</p>}

      <div className="receipt-card relative overflow-x-auto rounded-sm">
        <span className="receipt-notch left-6" />
        {staffUsers.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">No other accounts yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-charcoal-lighter text-xs uppercase tracking-wide text-muted">
                <th className="px-5 pb-3 pt-7 font-medium">Name</th>
                <th className="px-5 pb-3 pt-7 font-medium">Role</th>
                <th className="px-5 pb-3 pt-7 font-medium">Permissions</th>
                <th className="px-5 pb-3 pt-7 font-medium">Outlets</th>
                <th className="px-5 pb-3 pt-7 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {staffUsers.map((u) => (
                <tr key={u.id} className="border-b border-charcoal-lighter transition-colors last:border-0 hover:bg-charcoal">
                  <td className="px-5 py-3 text-cream">{u.name}<p className="text-xs text-muted">{u.email}</p></td>
                  <td className="px-5 py-3 text-muted">{ROLE_LABEL[u.role]}</td>
                  <td className="px-5 py-3 text-muted">{u.permissions?.length || 0} granted</td>
                  <td className="px-5 py-3 text-muted">{u.outletAccess?.length ? u.outletAccess.map((o) => o.name).join(", ") : "None assigned"}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => setEditing(u)} className="text-xs text-saffron hover:underline">Edit</button>
                    <span className="mx-2 text-charcoal-lighter">·</span>
                    <button onClick={() => handleDelete(u.id, u.name)} className="text-xs text-brick hover:underline">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <AccessModal
          existing={editing.id ? editing : null}
          options={options}
          outlets={outlets}
          creatableRoles={creatableRoles}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); loadAll(); }}
        />
      )}
    </div>
  );
}

function AccessModal({ existing, options, outlets, creatableRoles, onClose, onSaved }) {
  const isNew = !existing;
  const [name, setName] = useState(existing?.name || "");
  const [email, setEmail] = useState(existing?.email || "");
  const [phone, setPhone] = useState(existing?.phone || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(existing?.role || creatableRoles[0] || "waiter");
  const [permissions, setPermissions] = useState(existing?.permissions || options.defaultsByRole[role] || []);
  const [outletAccess, setOutletAccess] = useState((existing?.outletAccess || []).map((o) => o._id || o));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function handleRoleChange(newRole) {
    setRole(newRole);
    if (isNew) setPermissions(options.defaultsByRole[newRole] || []); // only auto-fill defaults for brand-new accounts
  }

  function togglePermission(key) {
    setPermissions((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));
  }
  function toggleOutlet(id) {
    setOutletAccess((prev) => (prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (isNew) {
        if (!password) { setError("Password is required for a new account"); setSaving(false); return; }
        await accessApi.createStaffUser({ name, email, phone, password, role, permissions, outletAccess });
      } else {
        await accessApi.updateStaffAccess(existing.id, { role, permissions, outletAccess });
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={handleSubmit} className="receipt-card relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-cream">{isNew ? "Add Person" : `Edit ${existing.name}'s Access`}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-cream">✕</button>
        </div>

        {error && <p className="mb-3 text-sm text-brick">{error}</p>}

        {isNew && (
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className={labelCls}>Name</label><input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} /></div>
            <div className="col-span-2"><label className={labelCls}>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} /></div>
            <div><label className={labelCls}>Phone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Password</label><input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required className={inputCls} /></div>
          </div>
        )}

        <div className="mb-4">
          <label className={labelCls}>Role</label>
          <select value={role} onChange={(e) => handleRoleChange(e.target.value)} disabled={!isNew && !creatableRoles.includes(existing.role)} className={inputCls}>
            {creatableRoles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </div>

        <div className="mb-4">
          <p className={labelCls}>Outlet access</p>
          <div className="flex flex-wrap gap-2">
            {outlets.map((o) => (
              <label key={o._id} className={`cursor-pointer rounded-sm border px-3 py-1.5 text-sm ${outletAccess.includes(o._id) ? "border-saffron text-saffron" : "border-charcoal-lighter text-muted"}`}>
                <input type="checkbox" className="hidden" checked={outletAccess.includes(o._id)} onChange={() => toggleOutlet(o._id)} />
                {o.name}
              </label>
            ))}
          </div>
          {outletAccess.length === 0 && <p className="mt-1 text-xs text-brick">No outlets selected — this person won't see any orders/tables.</p>}
        </div>

        <div>
          <p className={labelCls}>Permissions</p>
          <div className="space-y-3">
            {options.groups.map((g) => (
              <div key={g.label}>
                <p className="mb-1 text-xs text-cream">{g.label}</p>
                <div className="flex flex-wrap gap-2">
                  {g.keys.map((key) => (
                    <label key={key} className={`cursor-pointer rounded-sm border px-2.5 py-1 text-xs ${permissions.includes(key) ? "border-saffron text-saffron" : "border-charcoal-lighter text-muted"}`}>
                      <input type="checkbox" className="hidden" checked={permissions.includes(key)} onChange={() => togglePermission(key)} />
                      {key.replace(/_/g, " ")}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
          <button disabled={saving} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">
            {saving ? "Saving…" : isNew ? "Create Account" : "Save Access"}
          </button>
        </div>
      </form>
    </div>
  );
}