import { useEffect, useState } from "react";
import { useAuth } from "../../../shared/context/AuthContext";
import { getOutlets } from "../../../shared/api/outlets";
import { getTables } from "../api/tables";
import * as menuApi from "../api/menuApi";
import ordersApi from "../api/orders";

const STATUS_STYLE = {
  AVAILABLE: { label: "Free", dot: "🟢", text: "text-sage" },
  OCCUPIED: { label: "Busy", dot: "🔴", text: "text-brick" },
  RESERVED: { label: "Reserved", dot: "🟡", text: "text-saffron" },
  CLEANING: { label: "Cleaning", dot: "⚪", text: "text-muted" },
};

const ORDER_TYPE_LABEL = { dineIn: "Dine-in", takeaway: "Takeaway", delivery: "Delivery" };

export default function BillingSection() {
  const [outlets, setOutlets] = useState([]);
  const [outlet, setOutlet] = useState("");
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("tables"); // "tables" | "orders"
  const [activeTable, setActiveTable] = useState(null);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [quickSale, setQuickSale] = useState(false);

  useEffect(() => {
    getOutlets()
      .then((res) => {
        const active = (res.outlets || []).filter((o) => o.isActive);
        setOutlets(active);
        if (active.length >= 1) setOutlet(active[0]._id);
      })
      .catch(() => setError("Failed to load outlets"));
  }, []);

  useEffect(() => {
    if (outlet) loadTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlet]);

  async function loadTables() {
    setLoading(true);
    try {
      const res = await getTables({ outlet });
      setTables(res.tables.filter((t) => t.isActive));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load tables");
    } finally {
      setLoading(false);
    }
  }

  function backToGrid() {
    setActiveTable(null);
    setActiveOrderId(null);
    setQuickSale(false);
    loadTables();
  }

  if (quickSale) {
    return <PosPanel outlet={outlet} table={null} onDone={backToGrid} onBack={backToGrid} />;
  }
  if (activeTable) {
    return <PosPanel outlet={outlet} table={activeTable} onDone={backToGrid} onBack={backToGrid} />;
  }
  if (activeOrderId) {
    return <PosPanel outlet={outlet} orderId={activeOrderId} onDone={backToGrid} onBack={backToGrid} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-cream">Billing / POS</h1>
        <div className="flex items-center gap-3">
          {outlets.length > 1 && (
            <select
              value={outlet}
              onChange={(e) => setOutlet(e.target.value)}
              className="rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2 text-cream outline-none focus:border-saffron"
            >
              {outlets.map((o) => (
                <option key={o._id} value={o._id}>{o.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setQuickSale(true)}
            className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark"
          >
            Quick Sale (Takeaway/Delivery)
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-charcoal-lighter">
        <button
          onClick={() => setView("tables")}
          className={`px-3 py-2 text-sm ${view === "tables" ? "border-b-2 border-saffron text-saffron" : "text-muted hover:text-cream"}`}
        >
          Tables
        </button>
        <button
          onClick={() => setView("orders")}
          className={`px-3 py-2 text-sm ${view === "orders" ? "border-b-2 border-saffron text-saffron" : "text-muted hover:text-cream"}`}
        >
          All Orders
        </button>
      </div>

      {error && <p className="text-sm text-brick">{error}</p>}

      {view === "tables" ? (
        loading ? (
          <p className="text-muted">Loading tables…</p>
        ) : tables.length === 0 ? (
          <p className="text-muted">No tables set up for this outlet yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {tables.map((table) => {
              const style = STATUS_STYLE[table.status];
              return (
                <button
                  key={table._id}
                  onClick={() => setActiveTable(table)}
                  className="receipt-card rounded-sm px-5 pb-6 pt-8 text-left"
                >
                  <span className="receipt-notch left-6" />
                  <p className="font-medium text-cream">{table.name || table.tableNumber}</p>
                  <p className="mt-1 text-sm text-muted">{table.capacity} Seats</p>
                  <p className={`mt-3 text-sm ${style.text}`}>
                    {style.dot} {style.label}
                    {table.status === "OCCUPIED" && table.currentOrder?.guestCount
                      ? ` · ${table.currentOrder.guestCount}/${table.capacity} seated`
                      : ""}
                  </p>
                  {table.currentOrder && (
                    <p className="mt-2 text-xs text-muted">
                      {table.currentOrder.orderNumber} · ₹{table.currentOrder.total?.toFixed(2)} · {table.currentOrder.paymentStatus}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )
      ) : (
        <AllOrdersTab outlet={outlet} onSelect={(id) => setActiveOrderId(id)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// All Orders — every order (any type) that still needs payment, so a
// cashier can bill takeaway/delivery orders too, not just table-linked ones.
// ─────────────────────────────────────────────────────────────────────────
function AllOrdersTab({ outlet, onSelect }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("unpaid"); // "unpaid" | "billed_unpaid" | "paid" | "all"

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlet, search]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = { page: 1, limit: 100 };
      if (outlet) params.outlet = outlet;
      if (search) params.search = search;
      const data = await ordersApi.getAll(params);
      setOrders(data.orders.filter((o) => o.status !== "cancelled"));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  function matches(order, key) {
    if (key === "paid") return order.paymentStatus === "paid";
    if (key === "billed_unpaid") return order.billGenerated && order.paymentStatus !== "paid";
    if (key === "unpaid") return order.paymentStatus !== "paid" && !order.billGenerated;
    return true; // "all"
  }

  const CATEGORIES = [
    { key: "unpaid", label: "Unpaid" },
    { key: "billed_unpaid", label: "Bill Generated (Unpaid)" },
    { key: "paid", label: "Paid" },
    { key: "all", label: "All" },
  ];

  const filtered = orders.filter((o) => matches(o, category));

  return (
    <div className="space-y-4">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Order #, customer name, phone…"
        className="w-full max-w-md rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2 text-sm text-cream outline-none focus:border-saffron"
      />

      <div className="flex flex-wrap gap-2 border-b border-charcoal-lighter pb-3">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`rounded-sm border px-3 py-1.5 text-sm ${
              category === c.key ? "border-saffron text-saffron" : "border-charcoal-lighter text-muted hover:text-cream"
            }`}
          >
            {c.label}
            <span className="ml-1.5 text-xs text-muted">
              ({orders.filter((o) => matches(o, c.key)).length})
            </span>
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-brick">{error}</p>}

      {loading ? (
        <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">No orders in this category.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((order) => (
            <button key={order._id} onClick={() => onSelect(order._id)} className="receipt-card relative rounded-sm px-5 pb-5 pt-7 text-left">
              <span className="receipt-notch left-6" />
              <div className="flex items-center justify-between">
                <span className="font-medium text-cream">{order.orderNumber}</span>
                <span className="text-xs capitalize text-muted">{order.status}</span>
              </div>
              <p className="mt-1 text-sm text-muted">
                {ORDER_TYPE_LABEL[order.orderType]}
                {order.table ? ` · ${order.table.name || order.table.tableNumber}` : ""}
              </p>
              {order.customer?.name && <p className="text-xs text-muted">{order.customer.name}</p>}
              <div className="mt-3 flex items-center justify-between border-t border-charcoal-lighter pt-3 text-sm">
                <span className="text-cream">₹{order.total.toFixed(2)}</span>
                <span className={order.amountDue > 0 ? "text-brick" : "text-sage"}>
                  {order.amountDue > 0 ? `₹${order.amountDue.toFixed(2)} due` : "Paid"}
                </span>
              </div>
              {order.billGenerated && order.paymentStatus !== "paid" && (
                <span className="mt-2 inline-block rounded-full bg-saffron/10 px-2 py-0.5 text-xs text-saffron">
                  Bill generated
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PosPanel({ outlet, table, orderId, onBack, onDone }) {
  const { user, restaurant } = useAuth();
  const canCancel = ["owner", "manager"].includes(user.role);

  const [order, setOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(!!table?.currentOrder || !!orderId);
  const [orderType, setOrderType] = useState(table ? "dineIn" : "takeaway");
  const [guestCount, setGuestCount] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [pickerItem, setPickerItem] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showBill, setShowBill] = useState(false);

  // An order is locked (no further edits) once it's completed or cancelled —
  // the backend already rejects addItems/updateOrderItems for these, this
  // just keeps the UI from offering an edit path in the first place.
  const isLocked = order && (order.status === "completed" || order.status === "cancelled");

  useEffect(() => {
    menuApi.getCategories().then((cats) => { setCategories(cats); setActiveCategory(cats[0]?._id || null); });
    menuApi.getItems().then((its) => setItems(its.filter((i) => i.isAvailable)));
  }, []);

  useEffect(() => {
    const idToLoad = orderId || table?.currentOrder?._id;
    if (idToLoad) {
      ordersApi.getById(idToLoad).then((res) => setOrder(res.order)).finally(() => setLoadingOrder(false));
    } else {
      setLoadingOrder(false);
    }
  }, [table, orderId]);

  function itemCategoryId(item) {
    return typeof item.category === "object" ? item.category?._id : item.category;
  }
  function priceFor(item) {
    return item.pricingByOrderType?.[orderType] ?? item.price;
  }

  function handleAddClick(item) {
    if ((item.variants?.length || 0) > 0 || (item.addOns?.length || 0) > 0) {
      setPickerItem(item);
    } else {
      addToCart(item, { variantLabel: null, addOnNames: [], unitPrice: priceFor(item) });
    }
  }

  function addToCart(item, { variantLabel, variantId, addOnNames, unitPrice }) {
  setCart((prev) => {
    const key = `${item._id}|${variantLabel || ""}|${(addOnNames || []).sort().join(",")}`;
    const existing = prev.find((l) => l._key === key);
    if (existing) return prev.map((l) => (l._key === key ? { ...l, quantity: l.quantity + 1 } : l));
    return [...prev, { _key: key, menuItem: item._id, variantId: variantId ?? item.variantId, name: item.name, unitPrice, variantLabel, addOnNames: addOnNames || [], quantity: 1, notes: "" }];
  });
  setPickerItem(null);
}

  function updateQty(key, delta) {
    setCart((prev) => prev.map((l) => (l._key === key ? { ...l, quantity: l.quantity + delta } : l)).filter((l) => l.quantity > 0));
  }

  const cartTotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  function cartAsPayload() {
    return cart.map((l) => ({
      menuItem: l.menuItem,
      quantity: l.quantity,
      notes: l.notes,
      variantId: l.variantId,
      variantLabel: l.variantLabel || undefined,
      addOnNames: l.addOnNames.length ? l.addOnNames : undefined,
    }));
  }

  async function handlePlace() {
    setError("");
    if (orderType === "delivery" && !deliveryAddress) return setError("Delivery address is required");
    if (cart.length === 0) return setError("Add at least one item");
    if (table && guestCount && Number(guestCount) > table.capacity) {
      return setError(`Table ${table.name || table.tableNumber} seats up to ${table.capacity} guests`);
    }
    setBusy(true);
    try {
      const res = await ordersApi.create({
        outlet,
        orderType,
        table: table?._id,
        guestCount: table && guestCount ? Number(guestCount) : undefined,
        customer: { name: customerName, phone: customerPhone },
        deliveryAddress: orderType === "delivery" ? deliveryAddress : undefined,
        items: cartAsPayload(),
      });
      setOrder(res.order);
      setCart([]);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to place order");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddMore() {
    setError("");
    if (cart.length === 0) return setError("Add at least one item");
    setBusy(true);
    try {
      const res = await ordersApi.addItems(order._id, cartAsPayload());
      setOrder(res.order);
      setCart([]);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add items");
    } finally {
      setBusy(false);
    }
  }

  async function handlePay(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await ordersApi.addPayment(order._id, { method: payMethod, amount: Number(payAmount) });
      setOrder(res.order);
      setPayAmount("");
      // On full payment the order flips to "completed" server-side (table
      // cleaning starts automatically too) — we don't auto-close here so
      // the cashier can see/print the bill first; isLocked takes over the UI.
    } catch (err) {
      setError(err.response?.data?.message || "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm("Cancel this order? The table will be freed immediately with no charge.")) return;
    setBusy(true);
    try {
      await ordersApi.cancel(order._id);
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to cancel order");
    } finally {
      setBusy(false);
    }
  }
  async function handleGenerateBill() {
    setShowBill(true);
    if (!order.billGenerated) {
      try {
        const res = await ordersApi.markBillGenerated(order._id);
        setOrder(res.order);
      } catch {
        // non-fatal — bill still shows locally even if the save fails
      }
    }
  }

  if (loadingOrder) return <p className="text-muted">Loading order…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-cream">
          {order ? order.orderNumber : table ? (table.name || table.tableNumber) : "Quick Sale"}
        </h1>
        <button onClick={onBack} className="text-sm text-muted hover:text-cream">← Back</button>
      </div>

      {error && <p className="text-sm text-brick">{error}</p>}

      {!order && (
        <div className="receipt-card rounded-sm px-5 pb-6 pt-8">
          <span className="receipt-notch left-6" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {!table && (
              <select value={orderType} onChange={(e) => setOrderType(e.target.value)}
                className="rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2 text-cream outline-none focus:border-saffron">
                <option value="takeaway">Takeaway</option>
                <option value="delivery">Delivery</option>
              </select>
            )}
            {orderType === "delivery" && !table && (
              <input placeholder="Delivery address" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)}
                className="col-span-2 rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2 text-cream outline-none focus:border-saffron" />
            )}
            {table && (
              <input
                type="number"
                min="1"
                max={table.capacity}
                placeholder={`Guests (up to ${table.capacity})`}
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value)}
                className="rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2 text-cream outline-none focus:border-saffron"
              />
            )}
            <input placeholder="Customer name (optional)" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
              className="rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2 text-cream outline-none focus:border-saffron" />
              <input placeholder="Customer phone (optional)" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
              className="rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2 text-cream outline-none focus:border-saffron" />
          </div>
        </div>
      )}

      {order && (
        <div className="receipt-card rounded-sm px-5 pb-6 pt-8">
          <span className="receipt-notch left-6" />
          <div className="flex items-center justify-between">
            <p className="font-medium text-cream">{order.orderNumber}</p>
            {order.guestCount && <p className="text-xs text-muted">{order.guestCount} guests</p>}
          </div>
          <ul className="mt-3 divide-y divide-charcoal-lighter">
            {order.items.map((item) => (
              <li key={item._id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="text-cream">{item.quantity}× {item.name}</span>
                  {(item.selectedVariant?.label || item.addOns?.length > 0) && (
                    <p className="text-xs text-muted">
                      {[item.selectedVariant?.label, ...(item.addOns || []).map((a) => a.name)].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
                <span className="text-muted">₹{(item.price * item.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between font-medium text-cream"><span>Total</span><span>₹{order.total.toFixed(2)}</span></div>
            <div className="flex justify-between text-sage"><span>Paid</span><span>₹{order.amountPaid.toFixed(2)}</span></div>
            <div className="flex justify-between text-brick"><span>Due</span><span>₹{order.amountDue.toFixed(2)}</span></div>
          </div>

          {!isLocked && (
            <button type="button" onClick={handleGenerateBill} className="mt-4 w-full rounded-sm border border-saffron px-4 py-2.5 text-sm font-medium text-saffron hover:bg-saffron hover:text-charcoal sm:w-auto">
              Generate Bill
            </button>
          )}


          {!isLocked && order.amountDue > 0 && (
            <form onSubmit={handlePay} className="mt-4 flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted">Amount</label>
                <input type="number" min="0.01" step="0.01" max={order.amountDue} value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)} required
                  className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2 text-cream outline-none focus:border-saffron" />
              </div>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}
                className="rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2 text-cream outline-none focus:border-saffron">
                {["cash", "card", "upi", "wallet", "other"].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <button type="button" onClick={() => setPayAmount(order.amountDue.toFixed(2))}
                className="rounded-sm border border-charcoal-lighter px-3 py-2 text-sm text-cream hover:border-saffron">
                Full
              </button>
              <button disabled={busy} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">
                Pay
              </button>
            </form>
          )}

          {canCancel && order.status !== "cancelled" && (
            <button
              onClick={handleCancel}
              disabled={busy}
              className="mt-4 rounded-sm border border-brick px-4 py-2 text-sm font-medium text-brick hover:bg-brick/10 disabled:opacity-50"
            >
              Cancel Order
            </button>
          )}
        </div>
      )}

      {isLocked ? (
        <BillView order={order} restaurant={restaurant} paid onDone={onDone} />
      ) : showBill ? (
          <BillView
            order={order}
            restaurant={restaurant}
            paid={false}
            onDone={() => setShowBill(false)}
            onCancelBill={onDone}
          />
        ) : (
        <div className="receipt-card rounded-sm px-5 pb-6 pt-8">
          <span className="receipt-notch left-6" />
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((cat) => (
              <button key={cat._id} onClick={() => setActiveCategory(cat._id)}
                className={`whitespace-nowrap rounded-sm border px-3 py-1.5 text-sm ${activeCategory === cat._id ? "border-saffron text-saffron" : "border-charcoal-lighter text-muted hover:text-cream"}`}>
                {cat.name}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.filter((i) => itemCategoryId(i) === activeCategory).map((item) => (
              <button key={item._id} onClick={() => handleAddClick(item)}
                className="rounded-sm border border-charcoal-lighter bg-charcoal-light p-3 text-left hover:border-saffron">
                <p className="text-sm font-medium text-cream">{item.name}</p>
                <p className="mt-1 text-xs text-muted">₹{priceFor(item)}</p>
              </button>
            ))}
          </div>

          {cart.length > 0 && (
            <div className="mt-4 border-t border-charcoal-lighter pt-3">
              <ul className="space-y-1 text-sm">
                {cart.map((line) => (
                  <li key={line._key} className="flex items-center justify-between">
                    <div>
                      <span className="text-cream">{line.name}</span>
                      {(line.variantLabel || line.addOnNames.length > 0) && (
                        <p className="text-xs text-muted">{[line.variantLabel, ...line.addOnNames].filter(Boolean).join(", ")}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(line._key, -1)} className="text-muted hover:text-cream">-</button>
                      <span className="text-cream">{line.quantity}</span>
                      <button onClick={() => updateQty(line._key, 1)} className="text-muted hover:text-cream">+</button>
                      <span className="w-16 text-right text-muted">₹{(line.unitPrice * line.quantity).toFixed(2)}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-medium text-cream">Cart total: ₹{cartTotal.toFixed(2)}</span>
                <button
                  onClick={order ? handleAddMore : handlePlace}
                  disabled={busy}
                  className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50"
                >
                  {order ? "Add to Order" : "Place Order"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {pickerItem && (
        <VariantAddOnPicker item={pickerItem} basePrice={priceFor(pickerItem)} onCancel={() => setPickerItem(null)} onConfirm={(c) => addToCart(pickerItem, c)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Bill — shown once an order is fully paid (locked). Printable receipt;
// "Done" returns to the grid/order list.
// ─────────────────────────────────────────────────────────────────────────
function BillView({ order, restaurant, paid = true, onDone, onCancelBill }) {
  const paidLines = order.payments || [];

  function handlePrint() {
    const win = window.open("", "_blank", "width=380,height=600");
    if (!win) return;

    const itemsHtml = order.items
      .filter((i) => i.status !== "cancelled")
      .map(
        (i) => `
        <tr>
          <td style="padding:2px 0;">${i.quantity}× ${escapeHtml(i.name)}${
            i.selectedVariant?.label ? ` (${escapeHtml(i.selectedVariant.label)})` : ""
          }</td>
          <td style="padding:2px 0;text-align:right;">₹${(i.price * i.quantity).toFixed(2)}</td>
        </tr>`
      )
      .join("");

    const paymentsHtml = paid
      ? paidLines
          .map((p) => `<tr><td>${p.method.toUpperCase()}</td><td style="text-align:right;">₹${p.amount.toFixed(2)}</td></tr>`)
          .join("")
      : `<tr class="bold"><td>Amount Due</td><td style="text-align:right;">₹${order.amountDue.toFixed(2)}</td></tr>`;

    win.document.write(`
      <html>
        <head>
          <title>${order.orderNumber}</title>
          <style>
            body { font-family: 'Courier New', monospace; font-size: 13px; padding: 16px; color: #111; }
            h1 { font-size: 16px; margin: 0 0 2px; text-align: center; }
            p { margin: 2px 0; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .divider { border-top: 1px dashed #999; margin: 10px 0; }
            .totals td { padding: 2px 0; }
            .totals .label { text-align: left; }
            .totals .value { text-align: right; }
            .bold { font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(restaurant?.name || "Restaurant")}</h1>
          <p>${order.orderNumber}</p>
          <p>${new Date(order.createdAt || Date.now()).toLocaleString("en-IN")}</p>
          ${order.table ? `<p>Table: ${escapeHtml(order.table.name || order.table.tableNumber)}</p>` : ""}
          <div class="divider"></div>
          <table>${itemsHtml}</table>
          <div class="divider"></div>
          <table class="totals">
            <tr><td class="label">Subtotal</td><td class="value">₹${order.subtotal.toFixed(2)}</td></tr>
            ${order.discount ? `<tr><td class="label">Discount</td><td class="value">-₹${order.discount.toFixed(2)}</td></tr>` : ""}
            ${order.tax ? `<tr><td class="label">Tax</td><td class="value">₹${order.tax.toFixed(2)}</td></tr>` : ""}
            <tr class="bold"><td class="label">Total</td><td class="value">₹${order.total.toFixed(2)}</td></tr>
          </table>
          <div class="divider"></div>
          <table class="totals">${paymentsHtml}</table>
          <div class="divider"></div>
          <p>${paid ? "Thank you!" : "Payment pending"}</p>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div className="receipt-card rounded-sm px-5 pb-6 pt-8">
      <span className="receipt-notch left-6" />
      <div className="flex items-center justify-between">
        <div>
          <p className={`font-display text-lg ${paid ? "text-sage" : "text-saffron"}`}>
            {paid ? "Bill generated" : "Bill generated — payment pending"}
          </p>
          <p className="text-xs text-muted">
            {paid
              ? "This order is paid in full and can no longer be edited."
              : `₹${order.amountDue.toFixed(2)} still due — collect payment on the order card above.`}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${paid ? "bg-sage/10 text-sage" : "bg-saffron/10 text-saffron"}`}>
          {paid ? "PAID" : "DUE"}
        </span>
      </div>

      <div className="mt-4 rounded-sm border border-charcoal-lighter bg-charcoal-light p-4 font-mono text-xs text-cream">
        <p className="text-center font-display text-sm">{restaurant?.name || "Restaurant"}</p>
        <p className="text-center text-muted">{order.orderNumber}</p>
        <p className="text-center text-muted">{new Date(order.createdAt || Date.now()).toLocaleString("en-IN")}</p>
        <div className="my-2 border-t border-dashed border-charcoal-lighter" />
        {order.items.filter((i) => i.status !== "cancelled").map((i) => (
          <div key={i._id} className="flex justify-between py-0.5">
            <span>{i.quantity}× {i.name}{i.selectedVariant?.label ? ` (${i.selectedVariant.label})` : ""}</span>
            <span>₹{(i.price * i.quantity).toFixed(2)}</span>
          </div>
        ))}
        <div className="my-2 border-t border-dashed border-charcoal-lighter" />
        <div className="flex justify-between"><span>Subtotal</span><span>₹{order.subtotal.toFixed(2)}</span></div>
        {order.discount > 0 && <div className="flex justify-between"><span>Discount</span><span>-₹{order.discount.toFixed(2)}</span></div>}
        {order.tax > 0 && <div className="flex justify-between"><span>Tax</span><span>₹{order.tax.toFixed(2)}</span></div>}
        <div className="flex justify-between font-bold"><span>Total</span><span>₹{order.total.toFixed(2)}</span></div>
        <div className="my-2 border-t border-dashed border-charcoal-lighter" />
        {paid ? (
          paidLines.map((p) => (
            <div key={p._id} className="flex justify-between uppercase text-muted">
              <span>{p.method}</span><span>₹{p.amount.toFixed(2)}</span>
            </div>
          ))
        ) : (
          <div className="flex justify-between font-bold text-saffron">
            <span>Amount Due</span><span>₹{order.amountDue.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={handlePrint} className="rounded-sm border border-saffron px-4 py-2.5 text-sm font-medium text-saffron hover:bg-saffron hover:text-charcoal">
          Print Bill
        </button>
        <button onClick={onDone} className="rounded-sm bg-saffron px-4 py-2.5 text-sm font-medium text-charcoal hover:bg-saffron-dark">
          {paid ? "Done" : "Back to Order"}
        </button>
        {!paid && onCancelBill && (
          <button
            onClick={onCancelBill}
            className="rounded-sm border border-charcoal-lighter px-4 py-2.5 text-sm font-medium text-cream hover:border-brick hover:text-brick"
          >
            Cancel Bill
          </button>
        )}
      </div>
    </div>
  );
}

function escapeHtml(str = "") {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function VariantAddOnPicker({ item, basePrice, onCancel, onConfirm }) {
  const [variantLabel, setVariantLabel] = useState(item.variants?.[0]?.label || null);
  const [addOnNames, setAddOnNames] = useState([]);
  const variant = item.variants?.find((v) => v.label === variantLabel);
  const unitPrice = (variant ? variant.price : basePrice) + addOnNames.reduce((sum, name) => sum + (item.addOns.find((a) => a.name === name)?.price || 0), 0);

  function toggleAddOn(name) {
    setAddOnNames((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="receipt-card w-full max-w-sm rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <h3 className="font-display text-lg text-cream">{item.name}</h3>
        {item.variants?.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-muted">Size / Variant</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {item.variants.map((v) => (
                <button key={v.label} onClick={() => setVariantLabel(v.label)}
                  className={`rounded-sm border px-3 py-1.5 text-sm ${variantLabel === v.label ? "border-saffron text-saffron" : "border-charcoal-lighter text-muted"}`}>
                  {v.label} · ₹{v.price}
                </button>
              ))}
            </div>
          </div>
        )}
        {item.addOns?.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-muted">Add-ons</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {item.addOns.map((a) => (
                <button key={a.name} onClick={() => toggleAddOn(a.name)}
                  className={`rounded-sm border px-3 py-1.5 text-sm ${addOnNames.includes(a.name) ? "border-saffron text-saffron" : "border-charcoal-lighter text-muted"}`}>
                  {a.name} · +₹{a.price}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-cream">₹{unitPrice}</span>
          <div className="flex gap-2">
            <button onClick={onCancel} className="text-sm text-muted hover:text-cream">Cancel</button>
            <button onClick={() => onConfirm({ variantLabel, variantId: variant?._id, addOnNames, unitPrice })}
              className="rounded-sm bg-saffron px-3 py-1.5 text-sm font-medium text-charcoal hover:bg-saffron-dark">
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}