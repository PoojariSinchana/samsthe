import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import ImageUploadField from "../components/ImageUploadField";


const RESTAURANT_BUSINESS_TYPES = [
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Café" },
  { value: "cloud_kitchen", label: "Cloud kitchen" },
  { value: "bar", label: "Bar / pub" },
  { value: "food_truck", label: "Food truck" },
  { value: "other", label: "Other" },
];

const RETAIL_BUSINESS_TYPES = [
  { value: "clothing", label: "Clothing / Apparel" },
  { value: "grocery", label: "Grocery / Supermarket" },
  { value: "electronics", label: "Electronics" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "footwear", label: "Footwear" },
  { value: "general_store", label: "General store" },
  { value: "other", label: "Other" },
];
const FINANCIAL_YEAR_OPTIONS = ["Apr - Mar", "Jan - Dec", "Jul - Jun", "Oct - Sep"];

function RestaurantProfileCard() {
  const { updateRestaurantInfo, restaurant } = useAuth();
  const isRetail = restaurant?.appType === "retail";
  const BUSINESS_TYPES_LIST = isRetail ? RETAIL_BUSINESS_TYPES : RESTAURANT_BUSINESS_TYPES;
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get("/restaurants/me")
      .then(({ data }) => {
        const r = data.restaurant;
        setForm({
          name: r.name || "",
          businessType: r.businessType || "restaurant",
          phone: r.phone || "",
          email: r.email || "",
          address: r.address || "",
          city: r.city || "",
          state: r.state || "",
          country: r.country || "",
          financialYear: r.financialYear || "Apr - Mar",
          logoUrl: r.logoUrl || "",
          imageUrl: r.imageUrl || "",
          gstRegistered: r.gst?.registered || false,
          gstNumber: r.gst?.number || "",
        });
      })
      .catch(() => setError("Couldn't load restaurant profile."))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    setSaved(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const { data } = await api.put("/restaurants/me", form);
      updateRestaurantInfo({ name: data.restaurant.name, logoUrl: data.restaurant.logoUrl });
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard title="Restaurant Profile" description="Shown across the app — sidebar, receipts, and (soon) customer-facing pages.">
      {loading || !form ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="name" className="block text-sm text-muted">Restaurant name</label>
            <input id="name" name="name" value={form.name} onChange={handleChange}
              className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron" />
          </div>

          <div>
            <label htmlFor="businessType" className="block text-sm text-muted">Business type</label>
            <select id="businessType" name="businessType" value={form.businessType} onChange={handleChange}
              className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron">
              {BUSINESS_TYPES_LIST.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="financialYear" className="block text-sm text-muted">Financial year</label>
            <select id="financialYear" name="financialYear" value={form.financialYear} onChange={handleChange}
              className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron">
              {FINANCIAL_YEAR_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm text-muted">Phone</label>
            <input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange}
              className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron" />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm text-muted">Email</label>
            <input id="email" name="email" type="email" value={form.email} onChange={handleChange}
              className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron" />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="address" className="block text-sm text-muted">Address</label>
            <textarea id="address" name="address" rows={2} value={form.address} onChange={handleChange}
              className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron" />
          </div>

          <div>
            <label htmlFor="city" className="block text-sm text-muted">City</label>
            <input id="city" name="city" value={form.city} onChange={handleChange}
              className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron" />
          </div>

          <div>
            <label htmlFor="state" className="block text-sm text-muted">State</label>
            <input id="state" name="state" value={form.state} onChange={handleChange}
              className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron" />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="country" className="block text-sm text-muted">Country</label>
            <input id="country" name="country" value={form.country} onChange={handleChange}
              className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron" />
          </div>

          <div>
            <label htmlFor="logoUrl" className="block text-sm text-muted">Logo URL</label>
            <input id="logoUrl" name="logoUrl" type="url" placeholder="https://…" value={form.logoUrl} onChange={handleChange}
              className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron" />
          </div>

          <div>
            <label htmlFor="imageUrl" className="block text-sm text-muted">Cover / banner image URL</label>
            <input id="imageUrl" name="imageUrl" type="url" placeholder="https://…" value={form.imageUrl} onChange={handleChange}
              className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron" />
          </div>

          <ImageUploadField
            label="Or upload a logo from your device"
            value={form.logoUrl}
            uploadUrl="/restaurants/me/logo"
            formFieldName="logo"
            shape="circle"
            onUploaded={(url) => { setForm((prev) => ({ ...prev, logoUrl: url })); setSaved(false); }}
          />

          <ImageUploadField
            label="Or upload a banner from your device"
            value={form.imageUrl}
            uploadUrl="/restaurants/me/image"
            formFieldName="image"
            shape="square"
            onUploaded={(url) => { setForm((prev) => ({ ...prev, imageUrl: url })); setSaved(false); }}
          />

          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-cream">
              <input type="checkbox" name="gstRegistered" checked={form.gstRegistered} onChange={handleChange} className="h-4 w-4 accent-saffron" />
              Registered for GST (optional)
            </label>
          </div>

          {form.gstRegistered && (
            <div className="sm:col-span-2">
              <label htmlFor="gstNumber" className="block text-sm text-muted">GST number</label>
              <input id="gstNumber" name="gstNumber" type="text" maxLength={15} value={form.gstNumber} onChange={handleChange}
                className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron" />
            </div>
          )}

          {error && <p className="text-sm text-brick sm:col-span-2">{error}</p>}
          {saved && <p className="text-sm text-sage sm:col-span-2">Saved.</p>}

          <div className="sm:col-span-2">
            <button type="submit" disabled={saving}
              className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-60">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}
    </SectionCard>
  );
}


export default function SettingsSection() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl text-cream sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Manage your restaurant profile, appearance, and account.
        </p>
      </div>

      <RestaurantProfileCard />
      <AppearanceCard />
      <PasswordCard />
      <DangerZoneCard />
    </div>
  );
}

function SectionCard({ title, description, children }) {
  return (
    <section className="receipt-card rounded-sm px-5 pb-6 pt-8 sm:px-7">
      <span className="receipt-notch left-6" />
      <h2 className="font-display text-lg text-cream">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function AppearanceCard() {
  const { theme, setTheme } = useTheme();

  return (
    <SectionCard title="Appearance" description="Choose how the app looks on this device.">
      <div className="flex gap-3">
        <ThemeOption
          label="Light"
          active={theme === "light"}
          onClick={() => setTheme("light")}
          swatchClass="bg-[#F5F3FA]"
          dotClass="bg-[#8B5CF6]"
        />
        <ThemeOption
          label="Dark"
          active={theme === "dark"}
          onClick={() => setTheme("dark")}
          swatchClass="bg-[#1C1B18]"
          dotClass="bg-[#E3A23C]"
        />
      </div>
    </SectionCard>
  );
}

function ThemeOption({ label, active, onClick, swatchClass, dotClass }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-2 rounded-sm border px-4 py-3 transition-colors ${
        active ? "border-saffron" : "border-charcoal-lighter hover:border-muted"
      }`}
    >
      <span className={`flex h-10 w-16 items-center justify-center rounded-sm ${swatchClass}`}>
        <span className={`h-3 w-3 rounded-full ${dotClass}`} />
      </span>
      <span className="text-sm text-cream">{label}</span>
    </button>
  );
}

function PasswordCard() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setSuccess("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (form.newPassword !== form.confirmNewPassword) {
      setError("New passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      await api.put("/auth/password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setSuccess("Password updated.");
      setForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't update password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SectionCard title="Password" description="Change the password you log in with.">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:max-w-sm">
        <PasswordField
          label="Current password"
          name="currentPassword"
          value={form.currentPassword}
          onChange={handleChange}
        />
        <PasswordField
          label="New password"
          name="newPassword"
          value={form.newPassword}
          onChange={handleChange}
        />
        <PasswordField
          label="Confirm new password"
          name="confirmNewPassword"
          value={form.confirmNewPassword}
          onChange={handleChange}
        />

        {error && <p className="text-sm text-brick">{error}</p>}
        {success && <p className="text-sm text-sage">{success}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-60 sm:w-fit"
        >
          {submitting ? "Updating…" : "Update password"}
        </button>
      </form>
    </SectionCard>
  );
}

function PasswordField({ label, name, value, onChange }) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm text-muted">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="password"
        required
        minLength={6}
        value={value}
        onChange={onChange}
        className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron"
      />
    </div>
  );
}

function DangerZoneCard() {
  
  const { logout, restaurant } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e) {
    e.preventDefault();
    setError("");
    setDeleting(true);
    try {
      await api.delete("/auth/account", { data: { password } });
      logout();
      navigate(`/${restaurant?.appType || "restaurant"}/login`);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't delete account.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SectionCard title="Account">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-cream">Log out</p>
            <p className="text-xs text-muted">End your session on this device.</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="shrink-0 rounded-sm border border-charcoal-lighter px-4 py-2 text-sm text-muted hover:text-cream"
          >
            Logout
          </button>
        </div>

        <div className="border-t border-charcoal-lighter pt-6">
          <p className="text-sm text-brick">Delete restaurant account</p>
          <p className="mt-1 text-xs text-muted">
            Permanently deletes this restaurant, its outlets, and every staff
            login tied to it. This can't be undone.
          </p>

          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-3 rounded-sm border border-brick px-4 py-2 text-sm text-brick hover:bg-brick/10"
            >
              Delete account
            </button>
          ) : (
            <form onSubmit={handleDelete} className="mt-3 flex flex-col gap-3 sm:max-w-sm">
              <label htmlFor="deletePassword" className="block text-sm text-muted">
                Confirm your password to continue
              </label>
              <input
                id="deletePassword"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-sm border border-brick bg-charcoal-light px-3 py-2.5 text-cream outline-none"
              />
              {error && <p className="text-sm text-brick">{error}</p>}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={deleting}
                  className="rounded-sm bg-brick px-4 py-2 text-sm font-medium text-cream hover:bg-brick/80 disabled:opacity-60"
                >
                  {deleting ? "Deleting…" : "Permanently delete"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    setPassword("");
                    setError("");
                  }}
                  className="rounded-sm border border-charcoal-lighter px-4 py-2 text-sm text-muted hover:text-cream"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </SectionCard>
  );
}