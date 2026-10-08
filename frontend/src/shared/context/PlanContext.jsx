import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "./AuthContext";
import UpgradeModal from "../components/UpgradeModal";

const PlanContext = createContext(null);

export function PlanProvider({ children }) {
  const { user } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [info, setInfo] = useState(null);
  const [prompt, setPrompt] = useState(null);

  const refresh = useCallback(
  () => api.get("/business/me/usage").then(({ data }) => setInfo(data)).catch(() => {}).finally(() => setLoaded(true)),
  []
);

  useEffect(() => { if (user) refresh(); else { setInfo(null); setLoaded(false); } }, [user, refresh]);

  useEffect(() => {
    const open = (e) => setPrompt(e.detail || {});
    window.addEventListener("plan:locked", open);
    return () => window.removeEventListener("plan:locked", open);
  }, []);

  // modules === null means no restriction
  const isLocked = useCallback((f) => !!f && Array.isArray(info?.modules) && !info.modules.includes(f), [info]);
  const openUpgrade = useCallback((feature, message) => setPrompt({ feature, message }), []);

  return (
    <PlanContext.Provider value={{ info, loaded, isLocked, openUpgrade, refresh }}>
      {children}
      {prompt && <UpgradeModal prompt={prompt} currentPlan={info?.plan} onClose={() => setPrompt(null)} />}
    </PlanContext.Provider>
  );
}

export const usePlan = () => useContext(PlanContext);