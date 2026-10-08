import api from "../../../shared/api/axios";
import { pickList, pickOne } from "../../../shared/api/normalize";

const T = "menu";

export const getCategories = () =>
  api.get("/catalog/categories", { params: { kind: T } }).then((r) => pickList(r.data, "categories"));
export const createCategory = (data) =>
  api.post("/catalog/categories", { ...data, kind: T }).then((r) => pickOne(r.data, "category"));
export const updateCategory = (id, data) =>
  api.put(`/catalog/categories/${id}`, data).then((r) => pickOne(r.data, "category"));
export const deleteCategory = (id) => api.delete(`/catalog/categories/${id}`).then((r) => r.data);

export const getItems = (params) =>
  api.get("/catalog/items", { params: { ...params, type: T } }).then((r) => pickList(r.data, "items"));
export const getItemById = (id) => api.get(`/catalog/items/${id}`).then((r) => pickOne(r.data, "item"));
export const createItem = (data) =>
  api.post("/catalog/items", { ...data, type: T }).then((r) => pickOne(r.data, "item"));
export const updateItem = (id, data) =>
  api.put(`/catalog/items/${id}`, data).then((r) => pickOne(r.data, "item"));
export const toggleAvailability = (id) =>
  api.patch(`/catalog/items/${id}/availability`).then((r) => pickOne(r.data, "item"));
export const deleteItem = (id) => api.delete(`/catalog/items/${id}`).then((r) => r.data);

export const addAddOn = (itemId, data) => api.post(`/catalog/items/${itemId}/addons`, data).then((r) => r.data);
export const removeAddOn = (itemId, addOnId) =>
  api.delete(`/catalog/items/${itemId}/addons/${addOnId}`).then((r) => r.data);