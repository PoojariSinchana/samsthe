import { useEffect, useState } from "react";
import { useAuth } from "../../../shared/context/AuthContext";
import { getOutlets } from "../../../shared/api/outlets";
import * as productsApi from "../api/productsApi";
import shopSales from "../api/shopSalesApi";
import { useShopSaleBuilder } from "../context/ShopSaleBuilderContext";

const ORDER_TYPE_LABEL = { unpaid: "Unpaid", billed_unpaid: "Bill Generated (Unpaid)", paid: "Paid", all: "All" };

export default function ShopPosSection({ onNavigate }) {
  const { isBuilding, startBuilder } = useShopSaleBuilder();
  const [outlets, setOutlets] = useState([]);
  const [outlet, setOutlet] = useState("");
  const [activeSaleId, setActiveSaleId] = useState(null);

  useEffect(() => {
    getOutlets()
      .then((res) => {
        const active = (res.outlets || []).filter((o) => o.isActive);
        setOutlets(active);
        if (active.length >= 1) setOutlet(active[0]._id);
      })
      .catch(() => {});
  }, []);

  function backToList() {
    setActiveSaleId(null);
  }

  if (isBuilding) {
    return <SaleBuilderPanel outlet={outlet} onNavigate={onNavigate} onDone={backToList} onCreated={(id) => setActiveSaleId(id)} />;
  }
  if (activeSaleId) {
    return <PosPanel outlet={outlet} saleId={activeSaleId} onBack={backToList} onDone={backToList} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-cream">Sales / POS</h1>
        <div className="flex items-center gap-3">
          {outlets.length > 1 && (
            <select
              value={outlet}
              onChange={(e) => setOutlet(e.target.value)}
              className="rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2 text-cream outline-none focus:border-saffron"
            >
              {outlets.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
            </select>
          )}
          <button
            onClick={() => { startBuilder(); }}
            className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark"
          >
            New Sale
          </button>
        </div>
      </div>

      <AllSalesTab outlet={outlet} onSelect={(id) => setActiveSaleId(id)} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// All Sales — every sale that needs attention or review, filterable by
// payment state, same category split as BillingSection's AllOrdersTab.
// ─────────────────────────────────────────────────────────────────────────
function AllSalesTab({ outlet, onSelect }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("unpaid");

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
      const data = await shopSales.getAll(params);
      setSales(data.sales.filter((s) => s.status !== "cancelled"));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load sales");
    } finally {
      setLoading(false);
    }
  }

  function matches(sale, key) {
    if (key === "paid") return sale.paymentStatus === "paid";
    if (key === "billed_unpaid") return sale.billGenerated && sale.paymentStatus !== "paid";
    if (key === "unpaid") return sale.paymentStatus !== "paid" && !sale.billGenerated;
    return true;
  }

  const CATEGORIES = ["unpaid", "billed_unpaid", "paid", "all"];
  const filtered = sales.filter((s) => matches(s, category));

  return (
    <div className="space-y-4">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Sale #, customer name, phone…"
        className="w-full max-w-md rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2 text-sm text-cream outline-none focus:border-saffron"
      />

      <div className="flex flex-wrap gap-2 border-b border-charcoal-lighter pb-3">
        {CATEGORIES.map((key) => (
          <button
            key={key}
            onClick={() => setCategory(key)}
            className={`rounded-sm border px-3 py-1.5 text-sm ${
              category === key ? "border-saffron text-saffron" : "border-charcoal-lighter text-muted hover:text-cream"
            }`}
          >
            {ORDER_TYPE_LABEL[key]}
            <span className="ml-1.5 text-xs text-muted">({sales.filter((s) => matches(s, key)).length})</span>
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-brick">{error}</p>}

      {loading ? (
        <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">No sales in this category.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((sale) => (
            <button key={sale._id} onClick={() => onSelect(sale._id)} className="receipt-card relative rounded-sm px-5 pb-5 pt-7 text-left">
              <span className="receipt-notch left-6" />
              <div className="flex items-center justify-between">
                <span className="font-medium text-cream">{sale.saleNumber}</span>
                <span className="text-xs capitalize text-muted">{sale.status}</span>
              </div>
              {sale.customer?.name && <p className="mt-1 text-sm text-muted">{sale.customer.name}</p>}
              <div className="mt-3 flex items-center justify-between border-t border-charcoal-lighter pt-3 text-sm">
                <span className="text-cream">₹{sale.total.toFixed(2)}</span>
                <span className={sale.amountDue > 0 ? "text-brick" : "text-sage"}>
                  {sale.amountDue > 0 ? `₹${sale.amountDue.toFixed(2)} due` : "Paid"}
                </span>
              </div>
              {sale.billGenerated && sale.paymentStatus !== "paid" && (
                <span className="mt-2 inline-block rounded-full bg-saffron/10 px-2 py-0.5 text-xs text-saffron">Bill generated</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sale Builder — details + cart, filled either by tapping products on the
// Products page (isBuilding drives that page's tap-to-add UI) or by
// scanning/typing a barcode/SKU right here.
// ─────────────────────────────────────────────────────────────────────────
function SaleBuilderPanel({ outlet, onNavigate, onDone, onCreated }) {
  const { details, setDetails, cart, removeLine, cartSubtotal, cartCount, cancelBuilder, submitSale, addScannedLine } = useShopSaleBuilder();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (outlet && !details.outlet) setDetails({ outlet });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlet]);

  async function handleLookup(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setError("");
    try {
      const res = await productsApi.lookupByCode(code.trim(), details.outlet || outlet);
      if (res.stock <= 0) {
        setError(`${res.product.name} is out of stock at this outlet`);
        return;
      }
      addScannedLine(res.product, res.variant, 1);
      setCode("");
    } catch (err) {
      setError(err.response?.data?.message || "No product found for that code");
    }
  }

  async function handleSubmit() {
    setError("");
    if (!details.outlet) return setError("Select an outlet");
    if (cart.length === 0) return setError("Add items via barcode or the Products tab");

    setSubmitting(true);
    try {
      const sale = await submitSale();
      cancelBuilder();
      onCreated(sale._id);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create sale");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-cream">New Sale</h1>
        <button onClick={() => { cancelBuilder(); onDone(); }} className="text-sm text-muted hover:text-cream">Cancel</button>
      </div>

      {error && <p className="text-sm text-brick">{error}</p>}

      <div className="receipt-card rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            placeholder="Customer name (optional)"
            value={details.customerName}
            onChange={(e) => setDetails({ customerName: e.target.value })}
            className="rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2 text-cream outline-none focus:border-saffron"
          />
          <input
            placeholder="Customer phone (optional)"
            value={details.customerPhone}
            onChange={(e) => setDetails({ customerPhone: e.target.value })}
            className="rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2 text-cream outline-none focus:border-saffron"
          />
        </div>

        <form onSubmit={handleLookup} className="mt-4 flex gap-2">
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Scan or type SKU / barcode…"
            className="flex-1 rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2 text-cream outline-none focus:border-saffron"
          />
          <button type="submit" className="rounded-sm border border-saffron px-4 py-2 text-sm font-medium text-saffron hover:bg-saffron hover:text-charcoal">
            Add
          </button>
        </form>

        <button
          onClick={() => onNavigate("products")}
          className="mt-4 w-full rounded-sm border border-charcoal-lighter px-4 py-2.5 text-sm text-cream hover:border-saffron"
        >
          Or browse Products to add items
        </button>
      </div>

      <div className="receipt-card rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <p className="font-medium text-cream">Cart</p>
        {cart.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No items yet — scan a code above or browse Products.</p>
        ) : (
          <ul className="mt-2 divide-y divide-charcoal-lighter">
            {cart.map((line) => (
              <li key={line.key} className="flex items-center justify-between py-2">
                <div>
                  <span className="text-cream">{line.quantity}× {line.name}</span>
                  <p className="text-xs text-muted">{line.sku}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted">₹{(line.unitPrice * line.quantity - (line.discount || 0)).toFixed(2)}</span>
                  <button onClick={() => removeLine(line.key)} className="text-xs text-brick hover:underline">Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex items-center justify-between border-t border-charcoal-lighter pt-3">
          <span className="font-medium text-cream">{cartCount} item{cartCount !== 1 ? "s" : ""} · ₹{cartSubtotal.toFixed(2)}</span>
          <button
            onClick={handleSubmit}
            disabled={submitting || cart.length === 0}
            className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create Sale"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Existing sale — payment, bill generation, printing. Mirrors
// BillingSection's PosPanel once an order exists, minus table concerns.
// ─────────────────────────────────────────────────────────────────────────
function PosPanel({ outlet, saleId, onBack, onDone }) {
  const { user, restaurant } = useAuth();
  const canCancel = ["owner", "manager"].includes(user.role);

  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showBill, setShowBill] = useState(false);

  const isLocked = sale && sale.status === "cancelled";
  const isPaid = sale && sale.paymentStatus === "paid";

  useEffect(() => {
    shopSales.getById(saleId).then((res) => setSale(res.sale)).finally(() => setLoading(false));
  }, [saleId]);

  async function handlePay(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await shopSales.addPayment(sale._id, { method: payMethod, amount: Number(payAmount) });
      setSale(res.sale);
      setPayAmount("");
    } catch (err) {
      setError(err.response?.data?.message || "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm("Cancel this sale? Unpaid items will be restocked.")) return;
    setBusy(true);
    try {
      await shopSales.cancel(sale._id);
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to cancel sale");
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateBill() {
    setShowBill(true);
    if (!sale.billGenerated) {
      try {
        const res = await shopSales.markBillGenerated(sale._id);
        setSale(res.sale);
      } catch {
        // non-fatal
      }
    }
  }

  if (loading || !sale) return <p className="text-muted">Loading sale…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-cream">{sale.saleNumber}</h1>
        <button onClick={onBack} className="text-sm text-muted hover:text-cream">← Back</button>
      </div>

      {error && <p className="text-sm text-brick">{error}</p>}

      <div className="receipt-card rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        {sale.customer?.name && <p className="text-sm text-cream">{sale.customer.name} {sale.customer.phone ? `· ${sale.customer.phone}` : ""}</p>}
        <ul className="mt-3 divide-y divide-charcoal-lighter">
          {sale.items.map((item) => (
            <li key={item._id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <span className={item.status === "returned" ? "text-muted line-through" : "text-cream"}>
                  {item.quantity}× {item.name}
                </span>
                <p className="text-xs text-muted">{item.sku}</p>
              </div>
              <span className="text-muted">₹{(item.price * item.quantity - (item.discount || 0)).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between font-medium text-cream"><span>Total</span><span>₹{sale.total.toFixed(2)}</span></div>
          <div className="flex justify-between text-sage"><span>Paid</span><span>₹{sale.amountPaid.toFixed(2)}</span></div>
          <div className="flex justify-between text-brick"><span>Due</span><span>₹{sale.amountDue.toFixed(2)}</span></div>
        </div>

        {!isLocked && (
          <button type="button" onClick={handleGenerateBill} className="mt-4 w-full rounded-sm border border-saffron px-4 py-2.5 text-sm font-medium text-saffron hover:bg-saffron hover:text-charcoal sm:w-auto">
            Generate Bill
          </button>
        )}

        {!isLocked && sale.amountDue > 0 && (
          <form onSubmit={handlePay} className="mt-4 flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted">Amount</label>
              <input type="number" min="0.01" step="0.01" max={sale.amountDue} value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)} required
                className="mt-1 w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2 text-cream outline-none focus:border-saffron" />
            </div>
            <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}
              className="rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2 text-cream outline-none focus:border-saffron">
              {["cash", "card", "upi", "wallet", "other"].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <button type="button" onClick={() => setPayAmount(sale.amountDue.toFixed(2))}
              className="rounded-sm border border-charcoal-lighter px-3 py-2 text-sm text-cream hover:border-saffron">
              Full
            </button>
            <button disabled={busy} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">
              Pay
            </button>
          </form>
        )}

        {canCancel && !isLocked && sale.amountPaid === 0 && (
          <button onClick={handleCancel} disabled={busy} className="mt-4 rounded-sm border border-brick px-4 py-2 text-sm font-medium text-brick hover:bg-brick/10 disabled:opacity-50">
            Cancel Sale
          </button>
        )}
      </div>

      {isPaid || showBill ? (
        <BillView sale={sale} restaurant={restaurant} paid={isPaid} onDone={isPaid ? onDone : () => setShowBill(false)} />
      ) : null}
    </div>
  );
}

function BillView({ sale, restaurant, paid, onDone }) {
  function handlePrint() {
    const win = window.open("", "_blank", "width=380,height=600");
    if (!win) return;
    const itemsHtml = sale.items
      .filter((i) => i.status !== "returned")
      .map((i) => `<tr><td style="padding:2px 0;">${i.quantity}× ${escapeHtml(i.name)}</td><td style="padding:2px 0;text-align:right;">₹${(i.price * i.quantity - (i.discount || 0)).toFixed(2)}</td></tr>`)
      .join("");
    const paymentsHtml = paid
      ? (sale.payments || []).map((p) => `<tr><td>${p.method.toUpperCase()}</td><td style="text-align:right;">₹${p.amount.toFixed(2)}</td></tr>`).join("")
      : `<tr class="bold"><td>Amount Due</td><td style="text-align:right;">₹${sale.amountDue.toFixed(2)}</td></tr>`;

    win.document.write(`
      <html><head><title>${sale.saleNumber}</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 13px; padding: 16px; color: #111; }
        h1 { font-size: 16px; margin: 0 0 2px; text-align: center; }
        p { margin: 2px 0; text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .divider { border-top: 1px dashed #999; margin: 10px 0; }
        .totals td { padding: 2px 0; } .bold { font-weight: bold; }
      </style></head>
      <body>
        <h1>${escapeHtml(restaurant?.name || "Shop")}</h1>
        <p>${sale.saleNumber}</p>
        <p>${new Date(sale.createdAt || Date.now()).toLocaleString("en-IN")}</p>
        <div class="divider"></div><table>${itemsHtml}</table><div class="divider"></div>
        <table class="totals">
          <tr><td>Subtotal</td><td style="text-align:right;">₹${sale.subtotal.toFixed(2)}</td></tr>
          ${sale.discount ? `<tr><td>Discount</td><td style="text-align:right;">-₹${sale.discount.toFixed(2)}</td></tr>` : ""}
          ${sale.tax ? `<tr><td>Tax</td><td style="text-align:right;">₹${sale.tax.toFixed(2)}</td></tr>` : ""}
          <tr class="bold"><td>Total</td><td style="text-align:right;">₹${sale.total.toFixed(2)}</td></tr>
        </table>
        <div class="divider"></div><table class="totals">${paymentsHtml}</table>
        <div class="divider"></div><p>${paid ? "Thank you!" : "Payment pending"}</p>
      </body></html>
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
          {!paid && <p className="text-xs text-muted">₹{sale.amountDue.toFixed(2)} still due — collect payment above.</p>}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${paid ? "bg-sage/10 text-sage" : "bg-saffron/10 text-saffron"}`}>
          {paid ? "PAID" : "DUE"}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={handlePrint} className="rounded-sm border border-saffron px-4 py-2.5 text-sm font-medium text-saffron hover:bg-saffron hover:text-charcoal">
          Print Bill
        </button>
        <button onClick={onDone} className="rounded-sm bg-saffron px-4 py-2.5 text-sm font-medium text-charcoal hover:bg-saffron-dark">
          {paid ? "Done" : "Back to Sale"}
        </button>
      </div>
    </div>
  );
}

function escapeHtml(str = "") {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}