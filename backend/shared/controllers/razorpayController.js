const crypto = require("crypto");
const Razorpay = require("razorpay");
const Invoice = require("../../modules/admin/models/Invoice");
const Subscription = require("../../modules/admin/models/Subscription");
const Payment = require("../../modules/admin/models/Payment");
const User = require("../models/User");
const { paidTotals, syncInvoice } = require("../../modules/admin/utils/billing");
const { fail, send } = require("../utils/httpError");

let client;
function rzp() {
  const { RAZORPAY_KEY_ID: id, RAZORPAY_KEY_SECRET: secret } = process.env;
  if (!id || !secret) throw fail(503, "Online payment isn't configured");
  return (client ||= new Razorpay({ key_id: id, key_secret: secret }));
}

const hmac = (secret, data) => crypto.createHmac("sha256", secret).update(data).digest("hex");
const safeEq = (a, b) => {
  const A = Buffer.from(a || ""), B = Buffer.from(b || "");
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};
const METHOD = { card: "card", upi: "upi", netbanking: "netbanking", wallet: "wallet", emi: "card" };

async function openInvoice(businessId) {
  const sub = await Subscription.findOne({ businessId });
  if (!sub) throw fail(409, "There's nothing to pay for");
  if (sub.status === "SUSPENDED") throw fail(403, "This account is suspended. Please contact support.");
  const invoice = await Invoice.findOne({ subscriptionId: sub._id, kind: "subscription", status: { $in: ["sent", "overdue"] } }).sort({ createdAt: -1 });
  if (!invoice) throw fail(404, "No open invoice found");
  const paid = (await paidTotals([invoice._id])).get(String(invoice._id)) || 0;
  return { invoice, paid, due: Math.max(invoice.total - paid, 0) };
}

// Shared by verify() and webhook(). Safe to call twice for the same payment.
async function recordCaptured(p) {
  if (await Payment.exists({ razorpayPaymentId: p.id })) return;
  const order = await rzp().orders.fetch(p.order_id);
  const { invoiceId, businessId } = order.notes || {};
  if (!invoiceId || !businessId) return;
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return;
  try {
    await Payment.create({
      businessId, invoiceId: invoice._id, subscriptionId: invoice.subscriptionId,
      amount: p.amount / 100, method: METHOD[p.method] || "other", status: "paid",
      paidAt: new Date((p.created_at || Date.now() / 1000) * 1000),
      gatewayReference: p.id, razorpayPaymentId: p.id, razorpayOrderId: p.order_id,
      notes: invoice.status === "cancelled"
        ? "Invoice was cancelled before this payment arrived: refund via Razorpay"
        : "Paid online via Razorpay",
    });
  } catch (e) {
    if (e.code === 11000) return; // the other path won the race
    throw e;
  }
  await syncInvoice(invoice._id); // marks invoice paid -> activates the subscription
}

// GET /api/business/me/pay/info
async function info(req, res) {
  try {
    const { invoice, paid, due } = await openInvoice(req.user.businessId);
    res.json({ invoiceNumber: invoice.invoiceNumber, total: invoice.total, paid, due });
  } catch (err) { send(res, err, "Couldn't load payment details"); }
}

// POST /api/business/me/pay/order
async function createOrder(req, res) {
  try {
    const { invoice, due } = await openInvoice(req.user.businessId);
    if (due < 1) throw fail(409, "This invoice is already paid");
    const order = await rzp().orders.create({
      amount: Math.round(due * 100), currency: "INR",
      receipt: invoice.invoiceNumber.slice(0, 40),
      notes: { invoiceId: String(invoice._id), businessId: String(req.user.businessId) },
    });
    const user = await User.findById(req.user._id, "name email phone").lean();
    res.status(201).json({
      keyId: process.env.RAZORPAY_KEY_ID, orderId: order.id, amount: order.amount, currency: order.currency,
      invoiceNumber: invoice.invoiceNumber,
      prefill: { name: user?.name, email: user?.email, contact: user?.phone },
    });
  } catch (err) { send(res, err, "Couldn't start the payment"); }
}

// POST /api/business/me/pay/verify
async function verify(req, res) {
  try {
    const { razorpay_order_id: oid, razorpay_payment_id: pid, razorpay_signature: sig } = req.body;
    if (!oid || !pid || !sig) throw fail(400, "Missing payment details");
    if (!safeEq(hmac(process.env.RAZORPAY_KEY_SECRET, `${oid}|${pid}`), sig)) throw fail(400, "Payment verification failed");

    const order = await rzp().orders.fetch(oid);
    if (String(order.notes?.businessId) !== String(req.user.businessId)) throw fail(403, "This payment doesn't belong to your business");

    let pay = await rzp().payments.fetch(pid);
    if (pay.order_id !== oid) throw fail(400, "Payment doesn't match the order");
    if (pay.status === "authorized") pay = await rzp().payments.capture(pid, pay.amount, pay.currency);
    if (pay.status !== "captured") throw fail(402, "Payment was not completed");

    await recordCaptured(pay);
    res.json({ ok: true });
  } catch (err) { send(res, err, "Couldn't verify the payment"); }
}

// POST /api/razorpay/webhook (raw body, no auth; the signature is the auth)
async function webhook(req, res) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !safeEq(hmac(secret, req.body), req.headers["x-razorpay-signature"])) return res.status(400).end();
  try {
    const evt = JSON.parse(req.body.toString());
    if (["payment.captured", "order.paid"].includes(evt.event)) {
      const p = evt.payload?.payment?.entity;
      if (p) await recordCaptured(p);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Razorpay webhook error:", err.message);
    res.status(500).end(); // Razorpay will retry
  }
}

module.exports = { info, createOrder, verify, webhook };