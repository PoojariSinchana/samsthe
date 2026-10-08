import api from "./axios";

export const getOverview = (params) => api.get("/accounting/overview", { params }).then((res) => res.data);

export const getAccounts = () => api.get("/accounting/accounts").then((res) => res.data);
export const createAccount = (data) => api.post("/accounting/accounts", data).then((res) => res.data);
export const deactivateAccount = (id) => api.delete(`/accounting/accounts/${id}`).then((res) => res.data);

export const getEntries = (params) => api.get("/accounting/entries", { params }).then((res) => res.data);
export const createManualEntry = (data) => api.post("/accounting/entries", data).then((res) => res.data);

export const getLedger = (accountId, params) => api.get(`/accounting/ledger/${accountId}`, { params }).then((res) => res.data);

export const getReceivables = (params) =>
  api.get("/accounting/receivables", { params }).then(({ data }) => ({
    ...data,
    receivables: (data.receivables || []).map((o) => ({
      ...o,
      orderNumber: o.number,
      customer: o.customerSnapshot,
      outlet: o.outletId,
      table: o.tableId,
    })),
  }));

export const getPayables = (params) =>
  api.get("/accounting/payables", { params }).then(({ data }) => ({
    ...data,
    payables: (data.payables || []).map((p) => ({
      ...p,
      supplier: p.supplierId,
      outlet: p.outletId,
    })),
  }));

export const getProfitAndLoss = (params) => api.get("/accounting/statements/profit-and-loss", { params }).then((res) => res.data);
export const getBalanceSheet = (params) => api.get("/accounting/statements/balance-sheet", { params }).then((res) => res.data);
export const getCashFlow = (params) => api.get("/accounting/statements/cash-flow", { params }).then((res) => res.data);
export const getOwnersEquity = (params) => api.get("/accounting/statements/owners-equity", { params }).then((res) => res.data);
export const getTrialBalance = (params) => api.get("/accounting/statements/trial-balance", { params }).then((res) => res.data);