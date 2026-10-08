import { useEffect, useMemo, useState } from "react";
import * as authApi from "../api/adminAuthApi";
import { useAdminAuth } from "../context/AdminAuthContext";

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const labelCls = "mb-1 block text-xs text-muted";

const human = (s) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

// VIEW_LEADS + MANAGE_LEADS -> one "Leads" group; standalone keys get their own group.
function groupPermissions(perms) {
  const groups = new Map();
  for (const p of perms) {
    const base = p.replace(/^(VIEW|MANAGE)_/, "");
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push(p);
  }
  return [...groups.entries()].map(([base, keys]) => ({ label: human(base), keys }));
}

export default function AdminUsersSection() {
  const { admin: me } = useAdminAuth();
  const [admins, setAdmins] = useState([]);
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // {} = new, admin = edit

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [list, opts] = await Promise.all([authApi.listAdmins(), authApi.getAccessOptions()]);
      setAdmins(list.admins);
      setOptions(opts);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't load admin users.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function toggleActive(a) {
    try {
      await authApi.updateAdmin(a.id, { isActive: !a.isActive });
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't update that account.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Admin users</h1>
          <p className="mt-1 text-sm text-muted">Everyone who can sign in to this portal, and what each person can do.</p>
        </div>
        <button onClick={() => setEditing({})} disabled={!options}
          className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">
          Add admin user
        </button>
      </div>

      {error && <p role="alert" className="text-sm text-brick">{error}</p>}

      <div className="receipt-card relative overflow-x-auto rounded-sm">
        <span className="receipt-notch left-6" />
        {loading ? (
          <p className="p-8 text-center text-sm text-muted">Loading…</p>
        ) : admins.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">No admin users yet.</p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-charcoal-lighter text-xs text-muted">
                <th className="px-5 pb-3 pt-7 font-medium">Name</th>
                <th className="px-5 pb-3 pt-7 font-medium">Role</th>
                <th className="px-5 pb-3 pt-7 font-medium">Permissions</th>
                <th className="px-5 pb-3 pt-7 font-medium">Last login</th>
                <th className="px-5 pb-3 pt-7 font-medium">Status</th>
                <th className="px-5 pb-3 pt-7"></th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => {
                const isSelf = a.id === me.id;
                const locked = a.role === "superadmin" && me.role !== "superadmin";
                return (
                  <tr key={a.id} className="border-b border-charcoal-lighter last:border-0 hover:bg-charcoal">
                    <td className="px-5 py-3 text-cream">{a.name}{isSelf && <span className="ml-2 text-xs text-muted">(you)</span>}
                      <p className="text-xs text-muted">{a.email}</p></td>
                    <td className="px-5 py-3 capitalize text-muted">{a.role}</td>
                    <td className="px-5 py-3 text-muted">{a.role === "superadmin" ? "All" : `${a.permissions?.length || 0} granted`}</td>
                    <td className="px-5 py-3 text-muted">{a.lastLogin ? new Date(a.lastLogin).toLocaleDateString("en-IN") : "Never"}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${a.isActive ? "bg-sage/10 text-sage" : "bg-brick/10 text-brick"}`}>
                        {a.isActive ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {locked ? (
                        <span className="text-xs text-muted">Superadmin only</span>
                      ) : (
                        <>
                          <button onClick={() => setEditing(a)} className="text-xs text-saffron hover:underline">Edit</button>
                          {!isSelf && (
                            <>
                              <span className="mx-2 text-charcoal-lighter">·</span>
                              <button onClick={() => toggleActive(a)} className={`text-xs hover:underline ${a.isActive ? "text-brick" : "text-sage"}`}>
                                {a.isActive ? "Deactivate" : "Reactivate"}
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editing && options && (
        <AdminUserModal existing={editing.id ? editing : null} options={options} me={me}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

function AdminUserModal({ existing, options, me, onClose, onSaved }) {
  const isNew = !existing;
  const [name, setName] = useState(existing?.name || "");
  const [email, setEmail] = useState(existing?.email || "");
  const [phone, setPhone] = useState(existing?.phone || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(existing?.role || "support");
  const [permissions, setPermissions] = useState(existing?.permissions || options.defaultsByRole["support"] || []);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const roles = options.roles.filter((r) => r !== "superadmin" || me.role === "superadmin");
  const groups = useMemo(() => groupPermissions(options.permissions), [options.permissions]);
  const isSuper = role === "superadmin";
  const canGrant = (p) => me.role === "superadmin" || (me.permissions || []).includes(p);

  function changeRole(r) {
    setRole(r);
    setPermissions(options.defaultsByRole[r] || []); // sensible starting point; still editable
  }
  const toggle = (p) => setPermissions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const perms = isSuper ? [] : permissions;
      if (isNew) {
        await authApi.createAdmin({ name, email, phone, password, role, permissions: perms });
      } else {
        const body = { name, phone, role, permissions: perms };
        if (password) body.password = password;
        await authApi.updateAdmin(existing.id, body);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't save this admin user.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <form onSubmit={handleSubmit} className="receipt-card relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-sm">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between px-5 pb-3 pt-8 sm:px-6">
          <h2 className="font-display text-xl text-cream">{isNew ? "Add admin user" : `Edit ${existing.name}`}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-cream">✕</button>
        </div>
        {error && <p role="alert" className="px-5 text-sm text-brick sm:px-6">{error}</p>}

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-3 sm:px-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className={labelCls}>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} /></div>
            <div><label className={labelCls}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={!isNew} className={`${inputCls} disabled:opacity-60`} /></div>
            <div><label className={labelCls}>Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>{isNew ? "Password" : "Reset password (optional)"}</label>
              <input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required={isNew}
                placeholder="At least 8 characters" className={inputCls} /></div>
            <div><label className={labelCls}>Role</label>
              <select value={role} onChange={(e) => changeRole(e.target.value)} className={inputCls}>
                {roles.map((r) => <option key={r} value={r}>{human(r)}</option>)}
              </select></div>
          </div>

          <div>
            <p className={labelCls}>Permissions</p>
            {isSuper ? (
              <p className="text-sm text-muted">Superadmins can do everything, so there's nothing to select.</p>
            ) : (
              <div className="space-y-3">
                {groups.map((g) => (
                  <div key={g.label}>
                    <p className="mb-1 text-xs text-cream">{g.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {g.keys.map((k) => {
                        const on = permissions.includes(k);
                        const disabled = !canGrant(k) && !on;
                        return (
                          <label key={k} title={disabled ? "You can't grant a permission you don't have" : undefined}
                            className={`rounded-sm border px-2.5 py-1 text-xs ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"} ${on ? "border-saffron text-saffron" : "border-charcoal-lighter text-muted"}`}>
                            <input type="checkbox" className="sr-only" checked={on} disabled={disabled} onChange={() => toggle(k)} />
                            {k.startsWith("VIEW_") ? "View" : k.startsWith("MANAGE_") ? "Manage" : human(k)}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-charcoal-lighter px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
          <button disabled={saving} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">
            {saving ? "Saving…" : isNew ? "Create admin user" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}