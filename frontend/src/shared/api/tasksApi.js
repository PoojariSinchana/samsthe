import api from "./axios";
export const getTasks = (params) => api.get("/tasks", { params }).then((r) => r.data);
export const getAssignees = () => api.get("/tasks/assignees").then((r) => r.data);
export const createTask = (data) => api.post("/tasks", data).then((r) => r.data);
export const updateTask = (id, data) => api.put(`/tasks/${id}`, data).then((r) => r.data);
export const deleteTask = (id) => api.delete(`/tasks/${id}`).then((r) => r.data);