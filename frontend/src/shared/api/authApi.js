import api from "./axios";

export const createLogin = (data) => api.post("/auth/staff", data).then((res) => res.data);
export const staffLogin = (data) => api.post("/auth/staff-login", data).then((res) => res.data);