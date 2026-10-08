import api from "./axios";

export const getAnalytics = (params) => api.get("/analytics", { params }).then((res) => res.data);