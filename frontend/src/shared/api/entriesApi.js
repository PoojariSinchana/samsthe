import api from "./axios";

export const getMeta = () => api.get("/entries/meta").then((res) => res.data);
export const getEntries = (params) => api.get("/entries", { params }).then((res) => res.data);
export const createEntry = (data) => api.post("/entries", data).then((res) => res.data);
export const updateEntry = (id, data) => api.put(`/entries/${id}`, data).then((res) => res.data);
export const cancelEntry = (id) => api.patch(`/entries/${id}/cancel`).then((res) => res.data);
export const analyzeSmartEntry = (text) => api.post("/entries/smart/analyze", { text }).then((res) => res.data);
export const getInventorySnapshot = () => api.get("/entries/inventory-snapshot").then((res) => res.data);
export const transcribeVoice = (blob) => {
  const formData = new FormData();
  formData.append("audio", blob, "recording.webm");
  return api.post("/entries/smart/transcribe", formData).then((res) => res.data);
};