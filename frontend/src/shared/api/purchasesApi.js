import api from "./axios";

const adaptPurchase = (p) => p && { ...p, supplier: p.supplierId, outlet: p.outletId, items: (p.lines || []).map((l) => ({ ...l, unitCost: l.price })) };

const toPayload = (p) => ({
  outletId: p.outlet, supplierId: p.supplier, date: p.date, notes: p.notes,
  amountPaid: p.amountPaid, paymentMethod: p.paymentMethod,
  lines: (p.items || []).map((i) =>
    i.product
      ? { itemId: i.product, variantId: i.variantId, quantity: i.quantity, price: i.unitCost }
      : { name: i.name, unit: i.unit, quantity: i.quantity, price: i.unitCost }),
});
const wrap = (r) => ({ ...r.data, purchase: adaptPurchase(r.data.purchase) });

export const getAll = (params) => api.get("/purchases", { params }).then((r) => ({ ...r.data, purchases: (r.data.purchases || []).map(adaptPurchase) }));
export const getById = (id) => api.get(`/purchases/${id}`).then(wrap);
export const create = (payload) => api.post("/purchases", toPayload(payload)).then(wrap);
export const addPayment = (id, payload) => api.post(`/purchases/${id}/payments`, payload).then(wrap);

export const purchasesApi = { getAll, getById, create, addPayment };
export const restaurantPurchases = purchasesApi;
export const shopPurchases = purchasesApi;
export const addPurchasePayment = addPayment;