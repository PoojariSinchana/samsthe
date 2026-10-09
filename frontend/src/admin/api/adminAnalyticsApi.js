import api from "./adminAxios";
export const getAnalytics = (params) => api.get("/analytics", { params }).then((r) => r.data);