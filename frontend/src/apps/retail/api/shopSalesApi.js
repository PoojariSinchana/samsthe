import api from "../../../shared/api/axios";
import { pickList } from "../../../shared/api/normalize";

const CHANNEL = "counter";
const adaptSale = (o) => o && { ...o, saleNumber: o.number, items: o.lines || [], customer: o.customerSnapshot, outlet: o.outletId };
const wrap = (r) => ({ ...r.data, sale: adaptSale(r.data.sale ?? r.data.order) });

const shopSales = {
  getAll: (params) =>
    api.get("/orders", { params: { ...params, channel: CHANNEL } })
      .then((r) => ({ ...r.data, sales: pickList(r.data, "orders", "sales").map(adaptSale) })),
  getById: (id) => api.get(`/orders/${id}`).then(wrap),
  create: (p) => api.post("/orders", {
    outletId: p.outlet, channel: CHANNEL, customer: p.customer,
    lines: p.items.map((i) => ({ itemId: i.product, variantId: i.variantId, quantity: i.quantity, discount: i.discount })),
  }).then(wrap),
  addPayment: (id, payload) => api.post(`/orders/${id}/payments`, payload).then(wrap),
  returnItems: (id, lineIds) => api.post(`/orders/${id}/returns`, { lineIds }).then(wrap),
  cancel: (id) => api.patch(`/orders/${id}/cancel`).then((r) => r.data),
  markBillGenerated: (id) => api.patch(`/orders/${id}/generate-bill`).then(wrap),
  getPaymentsReport: (params) =>
    api.get("/orders/reports/payments", { params: { ...params, channel: CHANNEL } }).then((r) => r.data),
};
export default shopSales;