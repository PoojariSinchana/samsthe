import api from "./adminAxios";

export const getMeta = () => api.get("/support/meta").then((r) => r.data);
export const getTickets = (params) => api.get("/support", { params }).then((r) => r.data);
export const getTicket = (id) => api.get(`/support/${id}`).then((r) => r.data);
export const createTicket = (data) => api.post("/support", data).then((r) => r.data);
export const updateTicket = (id, data) => api.put(`/support/${id}`, data).then((r) => r.data);
export const addReply = (id, data) => api.post(`/support/${id}/replies`, data).then((r) => r.data);
export const deleteTicket = (id) => api.delete(`/support/${id}`).then((r) => r.data);