import api from "./axios";

export const getMeta = () => api.get("/expenses/meta").then((r) => r.data);
export const getEntries = (params) => api.get("/expenses", { params }).then((r) => r.data);
export const createEntry = (data) => api.post("/expenses", data).then((r) => r.data);
export const cancelEntry = (id) => api.patch(`/expenses/${id}/cancel`).then((r) => r.data);