import { useCallback, useEffect, useState } from "react";
import * as empApi from "../api/adminEmployeesApi";
import { useAdminAuth } from "../context/AdminAuthContext";

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const labelCls = "mb-1 block text-xs text-muted";
const human = (s = "") => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const rupees = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;
const dateStr = (d) => (d ? new Date(d).toLocaleDateString("en-IN") : "—");
const dateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const initials = (n = "") => n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
const STYLE = { Active: "bg-sage/10 text-sage", "On Leave": "bg-saffron/10 text-saffron", Inactive: "bg-charcoal-lighter text-muted" };

export default function AdminEmployeesSection() {
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission("MANAGE_EMPLOYEES");
  const canLogin = canManage && hasPermission("MANAGE_ADMIN_USERS");

  const [meta, setMeta] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState("");
  const [department, setDepartment] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // {} = new
  const [loginFor, setLoginFor] = useState(null);

  useEffect(() => { empApi.getMeta().then(setMeta).catch((e) => setError(e.response?.data?.message || "Couldn't load options.")); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, limit: 20 };
      if (status) params.status = status;
      if (department) params.department = department;
      if (search) params.search = search;
      const d = await empApi.getEmployees(params);
      setEmployees(d.employees); setSummary(d.summary); setPages(d.pages); setTotal(d.total);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't load employees.");
    } finally {
      setLoading(false);
    }
  }, [page, status, department, search]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  async function remove(e) {
    if (!window.confirm(`Remove ${e.fullName}?${e.adminUserId ? " Their portal login will be deactivated." : ""}`)) return;
    try { await empApi.deleteEmployee(e._id); load(); }
    catch (err) { setError(err.response?.data?.message || "Couldn't remove the employee."); }
  }

  const counts = summary?.counts || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Employees</h1>
          <p className="mt-1 text-sm text-muted">Your own team, and who can sign in to this portal.</p>
        </div>
        {canManage && (
          <button onClick={() => setEditing({})} disabled={!meta}
            className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">Add employee</button>
        )}
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total" value={summary.all} />
          <Stat label="Active" value={counts.Active || 0} accent="text-sage" />
          <Stat label="On leave" value={counts["On Leave"] || 0} accent="text-saffron" />
          {summary.monthlyPayroll !== null && <Stat label="Monthly payroll" value={rupees(summary.monthlyPayroll)} sub="Active employees" />}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, ID, phone or email"
          aria-label="Search employees" className={`${inputCls} max-w-xs`} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status" className={`${inputCls} w-auto`}>
          <option value="">All statuses</option>{meta?.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }} aria-label="Filter by department" className={`${inputCls} w-auto`}>
          <option value="">All departments</option>{meta?.departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {error && <p role="alert" className="text-sm text-brick">{error}</p>}

      <div className="receipt-card relative overflow-x-auto rounded-sm">
        <span className="receipt-notch left-6" />
        {loading ? <p className="p-8 text-center text-sm text-muted">Loading…</p>
        : employees.length === 0 ? <p className="p-8 text-center text-sm text-muted">{search || status || department ? "No employees match these filters." : canManage ? "No employees yet. Add your first team member." : "No employees yet."}</p>
        : (
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-charcoal-lighter text-xs text-muted">
                {["Employee", "Role", "Contact", "Joined"].map((h) => <th key={h} className="px-5 pb-3 pt-7 font-medium">{h}</th>)}
                {canManage && <th className="px-5 pb-3 pt-7 font-medium">Salary</th>}
                {["Status", "Portal login"].map((h) => <th key={h} className="px-5 pb-3 pt-7 font-medium">{h}</th>)}
                {canManage && <th className="px-5 pb-3 pt-7"></th>}
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e._id} className="border-b border-charcoal-lighter last:border-0 hover:bg-charcoal">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-saffron/15 text-xs font-medium text-saffron">{initials(e.fullName)}</span>
                      <span className="text-cream">{e.fullName}<p className="text-xs text-muted">{e.employeeCode}</p></span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-cream">{e.designation || "—"}<p className="text-xs text-muted">{e.department} · {e.employmentType}</p></td>
                  <td className="px-5 py-3 text-muted">{e.phone}<p className="text-xs">{e.email}</p></td>
                  <td className="px-5 py-3 text-muted">{dateStr(e.joiningDate)}</td>
                  {canManage && <td className="px-5 py-3 text-cream">{e.salary ? rupees(e.salary) : "—"}</td>}
                  <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STYLE[e.status]}`}>{e.status}</span></td>
                  <td className="px-5 py-3 text-xs">
                    {e.adminUserId
                      ? <span className={e.adminUserId.isActive ? "text-sage" : "text-brick"}>{human(e.adminUserId.role)}{e.adminUserId.isActive ? "" : " (off)"}</span>
                      : canLogin ? <button onClick={() => setLoginFor(e)} className="text-saffron hover:underline">Set up login</button>
                      : <span className="text-muted">None</span>}
                  </td>
                  {canManage && (
                    <td className="whitespace-nowrap px-5 py-3 text-right text-xs">
                      <button onClick={() => setEditing(e)} className="text-saffron hover:underline">Edit</button>
                      <span className="mx-2 text-charcoal-lighter">·</span>
                      <button onClick={() => remove(e)} className="text-brick hover:underline">Remove</button>
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
          <span>Page {page} of {pages} · {total} employees</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-sm border border-charcoal-lighter px-3 py-1.5 hover:text-cream disabled:opacity-40">Previous</button>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="rounded-sm border border-charcoal-lighter px-3 py-1.5 hover:text-cream disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {editing && meta && <EmployeeModal existing={editing._id ? editing : null} meta={meta} canLogin={canLogin}
        onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {loginFor && meta && <LoginModal employee={loginFor} roles={meta.roles}
        onClose={() => setLoginFor(null)} onSaved={() => { setLoginFor(null); load(); }} />}
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

function EmployeeModal({ existing, meta, canLogin, onClose, onSaved }) {
  const isNew = !existing;
  const [f, setF] = useState({
    fullName: existing?.fullName || "", phone: existing?.phone || "", email: existing?.email || "",
    dateOfBirth: dateInput(existing?.dateOfBirth), joiningDate: dateInput(existing?.joiningDate) || new Date().toISOString().slice(0, 10),
    department: existing?.department || "Other", designation: existing?.designation || "",
    employmentType: existing?.employmentType || "Full-time", salary: existing?.salary ?? "",
    status: existing?.status || "Active", notes: existing?.notes || "",
  });
  const [createLogin, setCreateLogin] = useState(false);
  const [role, setRole] = useState(meta.roles.includes("support") ? "support" : meta.roles[0]);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const showSalary = existing ? existing.salary !== undefined : true; // view-only admins never get salary back

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const body = { ...f };
      if (!showSalary) delete body.salary;
      if (isNew) await empApi.createEmployee({ ...body, createLogin, login: createLogin ? { role, password } : undefined });
      else await empApi.updateEmployee(existing._id, body);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't save this employee.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <form onSubmit={submit} className="receipt-card relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-sm">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between px-5 pb-3 pt-8 sm:px-6">
          <h2 className="font-display text-xl text-cream">{isNew ? "Add employee" : `Edit ${existing.fullName}`}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-cream">✕</button>
        </div>
        {error && <p role="alert" className="px-5 text-sm text-brick sm:px-6">{error}</p>}

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-3 sm:px-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className={labelCls}>Full name *</label><input value={f.fullName} onChange={set("fullName")} required className={inputCls} /></div>
            <div><label className={labelCls}>Phone *</label><input value={f.phone} onChange={set("phone")} required className={inputCls} /></div>
            <div><label className={labelCls}>Email</label><input type="email" value={f.email} onChange={set("email")} className={inputCls} /></div>
            <div><label className={labelCls}>Department</label>
              <select value={f.department} onChange={set("department")} className={inputCls}>{meta.departments.map((d) => <option key={d}>{d}</option>)}</select></div>
            <div><label className={labelCls}>Designation</label><input value={f.designation} onChange={set("designation")} placeholder="e.g. Sales Executive" className={inputCls} /></div>
            <div><label className={labelCls}>Employment type</label>
              <select value={f.employmentType} onChange={set("employmentType")} className={inputCls}>{meta.employmentTypes.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div><label className={labelCls}>Status</label>
              <select value={f.status} onChange={set("status")} className={inputCls}>{meta.statuses.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label className={labelCls}>Joining date</label><input type="date" value={f.joiningDate} onChange={set("joiningDate")} className={inputCls} /></div>
            <div><label className={labelCls}>Date of birth</label><input type="date" value={f.dateOfBirth} onChange={set("dateOfBirth")} className={inputCls} /></div>
            {showSalary && <div><label className={labelCls}>Monthly salary (₹)</label><input type="number" min="0" value={f.salary} onChange={set("salary")} className={inputCls} /></div>}
            <div className="sm:col-span-2"><label className={labelCls}>Notes</label><textarea rows={2} value={f.notes} onChange={set("notes")} className={inputCls} /></div>
          </div>

          {isNew && canLogin && (
            <div className="rounded-sm border border-charcoal-lighter p-3">
              <label className="flex items-center gap-2 text-sm text-cream">
                <input type="checkbox" checked={createLogin} onChange={(e) => setCreateLogin(e.target.checked)} className="accent-saffron" />
                Give this person a login to this portal
              </label>
              {createLogin && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><label className={labelCls}>Role</label>
                    <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>{meta.roles.map((r) => <option key={r} value={r}>{human(r)}</option>)}</select></div>
                  <div><label className={labelCls}>Password</label>
                    <input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="At least 8 characters" className={inputCls} /></div>
                  <p className="text-xs text-muted sm:col-span-2">They sign in with the email above. Permissions start from the role's defaults; fine-tune them under Admin Users.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-charcoal-lighter px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
          <button disabled={saving} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">{saving ? "Saving…" : isNew ? "Add employee" : "Save changes"}</button>
        </div>
      </form>
    </div>
  );
}

function LoginModal({ employee, roles, onClose, onSaved }) {
  const [role, setRole] = useState(roles.includes("support") ? "support" : roles[0]);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try { await empApi.createLogin(employee._id, { role, password }); onSaved(); }
    catch (err) { setError(err.response?.data?.message || "Couldn't create the login."); setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <form onSubmit={submit} className="receipt-card relative w-full max-w-sm rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-cream">Set up login</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-cream">✕</button>
        </div>
        <p className="mt-1 text-xs text-muted">{employee.fullName} signs in with {employee.email || "an email (add one to the employee first)"}.</p>
        {error && <p role="alert" className="mt-2 text-sm text-brick">{error}</p>}
        <div className="mt-4 space-y-3">
          <div><label className={labelCls}>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>{roles.map((r) => <option key={r} value={r}>{human(r)}</option>)}</select></div>
          <div><label className={labelCls}>Password</label>
            <input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="At least 8 characters" className={inputCls} /></div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
          <button disabled={saving || !employee.email} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">{saving ? "Creating…" : "Create login"}</button>
        </div>
      </form>
    </div>
  );
}