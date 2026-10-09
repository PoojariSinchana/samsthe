import api from "./adminAxios";

export const getMeta = () => api.get("/employees/meta").then((r) => r.data);
export const getEmployees = (params) => api.get("/employees", { params }).then((r) => r.data);
export const createEmployee = (data) => api.post("/employees", data).then((r) => r.data);
export const updateEmployee = (id, data) => api.put(`/employees/${id}`, data).then((r) => r.data);
export const deleteEmployee = (id) => api.delete(`/employees/${id}`).then((r) => r.data);
export const createLogin = (id, data) => api.post(`/employees/${id}/login`, data).then((r) => r.data);