import api from "../../../shared/api/axios";
import { pickList, pickOne } from "../../../shared/api/normalize";

const K = "product";

export const getCategories = () =>
  api.get("/catalog/categories", { params: { kind: K } }).then((r) => ({ categories: pickList(r.data, "categories") }));
export const createCategory = (data) =>
  api.post("/catalog/categories", { ...data, kind: K }).then((r) => ({ category: pickOne(r.data, "category") }));
export const updateCategory = (id, data) =>
  api.put(`/catalog/categories/${id}`, data).then((r) => ({ category: pickOne(r.data, "category") }));
export const deleteCategory = (id) => api.delete(`/catalog/categories/${id}`).then((r) => r.data);