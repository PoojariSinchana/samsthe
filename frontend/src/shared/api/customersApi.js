import api from "./axios";

export const getCustomers = (params) => api.get("/customers", { params }).then((res) => res.data);
export const createCustomer = (data) => api.post("/customers", data).then((res) => res.data);
export const updateCustomer = (id, data) => api.put(`/customers/${id}`, data).then((res) => res.data);
export const deactivateCustomer = (id) => api.delete(`/customers/${id}`).then((res) => res.data);
