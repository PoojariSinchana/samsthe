import api from "./adminAxios";
export const getSummary = () => api.get("/dashboard/summary").then((r) => r.data);