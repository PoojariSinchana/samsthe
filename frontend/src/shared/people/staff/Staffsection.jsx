import { useEffect, useState, useCallback } from "react";
import { fetchStaff, fetchStaffById, addStaff, editStaff, removeStaff } from "../../api/Staffapi";
import * as accessApi from "../../api/accessApi";
import { getOutlets } from "../../api/outlets";
import { useAuth } from "../../context/AuthContext";
import ImageUploadField from "../../components/ImageUploadField";
import LoginSetupModal from "../../components/LoginSetupModal";

const RESTAURANT_DEPARTMENTS = ["Kitchen", "Service", "Billing", "Management", "Delivery", "Housekeeping", "Security", "Other"];
const RESTAURANT_ROLES = ["Manager", "Head Chef", "Chef", "Cook", "Kitchen Helper", "Waiter", "Cashier", "Cleaner", "Delivery Staff", "Security", "Other"];

const RETAIL_DEPARTMENTS = ["Sales Floor", "Stockroom", "Billing", "Management", "Delivery", "Housekeeping", "Security", "Other"];
const RETAIL_ROLES = ["Manager", "Sales Associate", "Cashier", "Stock Clerk", "Visual Merchandiser", "Warehouse Staff", "Delivery Staff", "Security", "Cleaner", "Other"];

const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Intern"];
const STATUSES = ["Active", "Inactive", "On Leave"];

// System-access (login) roles — separate from the HR "job title" ROLES above.
// Restaurant has waiter/kitchen roles; retail has neither (no tables, no kitchen queue).
const RESTAURANT_SYSTEM_ROLES = ["manager", "investor", "partner", "cashier", "waiter", "kitchen"];
const RETAIL_SYSTEM_ROLES = ["manager", "investor", "partner", "cashier"];
const SYSTEM_ROLE_LABEL = { manager: "Manager", investor: "Investor", partner: "Partner", cashier: "Cashier", waiter: "Waiter", kitchen: "Kitchen" };

const statusStyles = {
  Active: "bg-sage/10 text-sage",
  Inactive: "bg-muted/10 text-muted",
  "On Leave": "bg-saffron/10 text-saffron-dark",
};

const inputClass =
  "w-full rounded-sm border border-charcoal-lighter bg-charcoal px-3 py-2 text-sm text-cream placeholder:text-muted focus:border-saffron focus:outline-none disabled:opacity-70";
const labelClass = "mb-1 block text-sm font-medium text-muted";

function initials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function StaffSection() {
  // view: "list" | "add" | "profile"
  const [view, setView] = useState("list");
  const [selectedId, setSelectedId] = useState(null);

  const goToList = () => {
    setView("list");
    setSelectedId(null);
  };

  const goToAdd = () => setView("add");

  const goToProfile = (id) => {
    setSelectedId(id);
    setView("profile");
  };

  if (view === "add") {
    return <AddStaffView onCancel={goToList} onSaved={(id) => goToProfile(id)} />;
  }

  if (view === "profile" && selectedId) {
    return <StaffProfileView id={selectedId} onBack={goToList} onDeleted={goToList} />;
  }

  return <AllStaffView onAdd={goToAdd} onSelect={goToProfile} />;
}

/* ---------------------------- All Staff (list) ---------------------------- */

function AllStaffView({ onAdd, onSelect }) {
  const { restaurant } = useAuth();
  const isRetail = restaurant?.appType === "retail";
  const DEPARTMENTS = isRetail ? RETAIL_DEPARTMENTS : RESTAURANT_DEPARTMENTS;
  const ROLES = isRetail ? RETAIL_ROLES : RESTAURANT_ROLES;

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (search) params.search = search;
      if (department) params.department = department;
      if (role) params.role = role;
      if (status) params.status = status;

      const { data } = await fetchStaff(params);
      setStaff(data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }, [search, department, role, status]);

  useEffect(() => {
    const timeout = setTimeout(loadStaff, 300);
    return () => clearTimeout(timeout);
  }, [loadStaff]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Remove ${name} from staff? This cannot be undone.`)) return;
    try {
      await removeStaff(id);
      setStaff((prev) => prev.filter((s) => s._id !== id));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete staff member");
    }
  };

  const activeFilterCount = [department, role, status].filter(Boolean).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Staff</h1>
          <p className="mt-1 text-sm text-muted">Manage your team, roles and departments.</p>
        </div>
        <button
          onClick={onAdd}
          className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-saffron-dark"
        >
          + Add Staff
        </button>
      </div>

      <div className="receipt-card relative mt-6 rounded-sm px-5 pb-4 pt-7">
        <span className="receipt-notch left-6" />
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[220px] flex-1">
            <label className={labelClass}>Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, phone, employee ID…"
              className={inputClass}
            />
          </div>
          <div className="min-w-[160px]">
            <label className={labelClass}>Department</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass}>
              <option value="">All departments</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className={labelClass}>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
              <option value="">All roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className={labelClass}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setDepartment(""); setRole(""); setStatus(""); }}
              className="pb-2 text-sm text-muted hover:text-cream"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {!loading && !error && (
        <p className="mt-4 text-sm text-muted">
          {staff.length} staff member{staff.length !== 1 ? "s" : ""}
        </p>
      )}

      {loading ? (
        <div className="receipt-card mt-3 rounded-sm p-10 text-center text-sm text-muted">Loading staff…</div>
      ) : error ? (
        <div className="receipt-card mt-3 rounded-sm p-10 text-center text-sm text-brick">{error}</div>
      ) : staff.length === 0 ? (
        <div className="receipt-card mt-3 rounded-sm p-10 text-center">
          <p className="text-sm text-muted">No staff members found. Try adjusting your filters, or:</p>
          <button onClick={onAdd} className="mt-3 text-sm font-medium text-saffron hover:text-saffron-dark">
            Add your first staff member
          </button>
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:hidden">
            {staff.map((member) => (
              <button
                key={member._id}
                onClick={() => onSelect(member._id)}
                className="receipt-card relative rounded-sm px-5 pb-5 pt-7 text-left"
              >
                <span className="receipt-notch left-6" />
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-saffron/15 text-sm font-medium text-saffron">
                    {initials(member.fullName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-cream">{member.fullName}</p>
                    <p className="truncate text-xs text-muted">{member.role} · {member.department}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[member.status] || "bg-muted/10 text-muted"}`}>
                    {member.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-charcoal-lighter pt-3 text-xs text-muted">
                  <span>{member.employeeId}</span>
                  <span>{member.phone}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="receipt-card relative mt-3 hidden overflow-hidden rounded-sm sm:block">
            <span className="receipt-notch left-6" />
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-charcoal-lighter text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 pb-3 pt-7 font-medium">Employee</th>
                  <th className="px-5 pb-3 pt-7 font-medium">Role</th>
                  <th className="px-5 pb-3 pt-7 font-medium">Department</th>
                  <th className="px-5 pb-3 pt-7 font-medium">Phone</th>
                  <th className="px-5 pb-3 pt-7 font-medium">Status</th>
                  <th className="px-5 pb-3 pt-7 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => (
                  <tr
                    key={member._id}
                    className="border-b border-charcoal-lighter transition-colors last:border-0 hover:bg-charcoal"
                  >
                    <td className="px-5 py-3">
                      <button onClick={() => onSelect(member._id)} className="flex items-center gap-3 text-left">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-saffron/15 text-xs font-medium text-saffron">
                          {initials(member.fullName)}
                        </span>
                        <span>
                          <span className="block font-medium text-cream">{member.fullName}</span>
                          <span className="block text-xs text-muted">{member.employeeId}</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-5 py-3 text-cream">{member.role}</td>
                    <td className="px-5 py-3 text-cream">{member.department}</td>
                    <td className="px-5 py-3 text-muted">{member.phone}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[member.status] || "bg-muted/10 text-muted"}`}>
                        {member.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => onSelect(member._id)} className="text-sm font-medium text-saffron hover:text-saffron-dark">
                        View
                      </button>
                      <span className="mx-2 text-charcoal-lighter">·</span>
                      <button onClick={() => handleDelete(member._id, member.fullName)} className="text-sm font-medium text-brick hover:text-brick/80">
                        Delete
                      </button>
                    </td>
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

/* ------------------------------ Add Staff ------------------------------- */

const initialForm = {
  fullName: "",
  employeeId: "",
  phone: "",
  email: "",
  dateOfBirth: "",
  joiningDate: "",
  department: "",
  role: "",
  employmentType: "Full-time",
  salary: "",
  status: "Active",
  photo: "",
  // Access fields
  createLogin: true,
  systemRole: "cashier",
  permissions: [],
  outletAccess: [],
};

function FormSection({ title, children }) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-saffron">{title}</h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function AddStaffView({ onCancel, onSaved }) {
  const { user, restaurant } = useAuth();
  const isRetail = restaurant?.appType === "retail";
  const appSystemRoles = isRetail ? RETAIL_SYSTEM_ROLES : RESTAURANT_SYSTEM_ROLES;
  const DEPARTMENTS = isRetail ? RETAIL_DEPARTMENTS : RESTAURANT_DEPARTMENTS;
  const ROLES = isRetail ? RETAIL_ROLES : RESTAURANT_ROLES;
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [password, setPassword] = useState("");

  const [accessOptions, setAccessOptions] = useState(null); // { groups, defaultsByRole, managerAssignableRoles }
  const [outlets, setOutlets] = useState([]);

  useEffect(() => {
    accessApi.getAccessOptions().then(setAccessOptions).catch(() => {});
    getOutlets().then((res) => setOutlets((res.outlets || []).filter((o) => o.isActive))).catch(() => {});
  }, []);

  // Which system roles this requester is allowed to grant — intersected
  // with the roles that actually make sense for this app.
  const creatableSystemRoles = (
    user.role === "owner" ? appSystemRoles : (accessOptions?.managerAssignableRoles || [])
  ).filter((r) => appSystemRoles.includes(r));
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Changing the system role resets permissions to that role's sensible
  // defaults — same pattern as the old AccessModal.
  const handleSystemRoleChange = (newRole) => {
    setForm((prev) => ({
      ...prev,
      systemRole: newRole,
      permissions: accessOptions?.defaultsByRole?.[newRole] || [],
    }));
  };

  const togglePermission = (key) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key],
    }));
  };

  const toggleOutlet = (id) => {
    setForm((prev) => ({
      ...prev,
      outletAccess: prev.outletAccess.includes(id)
        ? prev.outletAccess.filter((o) => o !== id)
        : [...prev.outletAccess, id],
    }));
  };

  const validate = () => {
    const next = {};
    if (!form.fullName.trim()) next.fullName = "Full name is required";
    if (!form.phone.trim()) next.phone = "Phone number is required";
    if (!form.dateOfBirth) next.dateOfBirth = "Date of birth is required";
    if (!form.joiningDate) next.joiningDate = "Joining date is required";
    if (!form.department) next.department = "Department is required";
    if (!form.role) next.role = "Role is required";
    if (form.createLogin && !form.systemRole) next.systemRole = "System access role is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setServerError("");
    try {
      const payload = { ...form };
      if (!payload.employeeId) delete payload.employeeId;
      if (payload.salary) payload.salary = Number(payload.salary);
      if (!payload.createLogin) {
        // Don't send half-filled access fields when no login is being created.
        delete payload.systemRole;
        delete payload.permissions;
        delete payload.outletAccess;
      }

      const { data } = await addStaff(payload);
      onSaved(data._id);
    } catch (err) {
      setServerError(err.response?.data?.message || "Failed to add staff member");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <button onClick={onCancel} className="mb-2 text-sm text-muted hover:text-cream">
        ← Back to Staff
      </button>
      <h1 className="font-display text-2xl text-cream sm:text-3xl">Add Staff</h1>
      <p className="mt-1 text-sm text-muted">Add a new team member — and optionally set up their system login — in one step.</p>

      <form onSubmit={handleSubmit} className="receipt-card mt-6 max-w-2xl rounded-sm px-6 pb-6 pt-8">
        <span className="receipt-notch left-1/2 -translate-x-1/2" />

        {serverError && (
          <div className="mb-6 rounded-sm bg-brick/10 px-3 py-2 text-sm text-brick">{serverError}</div>
        )}

        <FormSection title="Personal Details">
          <div className="sm:col-span-2">
            <ImageUploadField
              label="Profile photo (optional)"
              value={form.photo}
              uploadUrl="/staff/upload-photo"
              formFieldName="photo"
              shape="circle"
              onUploaded={(url) => setForm((prev) => ({ ...prev, photo: url }))}
            />
          </div>
          <div>
            <label className={labelClass}>Full Name *</label>
            <input type="text" name="fullName" value={form.fullName} onChange={handleChange} className={inputClass} placeholder="e.g. Rahul Sharma" />
            {errors.fullName && <p className="mt-1 text-xs text-brick">{errors.fullName}</p>}
          </div>

          <div>
            <label className={labelClass}>Phone *</label>
            <input type="tel" name="phone" value={form.phone} onChange={handleChange} className={inputClass} placeholder="98765 xxxxx" />
            {errors.phone && <p className="mt-1 text-xs text-brick">{errors.phone}</p>}
            <p className="mt-1 text-xs text-muted">Used as their login ID if a system login is created below.</p>
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} className={inputClass} placeholder="optional" />
          </div>

          <div>
            <label className={labelClass}>Date of Birth *</label>
            <input type="date" name="dateOfBirth" value={form.dateOfBirth} onChange={handleChange} className={inputClass} />
            {errors.dateOfBirth && <p className="mt-1 text-xs text-brick">{errors.dateOfBirth}</p>}
            <p className="mt-1 text-xs text-muted">Their birth year becomes the initial login password.</p>
          </div>

          <div>
            <label className={labelClass}>Employee ID</label>
            <input type="text" name="employeeId" value={form.employeeId} onChange={handleChange} className={inputClass} placeholder="Auto-generated if left blank" />
          </div>
        </FormSection>

        <div className="my-6 border-t border-charcoal-lighter" />

        <FormSection title="Employment Details">
          <div>
            <label className={labelClass}>Department *</label>
            <select name="department" value={form.department} onChange={handleChange} className={inputClass}>
              <option value="">Select department</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            {errors.department && <p className="mt-1 text-xs text-brick">{errors.department}</p>}
          </div>

          <div>
            <label className={labelClass}>Role *</label>
            <select name="role" value={form.role} onChange={handleChange} className={inputClass}>
              <option value="">Select role</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {errors.role && <p className="mt-1 text-xs text-brick">{errors.role}</p>}
          </div>

          <div>
            <label className={labelClass}>Employment Type</label>
            <select name="employmentType" value={form.employmentType} onChange={handleChange} className={inputClass}>
              {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>Joining Date *</label>
            <input type="date" name="joiningDate" value={form.joiningDate} onChange={handleChange} className={inputClass} />
            {errors.joiningDate && <p className="mt-1 text-xs text-brick">{errors.joiningDate}</p>}
          </div>

          <div>
            <label className={labelClass}>Salary</label>
            <input type="number" name="salary" value={form.salary} onChange={handleChange} className={inputClass} placeholder="Monthly salary, optional" min="0" />
          </div>

          <div>
            <label className={labelClass}>Status</label>
            <select name="status" value={form.status} onChange={handleChange} className={inputClass}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </FormSection>

        <div className="my-6 border-t border-charcoal-lighter" />

        {/* ── System Access — merged in from the old AccessSection flow ── */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-saffron">System Access</h2>

          <label className="mt-4 flex items-center gap-2 text-sm text-cream">
            <input
              type="checkbox"
              checked={form.createLogin}
              onChange={(e) => setForm((prev) => ({ ...prev, createLogin: e.target.checked }))}
              className="accent-saffron"
            />
            Give this person a login to the system
          </label>

          {form.createLogin && (
            <div className="mt-4 space-y-4">
              <div className="max-w-xs">
                <label className={labelClass}>System role</label>
                <select
                  value={form.systemRole}
                  onChange={(e) => handleSystemRoleChange(e.target.value)}
                  className={inputClass}
                >
                  {creatableSystemRoles.map((r) => (
                    <option key={r} value={r}>{SYSTEM_ROLE_LABEL[r] || r}</option>
                  ))}
                </select>
                {errors.systemRole && <p className="mt-1 text-xs text-brick">{errors.systemRole}</p>}
              </div>

              <div>
                <p className={labelClass}>Outlet access</p>
                <div className="flex flex-wrap gap-2">
                  {outlets.map((o) => (
                    <label
                      key={o._id}
                      className={`cursor-pointer rounded-sm border px-3 py-1.5 text-sm ${
                        form.outletAccess.includes(o._id) ? "border-saffron text-saffron" : "border-charcoal-lighter text-muted"
                      }`}
                    >
                      <input type="checkbox" className="hidden" checked={form.outletAccess.includes(o._id)} onChange={() => toggleOutlet(o._id)} />
                      {o.name}
                    </label>
                  ))}
                </div>
                {form.outletAccess.length === 0 && (
                  <p className="mt-1 text-xs text-brick">No outlets selected — this person won't see any orders/tables.</p>
                )}
              </div>

              {accessOptions && (
                <div>
                  <p className={labelClass}>Permissions</p>
                  <div className="space-y-3">
                    {accessOptions.groups.map((g) => (
                      <div key={g.label}>
                        <p className="mb-1 text-xs text-cream">{g.label}</p>
                        <div className="flex flex-wrap gap-2">
                          {g.keys.map((key) => (
                            <label
                              key={key}
                              className={`cursor-pointer rounded-sm border px-2.5 py-1 text-xs ${
                                form.permissions.includes(key) ? "border-saffron text-saffron" : "border-charcoal-lighter text-muted"
                              }`}
                            >
                              <input type="checkbox" className="hidden" checked={form.permissions.includes(key)} onChange={() => togglePermission(key)} />
                              {key.replace(/_/g, " ")}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-8 flex gap-3">
          <button type="submit" disabled={submitting} className="rounded-sm bg-saffron px-5 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-saffron-dark disabled:opacity-60">
            {submitting ? "Saving..." : "Save Staff Member"}
          </button>
          <button type="button" onClick={onCancel} className="rounded-sm border border-charcoal-lighter px-5 py-2 text-sm font-medium text-muted transition-colors hover:border-saffron hover:text-cream">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

/* ----------------------------- Staff Profile ----------------------------- */

const TABS = [
  { key: "personal", label: "Personal Details", available: true },
  { key: "employment", label: "Employment Details", available: true },
  { key: "attendance", label: "Attendance", available: false },
  { key: "leave", label: "Leave", available: false },
  { key: "overtime", label: "Overtime", available: false },
  { key: "salary", label: "Salary", available: false },
  { key: "payments", label: "Payments", available: false },
  { key: "documents", label: "Documents", available: false },
];

function StaffProfileView({ id, onBack, onDeleted }) {
  const { restaurant } = useAuth();
  const isRetail = restaurant?.appType === "retail";
  const DEPARTMENTS = isRetail ? RETAIL_DEPARTMENTS : RESTAURANT_DEPARTMENTS;
  const ROLES = isRetail ? RETAIL_ROLES : RESTAURANT_ROLES;

  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState("personal");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await fetchStaffById(id);
        setStaff(data);
        setForm(data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load staff member");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.salary) payload.salary = Number(payload.salary);
      const { data } = await editStaff(id, payload);
      setStaff(data);
      setForm(data);
      setEditing(false);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Remove ${staff.fullName} from staff? This cannot be undone.`)) return;
    try {
      await removeStaff(id);
      onDeleted();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete staff member");
    }
  };

  if (loading) return <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">Loading…</div>;
  if (error || !staff) return <div className="receipt-card rounded-sm p-10 text-center text-sm text-brick">{error || "Staff member not found"}</div>;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
            {staff.photo ? (
              <img
                src={staff.photo}
                alt=""
                className="h-14 w-14 shrink-0 rounded-full border border-charcoal-lighter object-cover"
              />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-saffron/15 text-lg font-medium text-saffron">
                {initials(staff.fullName)}
              </span>
            )}
          <div>
            <button onClick={onBack} className="mb-1 text-sm text-muted hover:text-cream">← Back to Staff</button>
            <h1 className="font-display text-2xl text-cream sm:text-3xl">{staff.fullName}</h1>
            <p className="mt-1 text-sm text-muted">{staff.role} · {staff.department} · {staff.employeeId}</p>
          </div>
        </div>
        <div className="flex gap-3">
             {!staff.userId && (
            <button
             onClick={() => setShowLoginModal(true)}
              className="rounded-sm border border-saffron px-4 py-2 text-sm font-medium text-saffron hover:bg-saffron hover:text-charcoal"
            >
              Set up login
            </button>
        )}
          {staff.userId && (
            <span className="flex items-center rounded-sm border border-sage/40 px-3 py-2 text-sm text-sage">
              Login enabled
            </span>
          )}
          {editing ? (
            <>
              <button onClick={handleSave} disabled={saving} className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-60">
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button onClick={() => { setForm(staff); setEditing(false); }} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-sm font-medium text-muted hover:text-cream">
                Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-sm font-medium text-cream hover:border-saffron">
                Edit
              </button>
              <button onClick={handleDelete} className="rounded-sm border border-brick/40 px-4 py-2 text-sm font-medium text-brick hover:bg-brick/10">
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-charcoal-lighter">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => tab.available && setActiveTab(tab.key)}
            disabled={!tab.available}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-saffron text-saffron"
                : tab.available
                ? "border-transparent text-muted hover:text-cream"
                : "cursor-not-allowed border-transparent text-muted/40"
            }`}
            title={tab.available ? undefined : "Coming in a later phase"}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="receipt-card relative mt-6 max-w-2xl rounded-sm px-6 pb-6 pt-8">
        <span className="receipt-notch left-1/2 -translate-x-1/2" />

        {activeTab === "personal" && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <ImageUploadField
                label="Profile photo"
                value={form.photo}
                uploadUrl="/staff/upload-photo"
                formFieldName="photo"
                shape="circle"
                onUploaded={(url) => setForm((prev) => ({ ...prev, photo: url }))}
              />
            </div>
            <div>
              <label className={labelClass}>Full Name</label>
              <input type="text" name="fullName" value={form.fullName || ""} onChange={handleChange} disabled={!editing} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input type="tel" name="phone" value={form.phone || ""} onChange={handleChange} disabled={!editing} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" name="email" value={form.email || ""} onChange={handleChange} disabled={!editing} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Date of Birth</label>
              <input type="date" name="dateOfBirth" value={form.dateOfBirth ? form.dateOfBirth.slice(0, 10) : ""} onChange={handleChange} disabled={!editing} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Employee ID</label>
              <input type="text" value={form.employeeId || ""} disabled className={inputClass} />
            </div>
          </div>
        )}

        {activeTab === "employment" && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Department</label>
              <select name="department" value={form.department || ""} onChange={handleChange} disabled={!editing} className={inputClass}>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Role</label>
              <select name="role" value={form.role || ""} onChange={handleChange} disabled={!editing} className={inputClass}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Employment Type</label>
              <select name="employmentType" value={form.employmentType || ""} onChange={handleChange} disabled={!editing} className={inputClass}>
                {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Joining Date</label>
              <input type="date" name="joiningDate" value={form.joiningDate ? form.joiningDate.slice(0, 10) : ""} onChange={handleChange} disabled={!editing} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Salary</label>
              <input type="number" name="salary" value={form.salary || ""} onChange={handleChange} disabled={!editing} className={inputClass} min="0" />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select name="status" value={form.status || ""} onChange={handleChange} disabled={!editing} className={inputClass}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        )}

        {!["personal", "employment"].includes(activeTab) && (
          <p className="text-sm text-muted">
            This section will be available once the Attendance / Payroll phase is built —
            it'll pull data from here rather than being entered manually.
          </p>
        )}
      </div>
      {showLoginModal && (
  <LoginSetupModal
    person={staff}
    linkType="staff"
    onClose={() => setShowLoginModal(false)}
    onCreated={async () => {
      setShowLoginModal(false);
      const { data } = await fetchStaffById(id);
      setStaff(data);
      setForm(data);
    }}
  />
)}
    </div>
  );
}