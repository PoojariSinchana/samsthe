import api from "./axios";

export const getPartners = () => api.get("/partners").then((res) => res.data);
export const createPartner = (data) => api.post("/partners", data).then((res) => res.data);
export const updatePartner = (id, data) => api.put(`/partners/${id}`, data).then((res) => res.data);
export const deactivatePartner = (id) => api.delete(`/partners/${id}`).then((res) => res.data);