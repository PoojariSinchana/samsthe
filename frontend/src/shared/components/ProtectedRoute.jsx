import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePlan } from "../context/PlanContext";

export default function ProtectedRoute({ children }) {
  const { user, business, loading } = useAuth();
  const { info, loaded } = usePlan();
  const { pathname } = useLocation();
  const app = pathname.startsWith("/retail/") ? "retail" : "restaurant";

  if (loading || (user && !loaded)) {
    return <div className="flex h-screen items-center justify-center bg-charcoal text-muted">Loading…</div>;
  }
  if (!user) return <Navigate to={`/${app}/login`} replace />;

  const own = business?.appType || app;
  if (info?.needsPlan && !pathname.endsWith("/plan") && !pathname.endsWith("/setup")) {
    return <Navigate to={`/${own}/plan`} replace />;
  }
  if (own !== app) return <Navigate to={`/${own}/app`} replace />;
  return children;
}