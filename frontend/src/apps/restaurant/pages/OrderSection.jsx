import { useEffect, useState, useCallback } from "react";
import ordersApi from "../api/orders";
import { getOutlets } from "../../../shared/api/outlets";
import { getTables } from "../api/tables";
import { useAuth } from "../../../shared/context/AuthContext";
import { useOrderBuilder } from "../context/OrderBuilderContext";
import PaymentsSection from "./PaymentsSection";

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const labelCls = "mb-1 block text-xs text-muted";

const TYPE_LABEL = { dineIn: "Dine-in", takeaway: "Takeaway", delivery: "Delivery" };
// Kitchen flow. "completed" is set by the backend when the bill is fully paid.
const NEXT_STATUS = { pending: "preparing", preparing: "ready", ready: "served" };
const NEXT_LABEL = { preparing: "Start preparing", ready: "Mark ready", served: "Mark served" };
const STATUS_FILTERS = ["all", "pending", "preparing", "ready", "served", "completed", "cancelled"];
const STATUS_STYLE = {
  pending: "bg-saffron/10 text-saffron",
  preparing: "bg-saffron/10 text-saffron",
  ready: "bg-sage/10 text-sage",
  served: "bg-sage/10 text-sage",
  completed: "bg-charcoal-lighter text-muted",
  cancelled: "bg-brick/10 text-brick",
};

export default function OrderSection({ onNavigate }) {
  const { isBuilding } = useOrderBuilder();
  const [tab, setTab] = useState("orders");

  if (isBuilding) return <OrderBuilderPanel onNavigate={onNavigate} />;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-charcoal-lighter">
        {[["orders", "Orders"], ["payments", "Payments"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-3 py-2 text-sm ${tab === key ? "border-b-2 border-saffron text-saffron" : "text-muted hover:text-cream"}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === "orders" ? <OrdersList /> : <PaymentsSection />}
    </div>
  );
}

function OrdersList() {
  const { user } = useAuth();
  const canCancel = ["owner", "manager"].includes(user.role);
  const { startBuilder, startEditingOrder } = useOrderBuilder();

  const [outlets, setOutlets] = useState([]);
  const [outlet, setOutlet] = useState("");
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    getOutlets().then((res) => setOutlets((res.outlets || []).filter((o) => o.isActive))).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page: 1, limit: 100 };
      if (outlet) params.outlet = outlet;
      if (search) params.search = search;
      const data = await ordersApi.getAll(params);
      setOrders(data.orders);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [outlet, search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function run(order, fn, fail) {
    setBusyId(order._id);
    setError("");
    try { await fn(); await load(); }
    catch (err) { setError(err.response?.data?.message || fail); }
    finally { setBusyId(null); }
  }

  const advance = (o) => run(o, () => ordersApi.updateStatus(o._id, NEXT_STATUS[o.status]), "Couldn't update the order");
  const cancel = (o) =>
    window.confirm(`Cancel ${o.orderNumber}? The table will be freed with no charge.`) &&
    run(o, () => ordersApi.cancel(o._id), "Couldn't cancel the order");

  const byType = orders.filter((o) => !type || o.orderType === type);
  const visible = byType.filter((o) => status === "all" || o.status === status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Orders</h1>
          <p className="mt-1 text-sm text-muted">Track every order from the kitchen to the table.</p>
        </div>
        <button onClick={startBuilder} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark">
          New order
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order #, customer name, phone"
          aria-label="Search orders" className={`${inputCls} max-w-xs`} />
        {outlets.length > 1 && (
          <select value={outlet} onChange={(e) => setOutlet(e.target.value)} aria-label="Filter by outlet" className={`${inputCls} w-auto`}>
            <option value="">All outlets</option>
            {outlets.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
          </select>
        )}
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by order type" className={`${inputCls} w-auto`}>
          <option value="">All types</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`whitespace-nowrap rounded-sm border px-3 py-1.5 text-sm capitalize ${status === s ? "border-saffron text-saffron" : "border-charcoal-lighter text-muted hover:text-cream"}`}>
            {s}
            <span className="ml-1.5 text-xs text-muted">{s === "all" ? byType.length : byType.filter((o) => o.status === s).length}</span>
          </button>
        ))}
      </div>

      {error && <p role="alert" className="text-sm text-brick">{error}</p>}

      {loading ? (
        <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">Loading orders…</div>
      ) : visible.length === 0 ? (
        <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">
          {orders.length === 0 ? "No orders yet. Start one with New order." : "No orders match these filters."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((o) => {
            const lines = (o.items || []).filter((i) => i.status !== "cancelled");
            const open = !["completed", "cancelled"].includes(o.status);
            return (
              <div key={o._id} className="receipt-card relative rounded-sm px-5 pb-5 pt-7">
                <span className="receipt-notch left-6" />
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-cream">{o.orderNumber}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLE[o.status] || "bg-charcoal-lighter text-muted"}`}>{o.status}</span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {TYPE_LABEL[o.orderType] || o.orderType}
                  {o.table ? ` · ${o.table.name || o.table.tableNumber}` : ""}
                  {o.guestCount ? ` · ${o.guestCount} guests` : ""}
                </p>
                {o.customer?.name && <p className="text-xs text-muted">{o.customer.name}{o.customer.phone ? ` · ${o.customer.phone}` : ""}</p>}

                <ul className="mt-3 space-y-0.5 text-sm">
                  {lines.slice(0, 4).map((i) => (
                    <li key={i._id} className="flex justify-between gap-2">
                      <span className="truncate text-cream">{i.quantity}× {i.name}</span>
                      {i.selectedVariant?.label && <span className="shrink-0 text-xs text-muted">{i.selectedVariant.label}</span>}
                    </li>
                  ))}
                  {lines.length > 4 && <li className="text-xs text-muted">+{lines.length - 4} more</li>}
                </ul>

                <div className="mt-3 flex items-center justify-between border-t border-charcoal-lighter pt-3 text-sm">
                  <span className="text-cream">₹{o.total.toFixed(2)}</span>
                  <span className={o.amountDue > 0 ? "text-brick" : "text-sage"}>{o.amountDue > 0 ? `₹${o.amountDue.toFixed(2)} due` : "Paid"}</span>
                </div>

                {open && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    {NEXT_STATUS[o.status] && (
                      <button disabled={busyId === o._id} onClick={() => advance(o)}
                        className="rounded-sm bg-saffron px-3 py-1.5 text-xs font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">
                        {NEXT_LABEL[NEXT_STATUS[o.status]]}
                      </button>
                    )}
                    {o.status === "pending" && <button onClick={() => startEditingOrder(o)} className="text-xs text-saffron hover:underline">Edit items</button>}
                    {canCancel && <button disabled={busyId === o._id} onClick={() => cancel(o)} className="text-xs text-brick hover:underline">Cancel</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OrderBuilderPanel({ onNavigate }) {
  const { details, setDetails, cart, removeLine, cartTotal, cartCount, cancelBuilder, submitOrder, editingOrderId } = useOrderBuilder();
  const [outlets, setOutlets] = useState([]);
  const [tables, setTables] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getOutlets().then((res) => {
      const active = (res.outlets || []).filter((o) => o.isActive);
      setOutlets(active);
      if (!details.outlet && active[0]) setDetails({ outlet: active[0]._id });
    }).catch(() => setError("Failed to load outlets"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!details.outlet || details.orderType !== "dineIn") return;
    getTables({ outlet: details.outlet })
      .then((res) => setTables(res.tables.filter((t) => t.isActive)))
      .catch(() => setError("Failed to load tables"));
  }, [details.outlet, details.orderType]);

  const selectedTable = tables.find((t) => t._id === details.table);

  async function handleSubmit() {
    setError("");
    if (!details.outlet) return setError("Select an outlet");
    if (cart.length === 0) return setError("Add at least one item from the menu");
    if (details.orderType === "dineIn") {
      if (!details.table) return setError("Select a table for dine-in orders");
      if (selectedTable && details.guestCount && Number(details.guestCount) > selectedTable.capacity) {
        return setError(`${selectedTable.name || selectedTable.tableNumber} seats up to ${selectedTable.capacity} guests`);
      }
    }
    if (details.orderType === "delivery" && !details.deliveryAddress.trim()) return setError("Delivery address is required");

    setSubmitting(true);
    try {
      await submitOrder();
      cancelBuilder();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save the order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-cream">{editingOrderId ? "Edit order" : "New order"}</h1>
        <button onClick={cancelBuilder} className="text-sm text-muted hover:text-cream">Discard</button>
      </div>

      {error && <p role="alert" className="text-sm text-brick">{error}</p>}

      <div className="receipt-card relative rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Order type</label>
            <select value={details.orderType} onChange={(e) => setDetails({ orderType: e.target.value, table: "", guestCount: "" })} className={inputCls}>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {outlets.length > 1 && (
            <div>
              <label className={labelCls}>Outlet</label>
              <select value={details.outlet} onChange={(e) => setDetails({ outlet: e.target.value, table: "" })} className={inputCls}>
                {outlets.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
              </select>
            </div>
          )}
          {details.orderType === "dineIn" && (
            <>
              <div>
                <label className={labelCls}>Table</label>
                <select value={details.table} onChange={(e) => setDetails({ table: e.target.value })} className={inputCls}>
                  <option value="">Select a table…</option>
                  {tables.map((t) => (
                    <option key={t._id} value={t._id} disabled={t.status === "OCCUPIED" && t._id !== details.table}>
                      {t.name || t.tableNumber} · {t.capacity} seats{t.status !== "AVAILABLE" ? ` (${t.status.toLowerCase()})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Guests</label>
                <input type="number" min="1" max={selectedTable?.capacity} value={details.guestCount}
                  onChange={(e) => setDetails({ guestCount: e.target.value })}
                  placeholder={selectedTable ? `Up to ${selectedTable.capacity}` : ""} className={inputCls} />
              </div>
            </>
          )}
          {details.orderType === "delivery" && (
            <div className="sm:col-span-2">
              <label className={labelCls}>Delivery address *</label>
              <input value={details.deliveryAddress} onChange={(e) => setDetails({ deliveryAddress: e.target.value })} className={inputCls} />
            </div>
          )}
          <div>
            <label className={labelCls}>Customer name</label>
            <input value={details.customerName} onChange={(e) => setDetails({ customerName: e.target.value })} placeholder="Optional" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Customer phone</label>
            <input value={details.customerPhone} onChange={(e) => setDetails({ customerPhone: e.target.value })} placeholder="Optional" className={inputCls} />
          </div>
        </div>
      </div>

      <div className="receipt-card relative rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between">
          <p className="font-medium text-cream">Items</p>
          <button onClick={() => onNavigate("menu")} className="rounded-sm border border-saffron px-3 py-1.5 text-sm font-medium text-saffron hover:bg-saffron hover:text-charcoal">
            Add from menu
          </button>
        </div>
        {cart.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing here yet. Open the menu and tap items to add them.</p>
        ) : (
          <ul className="mt-3 divide-y divide-charcoal-lighter">
            {cart.map((line) => (
              <li key={line.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-cream">{line.quantity}× {line.name}</p>
                  {(line.variantLabel || line.addOnNames.length > 0) && (
                    <p className="truncate text-xs text-muted">{[line.variantLabel, ...line.addOnNames].filter(Boolean).join(", ")}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-muted">₹{(line.unitPrice * line.quantity).toFixed(2)}</span>
                  <button onClick={() => removeLine(line.key)} aria-label={`Remove ${line.name}`} className="text-xs text-brick hover:underline">Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-charcoal-lighter pt-3">
          <span className="font-medium text-cream">{cartCount} item{cartCount !== 1 ? "s" : ""} · ₹{cartTotal.toFixed(2)}</span>
          <button onClick={handleSubmit} disabled={submitting || cart.length === 0}
            className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">
            {submitting ? "Saving…" : editingOrderId ? "Save changes" : "Place order"}
          </button>
        </div>
      </div>
    </div>
  );
}
