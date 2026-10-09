import api from "./adminAxios";

export const getMeta = () => api.get("/projects/meta").then((r) => r.data);
export const getProjects = (params) => api.get("/projects", { params }).then((r) => r.data);
export const createProject = (data) => api.post("/projects", data).then((r) => r.data);
export const updateProject = (id, data) => api.put(`/projects/${id}`, data).then((r) => r.data);
export const deleteProject = (id) => api.delete(`/projects/${id}`).then((r) => r.data);