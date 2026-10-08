import axios from "axios";

// No more "/restaurant/api" gateway prefix — the frontend is served by the
// same backend now (or proxied to it in dev, see vite.config.js), so
// everything just lives under /api.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const d = err.response?.data;
    if (
      err.response?.status === 402 && d?.code === "PLAN_REQUIRED" &&
      !["/choose-plan", "/restaurant-setup"].includes(window.location.pathname)
    ) {
      window.location.assign("/choose-plan");
      return new Promise(() => {}); // page is navigating away
    }
    if ([403, 402].includes(err.response?.status) && ["FEATURE_LOCKED", "PLAN_LIMIT", "SUBSCRIPTION_LAPSED"].includes(d?.code)) {
      window.dispatchEvent(new CustomEvent("plan:locked", { detail: { feature: d.feature, message: d.message, code: d.code } }));
    }
    return Promise.reject(err);
  }
);

export default api;