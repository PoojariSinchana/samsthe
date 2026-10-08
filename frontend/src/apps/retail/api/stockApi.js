import api from "../../../shared/api/axios";

export const getStock = (params) => api.get("/stock", { params }).then((r) => r.data);
export const adjustStock = (payload) => api.post("/stock/stock-adjust", payload).then((r) => r.data);
export const getMovements = (params) => api.get("/stock/history", { params }).then((r) => r.data);
export const getOverview = (params) => api.get("/stock/overview", { params }).then((r) => r.data);
export const setMinStock = (payload) => api.put("/stock/min-stock", payload).then((r) => r.data);
export const stockOut = (payload) => api.post("/stock/stock-out", payload).then((r) => r.data);