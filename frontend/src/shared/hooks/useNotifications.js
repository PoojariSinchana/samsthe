import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import { pickList } from "../api/normalize";

const readKey = (appType) => `notif-read-${appType}`;
const loadRead = (appType) => {
  try { return new Set(JSON.parse(localStorage.getItem(readKey(appType)) || "[]")); }
  catch { return new Set(); }
};

export default function useNotifications(appType) {
  const [items, setItems] = useState([]);
  const [readIds, setReadIds] = useState(() => loadRead(appType));
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const list = [];
    const retail = appType === "retail";

    const [summary, orders] = await Promise.allSettled([
      api.get("/dashboard/summary", { params: { period: "month" } }),
      api.get("/orders", { params: { page: 1, limit: 100, ...(retail ? { channel: "counter" } : {}) } }),
    ]);

    if (summary.status === "fulfilled") {
      const d = summary.value.data;
      const low = d.lowStockCount ?? d.kpis?.lowStockCount ?? 0;
      const due = d.outstandingDue ?? d.outstanding?.customerReceivables?.total ?? 0;

      if (low > 0) {
        list.push({
          id: `low-stock:${low}`, type: "warning",
          title: `${low} item${low !== 1 ? "s" : ""} low on stock`,
          body: retail ? "Check the Stock page and reorder." : "Check your purchases and restock.",
          go: retail ? "stock" : "purchases",
        });
      }
      if (due > 0) {
        list.push({
          id: `due:${Math.round(due)}`, type: "danger",
          title: `₹${due.toLocaleString("en-IN")} waiting to be collected`,
          body: "Unpaid bills are outstanding.",
          go: "accounting",
        });
      }
    }

    if (orders.status === "fulfilled") {
      const all = pickList(orders.value.data, "orders", "sales").filter((o) => o.status !== "cancelled");

      if (retail) {
        const unpaid = all.filter((o) => o.paymentStatus !== "paid").length;
        if (unpaid > 0) {
          list.push({
            id: `unpaid-sales:${unpaid}`, type: "info",
            title: `${unpaid} sale${unpaid !== 1 ? "s" : ""} not fully paid`,
            body: "Open Sales / POS to collect payment.", go: "pos",
          });
        }
      } else {
        const pending = all.filter((o) => o.status === "pending").length;
        const ready = all.filter((o) => o.status === "ready").length;
        if (pending > 0) {
          list.push({
            id: `pending:${pending}`, type: "info",
            title: `${pending} new order${pending !== 1 ? "s" : ""} waiting`,
            body: "Not started in the kitchen yet.", go: "orders",
          });
        }
        if (ready > 0) {
          list.push({
            id: `ready:${ready}`, type: "info",
            title: `${ready} order${ready !== 1 ? "s" : ""} ready to serve`,
            body: "Food is ready for the table or pickup.", go: "orders",
          });
        }
      }
    }

    setItems(list);
    setLoading(false);
  }, [appType]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, [refresh]);

  const persist = (set) => {
    localStorage.setItem(readKey(appType), JSON.stringify([...set].slice(-200)));
    setReadIds(set);
  };
  const markRead = (id) => persist(new Set(readIds).add(id));
  const markAllRead = () => persist(new Set([...readIds, ...items.map((i) => i.id)]));

  const unread = items.filter((i) => !readIds.has(i.id)).length;
  return { items, readIds, unread, loading, refresh, markRead, markAllRead };
}