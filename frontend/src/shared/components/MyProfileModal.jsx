import { useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const ROLE_LABEL = { owner: "Owner", manager: "Manager", investor: "Investor", partner: "Partner", cashier: "Cashier", waiter: "Waiter", kitchen: "Kitchen" };

export default function MyProfileModal({ open, onClose }) {
  const { user, restaurant } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword !== confirmPassword) return setError("New passwords do not match");

    setSaving(true);
    try {
      await api.put("/auth/password", { currentPassword, newPassword });
      setSuccess("Password updated.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't update password.");
    } finally {
      setSaving(false);
    }
  }

  if (!open || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="receipt-card relative w-full max-w-md rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-xl text-cream">{user.name}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-cream">✕</button>
        </div>
        <p className="text-sm text-muted">
          {restaurant?.name} · {ROLE_LABEL[user.role]}
          {user.employeeId ? ` · ${user.employeeId}` : ""}
        </p>

        {user.role !== "owner" && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {(user.permissions || []).map((p) => (
              <span key={p} className="rounded-full bg-saffron/10 px-2 py-0.5 text-xs text-saffron">{p.replace(/_/g, " ")}</span>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          <p className="text-sm font-medium text-cream">Change password</p>
          <div>
            <label className="block text-sm text-muted">Current password</label>
            <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron" />
          </div>
          <div>
            <label className="block text-sm text-muted">New password</label>
            <input type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron" />
          </div>
          <div>
            <label className="block text-sm text-muted">Confirm new password</label>
            <input type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron" />
          </div>

          {error && <p className="text-sm text-brick">{error}</p>}
          {success && <p className="text-sm text-sage">{success}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-60">
              {saving ? "Saving…" : "Update password"}
            </button>
            <button type="button" onClick={onClose}
              className="rounded-sm border border-charcoal-lighter px-4 py-2.5 text-cream hover:border-saffron">
              Close
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}