const fmtDay = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

export function adaptDashboard(raw, period) {
  if (!raw) return null;
  if (raw.kpis) return raw; // already in the UI shape

  if (!raw.revenue) return null; // genuinely unexpected

  const balances = raw.balances || {};
  const trend = raw.trend || [];

  return {
    period: raw.period || period,
    periodLabel: raw.range
      ? `${fmtDay(raw.range.from)} – ${fmtDay(raw.range.to)}`
      : "",
    changeLabel: raw.changeLabel,
    kpis: {
      totalSales: raw.revenue.total ?? 0,
      totalSalesChangePct: raw.revenue.changePct,
      totalExpenses: raw.expenses?.total ?? 0,
      totalExpensesChangePct: raw.expenses?.changePct,
      netProfit: raw.profit?.total ?? 0,
      netProfitChangePct: raw.profit?.changePct,
      orders: raw.orders?.total ?? 0,
      ordersChangePct: raw.orders?.changePct,
      sales: raw.orders?.total ?? 0,          // retail uses "sales"
      salesChangePct: raw.orders?.changePct,
      customers: raw.customers?.total ?? 0,
      customersChangePct: raw.customers?.changePct,
      cashBankBalance: (balances.cash || 0) + (balances.bank || 0),
      lowStockCount: raw.lowStockCount ?? 0,
    },
    salesTrend: trend.map((t) => ({ label: t.label, total: t.revenue ?? 0 })),
    revenueVsExpenses: trend.map((t) => ({
      label: t.label,
      revenue: t.revenue ?? 0,
      expenses: t.expenses ?? 0,
    })),
    recentTransactions: (raw.recentOrders || []).map((o) => ({
      title: `${o.number}${o.customerSnapshot?.name ? " · " + o.customerSnapshot.name : ""}`,
      amount: `₹${(o.total || 0).toLocaleString("en-IN")}`,
      positive: o.paymentStatus === "paid",
    })),
    outstanding: {
  customerReceivables: { count: raw.outstandingCount ?? 0, total: raw.outstandingDue ?? 0 },
  supplierPayables: { total: raw.supplierPayables ?? 0 },
},
  };
}