import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import * as partnersApi from "../api/partnersApi";
import ImageUploadField from "../components/ImageUploadField";
import LoginSetupModal from "../components/LoginSetupModal";

const ROLES = ["Owner", "Partner", "Investor"];
const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const labelCls = "mb-1 block text-xs text-muted";

function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export default function OwnersPartnersTab() {
  const { user } = useAuth();
  const canManage = user.role === "owner";

  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null); // null | {} (new) | partner (edit)
  const [loginModalFor, setLoginModalFor] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await partnersApi.getPartners();
      setPartners(res.partners);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load owners/partners");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(id, name) {
    if (!window.confirm(`Remove ${name} from owners/partners?`)) return;
    try {
      await partnersApi.deactivatePartner(id);
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to remove");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{partners.length} recorded</p>
        {canManage && (
          <button onClick={() => setModal({})} className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark">
            + Add Owner / Partner
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-brick">{error}</p>}

      {loading ? (
        <p className="mt-4 text-muted">Loading…</p>
      ) : partners.length === 0 ? (
        <div className="receipt-card mt-4 rounded-sm p-10 text-center text-sm text-muted">
          No owners or partners recorded yet.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {partners.map((p) => (
            <div key={p._id} className="receipt-card relative rounded-sm px-5 pb-5 pt-7">
              <span className="receipt-notch left-6" />
              <div className="flex items-center gap-3">
                {p.photo ? (
                  <img src={p.photo} alt="" className="h-12 w-12 shrink-0 rounded-full border border-charcoal-lighter object-cover" />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-saffron/15 text-sm font-medium text-saffron">
                    {initials(p.name)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-cream">{p.name}</p>
                  <p className="text-xs text-muted">{p.role}{p.sharePercentage != null ? ` · ${p.sharePercentage}%` : ""}</p>
                </div>
              </div>
              {p.phone && <p className="mt-3 text-xs text-muted">{p.phone}</p>}
              {p.email && <p className="text-xs text-muted">{p.email}</p>}
              {p.notes && <p className="mt-2 text-xs text-muted">{p.notes}</p>}
              {canManage && (
                <div className="mt-3 flex gap-3 border-t border-charcoal-lighter pt-3 text-xs">
                  <button onClick={() => setModal(p)} className="text-saffron hover:text-saffron-dark">Edit</button>
                  <button onClick={() => handleRemove(p._id, p.name)} className="text-brick hover:underline">Remove</button>
                  {p.userId ? (
                    <span className="text-sage">Login enabled</span>
                  ) : (
                    <button onClick={() => setLoginModalFor(p)} className="text-cream hover:text-saffron">Set up login</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <PartnerFormModal existing={modal._id ? modal : null} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
      {loginModalFor && (
        <LoginSetupModal
          person={loginModalFor}
          linkType="partner"
          onClose={() => setLoginModalFor(null)}
          onCreated={() => { setLoginModalFor(null); load(); }}
        />
      )}
    </div>
  );
}

function PartnerFormModal({ existing, onClose, onSaved }) {
  const [name, setName] = useState(existing?.name || "");
  const [role, setRole] = useState(existing?.role || "Partner");
  const [sharePercentage, setSharePercentage] = useState(existing?.sharePercentage ?? "");
  const [phone, setPhone] = useState(existing?.phone || "");
  const [email, setEmail] = useState(existing?.email || "");
  const [photo, setPhoto] = useState(existing?.photo || "");
  const [notes, setNotes] = useState(existing?.notes || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Name is required");
    setSaving(true);
    const payload = {
      name, role, phone, email, photo, notes,
      sharePercentage: sharePercentage === "" ? undefined : Number(sharePercentage),
    };
    try {
      if (existing) await partnersApi.updatePartner(existing._id, payload);
      else await partnersApi.createPartner(payload);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={handleSubmit} className="receipt-card w-full max-w-md rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-cream">{existing ? "Edit" : "Add"} Owner / Partner</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-cream">✕</button>
        </div>
        {error && <p className="mt-2 text-sm text-brick">{error}</p>}

        <div className="mt-4 space-y-3">
          <ImageUploadField
            label="Photo (optional)"
            value={photo}
            uploadUrl="/partners/upload-photo"
            formFieldName="photo"
            shape="circle"
            onUploaded={setPhoto}
          />
          <div>
            <label className={labelCls}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Share % (optional)</label>
              <input type="number" min="0" max="100" step="0.01" value={sharePercentage} onChange={(e) => setSharePercentage(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
          </div>
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