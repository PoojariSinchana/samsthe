import api from "./adminAxios";

export const getMeta = () => api.get("/leads/meta").then((r) => r.data);
export const getLeads = (params) => api.get("/leads", { params }).then((r) => r.data);
export const createLead = (data) => api.post("/leads", data).then((r) => r.data);
export const updateLead = (id, data) => api.put(`/leads/${id}`, data).then((r) => r.data);
export const deleteLead = (id) => api.delete(`/leads/${id}`).then((r) => r.data);