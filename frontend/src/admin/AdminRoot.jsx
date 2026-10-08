import { Outlet } from "react-router-dom";
import { AdminAuthProvider } from "./context/AdminAuthContext";

// Mounted at /admin in App.jsx. Scopes the admin auth provider to admin
// routes only, so it never interferes with the customer AuthProvider.
export default function AdminRoot() {
  return (
    <AdminAuthProvider>
      <Outlet />
    </AdminAuthProvider>
  );
}