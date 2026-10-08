import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../shared/context/ThemeContext";
import Logo from "../shared/components/Logo";
import Reveal from "../shared/components/Reveal";
import { MOTION_CSS } from "../shared/styles/motion";

const CSS = `
  .home{
    --bg:255 255 255; --surface:255 255 255; --border:224 229 240; --border-strong:198 208 226;
    --text:17 24 39; --muted:100 112 134;
    --accent:37 99 235; --accent-dark:29 78 216;
    background:rgb(var(--bg)); color:rgb(var(--text)); font-family:Manrope,system-ui,sans-serif; -webkit-font-smoothing:antialiased;
    min-height:100vh; transition:background-color .2s ease, color .2s ease;
  }
  .home.dark{
    --bg:15 18 26; --surface:22 26 37; --border:41 47 63; --border-strong:60 68 88;
    --text:237 240 246; --muted:148 158 178;
    --accent:59 130 246; --accent-dark:96 165 250;
  }
  .home *{box-sizing:border-box;}
  .home a{color:inherit;}
  .home h1,.home h2,.home h3{font-family:Fraunces,Georgia,serif; font-weight:600; margin:0;}
  .home .wrap{max-width:1100px; margin:0 auto; padding:0 1.5rem;}

  .home header.nav{position:sticky; top:0; z-index:50; backdrop-filter:blur(10px); background:rgb(var(--bg) / 0.85); border-bottom:1px solid rgb(var(--border));}
  .home .navbar{display:flex; align-items:center; justify-content:space-between; padding:1rem 0;}
  .home .brand{display:flex; align-items:center; gap:.5rem; font-family:Fraunces,Georgia,serif; font-weight:600; font-size:1.15rem;}
  .home .brand-mark{width:30px; height:30px; border-radius:8px; background:rgb(var(--accent)); display:flex; align-items:center; justify-content:center; font-size:15px;}
  .home .navlinks{display:flex; gap:2rem; list-style:none; margin:0; padding:0;}
  .home .navlinks a{font-size:.9rem; font-weight:600; color:rgb(var(--muted)); text-decoration:none;}
  .home .navlinks a:hover{color:rgb(var(--accent-dark));}
  .home .navcta{display:flex; align-items:center; gap:.75rem;}
  .home .btn{display:inline-flex; align-items:center; gap:.4rem; border-radius:6px; padding:.6rem 1.1rem; font-weight:700; font-size:.88rem; text-decoration:none; cursor:pointer; border:1px solid transparent;}
  .home .btn-primary{background:rgb(var(--accent)); color:#fff;}
  .home .btn-primary:hover{background:rgb(var(--accent-dark));}
  .home .btn-ghost{border-color:rgb(var(--border-strong)); color:rgb(var(--text));}
  .home .btn-ghost:hover{border-color:rgb(var(--accent));}
  .home .theme-toggle{display:flex; align-items:center; justify-content:center; width:38px; height:38px; border-radius:6px; border:1px solid rgb(var(--border-strong)); background:transparent; color:rgb(var(--text)); cursor:pointer;}
  .home .theme-toggle:hover{border-color:rgb(var(--accent));}
  .home .menu-toggle{display:none; background:none; border:1px solid rgb(var(--border-strong)); border-radius:6px; padding:.5rem .7rem; color:rgb(var(--text)); cursor:pointer;}
  .home .mobile-panel{display:none; flex-direction:column; gap:.25rem; padding:.75rem 0 1rem;}
  .home .mobile-panel a{padding:.6rem 0; font-weight:600; color:rgb(var(--text)); text-decoration:none; border-bottom:1px solid rgb(var(--border));}
  @media (max-width:820px){
    .home .navlinks{display:none;}
    .home .menu-toggle{display:inline-flex;}
    .home header.nav.open .mobile-panel{display:flex;}
  }
  @media (max-width:480px){
    .home .navcta{gap:.5rem;}
    .home .navcta .btn{padding:.55rem .8rem; font-size:.82rem;}
  }

  .home .hero{padding:5rem 0 4rem; text-align:center;}
  .home .eyebrow{display:inline-block; font-size:.78rem; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:rgb(var(--accent-dark)); background:rgb(var(--accent) / .12); padding:.35rem .8rem; border-radius:99px; margin-bottom:1.25rem;}
  .home .hero h1{font-size:clamp(2.2rem, 5.5vw, 3.4rem); line-height:1.08; max-width:18ch; margin:0 auto;}
  .home .hero h1 .hl{color:rgb(var(--accent-dark));}
  .home .hero p.sub{max-width:48ch; margin:1.25rem auto 0; color:rgb(var(--muted)); font-size:1.05rem; line-height:1.6;}
  .home .hero-ctas{display:flex; gap:.85rem; justify-content:center; margin-top:2rem; flex-wrap:wrap;}

  .home section{padding:4rem 0;}
  .home .section-head{text-align:center; max-width:40ch; margin:0 auto 2.5rem;}
  .home .section-head .kicker{font-size:.78rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:rgb(var(--accent-dark)); margin-bottom:.6rem; display:block;}
  .home .section-head h2{font-size:clamp(1.6rem,3.2vw,2.1rem);}
  .home .section-head p{color:rgb(var(--muted)); margin-top:.75rem; font-size:.98rem;}

  .home .pgrid{display:grid; grid-template-columns:repeat(3,1fr); gap:1.25rem;}
  @media (max-width:900px){ .home .pgrid{grid-template-columns:repeat(2,1fr);} }
  @media (max-width:560px){ .home .pgrid{grid-template-columns:1fr;} }
  .home .pcard{position:relative; padding:1.75rem 1.5rem; border:1px solid rgb(var(--border)); border-radius:12px; background:rgb(var(--surface)); text-decoration:none; transition:border-color .15s, transform .15s, box-shadow .2s;}
  .home .pcard:hover{border-color:rgb(var(--accent) / .55); transform:translateY(-3px); box-shadow:0 12px 28px -14px rgb(var(--accent) / .45);}
  .home .pcard .icon{font-size:2rem; display:inline-block;}
  .home .pcard h3{font-size:1.1rem; margin-top:.75rem;}
  .home .pcard p{font-size:.9rem; color:rgb(var(--muted)); line-height:1.5; margin:.5rem 0 0;}
  .home .pcard .tags{display:flex; flex-wrap:wrap; gap:.4rem; margin-top:.9rem;}
  .home .pcard .tag{font-size:.72rem; background:rgb(var(--accent) / .08); color:rgb(var(--accent-dark)); padding:.2rem .55rem; border-radius:99px;}
  .home .pcard .status{position:absolute; top:1.25rem; right:1.25rem; font-size:.72rem; font-weight:700; padding:.2rem .6rem; border-radius:99px;}
  .home .status.live{background:#dcfce7; color:#15803d;}
  .home .status.soon{background:#f1f5f9; color:#64748b;}
  .home.dark .status.live{background:#0f3d24; color:#4ade80;}
  .home.dark .status.soon{background:#1e2635; color:#94a3b8;}

  .home .whygrid{display:grid; grid-template-columns:repeat(4,1fr); gap:1rem; text-align:center;}
  @media (max-width:820px){ .home .whygrid{grid-template-columns:repeat(2,1fr);} }
  @media (max-width:420px){ .home .whygrid{grid-template-columns:1fr;} }
  .home .why-item{padding:1.25rem;}
  .home .why-item .w-icon{font-size:1.5rem; margin-bottom:.5rem; display:inline-block; transition:transform .25s cubic-bezier(.2,.7,.2,1);}
  .home .why-item:hover .w-icon{transform:translateY(-4px) scale(1.15);}
  .home .why-item h4{font-size:.95rem; margin:0 0 .3rem;}
  .home .why-item p{font-size:.82rem; color:rgb(var(--muted)); margin:0;}

  .home footer{border-top:1px solid rgb(var(--border)); padding:2.5rem 0;}
  .home .foot-row{display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; font-size:.85rem; color:rgb(var(--muted));}
  .home .foot-links{display:flex; gap:1.25rem;}
  .home .foot-links a{text-decoration:none;}
  .home .foot-links a:hover{color:rgb(var(--accent-dark));}
`;

const WHY = [
  { icon: "🧩", title: "One platform", desc: "One login, one company profile — every app plugs into the same account." },
  { icon: "☁️", title: "Cloud based", desc: "Access your business from any device, anywhere, always up to date." },
  { icon: "🏬", title: "Multi-outlet", desc: "Run several branches or stores under a single business account." },
  { icon: "📊", title: "Built-in reporting", desc: "Accounting, analytics and dashboards ship with every app, not bolted on." },
];

export default function Home() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [navOpen, setNavOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    fetch("/api/apps")
      .then((res) => res.json())
      .then((data) => setApps(data.apps || []))
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={`home ${isDark ? "dark" : ""}`}>
      <style>{CSS}</style>
      <style>{MOTION_CSS}</style>

      <header className={`nav${navOpen ? " open" : ""}`}>
        <div className="wrap navbar">
          <Link to="/" className="brand" style={{ textDecoration: "none" }}>
            <Logo compact />
          </Link>
          <ul className="navlinks">
            <li><a href="#products">Products</a></li>
            <li><a href="#why">Why us</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
          <div className="navcta">
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
            <button
              type="button"
              className="menu-toggle"
              aria-label="Menu"
              aria-expanded={navOpen}
              onClick={() => setNavOpen((v) => !v)}
            >
              ☰
            </button>
          </div>
        </div>
        <div className="wrap mobile-panel">
          <a href="#products" onClick={() => setNavOpen(false)}>Products</a>
          <a href="#why" onClick={() => setNavOpen(false)}>Why us</a>
          <a href="#contact" onClick={() => setNavOpen(false)}>Contact</a>
        </div>
      </header>

      <section className="hero m-hero">
        <span className="m-blob a" />
        <span className="m-blob b" />
        <div className="wrap">
          <span className="eyebrow m-in" style={{ "--d": 0 }}>Software for growing businesses</span>
          <h1 className="m-in" style={{ "--d": 120 }}>
            Run your <span className="hl m-hl">whole business</span>, one login at a time
          </h1>
          <p className="sub m-in" style={{ "--d": 260 }}>
            Restaurant, retail, and finance management — separate apps, one account. Pick what your
            business needs today and add more as you grow.
          </p>
        </div>
      </section>

      <section id="products">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker">Our products</span>
            <h2>Pick the app your business needs</h2>
            <p>Each one is a full, focused application — click through for details and pricing.</p>
          </Reveal>

          {loading ? (
            <p style={{ textAlign: "center", color: "rgb(100 112 134)" }}>Loading…</p>
          ) : (
            <div className="pgrid">
              {apps.map((app, i) => (
                <Reveal key={app.slug} delay={(i % 3) * 90}>
                  <Link to={app.frontendPath} className="pcard">
                    <span className={`status ${app.status === "live" ? "live m-pulse" : "soon"}`}>
                      {app.status === "live" ? "Live" : "Coming soon"}
                    </span>
                    <div className="icon">{app.icon}</div>
                    <h3>{app.name}</h3>
                    <p>{app.description}</p>
                    <div className="tags">
                      {(app.tags || []).map((t) => (
                        <span key={t} className="tag">{t}</span>
                      ))}
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="why">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker">Why Samsthe</span>
            <h2>Built as one platform, not three separate tools</h2>
          </Reveal>
          <div className="whygrid">
            {WHY.map((w, i) => (
              <Reveal key={w.title} delay={i * 90}>
                <div className="why-item">
                  <div className="w-icon">{w.icon}</div>
                  <h4>{w.title}</h4>
                  <p>{w.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <footer id="contact">
        <div className="wrap foot-row">
          <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
            <Logo compact />
            <span>© {new Date().getFullYear()} Samsthe. All rights reserved.</span>
          </div>
          <div className="foot-links">
            <a href="#products">Products</a>
            <a href="mailto:hello@samsthe.app">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}