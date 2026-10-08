import api from "../../../shared/api/axios";

// Menu lives under /api/catalog. These adapters convert between the backend's
// unified Item shape and the flat shape the menu UI already uses.

// Backend item -> flat UI item
const flattenItem = (item) => {
  if (!item) return item;
  const active = (item.variants || []).filter((v) => v.isActive !== false);
  const main = active.find((v) => v.isDefault) || active[0];
  // Only real size options are exposed as `variants`; a lone "Regular" variant is just the price.
  const sizes = active.length > 1 ? active.map((v) => ({ _id: v._id, label: v.label, price: v.price })) : [];
  return {
    ...item,
    category: item.categoryId, // populated { _id, name } when the endpoint populates it
    price: main?.price ?? 0,
    variantId: main?._id, // default variant id (needed when placing orders)
    variants: sizes,
    isVeg: item.menu?.isVeg !== false,
    addOns: item.menu?.addOns || [],
    pricingByOrderType: item.menu?.pricingByOrderType || {},
  };
};

// Flat form data -> backend payload. `existing` = the item's current variants, so edits
// keep their _id (stock and orders reference variant ids).
const toApiItem = (data, existing = []) => {
  const { category, price, variants, isVeg, addOns, pricingByOrderType, variantId, ...rest } = data;
  const payload = { ...rest };

  const categoryId = typeof category === "object" ? category?._id : category;
  if (categoryId) payload.categoryId = categoryId;

  if (isVeg !== undefined || addOns !== undefined || pricingByOrderType !== undefined) {
    payload.menu = { isVeg, addOns, pricingByOrderType };
  }

  const idFor = (label) => existing.find((e) => e.label === label)?._id;
  const sizes = (variants || []).filter((v) => v.label && v.price !== "" && v.price != null);

  if (sizes.length) {
    payload.variants = sizes.map((v, i) => ({
      ...(idFor(v.label) && { _id: idFor(v.label) }),
      label: v.label,
      price: Number(v.price),
      isDefault: i === 0,
    }));
  } else if (price !== undefined && price !== "") {
    payload.variants = [
      { ...(idFor("Regular") && { _id: idFor("Regular") }), label: "Regular", price: Number(price), isDefault: true },
    ];
  }
  return payload;
};

// Categories (return bare arrays/objects like before)
export const getCategories = () =>
  api.get("/catalog/categories", { params: { kind: "menu" } }).then((res) => res.data.categories);

export const createCategory = (data) =>
  api.post("/catalog/categories", { ...data, kind: "menu" }).then((res) => res.data.category);

export const updateCategory = (id, data) =>
  api.put(`/catalog/categories/${id}`, data).then((res) => res.data.category);

export const deleteCategory = (id) =>
  api.delete(`/catalog/categories/${id}`).then((res) => res.data);

// Menu Items
export const getItems = (params) =>
  api
    .get("/catalog/items", { params: { type: "menu", ...params } })
    .then((res) => res.data.items.map(flattenItem));

export const getItemById = (id) =>
  api.get(`/catalog/items/${id}`).then((res) => flattenItem(res.data.item));

// create / toggle / add-on responses aren't populated, so re-fetch to get the category name.
export const createItem = async (data) => {
  const res = await api.post("/catalog/items", { type: "menu", ...toApiItem(data) });
  return getItemById(res.data.item._id);
};

export const updateItem = async (id, data) => {
  const raw = (await api.get(`/catalog/items/${id}`)).data.item;
  const res = await api.put(`/catalog/items/${id}`, toApiItem(data, raw.variants));
  return flattenItem(res.data.item); // update response is populated
};

export const toggleAvailability = async (id) => {
  await api.patch(`/catalog/items/${id}/availability`);
  return getItemById(id);
};

export const deleteItem = (id) =>
  api.delete(`/catalog/items/${id}`).then((res) => res.data);

// Add-ons
export const addAddOn = async (itemId, data) => {
  await api.post(`/catalog/items/${itemId}/addons`, data);
  return getItemById(itemId);
};

export const removeAddOn = async (itemId, addOnId) => {
  await api.delete(`/catalog/items/${itemId}/addons/${addOnId}`);
  return getItemById(itemId);
};