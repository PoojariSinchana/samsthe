import ReportsPanel from "../../../shared/pages/ReportsPanel";
import shopSales from "../api/shopSalesApi";

const fetchPayments = (params) => shopSales.getPaymentsReport(params);

export default function ShopReportsSection() {
  return <ReportsPanel fetchPayments={fetchPayments} />;
}
