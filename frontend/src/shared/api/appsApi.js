import api from "./axios";

export const getApps = () => api.get("/apps").then((res) => res.data);