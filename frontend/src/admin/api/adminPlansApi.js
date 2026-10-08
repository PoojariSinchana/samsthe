import api from "./adminAxios";

export const getPlans = (params) => api.get("/plans", { params }).then((r) => r.data);
export const createPlan = (data) => api.post("/plans", data).then((r) => r.data);
export const updatePlan = (id, data) => api.put(`/plans/${id}`, data).then((r) => r.data);