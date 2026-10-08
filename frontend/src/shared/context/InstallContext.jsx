import { createContext, useContext, useEffect, useRef, useState } from "react";

const InstallContext = createContext(null);

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

// Points the page at the right manifest so the browser offers to install THAT app.
// Pass null/undefined to remove it (no install offered on that page).
export function setAppManifest(appType) {
  let link = document.querySelector('link[rel="manifest"]');
  if (!appType) { link?.remove(); return; }
  if (link?.dataset.app === appType) return;
  if (!link) {
    link = document.createElement("link");
    link.rel = "manifest";
    document.head.appendChild(link);
  }
  link.href = `/manifest-${appType}.webmanifest`;
  link.dataset.app = appType;

  const touch = document.querySelector('link[rel="apple-touch-icon"]');
  if (touch) touch.href = `/icons/${appType}-192.png`;
}

export function InstallProvider({ children }) {
  const deferred = useRef(null);            // { event, appType }
  const [ready, setReady] = useState(null); // appType the captured prompt belongs to
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    function onPrompt(e) {
      e.preventDefault(); // keep it so we can trigger it after login
      const appType = document.querySelector('link[rel="manifest"]')?.dataset.app || null;
      deferred.current = { event: e, appType };
      setReady(appType);
    }
    function onInstalled() {
      deferred.current = null;
      setReady(null);
      setInstalled(true);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function promptInstall() {
    if (!deferred.current) return false;
    const { event } = deferred.current;
    event.prompt(); // must run from a user tap
    const { outcome } = await event.userChoice;
    deferred.current = null;
    setReady(null);
    return outcome === "accepted";
  }

  return (
    <InstallContext.Provider value={{ ready, installed, promptInstall }}>
      {children}
    </InstallContext.Provider>
  );
}

export const useInstall = () => useContext(InstallContext);