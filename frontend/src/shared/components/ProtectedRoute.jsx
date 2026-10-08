import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePlan } from "../context/PlanContext";

export default function ProtectedRoute({ children }) {
  const { user, business, loading } = useAuth();
  const { info, loaded } = usePlan();
  const { pathname } = useLocation();

  if (loading || (user && !loaded)) {
    return <div className="flex h-screen items-center justify-center bg-charcoal text-muted">Loading…</div>;
  }
  if (!user) {
    return <Navigate to={pathname.startsWith("/app/retail") ? "/retail/login" : "/restaurant/login"} replace />;
  }
  // No plan chosen yet (or invoice unpaid): the only page allowed is plan selection.
  if (info?.needsPlan && pathname !== "/choose-plan" && pathname !== "/restaurant-setup") {
  return <Navigate to="/choose-plan" replace />;
}
  const wanted = pathname.startsWith("/app/retail") ? "retail" : pathname.startsWith("/app/restaurant") ? "restaurant" : null;
  if (wanted && business?.appType && business.appType !== wanted) {
    return <Navigate to={`/app/${business.appType}`} replace />;
  }
  return children;
}