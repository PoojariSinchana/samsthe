import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { setAppManifest } from "../context/InstallContext";

export default function ManifestSwitcher() {
  const { pathname } = useLocation();
  const { business } = useAuth();

  useEffect(() => {
    let app = null;
    if (pathname === "/choose-plan" || pathname === "/restaurant-setup") app = business?.appType || null;
    else if (/^\/(app\/)?retail(\/|$)/.test(pathname)) app = "retail";
    else if (/^\/(app\/)?restaurant(\/|$)/.test(pathname)) app = "restaurant";
    setAppManifest(app);
  }, [pathname, business?.appType]);

  return null;
}