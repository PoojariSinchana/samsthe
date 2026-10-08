import api from "./adminAxios";

export const login = (data) => api.post("/auth/login", data).then((r) => r.data);
export const getMe = () => api.get("/auth/me").then((r) => r.data);
export const changePassword = (data) => api.put("/auth/password", data).then((r) => r.data);

export const getAccessOptions = () => api.get("/auth/access-options").then((r) => r.data);
export const listAdmins = () => api.get("/auth/users").then((r) => r.data);
export const createAdmin = (data) => api.post("/auth/users", data).then((r) => r.data);
export const updateAdmin = (id, data) => api.put(`/auth/users/${id}`, data).then((r) => r.data);