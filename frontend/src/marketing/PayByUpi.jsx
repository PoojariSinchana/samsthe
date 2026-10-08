import { useCallback, useEffect, useState } from "react";
import api from "../shared/api/axios";

const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

function loadCheckout() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function PayByUpi({ refresh }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const load = useCallback(async () => {
    try { setInfo((await api.get("/business/me/pay/info")).data); }
    catch { setInfo(null); }
  }, []);

  // Backup for the case where the webhook activates the plan after the tab was closed/refreshed
  useEffect(() => {
    load();
    const t = setInterval(() => { load(); refresh?.(); }, 15000);
    return () => clearInterval(t);
  }, [load, refresh]);

  async function pay() {
    setError("");
    setBusy(true);
    try {
      if (!(await loadCheckout())) throw new Error("Couldn't load the payment window. Check your connection.");
      const { data: o } = await api.post("/business/me/pay/order");

      const rz = new window.Razorpay({
        key: o.keyId,
        order_id: o.orderId,
        amount: o.amount,
        currency: o.currency,
        name: "Samsthe",
        description: `Invoice ${o.invoiceNumber}`,
        prefill: o.prefill,
        theme: { color: "#2563eb" },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (resp) => {
          setVerifying(true);
          try {
            await api.post("/business/me/pay/verify", resp);
            await refresh?.(); // needsPlan flips to false -> ChoosePlan redirects into the app
          } catch (err) {
            setError(err.response?.data?.message || "We received your payment but couldn't confirm it yet. It will activate shortly; if not, contact support.");
          } finally {
            setVerifying(false);
            setBusy(false);
            load();
          }
        },
      });
      rz.on("payment.failed", (r) => {
        setError(r.error?.description || "Payment failed. You can try again.");
        setBusy(false);
      });
      rz.open();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Couldn't start the payment.");
      setBusy(false);
    }
  }

  if (!info) return null;

  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm text-muted">
        Invoice {info.invoiceNumber} · Total {rupees(info.total)}
        {info.paid > 0 && <> · Received {rupees(info.paid)}. <b>Remaining {rupees(info.due)}.</b></>}
      </p>

      {verifying ? (
        <p className="text-sm text-saffron">Confirming your payment…</p>
      ) : (
        <button onClick={pay} disabled={busy}
          className="rounded-sm bg-saffron px-5 py-2.5 text-sm font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">
          {busy ? "Opening payment…" : `Pay ${rupees(info.due)}`}
        </button>
      )}
      <p className="text-xs text-muted">Secured by Razorpay. UPI, cards, net banking and wallets are accepted.</p>
      {error && <p role="alert" className="text-sm text-brick">{error}</p>}
    </div>
  );
}