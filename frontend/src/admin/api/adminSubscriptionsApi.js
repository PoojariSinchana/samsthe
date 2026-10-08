import api from "./adminAxios";

export const getMeta = () => api.get("/subscriptions/meta").then((r) => r.data);
export const getSubscriptions = (params) => api.get("/subscriptions", { params }).then((r) => r.data);
export const updateStatus = (id, data) => api.put(`/subscriptions/${id}/status`, data).then((r) => r.data);
export const extend = (id, days) => api.post(`/subscriptions/${id}/extend`, { days }).then((r) => r.data);
export const renewalInvoice = (id) => api.post(`/subscriptions/${id}/renewal-invoice`).then((r) => r.data);
export const generateRenewals = (days) => api.post("/subscriptions/generate-renewals", { days }).then((r) => r.data);