import { useState } from "react";
import * as authApi from "../api/adminAuthApi";
import { useAdminAuth } from "../context/AdminAuthContext";

const inputCls = "mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";

export default function AdminProfile() {
  const { admin } = useAdminAuth();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (e) => { setForm((f) => ({ ...f, [e.target.name]: e.target.value })); setSuccess(""); };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (form.newPassword.length < 8) return setError("New password must be at least 8 characters.");
    if (form.newPassword !== form.confirm) return setError("New passwords don't match.");
    setSaving(true);
    try {
      await authApi.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      setSuccess("Password updated.");
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't update password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-cream sm:text-3xl">My account</h1>
        <p className="mt-1 text-sm text-muted">{admin.name} · {admin.email} · <span className="capitalize">{admin.role}</span></p>
      </div>

      <section className="receipt-card relative max-w-md rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <h2 className="font-display text-lg text-cream">Change password</h2>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div><label className="text-sm text-muted">Current password</label>
            <input type="password" name="currentPassword" required value={form.currentPassword} onChange={set} className={inputCls} /></div>
          <div><label className="text-sm text-muted">New password</label>
            <input type="password" name="newPassword" required minLength={8} value={form.newPassword} onChange={set} className={inputCls} /></div>
          <div><label className="text-sm text-muted">Confirm new password</label>
            <input type="password" name="confirm" required minLength={8} value={form.confirm} onChange={set} className={inputCls} /></div>
          {error && <p role="alert" className="text-sm text-brick">{error}</p>}
          {success && <p className="text-sm text-sage">{success}</p>}
          <button disabled={saving} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-60 sm:w-fit">
            {saving ? "Saving…" : "Update password"}
          </button>
        </form>
      </section>
    </div>
  );
}