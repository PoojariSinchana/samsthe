import api from "./adminAxios";

export const getMeta = () => api.get("/payments/meta").then((r) => r.data);
export const getPayments = (params) => api.get("/payments", { params }).then((r) => r.data);
export const createPayment = (data) => api.post("/payments", data).then((r) => r.data);
export const updatePaymentStatus = (id, status, rejectReason) =>
  api.put(`/payments/${id}/status`, { status, rejectReason }).then((r) => r.data);