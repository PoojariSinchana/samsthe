import axios from "../../../shared/api/axios";

// Backend order -> shape the restaurant UI already understands.
export function adaptOrder(o) {
  if (!o) return o;
  return {
    ...o,
    orderNumber: o.number,
    orderType: o.channel,
    outlet: o.outletId,
    table: o.tableId,
    customer: o.customerSnapshot,
    items: (o.lines || []).map((l) => ({
      ...l,
      menuItem: l.itemId,
      selectedVariant: l.variantLabel ? { label: l.variantLabel } : undefined,
    })),
  };
}

// UI cart line -> backend line.
const toLines = (items = []) =>
  items.map((i) => ({
    itemId: i.menuItem,
    variantId: i.variantId,
    quantity: i.quantity,
    notes: i.notes,
    addOnNames: i.addOnNames,
  }));

const toPayload = (p) => ({
  outletId: p.outlet,
  channel: p.orderType,
  tableId: p.table,
  guestCount: p.guestCount,
  customer: p.customer,
  deliveryAddress: p.deliveryAddress,
  lines: toLines(p.items),
});

const wrap = (res) => ({ ...res.data, order: adaptOrder(res.data.order) });

const orders = {
  getAll: (params) =>
    axios
      .get("/orders", { params: { ...params, outletId: undefined } })
      .then((res) => ({ ...res.data, orders: (res.data.orders || []).map(adaptOrder) })),
  getById: (id) => axios.get(`/orders/${id}`).then(wrap),
  create: (payload) => axios.post("/orders", toPayload(payload)).then(wrap),
  addItems: (id, items) => axios.post(`/orders/${id}/items`, { lines: toLines(items) }).then(wrap),
  updateItems: (id, payload) => axios.patch(`/orders/${id}/items`, { lines: toLines(payload.items), guestCount: payload.guestCount }).then(wrap),
  updateStatus: (id, status) => axios.patch(`/orders/${id}/status`, { status }).then(wrap),
  updateItemStatus: (id, lineId, status) => axios.patch(`/orders/${id}/lines/${lineId}/status`, { status }).then(wrap),
  addPayment: (id, payload) => axios.post(`/orders/${id}/payments`, payload).then(wrap),
  cancel: (id) => axios.patch(`/orders/${id}/cancel`).then((res) => res.data),
  markBillGenerated: (id) => axios.patch(`/orders/${id}/generate-bill`).then(wrap),
  getPaymentsReport: (params) =>
    axios.get("/orders/reports/payments", { params }).then((res) => ({
      ...res.data,
      payments: (res.data.payments || []).map((p) => ({
        ...p,
        orderNumber: p.number,
        orderType: p.channel,
      })),
    })),
};

export default orders;