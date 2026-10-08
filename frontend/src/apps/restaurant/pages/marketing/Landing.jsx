import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Home as HomeIcon } from "lucide-react";
import { useTheme } from "../../../../shared/context/ThemeContext";
import Logo from "../../../../shared/components/Logo";
import Reveal from "../../../../shared/components/Reveal";
import { MOTION_CSS } from "../../../../shared/styles/motion";
import PricingSection from "../../../../shared/components/PricingSection";

const FEATURES = [
  { icon: "🧾", title: "Billing / POS", desc: "Fast table & takeaway billing with split payments, printable bills and live table status." },
  { icon: "🪑", title: "Floor & Tables", desc: "Drag-and-drop floor plan, table capacity, guest counts, and auto-cleaning windows." },
  { icon: "📋", title: "Menu Builder", desc: "Categories, variants, add-ons, and per-order-type pricing for dine-in, takeaway & delivery." },
  { icon: "📦", title: "Inventory", desc: "Stock levels, low-stock alerts, stock-out/adjust logs, and purchase-linked restocking." },
  { icon: "🚚", title: "Purchases & Suppliers", desc: "Record purchases on credit or paid, track supplier payables, and settle in part or full." },
  { icon: "🧮", title: "Full Accounting", desc: "Auto-posted journal entries, ledgers, trial balance, P&L, balance sheet & cash flow." },
  { icon: "📊", title: "Analytics", desc: "Revenue trends, peak hours, top items, repeat customers, and profit margins at a glance." },
  { icon: "👥", title: "Staff & Access", desc: "HR records plus optional system logins, each with fine-grained per-outlet permissions." },
  { icon: "🏬", title: "Multi-Outlet", desc: "Run several branches under one account — scoped orders, tables, and reporting per outlet." },
  { icon: "🎙️", title: "Smart Entry", desc: "Speak or type a transaction in any language — AI classifies it and books it correctly." },
  { icon: "🧑‍🤝‍🧑", title: "Customers & CRM", desc: "Track repeat customers, order history and total spend automatically from every sale." },
  { icon: "📈", title: "Live Dashboard", desc: "Sales, expenses, net profit and receivables — updated the moment a payment lands." },
];

const WORKFLOW = [
  {
    tab: "1. Take the order",
    title: "Dine-in, takeaway or delivery",
    body: "Waiters and cashiers build an order from the menu — pick a table, add guests, choose variants and add-ons.",
    points: ["Live table availability", "Variant & add-on pricing resolved automatically", "Kitchen sees items the moment they're added"],
    mock: [["Order", "ORD-0182"], ["Table", "T-04 · 3 guests"], ["Items", "2× Biryani, 1× Lassi"], ["Status", "preparing"]],
  },
  {
    tab: "2. Bill & get paid",
    title: "Split payments, printable bills",
    body: "Cashiers collect payment — cash, card, UPI or split across methods. The table frees up automatically after.",
    points: ["Multiple payments per order", "Auto bill generation & printing", "Table enters a cleaning window post-payment"],
    mock: [["Total", "₹842.00"], ["Paid", "₹842.00"], ["Due", "₹0.00"], ["Status", "PAID ✓"]],
  },
  {
    tab: "3. Books update themselves",
    title: "Accounting, done for you",
    body: "Every payment posts a balanced journal entry — no manual bookkeeping. Purchases post supplier payables automatically too.",
    points: ["Real double-entry ledger under the hood", "P&L, balance sheet & cash flow always current", "Receivables & payables tracked live"],
    mock: [["Dr", "Cash — ₹842.00"], ["Cr", "Food & Beverage Sales — ₹842.00"], ["Entry", "auto-posted"], ["Balanced", "✓"]],
  },
  {
    tab: "4. See it on the dashboard",
    title: "Everything, at a glance",
    body: "Owners and managers see sales, expenses, net profit and outstanding balances — filtered by today, week, month or year.",
    points: ["Revenue vs expense trend charts", "Outstanding receivables & payables", "Per-outlet or restaurant-wide view"],
    mock: [["Sales today", "₹18,420"], ["Net profit", "+₹6,110"], ["Orders", "47"], ["Cash/Bank", "₹92,300"]],
  },
];

const ROLES = [
  { icon: "👑", name: "Owner", desc: "Full control, every outlet" },
  { icon: "🧑‍💼", name: "Manager", desc: "Day-to-day operations" },
  { icon: "💳", name: "Cashier", desc: "Billing & payments" },
  { icon: "🧑‍🍳", name: "Waiter", desc: "Orders & tables" },
  { icon: "🔥", name: "Kitchen", desc: "Prep queue only" },
  { icon: "📈", name: "Investor", desc: "Reports & analytics" },
];

const FAQS = [
  { q: "Can I run more than one outlet on one account?", a: "Yes — add as many outlets as you need. Orders, tables and inventory are scoped per outlet, and staff can be restricted to just the outlets they work at." },
  { q: "Do I need accounting knowledge to use this?", a: "No. Every sale, purchase and payment posts the correct journal entries automatically in the background. You get full statements — P&L, balance sheet, cash flow — without touching a ledger yourself." },
  { q: "What can each staff role see?", a: "Owners set granular permissions per person — view-only or manage access for orders, tables, menu, billing, accounting, reports and more, plus which outlets they can access." },
  { q: "How does Smart Entry work?", a: "Type or speak a transaction in plain language, in any language — it's automatically classified into the right category, amount, and payment method, ready for you to confirm." },
  { q: "Is there a free trial?", a: "You can create a restaurant account and explore every module right away — no credit card required to get started." },
];

const CSS = `
  .lp{
    --bg:255 255 255; --surface:255 255 255; --border:224 229 240; --border-strong:198 208 226;
    --text:17 24 39; --muted:100 112 134;
    --accent:37 99 235; --accent-dark:29 78 216;
    --sage:37 99 235; --brick:220 74 85;
    background:rgb(var(--bg)); color:rgb(var(--text)); font-family:Manrope,system-ui,sans-serif; -webkit-font-smoothing:antialiased;
    min-height:100vh; transition:background-color .2s ease, color .2s ease;
  }
  .lp[data-theme="dark"]{
    --bg:8 12 22; --surface:15 21 36; --border:31 41 61; --border-strong:47 60 84;
    --text:241 245 249; --muted:148 163 184; --sage:96 165 250; --brick:235 91 103;
  }
  .lp *{box-sizing:border-box;}
  .lp a{color:inherit;}
  .lp h1,.lp h2,.lp h3{font-family:Fraunces,Georgia,serif; font-weight:600; margin:0;}
  .lp .wrap{max-width:1100px; margin:0 auto; padding:0 1.5rem;}

  .lp header.nav{position:sticky; top:0; z-index:50; backdrop-filter:blur(10px); background:rgb(var(--bg) / 0.85); border-bottom:1px solid rgb(var(--border));}
  .lp .navbar{display:flex; align-items:center; justify-content:space-between; padding:1rem 0;}
  .lp .brand{display:flex; align-items:center; gap:.5rem; font-family:Fraunces,Georgia,serif; font-weight:600; font-size:1.15rem;}
  .lp .navlinks{display:flex; gap:2rem; list-style:none; margin:0; padding:0;}
  .lp .navlinks a{font-size:.9rem; font-weight:600; color:rgb(var(--muted)); text-decoration:none; transition:color .15s; cursor:pointer;}
  .lp .navlinks a:hover{color:rgb(var(--accent-dark));}
  .lp[data-theme="dark"] .navlinks a:hover{color:rgb(var(--accent));}
  .lp .navcta{display:flex; align-items:center; gap:.75rem;}
  .lp .btn{display:inline-flex; align-items:center; gap:.4rem; border-radius:6px; padding:.6rem 1.1rem; font-weight:700; font-size:.88rem; text-decoration:none; cursor:pointer; border:1px solid transparent;}
  .lp .btn.home-btn{justify-content:center; width:38px; height:38px; padding:0;}
  .lp .btn-primary{background:rgb(var(--accent)); color:#fff;}
  .lp .btn-primary:hover{background:rgb(var(--accent-dark));}
  .lp .btn-ghost{border-color:rgb(var(--border-strong)); color:rgb(var(--text));}
  .lp .btn-ghost:hover{border-color:rgb(var(--accent));}
  .lp .menu-toggle{display:none; background:none; border:1px solid rgb(var(--border-strong)); border-radius:6px; padding:.5rem .7rem; color:rgb(var(--text)); cursor:pointer;}
  .lp .mobile-panel{display:none; flex-direction:column; gap:.25rem; padding:.75rem 0 1rem;}
  .lp .mobile-panel a{padding:.6rem 0; font-weight:600; color:rgb(var(--text)); text-decoration:none; border-bottom:1px solid rgb(var(--border)); cursor:pointer;}
  @media (max-width:820px){
    .lp .navlinks, .lp .navcta .btn-ghost:not(.home-btn){display:none;}
    .lp .menu-toggle{display:inline-flex;}
    .lp header.nav.open .mobile-panel{display:flex;}
  }

  .lp .hero{padding:5rem 0 4rem; text-align:center;}
  .lp .eyebrow{display:inline-block; font-size:.78rem; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:rgb(var(--accent-dark)); background:rgb(var(--accent) / .12); padding:.35rem .8rem; border-radius:99px; margin-bottom:1.25rem;}
  .lp[data-theme="dark"] .eyebrow{color:rgb(var(--accent));}
  .lp .hero h1{font-size:clamp(2.2rem, 5.5vw, 3.6rem); line-height:1.08; max-width:16ch; margin:0 auto;}
  .lp .hero h1 .hl{color:rgb(var(--accent-dark));}
  .lp[data-theme="dark"] .hero h1 .hl{color:rgb(var(--accent));}
  .lp .hero p.sub{max-width:46ch; margin:1.25rem auto 0; color:rgb(var(--muted)); font-size:1.05rem; line-height:1.6;}
  .lp .hero-ctas{display:flex; gap:.85rem; justify-content:center; margin-top:2rem; flex-wrap:wrap;}
  .lp .roles-strip{display:flex; flex-wrap:wrap; gap:.5rem .9rem; justify-content:center; margin-top:2.25rem; font-size:.85rem; color:rgb(var(--muted));}
  .lp .roles-strip span{white-space:nowrap;}

  .lp .stats{display:grid; grid-template-columns:repeat(4,1fr); gap:1rem; margin:3.5rem 0 0;}
  .lp .stat{text-align:center; padding:1.4rem .5rem; border:1px solid rgb(var(--border)); border-radius:10px; background:rgb(var(--surface));}
  .lp .stat .num{font-family:Fraunces,Georgia,serif; font-size:1.9rem; color:rgb(var(--accent-dark));}
  .lp[data-theme="dark"] .stat .num{color:rgb(var(--accent));}
  .lp .stat .lbl{font-size:.78rem; color:rgb(var(--muted)); margin-top:.15rem;}
  @media (max-width:700px){ .lp .stats{grid-template-columns:repeat(2,1fr);} }
  @media (max-width:420px){ .lp .stats{grid-template-columns:1fr;} }

  .lp section{padding:4.5rem 0;}
  .lp .section-head{text-align:center; max-width:38ch; margin:0 auto 2.75rem;}
  .lp .section-head .kicker{font-size:.78rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:rgb(var(--accent-dark)); margin-bottom:.6rem; display:block;}
  .lp[data-theme="dark"] .section-head .kicker{color:rgb(var(--accent));}
  .lp .section-head h2{font-size:clamp(1.6rem,3.2vw,2.1rem);}
  .lp .section-head p{color:rgb(var(--muted)); margin-top:.75rem; font-size:.98rem; line-height:1.55;}

  .lp .fgrid{display:grid; grid-template-columns:repeat(3,1fr); gap:1.1rem;}
  @media (max-width:820px){ .lp .fgrid{grid-template-columns:repeat(2,1fr);} }
  @media (max-width:560px){ .lp .fgrid{grid-template-columns:1fr;} }
  .lp .fcard{position:relative; padding:1.5rem 1.35rem; border:1px solid rgb(var(--border)); border-radius:10px; background:rgb(var(--surface)); transition:border-color .15s, transform .15s, box-shadow .2s;}
  .lp .fcard:hover{border-color:rgb(var(--accent) / .55); transform:translateY(-3px); box-shadow:0 12px 28px -14px rgb(var(--accent) / .45);}
  .lp .fcard .icon{width:2.3rem; height:2.3rem; border-radius:8px; background:rgb(var(--accent) / .14); display:flex; align-items:center; justify-content:center; font-size:1.15rem; margin-bottom:.9rem;}
  .lp .fcard h3{font-size:1.02rem; margin-bottom:.4rem;}
  .lp .fcard p{font-size:.88rem; color:rgb(var(--muted)); line-height:1.5; margin:0;}

  .lp .tabs{display:flex; gap:.5rem; flex-wrap:wrap; justify-content:center; margin-bottom:2rem;}
  .lp .tab-btn{border:1px solid rgb(var(--border-strong)); background:transparent; color:rgb(var(--muted)); padding:.55rem 1rem; border-radius:99px; font-size:.85rem; font-weight:600; cursor:pointer; transition:background-color .2s, color .2s, border-color .2s;}
  .lp .tab-btn:hover{border-color:rgb(var(--accent));}
  .lp .tab-btn.active{background:rgb(var(--accent)); border-color:rgb(var(--accent)); color:#fff;}
  .lp .tab-panel{border:1px solid rgb(var(--border)); border-radius:12px; padding:2rem; background:rgb(var(--surface)); display:grid; grid-template-columns:1fr 1fr; gap:2rem; align-items:center;}
  @media (max-width:700px){ .lp .tab-panel{grid-template-columns:1fr;} }
  .lp .tab-panel h3{font-size:1.25rem; margin-bottom:.6rem;}
  .lp .tab-panel p{color:rgb(var(--muted)); line-height:1.6; font-size:.95rem;}
  .lp .tab-panel ul{margin:1rem 0 0; padding:0; list-style:none;}
  .lp .tab-panel li{font-size:.88rem; padding:.4rem 0; padding-left:1.5rem; position:relative; color:rgb(var(--text));}
  .lp .tab-panel li::before{content:"✓"; position:absolute; left:0; color:rgb(var(--sage)); font-weight:700;}
  .lp .mock{border:1px solid rgb(var(--border)); border-radius:10px; background:rgb(var(--bg)); padding:1.1rem; font-family:monospace; font-size:.8rem; line-height:1.7; color:rgb(var(--muted));}
  .lp .mock .row{display:flex; justify-content:space-between; gap:1rem;}
  .lp .mock .hilite{color:rgb(var(--sage));}

  .lp .roles{display:flex; gap:1rem; flex-wrap:wrap; justify-content:center;}
  .lp .role-pill{border:1px solid rgb(var(--border)); border-radius:10px; padding:1.1rem 1.3rem; background:rgb(var(--surface)); min-width:140px; text-align:center; transition:border-color .15s, transform .15s;}
  .lp .role-pill:hover{border-color:rgb(var(--accent) / .55); transform:translateY(-3px);}
  .lp .role-pill .r-icon{font-size:1.4rem; margin-bottom:.4rem;}
  .lp .role-pill .r-name{font-weight:700; font-size:.9rem;}
  .lp .role-pill .r-desc{font-size:.75rem; color:rgb(var(--muted)); margin-top:.25rem;}

  .lp .faq{max-width:700px; margin:0 auto;}
  .lp .faq-item{border-bottom:1px solid rgb(var(--border));}
  .lp .faq-q{width:100%; text-align:left; background:none; border:none; padding:1.1rem 0; font-family:Fraunces,Georgia,serif; font-size:1.02rem; font-weight:500; color:rgb(var(--text)); cursor:pointer; display:flex; justify-content:space-between; align-items:center; gap:1rem;}
  .lp .faq-q .plus{transition:transform .2s; color:rgb(var(--accent-dark)); font-size:1.2rem;}
  .lp[data-theme="dark"] .faq-q .plus{color:rgb(var(--accent));}
  .lp .faq-item.open .plus{transform:rotate(45deg);}
  .lp .faq-a{max-height:0; overflow:hidden; transition:max-height .25s ease;}
  .lp .faq-a p{margin:0 0 1.1rem; color:rgb(var(--muted)); font-size:.92rem; line-height:1.6;}

  .lp .cta-banner{border:1px solid rgb(var(--border)); border-radius:14px; padding:3rem 2rem; text-align:center; background:linear-gradient(180deg, rgb(var(--accent) / .10), transparent);}
  .lp .cta-banner h2{font-size:clamp(1.5rem,3vw,2rem);}
  .lp .cta-banner p{color:rgb(var(--muted)); margin:.75rem 0 1.75rem;}

  .lp footer{border-top:1px solid rgb(var(--border)); padding:2.5rem 0; margin-top:2rem;}
  .lp .foot-row{display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; font-size:.85rem; color:rgb(var(--muted));}
  .lp .foot-links{display:flex; gap:1.25rem;}
  .lp .foot-links a{text-decoration:none; color:rgb(var(--muted)); cursor:pointer;}
  .lp .foot-links a:hover{color:rgb(var(--accent-dark));}
  .lp[data-theme="dark"] .foot-links a:hover{color:rgb(var(--accent));}

  .lp .theme-toggle{background:none; border:1px solid rgb(var(--border-strong)); border-radius:6px; width:38px; height:38px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:rgb(var(--text));}
  .lp .theme-toggle:hover{border-color:rgb(var(--accent));}

  .lp .page-heading{display:inline-flex; align-items:center; justify-content:center; gap:.6rem; margin-bottom:1.5rem; cursor:default;}
  .lp .page-heading-icon{font-size:1.8rem; line-height:1;}
  .lp .app-heading{font-family:Fraunces,Georgia,serif; font-weight:600; font-size:1.4rem; transition:color .25s ease, letter-spacing .25s ease;}
  .lp .page-heading:hover .app-heading{color:rgb(var(--accent-dark)); letter-spacing:.01em;}
  .lp[data-theme="dark"] .page-heading:hover .app-heading{color:rgb(var(--accent));}
`;

function AnimatedStat({ target, suffix = "" }) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  const animated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !animated.current) {
            animated.current = true;
            const duration = 1100;
            const start = performance.now();
            function tick(now) {
              const p = Math.min((now - start) / duration, 1);
              const eased = 1 - Math.pow(1 - p, 3); // ease-out
              setValue(Math.round(target * eased));
              if (p < 1) requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target]);

  return (
    <div ref={ref} className="num">
      {value}
      {suffix}
    </div>
  );
}

export default function Landing() {
  const [navOpen, setNavOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [openFaq, setOpenFaq] = useState(null);

  function closeMobileNav() {
    setNavOpen(false);
  }

  return (
    <div className="lp" data-theme={theme}>
      <style>{CSS}</style>
      <style>{MOTION_CSS}</style>

      <header className={`nav${navOpen ? " open" : ""}`}>
        <div className="wrap navbar">
          <div className="brand">
            <Logo compact />
          </div>
          <ul className="navlinks">
            <li><a href="#features">Features</a></li>
            <li><a href="#workflow">Workflow</a></li>
            <li><a href="#roles">Roles</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="#faq">FAQ</a></li>
          </ul>
          <div className="navcta">
            <Link to="/" className="btn btn-ghost home-btn" aria-label="Home" title="Home">
              <HomeIcon size={18} strokeWidth={1.9} />
            </Link>
            <button type="button" className="theme-toggle" aria-label="Toggle theme" onClick={toggleTheme}>
              <span key={theme} className="m-spin">{theme === "dark" ? "☀️" : "🌙"}</span>
            </button>
            <Link to="/restaurant/login" className="btn btn-ghost">Log in</Link>
            <Link to="/restaurant/signup" className="btn btn-primary">Get started →</Link>
            <button type="button" className="menu-toggle" aria-label="Menu" onClick={() => setNavOpen((v) => !v)}>
              ☰
            </button>
          </div>
        </div>
        <div className="wrap mobile-panel">
          <Link to="/" onClick={closeMobileNav}>Home</Link>
          <a href="#features" onClick={closeMobileNav}>Features</a>
          <a href="#workflow" onClick={closeMobileNav}>Workflow</a>
          <a href="#roles" onClick={closeMobileNav}>Roles</a>
          <a href="#pricing" onClick={closeMobileNav}>Pricing</a>
          <a href="#faq" onClick={closeMobileNav}>FAQ</a>
          <Link to="/restaurant/login" onClick={closeMobileNav}>Log in</Link>
          <Link to="/restaurant/signup" onClick={closeMobileNav}>Get started</Link>
        </div>
      </header>

      <section className="hero wrap m-hero">
        <span className="m-blob a" />
        <span className="m-blob b" />
        <div className="page-heading m-in" style={{ "--d": 0 }}>
          <span className="page-heading-icon m-bob">🍽️</span>
          <span className="app-heading">Restro</span>
        </div>
        <div>
          <span className="eyebrow m-in" style={{ "--d": 100 }}>For restaurants, cafés &amp; cloud kitchens</span>
        </div>
        <h1 className="m-in" style={{ "--d": 200 }}>
          Run the whole floor from <span className="hl m-hl">one screen.</span>
        </h1>
        <p className="sub m-in" style={{ "--d": 340 }}>
          Billing, tables, menu, inventory, staff and accounting — one system for your owners, managers and crew to
          keep service moving and see today's numbers instantly.
        </p>
        <div className="hero-ctas m-in" style={{ "--d": 460 }}>
          <Link to="/restaurant/signup" className="btn btn-primary">Start free →</Link>
          <a href="#workflow" className="btn btn-ghost">See how it works</a>
        </div>
        <div className="roles-strip m-in" style={{ "--d": 560 }}>
          <span>Owner</span>·<span>Manager</span>·<span>Cashier</span>·<span>Waiter</span>·<span>Kitchen</span>
        </div>

        <Reveal className="stats" delay={200}>
          <div className="stat"><AnimatedStat target={12} /><div className="lbl">Modules in one place</div></div>
          <div className="stat"><AnimatedStat target={5} /><div className="lbl">Role-based logins</div></div>
          <div className="stat"><AnimatedStat target={100} suffix="%" /><div className="lbl">Auto-posted accounting</div></div>
          <div className="stat"><AnimatedStat target={24} suffix="/7" /><div className="lbl">Live dashboard</div></div>
        </Reveal>
      </section>

      <section id="features">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker">Everything, connected</span>
            <h2>Built for how restaurants actually run</h2>
            <p>Every module talks to the others — a sale updates inventory, accounting, and the dashboard automatically.</p>
          </Reveal>
          <div className="fgrid">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 90}>
                <div className="fcard">
                  <div className="icon">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker">A day in Restro</span>
            <h2>From order to books, in one flow</h2>
          </Reveal>
          <div className="tabs">
            {WORKFLOW.map((w, i) => (
              <button
                key={w.tab}
                type="button"
                className={`tab-btn${activeTab === i ? " active" : ""}`}
                onClick={() => setActiveTab(i)}
              >
                {w.tab}
              </button>
            ))}
          </div>
          <div className="tab-panel m-swap" key={activeTab}>
            <div>
              <h3>{WORKFLOW[activeTab].title}</h3>
              <p>{WORKFLOW[activeTab].body}</p>
              <ul>
                {WORKFLOW[activeTab].points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
            <div className="mock">
              {WORKFLOW[activeTab].mock.map(([k, v]) => (
                <div className="row" key={k}>
                  <span>{k}</span>
                  <span className="hilite">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="roles">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker">Access that fits</span>
            <h2>Everyone sees only what they need</h2>
            <p>Fine-grained permissions, per outlet — set once from System Access.</p>
          </Reveal>
          <div className="roles">
            {ROLES.map((r, i) => (
              <Reveal key={r.name} delay={i * 70}>
                <div className="role-pill">
                  <div className="r-icon">{r.icon}</div>
                  <div className="r-name">{r.name}</div>
                  <div className="r-desc">{r.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <PricingSection appType="restaurant" signupTo="/restaurant/signup" />

      <section id="faq">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker">Questions</span>
            <h2>Frequently asked</h2>
          </Reveal>
          <div className="faq">
            {FAQS.map((f, i) => {
              const isOpen = openFaq === i;
              return (
                <div className={`faq-item${isOpen ? " open" : ""}`} key={f.q}>
                  <button
                    type="button"
                    className="faq-q"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                  >
                    <span>{f.q}</span>
                    <span className="plus">+</span>
                  </button>
                  <div className="faq-a" style={{ maxHeight: isOpen ? "12rem" : "0" }}>
                    <p>{f.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <Reveal>
            <div className="cta-banner">
              <h2>Ready to run service from one screen?</h2>
              <p>Set up your restaurant in a couple of minutes — no credit card needed.</p>
              <Link to="/restaurant/signup" className="btn btn-primary">Create your restaurant →</Link>
            </div>
          </Reveal>
        </div>
      </section>

      <footer>
        <div className="wrap foot-row">
          <span>© {new Date().getFullYear()} Restro. All rights reserved.</span>
          <div className="foot-links">
            <a href="#features">Features</a>
            <a href="#faq">FAQ</a>
            <a href="mailto:hello@restro.app">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}