import { useState } from "react";
import { Link } from "react-router-dom";
import { Sun, Moon, Home as HomeIcon } from "lucide-react";
import { useTheme } from "../../../shared/context/ThemeContext";
import Logo from "../../../shared/components/Logo";
import Reveal from "../../../shared/components/Reveal";
import { MOTION_CSS } from "../../../shared/styles/motion";
import PricingSection from "../../../shared/components/PricingSection";

// Marketing/info page for the Retail (Clothing Shop) product — lives at /products/retail.

const FEATURES = [
  { icon: "🧾", title: "Sales / POS", desc: "Barcode/SKU lookup, split payments, printable bills — built for the counter." },
  { icon: "👕", title: "Product Catalog", desc: "Products with unlimited variants — size, color, any attribute — each with its own SKU and price." },
  { icon: "📦", title: "Stock Management", desc: "Per-outlet stock levels, low-stock alerts, and a full movement history." },
  { icon: "🚚", title: "Purchases & Suppliers", desc: "Record purchases on credit or paid, and settle supplier payables over time." },
  { icon: "🧮", title: "Full Accounting", desc: "Every sale and purchase posts a balanced journal entry automatically." },
  { icon: "📊", title: "Analytics", desc: "Revenue trends, top products, top brands, and repeat-customer tracking." },
  { icon: "🏬", title: "Multi-Outlet", desc: "Run several stores under one account, each with its own stock and staff." },
  { icon: "👥", title: "Staff & Access", desc: "Per-outlet, per-person permissions for cashiers, managers, and owners." },
];

const WORKFLOW = [
  {
    tab: "1. Stock it",
    title: "Products & variants",
    body: "Add a product once, then define every size/color combination as its own SKU with its own price and barcode.",
    mock: [["Product", "Classic Tee"], ["Variant", "M / Black"], ["SKU", "TSHIRT-M-BLK"], ["Stock", "24 units"]],
  },
  {
    tab: "2. Sell it",
    title: "Scan, sell, get paid",
    body: "Scan a barcode or search by name at the register. Split payments across cash, card, or UPI.",
    mock: [["Sale", "SALE-0182"], ["Items", "2 SKUs"], ["Total", "₹1,240.00"], ["Status", "PAID ✓"]],
  },
  {
    tab: "3. Track it",
    title: "Stock and books update themselves",
    body: "Stock decrements the moment a sale is made. Purchases post supplier payables automatically — no manual bookkeeping.",
    mock: [["Stock change", "-1 unit"], ["Journal entry", "auto-posted"], ["Payable", "tracked"], ["Balanced", "✓"]],
  },
];

const inputCss = `
  .rl{
    --bg:255 255 255; --surface:255 255 255; --border:224 229 240; --border-strong:198 208 226;
    --text:17 24 39; --muted:100 112 134;
    --accent:37 99 235; --accent-dark:29 78 216; --sage:37 99 235;
    background:rgb(var(--bg)); color:rgb(var(--text)); font-family:Manrope,system-ui,sans-serif; -webkit-font-smoothing:antialiased;
    min-height:100vh; transition:background-color .2s ease, color .2s ease;
  }
  .rl.dark{
    --bg:15 18 26; --surface:22 26 37; --border:41 47 63; --border-strong:60 68 88;
    --text:237 240 246; --muted:148 158 178;
    --accent:59 130 246; --accent-dark:96 165 250; --sage:96 165 250;
  }
  .rl *{box-sizing:border-box;}
  .rl a{color:inherit;}
  .rl h1,.rl h2,.rl h3{font-family:Fraunces,Georgia,serif; font-weight:600; margin:0;}
  .rl .wrap{max-width:1100px; margin:0 auto; padding:0 1.5rem;}

  .rl header.nav{position:sticky; top:0; z-index:50; backdrop-filter:blur(10px); background:rgb(var(--bg) / 0.85); border-bottom:1px solid rgb(var(--border));}
  .rl .navbar{display:flex; align-items:center; justify-content:space-between; padding:1rem 0;}
  .rl .brand{display:flex; align-items:center; gap:.5rem; font-family:Fraunces,Georgia,serif; font-weight:600; font-size:1.15rem;}
  .rl .brand-mark{width:30px; height:30px; border-radius:8px; background:rgb(var(--accent)); display:flex; align-items:center; justify-content:center; font-size:15px;}
  .rl .navcta{display:flex; align-items:center; gap:.75rem; flex-wrap:wrap; justify-content:flex-end;}
  @media (max-width:480px){
    .rl .navcta{gap:.5rem;}
    .rl .navcta .btn{padding:.55rem .8rem; font-size:.82rem;}
  }
  .rl .btn{display:inline-flex; align-items:center; gap:.4rem; border-radius:6px; padding:.6rem 1.1rem; font-weight:700; font-size:.88rem; text-decoration:none; cursor:pointer; border:1px solid transparent;}
  .rl .btn-primary{background:rgb(var(--accent)); color:#fff;}
  .rl .btn-primary:hover{background:rgb(var(--accent-dark));}
  .rl .btn-ghost{border-color:rgb(var(--border-strong)); color:rgb(var(--text));}
  .rl .btn-ghost:hover{border-color:rgb(var(--accent));}
  .rl .theme-toggle{display:flex; align-items:center; justify-content:center; width:38px; height:38px; border-radius:6px; border:1px solid rgb(var(--border-strong)); background:transparent; color:rgb(var(--text)); cursor:pointer;}
  .rl .theme-toggle:hover{border-color:rgb(var(--accent));}
  .rl .home-btn{display:inline-flex; align-items:center; justify-content:center; width:38px; height:38px; padding:0;}
  .rl .page-heading{display:flex; align-items:center; justify-content:center; gap:.6rem; margin-bottom:1.5rem;}
  .rl .page-heading-icon{font-size:1.6rem; line-height:1;}
  .rl .app-heading{font-family:Fraunces,Georgia,serif; font-weight:600; font-size:1.3rem;}

  .rl .hero{padding:5rem 0 3rem; text-align:center;}
  .rl .eyebrow{display:inline-block; font-size:.78rem; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:rgb(var(--accent-dark)); background:rgb(var(--accent) / .12); padding:.35rem .8rem; border-radius:99px; margin-bottom:1.25rem;}
  .rl .hero h1{font-size:clamp(2.2rem, 5.5vw, 3.4rem); line-height:1.08; max-width:16ch; margin:0 auto;}
  .rl .hero h1 .hl{color:rgb(var(--accent-dark));}
  .rl .hero p.sub{max-width:46ch; margin:1.25rem auto 0; color:rgb(var(--muted)); font-size:1.05rem; line-height:1.6;}
  .rl .hero-ctas{display:flex; gap:.85rem; justify-content:center; margin-top:2rem; flex-wrap:wrap;}

  .rl section{padding:4rem 0;}
  .rl .section-head{text-align:center; max-width:38ch; margin:0 auto 2.5rem;}
  .rl .section-head .kicker{font-size:.78rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:rgb(var(--accent-dark)); margin-bottom:.6rem; display:block;}
  .rl .section-head h2{font-size:clamp(1.6rem,3.2vw,2.1rem);}

  .rl .fgrid{display:grid; grid-template-columns:repeat(4,1fr); gap:1rem;}
  @media (max-width:820px){ .rl .fgrid{grid-template-columns:repeat(2,1fr);} }
  @media (max-width:560px){ .rl .fgrid{grid-template-columns:1fr;} }
  .rl .fcard{padding:1.4rem 1.2rem; border:1px solid rgb(var(--border)); border-radius:10px; background:rgb(var(--surface)); transition:border-color .15s, transform .15s, box-shadow .2s;}
  .rl .fcard:hover{border-color:rgb(var(--accent) / .55); transform:translateY(-3px); box-shadow:0 12px 28px -14px rgb(var(--accent) / .45);}
  .rl .fcard .icon{font-size:1.4rem; margin-bottom:.6rem; display:inline-block;}
  .rl .fcard h3{font-size:.95rem; margin-bottom:.3rem;}
  .rl .fcard p{font-size:.83rem; color:rgb(var(--muted)); line-height:1.45; margin:0;}

  .rl .tabs{display:flex; gap:.5rem; flex-wrap:wrap; justify-content:center; margin-bottom:2rem;}
  .rl .tab-btn{border:1px solid rgb(var(--border-strong)); background:transparent; color:rgb(var(--muted)); padding:.55rem 1rem; border-radius:99px; font-size:.85rem; font-weight:600; cursor:pointer; transition:background-color .2s, color .2s, border-color .2s;}
  .rl .tab-btn:hover{border-color:rgb(var(--accent));}
  .rl .tab-btn.active{background:rgb(var(--accent)); border-color:rgb(var(--accent)); color:#fff;}
  .rl .tab-panel{border:1px solid rgb(var(--border)); border-radius:12px; padding:2rem; background:rgb(var(--surface)); display:grid; grid-template-columns:1fr 1fr; gap:2rem; align-items:center;}
  @media (max-width:700px){ .rl .tab-panel{grid-template-columns:1fr;} }
  .rl .mock{border:1px solid rgb(var(--border)); border-radius:10px; background:rgb(var(--bg)); padding:1.1rem; font-family:monospace; font-size:.8rem; line-height:1.7; color:rgb(var(--muted));}
  .rl .mock .row{display:flex; justify-content:space-between;}
  .rl .mock .hilite{color:rgb(var(--sage));}

  .rl .cta-banner{border:1px solid rgb(var(--border)); border-radius:14px; padding:3rem 2rem; text-align:center; background:linear-gradient(180deg, rgb(var(--accent) / .10), transparent);}
  .rl footer{border-top:1px solid rgb(var(--border)); padding:2.5rem 0;}
  .rl .foot-row{display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; font-size:.85rem; color:rgb(var(--muted));}
`;

export default function RetailLanding() {
  const [activeTab, setActiveTab] = useState(0);
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className={`rl ${isDark ? "dark" : ""}`}>
      <style>{inputCss}</style>
      <style>{MOTION_CSS}</style>

      <header className="nav">
        <div className="wrap navbar">
          <div className="brand">
            <Logo compact />
          </div>
          <div className="navcta">
            <Link to="/" className="btn btn-ghost home-btn" aria-label="Home" title="Home">
              <HomeIcon size={18} strokeWidth={1.9} />
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              className="theme-toggle"
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              <span key={theme} className="m-spin">
                {isDark ? <Sun size={17} strokeWidth={1.75} /> : <Moon size={17} strokeWidth={1.75} />}
              </span>
            </button>
            <Link to="/retail/login" className="btn btn-ghost">Log in</Link>
            <Link to="/retail/signup" className="btn btn-primary">Start free →</Link>
          </div>
        </div>
      </header>

      <section className="hero m-hero">
        <span className="m-blob a" />
        <span className="m-blob b" />
        <div className="wrap">
          <div className="page-heading m-in" style={{ "--d": 0 }}>
            <span className="page-heading-icon m-bob">👕</span>
            <span className="app-heading">Retail Shop</span>
          </div>
          <span className="eyebrow m-in" style={{ "--d": 100 }}>For clothing & retail businesses</span>
          <h1 className="m-in" style={{ "--d": 200 }}>
            Run your shop from <span className="hl m-hl">counter to ledger.</span>
          </h1>
          <p className="sub m-in" style={{ "--d": 340 }}>
            Catalog, POS, stock, purchases and accounting for retail — built for stores with real
            variants (size, color) and real multi-outlet operations.
          </p>
          <div className="hero-ctas m-in" style={{ "--d": 460 }}>
            <Link to="/retail/signup" className="btn btn-primary">Start free →</Link>
            <a href="#workflow" className="btn btn-ghost">See how it works</a>
          </div>
        </div>
      </section>

      <section id="features">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker">Everything included</span>
            <h2>Built for how retail actually runs</h2>
          </Reveal>
          <div className="fgrid">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 4) * 80}>
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
            <span className="kicker">A sale, start to finish</span>
            <h2>From shelf to books, in one flow</h2>
          </Reveal>
          <div className="tabs">
            {WORKFLOW.map((w, i) => (
              <button key={w.tab} type="button" className={`tab-btn${activeTab === i ? " active" : ""}`} onClick={() => setActiveTab(i)}>
                {w.tab}
              </button>
            ))}
          </div>
          <div className="tab-panel m-swap" key={activeTab}>
            <div>
              <h3>{WORKFLOW[activeTab].title}</h3>
              <p style={{ color: "rgb(var(--muted))", lineHeight: 1.6, fontSize: ".95rem" }}>{WORKFLOW[activeTab].body}</p>
            </div>
            <div className="mock">
              {WORKFLOW[activeTab].mock.map(([k, v]) => (
                <div className="row" key={k}><span>{k}</span><span className="hilite">{v}</span></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <PricingSection appType="retail" signupTo="/retail/signup" />

      <section>
        <div className="wrap">
          <Reveal>
            <div className="cta-banner">
              <h2 style={{ fontSize: "clamp(1.5rem,3vw,2rem)" }}>Ready to run your shop from one screen?</h2>
              <p style={{ color: "rgb(var(--muted))", margin: ".75rem 0 1.75rem" }}>No credit card needed to get started.</p>
              <Link to="/retail/signup" className="btn btn-primary">Create your shop →</Link>
            </div>
          </Reveal>
        </div>
      </section>

      <footer>
        <div className="wrap foot-row">
          <span>© {new Date().getFullYear()} Samsthe. All rights reserved.</span>
          <Link to="/">← All products</Link>
        </div>
      </footer>
    </div>
  );
}