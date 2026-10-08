import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import api from "../shared/api/axios";
import Logo from "../shared/components/Logo";
import { useAuth } from "../shared/context/AuthContext";
import { usePlan } from "../shared/context/PlanContext";
import PayByUpi from "./PayByUpi";

const rupees = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
export default function ChoosePlan() {
  const [params] = useSearchParams();
  const { user, business, logout } = useAuth();
  const { info, loaded, refresh } = usePlan();
  const [data, setData] = useState(null);
  const [cycle, setCycle] = useState("monthly");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(null);

  const preselect = params.get("plan");
  const isOwner = user?.role === "owner";
  const dest = `/app/${business?.appType || "restaurant"}`;

  useEffect(() => {
    api.get("/business/me/plans").then(({ data }) => setData(data))
      .catch((e) => setError(e.response?.data?.message || "Couldn't load plans."));
  }, []);

  if (loaded && info && !info.needsPlan) return <Navigate to={dest} replace />;
 

  async function choose(plan) {
    setError("");
    setBusy(plan.key);
    try {
      const { data: res } = await api.post("/business/me/subscribe", { planKey: plan.key, billingCycle: cycle });
      if (res.status === "PENDING") setSent({ ...(res.invoice || {}), planName: plan.name });
      await refresh(); // trial/active: needsPlan flips to false and the <Navigate> above takes over
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't select this plan.");
    } finally {
      setBusy("");
    }
  }

  const plans = data?.plans || [];
  const cards = data?.trial ? [data.trial, ...plans] : plans;
  const popularId = plans.length >= 3 ? plans[Math.floor(plans.length / 2)]._id : null;
  const hasYearly = plans.some((p) => p.yearlyPrice > 0);
  const pending = sent || (data?.subscription?.status === "PENDING"
    ? { ...(data.invoice || {}), planName: data.subscription.planName } : null);

  return (
    <div className="min-h-screen bg-charcoal px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <Logo />
          <button onClick={logout} className="text-sm text-muted hover:text-cream">Log out</button>
        </div>

        <h1 className="font-display text-2xl text-cream sm:text-3xl">Choose your plan</h1>
        <p className="mt-1 text-sm text-muted">
          Pick a plan to get started{business?.name ? ` with ${business.name}` : ""}.
          {data?.trial ? " Your free trial is available once." : ""}
        </p>

        {!isOwner ? (
          <div className="receipt-card mt-6 rounded-sm p-8 text-center text-sm text-muted">
            This business doesn't have a plan yet. Ask the owner to log in and choose one.
          </div>
        ) : (
          <>
            {pending && (
              <div className="receipt-card relative mt-6 rounded-sm px-5 pb-5 pt-7">
                <span className="receipt-notch left-6" />
                <p className="font-display text-lg text-saffron">{pending.planName} selected, waiting for payment</p>
                <p className="mt-1 text-sm text-muted">
                  {pending.invoiceNumber ? `Invoice ${pending.invoiceNumber} for ${rupees(pending.total)}. ` : ""}
                  Pay securely with UPI, card, net banking or wallet. Your account opens right after payment.
                </p>
                <PayByUpi refresh={refresh} />
              </div>
            )}

            {error && <p role="alert" className="mt-4 text-sm text-brick">{error}</p>}

            {hasYearly && (
              <div className="mt-6 inline-flex gap-1 rounded-sm border border-charcoal-lighter p-1">
                {["monthly", "yearly"].map((c) => (
                  <button key={c} onClick={() => setCycle(c)}
                    className={`rounded-sm px-3 py-1.5 text-sm capitalize ${cycle === c ? "bg-saffron text-charcoal" : "text-muted hover:text-cream"}`}>{c}</button>
                ))}
              </div>
            )}

            {!data && !error ? <p className="mt-8 text-sm text-muted">Loading plans…</p> : (
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {cards.map((p) => {
                  const yearly = cycle === "yearly" && p.yearlyPrice > 0;
                  const price = p.isTrial ? 0 : yearly ? p.yearlyPrice / 12 : p.monthlyPrice;
                  const highlight = preselect === p.key || (!preselect && p._id === popularId);
                  return (
                    <div key={p._id} className={`receipt-card relative flex flex-col rounded-sm px-5 pb-5 pt-8 ${highlight ? "!border-saffron" : ""}`}>
                      <span className="receipt-notch left-6" />
                      {p._id === popularId && <span className="absolute right-4 top-3 rounded-full bg-saffron px-2 py-0.5 text-[10px] font-medium text-charcoal">Most popular</span>}
                      <h2 className="font-display text-lg text-cream">{p.name}</h2>
                      <p className="mt-1 min-h-[2.5em] text-xs text-muted">{p.isTrial ? `${p.trialDays} days, one time only` : p.description}</p>
                      <p className="mt-3 font-display text-3xl text-cream">
                        {price > 0 ? <>{rupees(price)}<span className="text-xs text-muted"> /month</span></> : "Free"}
                      </p>
                      <p className="min-h-[1.2em] text-xs text-muted">{yearly ? `Billed ${rupees(p.yearlyPrice)} yearly` : ""}</p>
                      <ul className="mt-3 flex-1 space-y-1 text-sm text-muted">
                        <li>✓ {p.limits.maxOutlets} outlet{p.limits.maxOutlets > 1 ? "s" : ""}</li>
                        <li>✓ {p.limits.maxStaff} staff logins</li>
                        {(p.features || []).map((f) => <li key={f}>✓ {f}</li>)}
                      </ul>
                      <button onClick={() => choose(p)} disabled={!!busy}
                        className={`mt-5 rounded-sm px-4 py-2.5 text-sm font-medium disabled:opacity-50 ${highlight ? "bg-saffron text-charcoal hover:bg-saffron-dark" : "border border-charcoal-lighter text-cream hover:border-saffron"}`}>
                        {busy === p.key ? "Please wait…" : p.isTrial ? "Start free trial" : `Choose ${p.name}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}