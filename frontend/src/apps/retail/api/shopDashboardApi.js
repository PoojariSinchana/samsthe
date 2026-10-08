import api from "../../../shared/api/axios";

export const getSummary = (params) => api.get("/dashboard/summary", { params }).then((res) => res.data);