import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import Reveal from "./Reveal";

const CSS = `
  .pricing .cycle{display:inline-flex; gap:.25rem; padding:.25rem; border:1px solid rgb(var(--border-strong)); border-radius:99px; margin:0 auto 2.25rem;}
  .pricing .cycle-wrap{text-align:center;}
  .pricing .cycle button{border:0; background:transparent; color:rgb(var(--muted)); padding:.45rem 1.1rem; border-radius:99px; font-size:.85rem; font-weight:700; cursor:pointer;}
  .pricing .cycle button.on{background:rgb(var(--accent)); color:#fff;}
  .pricing .save{font-size:.7rem; margin-left:.35rem; opacity:.85;}
  .pricing .pgrid2{display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:1.1rem; align-items:stretch;}
  .pricing .plan{display:flex; flex-direction:column; height:100%; padding:1.75rem 1.4rem; border:1px solid rgb(var(--border)); border-radius:12px; background:rgb(var(--surface)); position:relative;}
  .pricing .plan.pop{border-color:rgb(var(--accent)); box-shadow:0 14px 30px -16px rgb(var(--accent) / .55);}
  .pricing .badge{position:absolute; top:-.7rem; left:1.4rem; background:rgb(var(--accent)); color:#fff; font-size:.68rem; font-weight:700; padding:.2rem .65rem; border-radius:99px; text-transform:uppercase; letter-spacing:.04em;}
  .pricing .plan h3{font-size:1.1rem;}
  .pricing .plan .desc{color:rgb(var(--muted)); font-size:.85rem; margin:.35rem 0 0; min-height:2.4em;}
  .pricing .amount{font-family:Fraunces,Georgia,serif; font-size:2.2rem; font-weight:600; margin-top:1rem;}
  .pricing .amount small{font-family:Manrope,system-ui,sans-serif; font-size:.85rem; color:rgb(var(--muted)); font-weight:500;}
  .pricing .billed{font-size:.78rem; color:rgb(var(--muted)); min-height:1.2em;}
  .pricing ul.feat{list-style:none; margin:1.1rem 0 1.5rem; padding:0; flex:1;}
  .pricing ul.feat li{position:relative; padding:.35rem 0 .35rem 1.5rem; font-size:.88rem;}
  .pricing ul.feat li::before{content:"✓"; position:absolute; left:0; color:rgb(var(--sage)); font-weight:700;}
  .pricing .plan .btn{justify-content:center;}
  .pricing .note{text-align:center; color:rgb(var(--muted)); font-size:.85rem; padding:2rem 0;}
`;

const rupees = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;

export default function PricingSection({ appType, signupTo }) {
  const [plans, setPlans] = useState([]);
  const [trial, setTrial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [cycle, setCycle] = useState("monthly");

  useEffect(() => {
    let ignore = false;
    api.get("/plans", { params: { appType } })
      .then(({ data }) => { if (!ignore) { setPlans(data.plans || []); setTrial(data.trial || null); } })
      .catch(() => !ignore && setFailed(true))
      .finally(() => !ignore && setLoading(false));
    return () => { ignore = true; };
  }, [appType]);

  const cards = trial ? [trial, ...plans] : plans;
  const hasYearly = plans.some((p) => p.yearlyPrice > 0);
  const savePct = Math.max(0, ...plans.filter((p) => p.monthlyPrice > 0 && p.yearlyPrice > 0)
    .map((p) => Math.round((1 - p.yearlyPrice / (p.monthlyPrice * 12)) * 100)));
  const popularId = plans.length >= 3 ? plans[Math.floor(plans.length / 2)]._id : null;

  return (
    <section id="pricing" className="pricing">
      <style>{CSS}</style>
      <div className="wrap">
        <Reveal className="section-head">
          <span className="kicker">Pricing</span>
          <h2>Simple plans that grow with you</h2>
          <p>Start free{trial ? ` for ${trial.trialDays} days` : ""}, or go straight to the plan you need.</p>
        </Reveal>

        {hasYearly && (
          <div className="cycle-wrap">
            <div className="cycle" role="tablist" aria-label="Billing cycle">
              <button type="button" className={cycle === "monthly" ? "on" : ""} onClick={() => setCycle("monthly")}>Monthly</button>
              <button type="button" className={cycle === "yearly" ? "on" : ""} onClick={() => setCycle("yearly")}>
                Yearly{savePct > 0 && <span className="save">Save {savePct}%</span>}
              </button>
            </div>
          </div>
        )}

        {loading ? <p className="note">Loading plans…</p>
        : failed || cards.length === 0 ? <p className="note">Pricing will be available soon. <Link to={signupTo} style={{ color: "rgb(var(--accent-dark))" }}>Get started →</Link></p>
        : (
          <div className="pgrid2">
            {cards.map((p, i) => {
              const yearly = cycle === "yearly" && p.yearlyPrice > 0 && !p.isTrial;
              const price = p.isTrial ? 0 : yearly ? p.yearlyPrice / 12 : p.monthlyPrice;
              const pop = p._id === popularId;
              return (
                <Reveal key={p._id} delay={i * 80}>
                  <div className={`plan${pop ? " pop" : ""}`}>
                    {pop && <span className="badge">Most popular</span>}
                    <h3>{p.name}</h3>
                    <p className="desc">{p.isTrial ? `${p.trialDays}-day free trial, one time only` : p.description}</p>
                    <div className="amount">
                      {price > 0 ? <>{rupees(price)}<small> /month</small></> : "Free"}
                    </div>
                    <div className="billed">{yearly ? `Billed ${rupees(p.yearlyPrice)} yearly` : ""}</div>
                    <ul className="feat">
                      <li>{p.limits.maxOutlets} {p.limits.maxOutlets === 1 ? "outlet" : "outlets"}</li>
                      <li>{p.limits.maxStaff} staff logins</li>
                      {(p.features || []).map((f) => <li key={f}>{f}</li>)}
                    </ul>
                    <Link to={`${signupTo}?plan=${p.key}`} className={`btn ${pop || p.isTrial ? "btn-primary" : "btn-ghost"}`}>
                      {p.isTrial ? "Start free trial" : `Get ${p.name}`}
                    </Link>
                  </div>
                </Reveal>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}