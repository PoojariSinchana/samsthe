import { useState, useEffect } from "react";
import { setAppManifest } from "../shared/context/InstallContext";
import { Link, useNavigate } from "react-router-dom";
import api from "../shared/api/axios";
import Logo from "../shared/components/Logo";
import { useAuth } from "../shared/context/AuthContext";

const APP_LABEL = { restaurant: "Restaurant", retail: "Retail" };

export default function LoginForm({ appType }) {
  const appLabel = APP_LABEL[appType] || "Restaurant";
  const navigate = useNavigate();
  const { loginSuccess } = useAuth();
  const [mode, setMode] = useState("owner");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [restaurantName, setRestaurantName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [staffPassword, setStaffPassword] = useState("");


  useEffect(() => { setAppManifest(appType); }, [appType]);
  
  // Handles the two extra response shapes from /auth/login
  const [chooser, setChooser] = useState(null);           // { continueToken, businesses }
  const [noBusinessHint, setNoBusinessHint] = useState(false);

  const signupHref = appType === "retail" ? "/retail/signup" : "/restaurant/signup";

  async function handleOwnerSubmit(e) {
    e.preventDefault();
    setError("");
    setNoBusinessHint(false);
    setSubmitting(true);
    try {
      const { data } = await api.post("/auth/login", { email, password, appType });

      if (data.code === "CHOOSE_BUSINESS") {
        setChooser(data);
        return;
      }

      loginSuccess(data);
      navigate(data.business?.appType === "retail" ? "/retail/app" : "/restaurant/app");
    } catch (err) {
      const body = err.response?.data;
      if (body?.code === "NO_BUSINESS_FOR_APP") {
        setError(body.message);
        setNoBusinessHint(true);
      } else {
        setError(body?.message || "Something went wrong.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChooseBusiness(businessId) {
    setError("");
    setSubmitting(true);
    try {
      const { data } = await api.post("/auth/login/continue", {
      continueToken: chooser.continueToken,
      restaurantId: businessId,   // was: restaurantId (undefined)
    });
      loginSuccess(data);
      navigate(data.business?.appType === "retail" ? "/app/retail" : "/app/restaurant");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong.");
      setChooser(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStaffSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { data } = await api.post("/auth/staff-login", {
        restaurantName, employeeId, password: staffPassword, appType,
      });
      loginSuccess(data);
      navigate(data.business?.appType === "retail" ? "/app/retail" : "/app/restaurant");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal px-4 py-12">
      <div className="w-full max-w-sm">
        <header className="flex items-center justify-between border-b border-charcoal-lighter bg-charcoal-light px-4 py-3">
          <Logo compact />
          {!window.matchMedia("(display-mode: standalone)").matches && (
            <Link to="/" className="text-sm text-muted hover:text-cream">← Website</Link>
          )}
        </header>

        <div className="receipt-card rounded-sm px-6 pb-8 pt-10 sm:px-8">
          <span className="receipt-notch left-1/2 -translate-x-1/2" />

          {/* Business picker — shown instead of the form when the account has multiple businesses */}
          {chooser ? (
            <>
              <h1 className="font-display text-2xl text-cream">Which business?</h1>
              <p className="mt-1 text-sm text-muted">This login has more than one business — pick one to continue.</p>

              {error && <p className="mt-3 text-sm text-brick">{error}</p>}

              <div className="mt-6 flex flex-col gap-3">
                {chooser.businesses.map((b) => (
                  <button
                    key={b.businessId}
                    type="button"
                    disabled={submitting}
                    onClick={() => handleChooseBusiness(b.businessId)}
                    className="flex items-center justify-between rounded-sm border border-charcoal-lighter bg-charcoal-light px-4 py-3 text-left hover:border-saffron disabled:opacity-60"
                  >
                    <span className="text-cream">{b.name}</span>
                    <span className="rounded-full bg-saffron/10 px-2 py-0.5 text-xs text-saffron">
                      {APP_LABEL[b.appType] || b.appType}
                    </span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => { setChooser(null); setError(""); }}
                className="mt-5 text-sm text-muted hover:text-cream"
              >
                ← Back to login
              </button>
            </>
          ) : (
            <>
              <div className="mb-5 flex rounded-sm border border-charcoal-lighter">
                <button type="button" onClick={() => { setMode("owner"); setError(""); setNoBusinessHint(false); }}
                  className={`flex-1 py-2 text-sm font-medium ${mode === "owner" ? "bg-saffron text-charcoal" : "text-muted hover:text-cream"}`}>
                  Owner
                </button>
                <button type="button" onClick={() => { setMode("staff"); setError(""); setNoBusinessHint(false); }}
                  className={`flex-1 py-2 text-sm font-medium ${mode === "staff" ? "bg-saffron text-charcoal" : "text-muted hover:text-cream"}`}>
                  Staff
                </button>
              </div>

              <h1 className="font-display text-2xl text-cream">Welcome back</h1>
              <p className="mt-1 text-sm text-muted">
                {`Log in to your ${appLabel} account${mode === "owner" ? " with your email" : " with your business name and employee ID"}.`}
              </p>

              {mode === "owner" ? (
                <form onSubmit={handleOwnerSubmit} className="mt-6 flex flex-col gap-4">
                  <div>
                    <label className="block text-sm text-muted">Email</label>
                    <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
                      className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron" />
                  </div>
                  <div>
                    <label className="block text-sm text-muted">Password</label>
                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                      className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron" />
                  </div>

                  {error && <p className="text-sm text-brick">{error}</p>}

                  {noBusinessHint && (
                    <Link to={signupHref} className="text-sm text-saffron hover:text-saffron-dark">
                      Create your {appLabel} business with this email →
                    </Link>
                  )}

                  <button type="submit" disabled={submitting}
                    className="mt-2 w-full rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-60">
                    {submitting ? "Logging in…" : "Log in"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleStaffSubmit} className="mt-6 flex flex-col gap-4">
                  <div>
                    <label className="block text-sm text-muted">
                      {appType === "retail" ? "Shop name" : "Restaurant name"}
                    </label>
                    <input required autoFocus value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)}
                      className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron" />
                  </div>
                  <div>
                    <label className="block text-sm text-muted">Employee ID</label>
                    <input required placeholder="EMP001" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
                      className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron" />
                  </div>
                  <div>
                    <label className="block text-sm text-muted">Password</label>
                    <input type="password" required value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)}
                      className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron" />
                  </div>
                  {error && <p className="text-sm text-brick">{error}</p>}
                  <button type="submit" disabled={submitting}
                    className="mt-2 w-full rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-60">
                    {submitting ? "Logging in…" : "Log in"}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        {mode === "owner" && !chooser && (
          <p className="mt-6 text-center text-sm text-muted">
            New {appType === "retail" ? "shop" : "restaurant"}?{" "}
            <Link to={signupHref} className="text-saffron hover:text-saffron-dark">
              Create an account
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}