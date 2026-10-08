import { useState } from "react";
import { createLogin } from "../api/authApi";
import { useAuth } from "../context/AuthContext";

const RESTAURANT_SYSTEM_ROLES = [
  { value: "manager", label: "Manager — full access except account deletion/settings" },
  { value: "cashier", label: "Cashier — billing & payments" },
  { value: "waiter", label: "Waiter — orders & tables" },
  { value: "kitchen", label: "Kitchen — order prep queue" },
];

const RETAIL_SYSTEM_ROLES = [
  { value: "manager", label: "Manager — full access except account deletion/settings" },
  { value: "cashier", label: "Cashier — sales & payments" },
];

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const labelCls = "mb-1 block text-xs text-muted";

export default function LoginSetupModal({ person, linkType, onClose, onCreated }) {
  const { restaurant } = useAuth();
  const SYSTEM_ROLES = restaurant?.appType === "retail" ? RETAIL_SYSTEM_ROLES : RESTAURANT_SYSTEM_ROLES;

  const [phone, setPhone] = useState(person.phone || "");
  const [dateOfBirth, setDateOfBirth] = useState(person.dateOfBirth ? person.dateOfBirth.slice(0, 10) : "");
  const [role, setRole] = useState("manager");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!phone.trim()) return setError("Phone number is required");
    if (!dateOfBirth) return setError("Date of birth is required");

    setSaving(true);
    try {
      await createLogin({
        name: person.name || person.fullName,
        email: person.email,
        phone,
        dateOfBirth,
        role,
        linkType,
        linkId: person._id,
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create login");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={handleSubmit} className="receipt-card w-full max-w-sm rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-cream">Set up login</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-cream">✕</button>
        </div>
        <p className="mt-1 text-xs text-muted">
          Creates a system account for {person.name || person.fullName}. Their initial password will be their birth year — they can change it after logging in.
        </p>
        {error && <p className="mt-2 text-sm text-brick">{error}</p>}

        <div className="mt-4 space-y-3">
          <div>
            <label className={labelCls}>Phone number</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Date of birth</label>
            <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required className={inputCls} />
            <p className="mt-1 text-xs text-muted">The birth year becomes their initial password.</p>
          </div>
          <div>
            <label className={labelCls}>System access</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
              {SYSTEM_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
          <button disabled={saving} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">
            {saving ? "Creating…" : "Create login"}
          </button>
        </div>
      </form>
    </div>
  );
}