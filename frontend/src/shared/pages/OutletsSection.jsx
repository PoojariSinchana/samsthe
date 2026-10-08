import { useEffect, useState } from "react";
import api from "../api/axios";

const emptyForm = { name: "", address: "", phone: "" };

export default function OutletsSection() {
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadOutlets();
  }, []);

  function loadOutlets() {
    setLoading(true);
    api
      .get("/outlets")
      .then(({ data }) => setOutlets(data.outlets))
      .catch(() => setError("Couldn't load outlets."))
      .finally(() => setLoading(false));
  }

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSubmitting(true);
    setError("");
    try {
      await api.post("/outlets", form);
      setForm(emptyForm);
      setShowForm(false);
      loadOutlets();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't create outlet.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(outlet) {
    try {
      await api.put(`/outlets/${outlet._id}`, { isActive: !outlet.isActive });
      loadOutlets();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't update that outlet.");
    }
  }

  async function handleDelete(outlet) {
    if (!confirm(`Remove "${outlet.name}"? This can't be undone.`)) return;
    try {
      await api.delete(`/outlets/${outlet._id}`);
      loadOutlets();
    } catch {
      setError("Couldn't remove that outlet.");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Outlets</h1>
          <p className="mt-1 text-sm text-muted">
            Every branch of your restaurant — orders, bills, tables and
            inventory will each belong to one of these.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark"
        >
          {showForm ? "Cancel" : "Add outlet"}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-brick">{error}</p>}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="receipt-card mt-6 grid grid-cols-1 gap-4 rounded-sm px-5 pb-6 pt-8 sm:grid-cols-2"
        >
          <span className="receipt-notch left-6" />
          <div className="sm:col-span-2">
            <label htmlFor="name" className="block text-sm text-muted">
              Outlet name
            </label>
            <input
              id="name"
              name="name"
              required
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Bengaluru Outlet"
              className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron"
            />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm text-muted">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron"
            />
          </div>
          <div>
            <label htmlFor="address" className="block text-sm text-muted">
              Address
            </label>
            <input
              id="address"
              name="address"
              value={form.address}
              onChange={handleChange}
              className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-60 sm:col-span-2"
          >
            {submitting ? "Adding…" : "Add outlet"}
          </button>
        </form>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading && <p className="text-sm text-muted">Loading outlets…</p>}

        {!loading && outlets.length === 0 && (
          <p className="text-sm text-muted">
            No outlets yet — add your first branch above.
          </p>
        )}

        {outlets.map((outlet) => (
          <div key={outlet._id} className="receipt-card rounded-sm px-5 pb-5 pt-7">
            <span className="receipt-notch left-6" />
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-lg text-cream">{outlet.name}</h3>
              <span
                className={`shrink-0 rounded-sm px-2 py-0.5 text-xs ${
                  outlet.isActive ? "bg-sage/20 text-sage" : "bg-brick/20 text-brick"
                }`}
              >
                {outlet.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            {outlet.address && <p className="mt-2 text-sm text-muted">{outlet.address}</p>}
            {outlet.phone && <p className="mt-1 text-sm text-muted">{outlet.phone}</p>}

            <div className="mt-4 flex gap-3 text-sm">
              <button
                type="button"
                onClick={() => toggleActive(outlet)}
                className="text-saffron hover:text-saffron-dark"
              >
                {outlet.isActive ? "Deactivate" : "Activate"}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(outlet)}
                className="text-brick hover:text-brick/80"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}