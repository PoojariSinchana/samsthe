import api from "./axios";

export const getMeta = () => api.get("/support/meta").then((r) => r.data);
export const getTickets = () => api.get("/support").then((r) => r.data);
export const getTicket = (id) => api.get(`/support/${id}`).then((r) => r.data);
export const createTicket = (data) => api.post("/support", data).then((r) => r.data);
export const addReply = (id, message) => api.post(`/support/${id}/replies`, { message }).then((r) => r.data);