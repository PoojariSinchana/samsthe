import api from "../../../shared/api/axios";
import { pickList } from "../../../shared/api/normalize";

export const getBrands = () => api.get("/catalog/brands").then((r) => ({ brands: pickList(r.data, "brands") }));
export const createBrand = (data) => api.post("/catalog/brands", data).then((r) => r.data); // FormData if uploading a logo
export const updateBrand = (id, data) => api.put(`/catalog/brands/${id}`, data).then((r) => r.data);
export const deleteBrand = (id) => api.delete(`/catalog/brands/${id}`).then((r) => r.data);