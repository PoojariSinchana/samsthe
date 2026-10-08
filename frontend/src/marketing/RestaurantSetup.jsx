import { useState } from "react";
import { useNavigate,useSearchParams  } from "react-router-dom";
import api from "../shared/api/axios";
import Logo from "../shared/components/Logo";
import ImageUploadField from "../shared/components/ImageUploadField";
import { useAuth } from "../shared/context/AuthContext";

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

export default function RestaurantSetup() {
  const navigate = useNavigate();
  const { updateRestaurantInfo, restaurant } = useAuth();
  const isRetail = restaurant?.appType === "retail";
  const dest = isRetail ? "/app/retail" : "/app/restaurant";
  const [params] = useSearchParams();
  const plan = params.get("plan");
  const next = `/choose-plan${plan ? `?plan=${plan}` : ""}`;

  const BUSINESS_TYPES = isRetail ? RETAIL_BUSINESS_TYPES : RESTAURANT_BUSINESS_TYPES;

  const [form, setForm] = useState({
    address: "",
    logoUrl: "",
    businessType: isRetail ? "general_store" : "restaurant",
    gstRegistered: false,
    gstNumber: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { data } = await api.put("/restaurants/me", form);
      updateRestaurantInfo({ logoUrl: data.restaurant.logoUrl, appType: data.restaurant.appType });
      navigate(dest);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="mb-8">
          <Logo />
        </div>
        <div className="receipt-card rounded-sm px-6 pb-8 pt-10 sm:px-10">
          <span className="receipt-notch left-1/2 -translate-x-1/2" />
          <h1 className="font-display text-2xl text-cream">
            Tell us about your {isRetail ? "shop" : "restaurant"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            A few more details to finish setting up your account. You can
            always update these later.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <div>
              <label htmlFor="address" className="block text-sm text-muted">Address</label>
              <textarea
                id="address"
                name="address"
                rows={2}
                value={form.address}
                onChange={handleChange}
                className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron"
              />
            </div>

            <div>
              <label htmlFor="logoUrl" className="block text-sm text-muted">Logo URL</label>
              <input
                id="logoUrl"
                name="logoUrl"
                type="url"
                placeholder="https://…"
                value={form.logoUrl}
                onChange={handleChange}
                className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron"
              />
            </div>
            <ImageUploadField
              label="Or upload a logo from your device"
              value={form.logoUrl}
              uploadUrl="/restaurants/me/logo"
              formFieldName="logo"
              shape="circle"
              onUploaded={(url) => setForm((prev) => ({ ...prev, logoUrl: url }))}
            />

            <div>
              <label htmlFor="businessType" className="block text-sm text-muted">Business type</label>
              <select
                id="businessType"
                name="businessType"
                value={form.businessType}
                onChange={handleChange}
                className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron"
              >
                {BUSINESS_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div className="rounded-sm border border-charcoal-lighter bg-charcoal-light px-4 py-3">
              <label className="flex items-center gap-2 text-sm text-cream">
                <input
                  type="checkbox"
                  name="gstRegistered"
                  checked={form.gstRegistered}
                  onChange={handleChange}
                  className="h-4 w-4 accent-saffron"
                />
                Registered for GST
              </label>
              {form.gstRegistered && (
                <div className="mt-3">
                  <label htmlFor="gstNumber" className="block text-sm text-muted">GST number</label>
                  <input
                    id="gstNumber"
                    name="gstNumber"
                    type="text"
                    maxLength={15}
                    value={form.gstNumber}
                    onChange={handleChange}
                    className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal px-3 py-2.5 text-cream outline-none focus:border-saffron"
                  />
                </div>
              )}
            </div>

            {error && <p className="text-sm text-brick">{error}</p>}

            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal transition-colors hover:bg-saffron-dark disabled:opacity-60 sm:flex-1"
              >
                {submitting ? "Saving…" : "Save & continue"}
              </button>
              <button
                type="button"
                onClick={() => navigate(dest)}
                className="w-full rounded-sm border border-charcoal-lighter px-4 py-2.5 text-sm text-muted hover:text-cream sm:w-auto"
              >
                Skip for now
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}