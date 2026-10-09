import api from "./adminAxios";
export const getSettings = () => api.get("/settings").then((r) => r.data);
export const saveSettings = (data) => api.put("/settings", data).then((r) => r.data);