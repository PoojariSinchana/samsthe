import api from "./adminAxios";

export const getMeta = () => api.get("/invoices/meta").then((r) => r.data);
export const getInvoices = (params) => api.get("/invoices", { params }).then((r) => r.data);
export const getInvoice = (id) => api.get(`/invoices/${id}`).then((r) => r.data);
export const createInvoice = (data) => api.post("/invoices", data).then((r) => r.data);
export const updateInvoice = (id, data) => api.put(`/invoices/${id}`, data).then((r) => r.data);
export const deleteInvoice = (id) => api.delete(`/invoices/${id}`).then((r) => r.data);