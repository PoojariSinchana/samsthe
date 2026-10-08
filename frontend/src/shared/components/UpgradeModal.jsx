import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { FEATURE_LABELS } from "../constants/features";

const rupees = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;

export default function UpgradeModal({ prompt, currentPlan, onClose }) {
  const { business, user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/plans", { params: { appType: business?.appType } })
      .then(({ data }) => setPlans(data.plans || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [business?.appType]);

  const feature = prompt.feature;
  const isLimit = prompt.code === "PLAN_LIMIT";
  const suggested = feature ? plans.find((p) => p.modules?.includes(feature)) : null;

  const title = feature
    ? `${FEATURE_LABELS[feature] || "This feature"} isn't in your plan`
    : isLimit ? "You've reached your plan limit" : "Upgrade your plan";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="receipt-card relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-sm">
        <span className="receipt-notch left-6" />
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-8 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-saffron/15 text-saffron"><Lock size={16} /></span>
            <div>
              <h2 className="font-display text-xl text-cream">{title}</h2>
              <p className="mt-1 text-sm text-muted">
                {prompt.message || "Pick a plan below to unlock it."}
                {currentPlan?.name && <> You're on <span className="text-cream">{currentPlan.name}</span>.</>}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-cream">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5 sm:px-6">
          {loading ? <p className="py-8 text-center text-sm text-muted">Loading plans…</p>
          : plans.length === 0 ? <p className="py-8 text-center text-sm text-muted">Contact us to upgrade your plan.</p>
          : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {plans.map((p) => {
                const current = currentPlan?.key === p.key;
                const rec = suggested?._id === p._id;
                return (
                  <div key={p._id} className={`flex flex-col rounded-sm border p-4 ${rec ? "border-saffron" : "border-charcoal-lighter"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-display text-lg text-cream">{p.name}</p>
                      {rec && <span className="rounded-full bg-saffron px-2 py-0.5 text-[10px] font-medium text-charcoal">Unlocks this</span>}
                      {current && <span className="rounded-full bg-charcoal-lighter px-2 py-0.5 text-[10px] text-muted">Current</span>}
                    </div>
                    <p className="mt-1 font-display text-2xl text-cream">{rupees(p.monthlyPrice)}<span className="text-xs text-muted"> /month</span></p>
                    {p.yearlyPrice > 0 && <p className="text-xs text-muted">or {rupees(p.yearlyPrice)} /year</p>}
                    <ul className="mt-3 flex-1 space-y-1 text-xs text-muted">
                      <li>✓ {p.limits.maxOutlets} outlet{p.limits.maxOutlets > 1 ? "s" : ""}</li>
                      <li>✓ {p.limits.maxStaff} staff logins</li>
                      {(p.features || []).slice(0, 5).map((f) => <li key={f}>✓ {f}</li>)}
                    </ul>
                    {!current && (user?.role === "owner" ? (
                      <button onClick={() => { window.dispatchEvent(new CustomEvent("nav:section", { detail: "subscription" })); onClose(); }}
                        className={`mt-4 rounded-sm px-3 py-2 text-center text-sm font-medium ${rec ? "bg-saffron text-charcoal hover:bg-saffron-dark" : "border border-charcoal-lighter text-cream hover:border-saffron"}`}>
                        See {p.name} plan
                      </button>
                    ) : <p className="mt-4 text-xs text-muted">Ask your business owner to upgrade.</p>)
                    }
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}