import api from "./axios";

export const getOutlets = () => api.get("/outlets").then((res) => res.data);
export const createOutlet = (data) => api.post("/outlets", data).then((res) => res.data);
export const updateOutlet = (id, data) => api.put(`/outlets/${id}`, data).then((res) => res.data);
export const deleteOutlet = (id) => api.delete(`/outlets/${id}`).then((res) => res.data);