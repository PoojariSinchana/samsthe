import api from "./axios";

export const fetchStaff = (params) => api.get("/staff", { params });
export const fetchStaffById = (id) => api.get(`/staff/${id}`);
export const addStaff = (data) => api.post("/staff", data);
export const editStaff = (id, data) => api.put(`/staff/${id}`, data);
export const removeStaff = (id) => api.delete(`/staff/${id}`);

export const uploadStaffPhoto = (file) => {
  const formData = new FormData();
  formData.append("photo", file);
  return api.post("/staff/upload-photo", formData);
};