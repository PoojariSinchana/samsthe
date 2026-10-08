import api from "./axios";

export const getSuppliers = () => api.get("/suppliers").then((res) => res.data);
export const createSupplier = (data) => api.post("/suppliers", data).then((res) => res.data);
export const updateSupplier = (id, data) => api.put(`/suppliers/${id}`, data).then((res) => res.data);
export const deactivateSupplier = (id) => api.delete(`/suppliers/${id}`).then((res) => res.data);