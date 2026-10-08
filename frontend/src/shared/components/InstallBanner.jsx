import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useInstall, setAppManifest } from "../context/InstallContext";

const DISMISS_DAYS = 7;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export default function InstallBanner({ appType, appName }) {
  const { ready, installed, promptInstall } = useInstall();
  const key = `install-dismissed-${appType}`;
  const [hidden, setHidden] = useState(() => {
    const t = Number(localStorage.getItem(key));
    return t && Date.now() - t < DISMISS_DAYS * 864e5;
  });

  useEffect(() => { setAppManifest(appType); }, [appType]);

  if (installed || hidden) return null;

  const canPrompt = ready === appType;
  if (!canPrompt && !isIos()) return null; // nothing useful to show

  function dismiss() {
    localStorage.setItem(key, String(Date.now()));
    setHidden(true);
  }

  return (
    <div className="receipt-card relative mb-6 flex items-center gap-3 rounded-sm px-4 py-3">
      <Download size={20} className="shrink-0 text-saffron" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="text-cream">Install {appName} on this device</p>
        <p className="text-xs text-muted">
          {canPrompt
            ? "Open it from your home screen every day, like a normal app."
            : "Tap the Share button in Safari, then “Add to Home Screen”."}
        </p>
      </div>
      {canPrompt && (
        <button onClick={promptInstall}
          className="shrink-0 rounded-sm bg-saffron px-3 py-1.5 text-sm font-medium text-charcoal hover:bg-saffron-dark">
          Install
        </button>
      )}
      <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 text-muted hover:text-cream">
        <X size={16} />
      </button>
    </div>
  );
}