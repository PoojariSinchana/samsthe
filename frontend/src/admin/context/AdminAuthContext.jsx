import { createContext, useContext, useEffect, useState } from "react";
import * as authApi from "../api/adminAuthApi";
import { ADMIN_TOKEN_KEY } from "../api/adminAxios";

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem(ADMIN_TOKEN_KEY)) {
      setLoading(false);
      return;
    }
    authApi
      .getMe()
      .then((data) => setAdmin(data.admin))
      .catch(() => localStorage.removeItem(ADMIN_TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const data = await authApi.login({ email, password });
    localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
    setAdmin(data.admin);
    return data.admin;
  }

  function logout() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setAdmin(null);
  }

  function hasPermission(key) {
    if (!admin) return false;
    return admin.role === "superadmin" || (admin.permissions || []).includes(key);
  }

  return (
    <AdminAuthContext.Provider value={{ admin, loading, login, logout, hasPermission }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}