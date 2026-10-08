import PurchasesPanel from "../../../shared/pages/PurchasesPanel";
import { shopPurchases } from "../../../shared/api/purchasesApi";
import * as productsApi from "../api/productsApi";

// Flattens products into one pickable option per variant (SKU).
async function loadVariants() {
  const { products } = await productsApi.getProducts({});
  return products
    .filter((p) => p.isActive !== false)
    .flatMap((p) =>
      p.variants.map((v) => {
        const attrs = (v.attributes || []).map((a) => a.value).join("/");
        return { value: `${p._id}|${v._id}`, label: `${p.name}${attrs ? ` — ${attrs}` : ""} (${v.sku})`, costPrice: v.costPrice };
      })
    );
}

export default function PurchasesSection() {
  return <PurchasesPanel api={shopPurchases} mode="variant" loadVariants={loadVariants} />;
}
