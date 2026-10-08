import PurchasesPanel from "../../../shared/pages/PurchasesPanel";
import { restaurantPurchases } from "../../../shared/api/purchasesApi";

export default function PurchasesSection() {
  return <PurchasesPanel api={restaurantPurchases} mode="ingredient" />;
}
