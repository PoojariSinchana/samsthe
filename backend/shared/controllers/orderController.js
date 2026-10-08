const mongoose = require("mongoose");
const Order = require("../models/Order");
const Item = require("../models/Item");
const Customer = require("../models/Customer");
const StockLevel = require("../models/StockLevel");
const Entry = require("../models/Entry");                    // existing model, after restaurantId -> businessId rename
const Outlet = require("../models/Outlet");
const Table = require("../../modules/restaurant/models/Table");
const { postEntry } = require("./accountingController");
const { recordMovement } = require("../services/stockService");
const { resolveOutletFilter } = require("../middleware/permissionMiddleware");

const CLEANING_MINUTES = 5;
const PAYMENT_TO_ENTRY_METHOD = { cash: "cash", card: "card", upi: "upi", wallet: "upi", other: "bank" };
const ENTRY_CATEGORY = { counter: "PRODUCT_SALES", delivery: "DELIVERY_SALES", dineIn: "FOOD_SALES", takeaway: "FOOD_SALES" };
const escapeRe = (s) => s.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const fail = (status, message) => Object.assign(new Error(message), { status });

async function assertOutlet(outletId, businessId) {
  if (!outletId || !(await Outlet.exists({ _id: outletId, businessId }))) throw fail(400, "Invalid outlet for this business");
}

async function nextNumber(businessId, outletId, channel) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const n = await Order.countDocuments({ businessId, outletId, channel: channel === "counter" ? "counter" : { $ne: "counter" }, createdAt: { $gte: start } });
  return `${channel === "counter" ? "SALE" : "ORD"}-${String(n + 1).padStart(4, "0")}`;
}

// Turns { itemId, variantId?, addOnNames?, quantity, discount?, notes? } into priced, snapshotted lines.
// ONE pricing function for create / add-items / replace-items.
async function resolveLines(input, { businessId, outletId, channel }) {
  const lines = [];
  for (const l of input) {
    const item = await Item.findOne({ _id: l.itemId, businessId, isActive: true, type: { $in: ["menu", "product"] } });
    if (!item) throw fail(400, `Invalid item: ${l.itemId}`);
    if (!item.isAvailable) throw fail(400, `${item.name} is currently unavailable`);

    const variant = l.variantId ? item.variants.id(l.variantId) : item.variants.find((v) => v.isDefault) || item.variants[0];
    if (!variant || variant.isActive === false) throw fail(400, `Invalid or unavailable variant for ${item.name}`);

    // A dish with only its auto-created "Regular" variant can have per-channel pricing.
    const single = item.variants.length === 1;
    const basePrice = item.type === "menu" && single ? item.menu?.pricingByOrderType?.[channel] ?? variant.price : variant.price;

    let unitPrice = basePrice;
    const addOns = [];
    for (const name of l.addOnNames || []) {
      const a = (item.menu?.addOns || []).find((x) => x.name === name && x.isActive !== false);
      if (!a) throw fail(400, `Invalid add-on "${name}" for ${item.name}`);
      addOns.push({ name: a.name, price: a.price });
      unitPrice += a.price;
    }

    const quantity = Number(l.quantity) || 1;
    if (item.type === "product") {
      const s = await StockLevel.findOne({ businessId, outletId, itemId: item._id, variantId: variant._id });
      if ((s?.currentStock ?? 0) < quantity) throw fail(400, `Insufficient stock for ${item.name} (${variant.sku || variant.label}), only ${s?.currentStock ?? 0} available`);
    }

    const attr = (variant.attributes || []).map((a) => a.value).join("/");
    lines.push({
      itemId: item._id, variantId: variant._id,
      name: item.type === "product" && attr ? `${item.name} — ${attr}` : item.name,
      sku: variant.sku, variantLabel: !single || item.type === "product" ? variant.label : undefined,
      basePrice, addOns, price: unitPrice, quantity, discount: Number(l.discount) || 0, notes: l.notes || "",
      _tracksStock: item.type === "product",
    });
  }
  return lines;
}

const stripInternal = (lines) => lines.map(({ _tracksStock, ...l }) => l);

async function moveStock(order, lines, direction, reason, userId) {
  const done = [];
  try {
    for (const l of lines) {
      if (!l._tracksStock && !l.tracksStock) continue;
      await recordMovement({
        businessId: order.businessId, outletId: order.outletId, itemId: l.itemId, variantId: l.variantId,
        type: direction === "out" ? "OUT" : "IN", quantity: direction === "out" ? -l.quantity : l.quantity,
        reason, refType: "order", refId: order._id, performedBy: userId,
      });
      done.push(l);
    }
  } catch (err) {
    for (const l of done) {                                  // compensate what already moved
      await recordMovement({
        businessId: order.businessId, outletId: order.outletId, itemId: l.itemId, variantId: l.variantId,
        type: direction === "out" ? "IN" : "OUT", quantity: direction === "out" ? l.quantity : -l.quantity,
        reason: "Rollback", refType: "order", refId: order._id, performedBy: userId,
      }).catch(() => {});
    }
    throw err;
  }
}

async function resolveCustomer(businessId, customer) {
  const phone = customer?.phone?.trim();
  if (!phone) return undefined;
  return (await Customer.findOne({ businessId, phone, isActive: true }, "_id"))?._id;
}

const startTableCleaning = (id) => id && Table.findByIdAndUpdate(id, { status: "CLEANING", cleaningUntil: new Date(Date.now() + CLEANING_MINUTES * 60000), currentOrder: null });
const freeTable = (id) => id && Table.findByIdAndUpdate(id, { status: "AVAILABLE", cleaningUntil: null, currentOrder: null });
const send = (res, err, fallback) => res.status(err.status || 500).json({ message: err.status ? err.message : fallback, ...(err.status ? {} : { error: err.message }) });

const orderController = {
  async createOrder(req, res) {
    const { businessId } = req.user;
    let claimed;
    try {
      const { outletId, channel, tableId, guestCount, customer, deliveryAddress, lines, discount, tax, notes } = req.body;
      if (!Order.CHANNELS.includes(channel)) throw fail(400, "Invalid channel");
      if (!Array.isArray(lines) || !lines.length) throw fail(400, "Order must have at least one item");
      await assertOutlet(outletId, businessId);

      if (channel === "dineIn") {
        if (!tableId) throw fail(400, "Table is required for dine-in orders");
        const t = await Table.findOne({ _id: tableId, outlet: outletId, businessId, isActive: true });
        if (!t) throw fail(400, "Invalid table for this outlet");
        if (guestCount && guestCount > t.capacity) throw fail(400, `Table ${t.name || t.tableNumber} seats up to ${t.capacity} guests`);
        // Atomic check-and-claim: don't replace with a plain update (reintroduces the double-seating race).
        claimed = await Table.findOneAndUpdate({ _id: tableId, status: "AVAILABLE" }, { status: "OCCUPIED" }, { new: true });
        if (!claimed) throw fail(409, `Table ${t.name || t.tableNumber} was just taken, pick another table`);
      }
      if (channel === "delivery" && !deliveryAddress) throw fail(400, "Delivery address is required for delivery orders");

      const resolved = await resolveLines(lines, { businessId, outletId, channel });
      const order = new Order({
        businessId, outletId, number: await nextNumber(businessId, outletId, channel), channel,
        tableId: channel === "dineIn" ? tableId : undefined, guestCount: channel === "dineIn" ? guestCount : undefined,
        customerId: await resolveCustomer(businessId, customer),
        customerSnapshot: { name: customer?.name || "", phone: customer?.phone || "" },
        deliveryAddress: channel === "delivery" ? deliveryAddress : "",
        lines: stripInternal(resolved), discount: discount || 0, tax: tax || 0, notes: notes || "",
        status: channel === "counter" ? "completed" : "pending",   // counter sales have no kitchen stage
        createdBy: req.user._id,
      });
      order.recalculate();
      await order.save();

      try {
        await moveStock(order, resolved, "out", "Sale", req.user._id);
      } catch (err) {
        await Order.deleteOne({ _id: order._id });
        throw err;
      }
      if (claimed) await Table.findByIdAndUpdate(claimed._id, { currentOrder: order._id });

      res.status(201).json({ message: "Order created", order });
    } catch (err) {
      if (claimed) await freeTable(claimed._id);
      send(res, err, "Failed to create order");
    }
  },

  // Add lines to an order that's already placed (mid-meal extras). Counter sales are fixed once created.
  async addItems(req, res) {
    try {
      const order = await Order.findOne({ _id: req.params.id, businessId: req.user.businessId });
      if (!order) throw fail(404, "Order not found");
      if (order.channel === "counter") throw fail(400, "Counter sales can't be extended, create a new sale");
      if (["completed", "cancelled"].includes(order.status)) throw fail(400, "Cannot add items to a completed or cancelled order");
      if (!req.body.lines?.length) throw fail(400, "At least one item is required");

      const resolved = await resolveLines(req.body.lines, { businessId: order.businessId, outletId: order.outletId, channel: order.channel });
      order.lines.push(...stripInternal(resolved));
      if (["ready", "served"].includes(order.status)) order.status = "preparing";
      order.recalculate();
      await order.save();
      res.status(201).json({ message: "Items added", order });
    } catch (err) { send(res, err, "Failed to add items"); }
  },

  // Replace the whole line list, only while the kitchen hasn't started.
  async replaceLines(req, res) {
    try {
      const order = await Order.findOne({ _id: req.params.id, businessId: req.user.businessId });
      if (!order) throw fail(404, "Order not found");
      if (order.status !== "pending" || order.channel === "counter") throw fail(400, "Only a pending order (not yet started by the kitchen) can be edited");
      const { lines, discount, tax, notes, guestCount } = req.body;
      if (lines) {
        if (!Array.isArray(lines) || !lines.length) throw fail(400, "Order must have at least one item");
        order.lines = stripInternal(await resolveLines(lines, { businessId: order.businessId, outletId: order.outletId, channel: order.channel }));
      }
      if (discount !== undefined) order.discount = discount;
      if (tax !== undefined) order.tax = tax;
      if (notes !== undefined) order.notes = notes;
      if (guestCount !== undefined && order.channel === "dineIn") {
        const t = order.tableId && (await Table.findById(order.tableId));
        if (t && guestCount > t.capacity) throw fail(400, `Table ${t.name || t.tableNumber} seats up to ${t.capacity} guests`);
        order.guestCount = guestCount;
      }
      order.recalculate();
      await order.save();
      res.json({ message: "Order updated", order });
    } catch (err) { send(res, err, "Failed to update order"); }
  },

  async getOrders(req, res) {
    try {
      const { outlet, status, channel, from, to, search, paymentStatus, page = 1, limit = 20 } = req.query;
      let scope;
      try { scope = resolveOutletFilter(req, outlet, "outletId"); }
      catch (e) { throw fail(e.status || 403, e.message); }
      const filter = { businessId: req.user.businessId, ...scope };
      if (outlet) filter.outletId = outlet;
      if (status) filter.status = status;
      if (channel) filter.channel = channel;
      if (paymentStatus) filter.paymentStatus = paymentStatus;
      if (from || to) filter.createdAt = { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to) }) };
      if (search) {
        const re = new RegExp(escapeRe(search), "i");
        filter.$or = [{ number: re }, { "customerSnapshot.name": re }, { "customerSnapshot.phone": re }];
      }
      const p = Math.max(1, parseInt(page, 10) || 1);
      const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const [orders, total] = await Promise.all([
        Order.find(filter).populate("tableId", "name tableNumber capacity").populate("createdBy", "name role").sort({ createdAt: -1 }).skip((p - 1) * l).limit(l),
        Order.countDocuments(filter),
      ]);
      res.json({ orders, total, page: p, pages: Math.max(1, Math.ceil(total / l)) });
    } catch (err) { send(res, err, "Failed to fetch orders"); }
  },

  async getOrderById(req, res) {
    try {
      const order = await Order.findOne({ _id: req.params.id, businessId: req.user.businessId })
        .populate("tableId", "name tableNumber capacity").populate("createdBy", "name role").populate("payments.receivedBy", "name");
      if (!order) throw fail(404, "Order not found");
      res.json({ order });
    } catch (err) { send(res, err, "Failed to fetch order"); }
  },

  async updateOrderStatus(req, res) {
    try {
      const { status } = req.body;
      if (!["pending", "preparing", "ready", "served", "completed", "cancelled"].includes(status)) throw fail(400, "Invalid status");
      const order = await Order.findOne({ _id: req.params.id, businessId: req.user.businessId });
      if (!order) throw fail(404, "Order not found");
      if (status === "cancelled") throw fail(400, "Use the cancel endpoint to cancel an order");
      order.status = status;
      await order.save();
      if (status === "completed" && order.channel === "dineIn") await startTableCleaning(order.tableId);
      res.json({ message: "Order status updated", order });
    } catch (err) { send(res, err, "Failed to update order status"); }
  },

  // Kitchen: per-line status. Order status is derived from its active lines.
  async updateLineStatus(req, res) {
    try {
      const { status } = req.body;
      if (!["pending", "preparing", "ready", "served", "cancelled"].includes(status)) throw fail(400, "Invalid line status");
      const order = await Order.findOne({ _id: req.params.id, businessId: req.user.businessId });
      if (!order) throw fail(404, "Order not found");
      const line = order.lines.id(req.params.lineId);
      if (!line) throw fail(404, "Line not found on this order");
      line.status = status;
      const active = order.lines.map((x) => x.status).filter((s) => !["cancelled", "returned"].includes(s));
      if (active.length && active.every((s) => s === "ready")) order.status = "ready";
      else if (active.some((s) => s === "preparing")) order.status = "preparing";
      order.recalculate();
      await order.save();
      res.json({ message: "Line status updated", order });
    } catch (err) { send(res, err, "Failed to update line status"); }
  },

  async addPayment(req, res) {
    try {
      const { method, amount } = req.body;
      if (!method || !(amount > 0)) throw fail(400, "Valid method and amount are required");
      const order = await Order.findOne({ _id: req.params.id, businessId: req.user.businessId });
      if (!order) throw fail(404, "Order not found");
      if (order.status === "cancelled") throw fail(400, "Cannot pay a cancelled order");
      if (amount > order.amountDue + 0.01) throw fail(400, `Amount exceeds the balance due (₹${order.amountDue.toFixed(2)})`);

      order.payments.push({ method, amount, receivedBy: req.user._id });
      const payment = order.payments[order.payments.length - 1];
      order.recalculate();
      if (order.paymentStatus === "paid" && order.status !== "completed") order.status = "completed";
      await order.save();
      if (order.status === "completed" && order.channel === "dineIn") await startTableCleaning(order.tableId);

      // Every payment becomes an INCOME Entry (unique on businessId+paymentId, so retries can't double-count).
      try {
        const entry = await Entry.create({
          businessId: order.businessId, outlet: order.outletId, entryType: "INCOME", category: ENTRY_CATEGORY[order.channel],
          description: `${order.channel === "counter" ? "Sale" : "Order"} ${order.number} payment`, amount,
          paymentMethod: PAYMENT_TO_ENTRY_METHOD[method] || "cash", date: payment.paidAt,
          source: "ORDER", orderId: order._id, paymentId: payment._id, createdBy: req.user._id,
        });
        await postEntry(entry);
      } catch (e) {
        if (e.code !== 11000) console.error("Accounting auto-post failed for payment", payment._id, e.message);
      }
      res.status(201).json({ message: "Payment recorded", order });
    } catch (err) { send(res, err, "Failed to record payment"); }
  },

  async markBillGenerated(req, res) {
    try {
      const order = await Order.findOneAndUpdate({ _id: req.params.id, businessId: req.user.businessId }, { billGenerated: true }, { new: true });
      if (!order) throw fail(404, "Order not found");
      res.json({ message: "Bill marked as generated", order });
    } catch (err) { send(res, err, "Failed to update order"); }
  },

  // Shop returns: restock and exclude the lines from totals. Refunding money stays a deliberate manual step.
  async returnLines(req, res) {
    try {
      const { lineIds } = req.body;
      if (!Array.isArray(lineIds) || !lineIds.length) throw fail(400, "lineIds is required");
      const order = await Order.findOne({ _id: req.params.id, businessId: req.user.businessId });
      if (!order) throw fail(404, "Order not found");

      const returned = [];
      for (const id of lineIds) {
        const line = order.lines.id(id);
        if (!line || line.status === "returned") continue;
        line.status = "returned";
        const item = await Item.findById(line.itemId, "type");
        returned.push({ itemId: line.itemId, variantId: line.variantId, quantity: line.quantity, tracksStock: item?.type === "product" });
      }
      order.recalculate();
      await order.save();
      await moveStock(order, returned, "in", "Return", req.user._id);
      res.json({ message: "Items returned", order });
    } catch (err) { send(res, err, "Failed to process return"); }
  },

  async cancelOrder(req, res) {
    try {
      const order = await Order.findOne({ _id: req.params.id, businessId: req.user.businessId });
      if (!order) throw fail(404, "Order not found");
      if (order.status === "cancelled") throw fail(400, "Order is already cancelled");
      if (order.channel === "counter" && order.amountPaid > 0) throw fail(400, "Cannot cancel a sale with payments recorded, process a return instead");

      if (order.channel === "counter") {
        const items = await Item.find({ _id: { $in: order.lines.map((l) => l.itemId) } }, "type");
        const tracked = new Set(items.filter((i) => i.type === "product").map((i) => String(i._id)));
        const restock = order.lines.filter((l) => l.status !== "returned").map((l) => ({ itemId: l.itemId, variantId: l.variantId, quantity: l.quantity, tracksStock: tracked.has(String(l.itemId)) }));
        await moveStock(order, restock, "in", "Sale cancelled", req.user._id);
      }
      order.status = "cancelled";
      await order.save();
      if (order.channel === "dineIn") await freeTable(order.tableId);   // nothing served, no cleaning buffer
      res.json({ message: "Order cancelled", order });
    } catch (err) { send(res, err, "Failed to cancel order"); }
  },

  // Flat ledger of every payment, for cash-drawer reconciliation.
  async getPaymentsReport(req, res) {
    try {
      const { outlet, method, from, to, channel } = req.query;
      const match = { businessId: new mongoose.Types.ObjectId(req.user.businessId) };
      if (outlet) match.outletId = new mongoose.Types.ObjectId(outlet);
      if (channel) match.channel = channel;

      const pm = {};
      if (method) pm["payments.method"] = method;
      if (from || to) pm["payments.paidAt"] = { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to) }) };

      const payments = await Order.aggregate([
        { $match: match }, { $unwind: "$payments" }, ...(Object.keys(pm).length ? [{ $match: pm }] : []),
        { $sort: { "payments.paidAt": -1 } },
        { $lookup: { from: "users", localField: "payments.receivedBy", foreignField: "_id", as: "u" } },
        { $lookup: { from: "outlets", localField: "outletId", foreignField: "_id", as: "o" } },
        { $lookup: { from: "tables", localField: "tableId", foreignField: "_id", as: "t" } },
        { $project: {
            _id: "$payments._id", orderId: "$_id", number: 1, channel: 1, customerSnapshot: 1,
            method: "$payments.method", amount: "$payments.amount", paidAt: "$payments.paidAt",
            receivedByName: { $arrayElemAt: ["$u.name", 0] }, outletName: { $arrayElemAt: ["$o.name", 0] },
            tableName: { $arrayElemAt: ["$t.name", 0] }, tableNumber: { $arrayElemAt: ["$t.tableNumber", 0] } } },
      ]);
      const totalsByMethod = {};
      let grandTotal = 0;
      for (const p of payments) { totalsByMethod[p.method] = (totalsByMethod[p.method] || 0) + p.amount; grandTotal += p.amount; }
      res.json({ payments, totalsByMethod, grandTotal, count: payments.length });
    } catch (err) { send(res, err, "Failed to fetch payments report"); }
  },
};

module.exports = orderController;