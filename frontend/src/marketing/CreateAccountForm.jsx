// frontend/src/marketing/CreateAccountForm.jsx
import { useEffect } from "react";
import { setAppManifest } from "../shared/context/InstallContext";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../shared/api/axios";
import { useAuth } from "../shared/context/AuthContext";
import Logo from "../shared/components/Logo";

const initialForm = {
  restaurantName: "",
  ownerName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
};

const APP_COPY = {
  restaurant: { noun: "restaurant", heading: "Create your restaurant account", nameLabel: "Restaurant / business name" },
  retail: { noun: "shop", heading: "Create your shop account", nameLabel: "Shop / business name" },
};

export default function CreateAccountForm({ appType }) {
  const navigate = useNavigate();
  const copy = APP_COPY[appType] || APP_COPY.restaurant;
  const { loginSuccess } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [params] = useSearchParams();
  const plan = params.get("plan");
  useEffect(() => { setAppManifest(appType); }, [appType]);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) { setError("Passwords do not match"); return; }
    setSubmitting(true);
    try {
      const { data } = await api.post("/auth/register", { ...form, appType });
      loginSuccess(data);
      navigate(`/restaurant-setup${plan ? `?plan=${plan}` : ""}`);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const loginHref = appType === "retail" ? "/retail/login" : "/restaurant/login";

  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal px-4 py-12">
      <div className="w-full max-w-2xl">
        <header className="flex items-center justify-between border-b border-charcoal-lighter bg-charcoal-light px-4 py-3">
          <Logo compact />
          <Link to="/" className="text-sm text-muted hover:text-cream">← Website</Link>
        </header>

        <div className="receipt-card rounded-sm px-6 pb-8 pt-10 sm:px-10">
          <span className="receipt-notch left-1/2 -translate-x-1/2" />
          <h1 className="font-display text-2xl text-cream">{copy.heading}</h1>
          <p className="mt-1 text-sm text-muted">
            This creates your {copy.noun} and your owner login together.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label={copy.nameLabel}
              name="restaurantName"
              value={form.restaurantName}
              onChange={handleChange}
              className="sm:col-span-2"
            />
            <Field label="Owner name" name="ownerName" value={form.ownerName} onChange={handleChange} />
            <Field
              label="Phone number"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
            />
            <Field
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="sm:col-span-2"
            />
            <Field
              label="Password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
            />
            <Field
              label="Confirm password"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
            />

            {error && <p className="text-sm text-brick sm:col-span-2">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal transition-colors hover:bg-saffron-dark disabled:opacity-60 sm:col-span-2"
            >
              {submitting ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link to={loginHref} className="text-saffron hover:text-saffron-dark">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, name, type = "text", value, onChange, className = "" }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="block text-sm text-muted">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required
        value={value}
        onChange={onChange}
        className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron"
      />
    </div>
  );
}