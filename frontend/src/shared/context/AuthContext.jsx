import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("token")) { setLoading(false); return; }
    api.get("/auth/me")
      .then(({ data }) => { setUser(data.user); setBusiness(data.business); })
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  function loginSuccess({ token, user: nextUser, business: nextBusiness }) {
    localStorage.setItem("token", token);
    setUser(nextUser);
    if (nextBusiness) setBusiness(nextBusiness);
  }

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
    setBusiness(null);
  }

  const updateBusinessInfo = (partial) => setBusiness((prev) => ({ ...prev, ...partial }));

  return (
    <AuthContext.Provider value={{
      user, business, restaurant: business, loading, loginSuccess, logout,
      updateBusinessInfo, updateRestaurantInfo: updateBusinessInfo,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}