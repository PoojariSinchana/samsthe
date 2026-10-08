import axios from "axios";

// Admin portal talks to /api/admin/* and stores its token under its own key,
// so an admin session never mixes with a customer ("token") session.
export const ADMIN_TOKEN_KEY = "adminToken";

const adminApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/admin` : "/api/admin",
});

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Token expired (12h) or account deactivated: send the admin back to sign-in instead of
// leaving every page stuck on a "not authorized" error. A wrong *current password* also
// returns 401 but with a different message, so it is not treated as an expired session.
adminApi.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.message || "";
    const sessionDead =
      localStorage.getItem(ADMIN_TOKEN_KEY) &&
      ((err.response?.status === 401 && /^Not authorized/.test(msg)) ||
        (err.response?.status === 403 && /deactivated/i.test(msg)));
    if (sessionDead) {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      window.location.assign("/admin/login");
      return new Promise(() => {}); // page is navigating away
    }
    return Promise.reject(err);
  }
);

export default adminApi;