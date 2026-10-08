import { Navigate } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";

export default function AdminProtectedRoute({ children }) {
  const { admin, loading } = useAdminAuth();

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-charcoal text-muted">Loading…</div>;
  }
  if (!admin) return <Navigate to="/admin/login" replace />;
  return children;
}