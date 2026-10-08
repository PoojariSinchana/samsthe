import { createContext, useContext, useState } from "react";
import ordersApi from "../api/orders";

const OrderBuilderContext = createContext(null);

const emptyDetails = {
  orderType: "dineIn",
  outlet: "",
  table: "",
  guestCount: "",
  customerName: "",
  customerPhone: "",
  deliveryAddress: "",
};

// Two cart lines with the same menu item but a different variant/add-on
// combination are genuinely different lines, not the same line at a
// different quantity — this key makes that distinction.
function lineKey(menuItemId, variantLabel, addOnNames) {
  return `${menuItemId}::${variantLabel || ""}::${[...(addOnNames || [])].sort().join(",")}`;
}

function computeUnitPrice(item, orderType, variantLabel, addOnNames) {
  let unitPrice;
  if (variantLabel) {
    const variant = (item.variants || []).find((v) => v.label === variantLabel);
    unitPrice = variant ? variant.price : item.price;
  } else {
    unitPrice = item.pricingByOrderType?.[orderType] ?? item.price;
  }
  for (const addOnName of addOnNames || []) {
    const addOn = (item.addOns || []).find((a) => a.name === addOnName);
    if (addOn) unitPrice += addOn.price;
  }
  return unitPrice;
}

export function OrderBuilderProvider({ children }) {
  const [isBuilding, setIsBuilding] = useState(false);
  const [details, setDetailsState] = useState(emptyDetails);
  const [cart, setCart] = useState([]);
  const [editingOrderId, setEditingOrderId] = useState(null);

  function startBuilder() {
    setIsBuilding(true);
  }

  function cancelBuilder() {
    setIsBuilding(false);
    setCart([]);
    setDetailsState(emptyDetails);
    setEditingOrderId(null);
  }

  function setDetails(partial) {
    setDetailsState((prev) => ({ ...prev, ...partial }));
  }

  // Loads an existing PENDING order into the builder for editing.
  function startEditingOrder(order) {
    setDetailsState({
      orderType: order.orderType,
      outlet: order.outlet,
      table: order.table?._id || order.table || "",
      guestCount: order.guestCount || "",
      customerName: order.customer?.name || "",
      customerPhone: order.customer?.phone || "",
      deliveryAddress: order.deliveryAddress || "",
    });
    setCart(
      order.items.map((line) => ({
        key: lineKey(line.menuItem, line.selectedVariant?.label, (line.addOns || []).map((a) => a.name)),
        menuItem: line.menuItem,
        name: line.name,
        variantLabel: line.selectedVariant?.label || "",
        addOnNames: (line.addOns || []).map((a) => a.name),
        unitPrice: line.price,
        quantity: line.quantity,
        notes: line.notes || "",
      }))
    );
    setEditingOrderId(order._id);
    setIsBuilding(true);
  }

  // Quick-add for items with NO variants/add-ons — plain +/- stepper.
  function addToCart(item, delta = 1) {
    setCart((prev) => {
      const key = lineKey(item._id, "", []);
      const existing = prev.find((line) => line.key === key);
      if (existing) {
        const nextQty = existing.quantity + delta;
        if (nextQty <= 0) return prev.filter((line) => line.key !== key);
        return prev.map((line) => (line.key === key ? { ...line, quantity: nextQty } : line));
      }
      if (delta <= 0) return prev;
      const unitPrice = computeUnitPrice(item, details.orderType, "", []);
      return [...prev, { key, menuItem: item._id, name: item.name, variantLabel: "", addOnNames: [], unitPrice, quantity: delta, notes: "" }];
    });
  }

  function qtyFor(itemId) {
    const key = lineKey(itemId, "", []);
    return cart.find((line) => line.key === key)?.quantity || 0;
  }

  // Adds a configured line (variant and/or add-ons chosen) — used by the
  // inline options panel for items that have variants/add-ons. The same
  // exact configuration adds to that line's quantity; a different
  // configuration of the same item becomes its own separate line.
  function addConfiguredLine(item, { variantLabel = "", addOnNames = [], quantity = 1, notes = "" }) {
    setCart((prev) => {
      const key = lineKey(item._id, variantLabel, addOnNames);
      const existing = prev.find((line) => line.key === key);
      if (existing) {
        return prev.map((line) => (line.key === key ? { ...line, quantity: line.quantity + quantity } : line));
      }
      const unitPrice = computeUnitPrice(item, details.orderType, variantLabel, addOnNames);
      return [...prev, { key, menuItem: item._id, name: item.name, variantLabel, addOnNames, unitPrice, quantity, notes }];
    });
  }

  function removeLine(key) {
    setCart((prev) => prev.filter((line) => line.key !== key));
  }

  function clearCart() {
    setCart([]);
  }

  const cartTotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const cartCount = cart.reduce((sum, l) => sum + l.quantity, 0);

  // Creates a new order, or saves edits to a pending one, depending on
  // whether we're in edit mode. Single source of truth for the payload
  // shape, so OrderSection doesn't have to build it twice.
  async function submitOrder() {
    const payload = {
      outlet: details.outlet,
      orderType: details.orderType,
      table: details.orderType === "dineIn" ? details.table : undefined,
      guestCount: details.orderType === "dineIn" && details.guestCount ? Number(details.guestCount) : undefined,
      customer: { name: details.customerName, phone: details.customerPhone },
      deliveryAddress: details.orderType === "delivery" ? details.deliveryAddress : undefined,
      items: cart.map((l) => ({
        menuItem: l.menuItem,
        variantLabel: l.variantLabel || undefined,
        variantId: l.variantId,
        addOnNames: l.addOnNames.length ? l.addOnNames : undefined,
        quantity: l.quantity,
        notes: l.notes,
      })),
    };

    if (editingOrderId) {
      const { order } = await ordersApi.updateItems(editingOrderId, payload);
      return order;
    }
    const { order } = await ordersApi.create(payload);
    return order;
  }

  return (
    <OrderBuilderContext.Provider
      value={{
        isBuilding,
        startBuilder,
        cancelBuilder,
        startEditingOrder,
        editingOrderId,
        details,
        setDetails,
        cart,
        addToCart,
        qtyFor,
        addConfiguredLine,
        removeLine,
        clearCart,
        cartTotal,
        cartCount,
        submitOrder,
      }}
    >
      {children}
    </OrderBuilderContext.Provider>
  );
}

export function useOrderBuilder() {
  const ctx = useContext(OrderBuilderContext);
  if (!ctx) throw new Error("useOrderBuilder must be used within OrderBuilderProvider");
  return ctx;
}