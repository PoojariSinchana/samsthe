import api from "./adminAxios";

export const getMeta = () => api.get("/clients/meta").then((r) => r.data);
export const getClients = (params) => api.get("/clients", { params }).then((r) => r.data);
export const getClient = (id) => api.get(`/clients/${id}`).then((r) => r.data);
export const saveSubscription = (id, data) => api.put(`/clients/${id}/subscription`, data).then((r) => r.data);