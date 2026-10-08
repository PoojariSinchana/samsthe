import api from "../../../shared/api/axios";
import { pickList, pickOne } from "../../../shared/api/normalize";

const T = "product";
const fromApi = (p) => p && { ...p, category: p.categoryId, brand: p.brandId, variants: (p.variants || []).filter((v) => v.isActive !== false) };
const toApi = ({ category, brand, ...rest }) => ({ ...rest, categoryId: category, brandId: brand || "" });

export const getProducts = (params) =>
  api.get("/catalog/items", { params: { ...params, type: T } }).then((r) => ({ products: pickList(r.data, "items", "products").map(fromApi) }));
export const getProductById = (id) =>
  api.get(`/catalog/items/${id}`).then((r) => ({ product: fromApi(pickOne(r.data, "item", "product")) }));
export const lookupByCode = (code, outlet) =>
  api.get("/catalog/items/lookup", { params: { code, outlet } }).then((r) => ({ ...r.data, product: fromApi(r.data.item) }));
export const createProduct = (data) =>
  api.post("/catalog/items", { ...toApi(data), type: T }).then((r) => ({ product: fromApi(pickOne(r.data, "item", "product")) }));
export const updateProduct = (id, data) =>
  api.put(`/catalog/items/${id}`, toApi(data)).then((r) => ({ product: fromApi(pickOne(r.data, "item", "product")) }));
export const deleteProduct = (id) => api.delete(`/catalog/items/${id}`).then((r) => r.data);