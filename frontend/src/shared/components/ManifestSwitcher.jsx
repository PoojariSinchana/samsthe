import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { setAppManifest } from "../context/InstallContext";

export default function ManifestSwitcher() {
  const { pathname } = useLocation();
  useEffect(() => {
    const app = pathname.startsWith("/retail/") ? "retail"
      : pathname.startsWith("/restaurant/") ? "restaurant" : null;
    setAppManifest(app); // landing/home -> no manifest -> no app install
  }, [pathname]);
  return null;
}