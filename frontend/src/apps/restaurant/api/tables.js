import api from "../../../shared/api/axios";

export const getTables = (params) => api.get("/tables", { params }).then((res) => res.data);
export const getTableById = (id) => api.get(`/tables/${id}`).then((res) => res.data);
export const createTable = (data) => api.post("/tables", data).then((res) => res.data);
export const updateTable = (id, data) => api.put(`/tables/${id}`, data).then((res) => res.data);
export const updateTablePosition = (id, x, y) => api.patch(`/tables/${id}/position`, { x, y }).then((res) => res.data);
export const updateTableStatus = (id, status) => api.patch(`/tables/${id}/status`, { status }).then((res) => res.data);
export const deleteTable = (id) => api.delete(`/tables/${id}`).then((res) => res.data);