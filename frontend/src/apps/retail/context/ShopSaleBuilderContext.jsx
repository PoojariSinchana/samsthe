import { createContext, useContext, useState } from "react";
import shopSales from "../api/shopSalesApi";

const ShopSaleBuilderContext = createContext(null);

const emptyDetails = {
  outlet: "",
  customerName: "",
  customerPhone: "",
};

// Simpler than OrderBuilderContext's lineKey — retail cart lines are keyed
// by (product, variantId) only. No add-ons/order-type branching like the
// restaurant menu; a variant IS the full configuration.
function lineKey(productId, variantId) {
  return `${productId}::${variantId}`;
}

export function ShopSaleBuilderProvider({ children }) {
  const [isBuilding, setIsBuilding] = useState(false);
  const [details, setDetailsState] = useState(emptyDetails);
  const [cart, setCart] = useState([]);

  function startBuilder() {
    setIsBuilding(true);
  }

  function cancelBuilder() {
    setIsBuilding(false);
    setCart([]);
    setDetailsState(emptyDetails);
  }

  function setDetails(partial) {
    setDetailsState((prev) => ({ ...prev, ...partial }));
  }

  // Adds/removes one unit of a (product, variant) line — the +/- stepper
  // pattern used by MenuSection's quick-add, adapted for a flat SKU list
  // instead of variant/add-on options.
  function addToCart(product, variant, delta = 1) {
    setCart((prev) => {
      const key = lineKey(product._id, variant._id);
      const existing = prev.find((line) => line.key === key);
      if (existing) {
        const nextQty = existing.quantity + delta;
        if (nextQty <= 0) return prev.filter((line) => line.key !== key);
        return prev.map((line) => (line.key === key ? { ...line, quantity: nextQty } : line));
      }
      if (delta <= 0) return prev;
      const attrLabel = (variant.attributes || []).map((a) => a.value).join("/");
      return [
        ...prev,
        {
          key,
          product: product._id,
          variantId: variant._id,
          sku: variant.sku,
          name: attrLabel ? `${product.name} — ${attrLabel}` : product.name,
          unitPrice: variant.price,
          quantity: delta,
          discount: 0,
        },
      ];
    });
  }

  // Adds a scanned/looked-up item directly at a given quantity (used by the
  // barcode-scan flow in the POS page, where the item may not already be
  // "in view" the way a product grid tile is).
  function addScannedLine(product, variant, quantity = 1) {
    addToCart(product, variant, quantity);
  }

  function qtyFor(productId, variantId) {
    const key = lineKey(productId, variantId);
    return cart.find((line) => line.key === key)?.quantity || 0;
  }

  function updateLineDiscount(key, discount) {
    setCart((prev) => prev.map((line) => (line.key === key ? { ...line, discount: Number(discount) || 0 } : line)));
  }

  function removeLine(key) {
    setCart((prev) => prev.filter((line) => line.key !== key));
  }

  function clearCart() {
    setCart([]);
  }

  const cartSubtotal = cart.reduce((sum, l) => sum + (l.unitPrice * l.quantity - (l.discount || 0)), 0);
  const cartCount = cart.reduce((sum, l) => sum + l.quantity, 0);

  async function submitSale() {
    const payload = {
      outlet: details.outlet,
      customer: { name: details.customerName, phone: details.customerPhone },
      items: cart.map((l) => ({
        product: l.product,
        variantId: l.variantId,
        quantity: l.quantity,
        discount: l.discount || 0,
      })),
    };
    const { sale } = await shopSales.create(payload);
    return sale;
  }

  return (
    <ShopSaleBuilderContext.Provider
      value={{
        isBuilding,
        startBuilder,
        cancelBuilder,
        details,
        setDetails,
        cart,
        addToCart,
        addScannedLine,
        qtyFor,
        updateLineDiscount,
        removeLine,
        clearCart,
        cartSubtotal,
        cartCount,
        submitSale,
      }}
    >
      {children}
    </ShopSaleBuilderContext.Provider>
  );
}

export function useShopSaleBuilder() {
  const ctx = useContext(ShopSaleBuilderContext);
  if (!ctx) throw new Error("useShopSaleBuilder must be used within ShopSaleBuilderProvider");
  return ctx;
}