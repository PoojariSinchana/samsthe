import ReportsPanel from "../../../shared/pages/ReportsPanel";
import ordersApi from "../api/orders";

const fetchPayments = (params) => ordersApi.getPaymentsReport(params);

export default function ReportsSection() {
  return <ReportsPanel fetchPayments={fetchPayments} />;
}
