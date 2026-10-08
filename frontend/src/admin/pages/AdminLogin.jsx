import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Logo from "../../shared/components/Logo";
import { useAdminAuth } from "../context/AdminAuthContext";


export default function AdminLogin() {
  const navigate = useNavigate();
  const { admin, loading, login } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && admin) return <Navigate to="/admin" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/admin");
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't log in. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal px-4 py-12">
      <div className="w-full max-w-sm">
        <header className="flex items-center justify-between border-b border-charcoal-lighter bg-charcoal-light px-4 py-3">
          <Logo compact />
          <Link to="/" className="text-sm text-muted hover:text-cream">← Website</Link>
        </header>
          
        <div className="receipt-card rounded-sm px-6 pb-8 pt-10 sm:px-8">
          <span className="receipt-notch left-1/2 -translate-x-1/2" />
          <h1 className="font-display text-2xl text-cream">Team sign in</h1>
          <p className="mt-1 text-sm text-muted">For Samsthe staff only. Customer accounts sign in from the product pages.</p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="block text-sm text-muted">Work email</label>
              <input id="email" type="email" required autoFocus autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron" />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm text-muted">Password</label>
              <input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron" />
            </div>
            {error && <p role="alert" className="text-sm text-brick">{error}</p>}
            <button type="submit" disabled={submitting}
              className="mt-2 w-full rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-60">
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}