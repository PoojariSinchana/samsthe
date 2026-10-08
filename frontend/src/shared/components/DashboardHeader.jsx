import { useEffect, useState } from "react";
import { Clock, Download, Menu, Moon, Share, Sun, X } from "lucide-react";
import Logo from "./Logo";
import NotificationBell from "./NotificationBell";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { usePlan } from "../context/PlanContext";
import { useInstall, setAppManifest } from "../context/InstallContext";

const DAY = 864e5;
const TONE = {
  ok: "bg-sage/10 text-sage",
  warn: "bg-gold/15 text-gold",
  danger: "bg-brick/10 text-brick",
};
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

// Re-renders once a minute, on the minute (and when the tab becomes visible again).
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let t;
    const schedule = () => {
      t = setTimeout(() => { setNow(new Date()); schedule(); }, 60000 - (Date.now() % 60000) + 50);
    };
    const onVis = () => document.visibilityState === "visible" && setNow(new Date());
    schedule();
    document.addEventListener("visibilitychange", onVis);
    return () => { clearTimeout(t); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  return now;
}

function planState(plan, now) {
  if (!plan?.endsAt) return null;
  const ms = new Date(plan.endsAt).getTime() - now.getTime();
  if (ms <= 0) return { label: "Expired", tone: "danger" };
  const days = Math.ceil(ms / DAY);
  return {
    label: days === 1 ? "1 day left" : `${days} days left`,
    tone: days <= 3 ? "danger" : days <= 7 ? "warn" : "ok",
  };
}

function PlanChip({ plan, now, className = "" }) {
  const { user } = useAuth();
  const { openUpgrade } = usePlan();
  const s = planState(plan, now);
  if (!s) return null;

  const owner = user?.role === "owner";
  const Tag = owner ? "button" : "span";
  const props = owner
    ? { type: "button", title: "View plans", onClick: () => window.dispatchEvent(new CustomEvent("nav:section", { detail: "subscription" })), }
    : {};

  return (
    <Tag {...props} className={`items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs ${TONE[s.tone]} ${owner ? "hover:opacity-80" : ""} ${className || "inline-flex"}`}>
      <Clock size={13} className="shrink-0" />
      <span className="hidden md:inline">{plan.name} ·</span>
      <span className="font-medium">{s.label}</span>
    </Tag>
  );
}

function InstallButton({ appType, appName }) {
  const { ready, installed, promptInstall } = useInstall();
  const [tip, setTip] = useState(false);
  useEffect(() => { setAppManifest(appType); }, [appType]);

  if (installed) return null;
  const canPrompt = ready === appType;
  if (!canPrompt && !isIos()) return null; // browser isn't offering install

  return (
    <div className="relative">
      <button type="button" onClick={canPrompt ? promptInstall : () => setTip((v) => !v)}
        title={`Install ${appName}`} aria-label={`Install ${appName}`}
        className="flex h-9 items-center justify-center gap-2 rounded-sm bg-saffron px-2.5 text-sm font-medium text-charcoal hover:bg-saffron-dark sm:px-3">
        <Download size={16} strokeWidth={2} />
        <span className="hidden lg:inline">Install app</span>
      </button>
      {tip && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-sm border border-charcoal-lighter bg-charcoal-light p-3 text-xs text-muted shadow-xl">
          <button type="button" onClick={() => setTip(false)} aria-label="Close" className="absolute right-2 top-2 hover:text-cream"><X size={14} /></button>
          <p className="pr-5 text-cream">Install {appName}</p>
          <p className="mt-1">Tap <Share size={12} className="inline align-text-bottom" /> Share in Safari, then choose “Add to Home Screen”.</p>
        </div>
      )}
    </div>
  );
}

export default function DashboardHeader({ appType, appName, onMenu, onNavigate }) {
  const { theme, toggleTheme } = useTheme();
  const { info } = usePlan();
  const now = useNow();
  const plan = info?.plan;
  const dark = theme === "dark";

  const time = now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
  const date = now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const dateShort = now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  return (
    <header className="sticky top-0 z-40 border-b border-charcoal-lighter bg-charcoal-light" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex h-14 items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-4 lg:px-6">
        {/* Menu button: only below md, where the sidebar is a drawer */}
        <button type="button" onClick={onMenu} aria-label="Open menu"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-charcoal-lighter text-cream transition-transform active:scale-95 md:hidden">
          <Menu size={18} />
        </button>

        <Logo className="shrink-0" imgClassName="h-9 w-auto sm:h-10" />

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {/* Clock: time from sm, date from lg. On phones it moves to the row below. */}
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-sm font-medium tabular-nums text-cream">{time}</p>
            <p className="hidden text-xs text-muted lg:block">{date}</p>
          </div>

          <PlanChip plan={plan} now={now} className="hidden sm:inline-flex" />
          <InstallButton appType={appType} appName={appName} />

          <button type="button" onClick={toggleTheme}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-charcoal-lighter text-muted hover:border-saffron hover:text-cream">
            {dark ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
          </button>

          {/* Bell is last so its dropdown never runs off the right edge */}
          <NotificationBell onNavigate={onNavigate} align="right" />
        </div>
      </div>

      {/* Phones only */}
      <div className="flex items-center justify-between gap-2 border-t border-charcoal-lighter px-3 py-1.5 text-xs text-muted sm:hidden">
        <span className="tabular-nums">{dateShort} · {time}</span>
        <PlanChip plan={plan} now={now} />
      </div>
    </header>
  );
}