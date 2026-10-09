import api from "./adminAxios";

export const getSummary = (params) => api.get("/reports/summary", { params }).then((r) => r.data);

// Authenticated download: a plain <a href> can't send the Bearer token, so fetch as a blob.
export async function downloadPaymentsCsv(params) {
  const res = await api.get("/reports/payments.csv", { params, responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = "payments.csv";
  a.click();
  URL.revokeObjectURL(url);
}