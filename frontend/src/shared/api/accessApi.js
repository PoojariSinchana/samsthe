import api from "./axios";

export const getAccessOptions = () => api.get("/auth/access-options").then((res) => res.data);
export const getStaffUsers = () => api.get("/auth/staff").then((res) => res.data);
export const createStaffUser = (data) => api.post("/auth/staff", data).then((res) => res.data);
export const updateStaffAccess = (id, data) => api.put(`/auth/staff/${id}/access`, data).then((res) => res.data);
export const deleteStaffUser = (id) => api.delete(`/auth/staff/${id}`).then((res) => res.data);