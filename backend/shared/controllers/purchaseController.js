const Purchase = require("../models/Purchase");
const Item = require("../models/Item");
const Supplier = require("../models/Supplier");
const Outlet = require("../models/Outlet");
const { recordMovement } = require("../services/stockService");
const { postPurchaseLiability, postPurchasePayment } = require("./accountingController");
const { fail, send } = require("../utils/httpError");
const Category = require("../models/Category"); 

const PAY_METHODS = ["cash", "card", "upi", "bank", "other"];
const escapeRe = (s) => s.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function resolveIngredient(businessId, name, unit) {
  const clean = String(name || "").trim();
  if (!clean) throw fail(400, "Item name is required");
  const found = await Item.findOne({ businessId, type: "ingredient", isActive: true, name: new RegExp(`^${escapeRe(clean)}$`, "i") });
  if (found) return found;
  const category = await Category.findOneAndUpdate(
    { businessId, kind: "ingredient", name: "General" },
    { $setOnInsert: { businessId, kind: "ingredient", name: "General" } },
    { upsert: true, new: true }
  );
  return Item.create({
    businessId, type: "ingredient", name: clean, categoryId: category._id,
    unit: Item.UNITS.includes(unit) ? unit : "pcs",
    variants: [{ label: "Regular", price: 0, isDefault: true }],
  });
}

const purchaseController = {
  // Restaurant ingredients and shop products go through the same path: lines = { itemId, variantId?, quantity, price }.
  async createPurchase(req, res) {
    const { businessId } = req.user;
    let purchase;
    const moved = [];
    try {
      const { outletId, supplierId, date, lines, paymentMethod, amountPaid, notes } = req.body;
      const method = paymentMethod || "cash";
      if (!outletId || !supplierId || !Array.isArray(lines) || !lines.length) throw fail(400, "outletId, supplierId and at least one line are required");
      if (method !== "credit" && !PAY_METHODS.includes(method)) throw fail(400, "Invalid payment method");
      if (!(await Outlet.exists({ _id: outletId, businessId }))) throw fail(400, "Invalid outlet for this business");
      const supplier = await Supplier.findOne({ _id: supplierId, businessId });
      if (!supplier) throw fail(400, "Invalid supplier for this business");

      const resolved = [];
      for (const l of lines) {
        const quantity = Number(l.quantity);
        const price = Number(l.price);
        if (!(quantity > 0) || Number.isNaN(price) || price < 0) throw fail(400, "Each line needs a positive quantity and a non-negative price");
        const item = l.itemId
          ? await Item.findOne({ _id: l.itemId, businessId, isActive: true, type: { $in: ["ingredient", "product"] } })
          : await resolveIngredient(businessId, l.name, l.unit);
        if (!item) throw fail(400, `Invalid stockable item: ${l.itemId || l.name}`);
        const variant = l.variantId ? item.variants.id(l.variantId) : item.variants.find((v) => v.isDefault) || item.variants[0];
        if (!variant) throw fail(400, `Invalid variant for ${item.name}`);
        const attr = (variant.attributes || []).map((a) => a.value).join("/");
        resolved.push({
          itemId: item._id, variantId: variant._id, sku: variant.sku,
          name: item.type === "product" && attr ? `${item.name} — ${attr}` : item.name,
          quantity, price, lineTotal: quantity * price,
        });
      }

      const totalAmount = resolved.reduce((s, l) => s + l.lineTotal, 0);

        // Pay in full by default; "credit" or amountPaid=0 means nothing paid; a smaller amount is a part-payment.
        const paidNow = method === "credit"
          ? 0
          : Math.min(amountPaid === undefined || amountPaid === "" ? totalAmount : Number(amountPaid) || 0, totalAmount);

        purchase = new Purchase({
          businessId, outletId, supplierId, date: date || Date.now(), lines: resolved, totalAmount,
          paymentMethod: paidNow > 0 ? method : "credit",
          notes: notes || "", createdBy: req.user._id,
        });
        if (paidNow > 0) purchase.payments.push({ method, amount: paidNow, paidBy: req.user._id });
        purchase.recalculate();
        await purchase.save();

      // Goods arrived whether or not the invoice is paid, so stock always goes up.
      for (const l of resolved) {
        await recordMovement({
          businessId, outletId, itemId: l.itemId, variantId: l.variantId, type: "IN", quantity: l.quantity,
          reason: "Purchase", costPerUnit: l.price, supplierName: supplier.name,
          refType: "purchase", refId: purchase._id, performedBy: req.user._id,
        });
        moved.push(l);
        await Item.updateOne({ _id: l.itemId, "variants._id": l.variantId }, { $set: { "variants.$.costPrice": l.price } });
      }

      try {
        await postPurchaseLiability(purchase);
        if (purchase.payments.length) await postPurchasePayment(purchase, purchase.payments[0]);
      } catch (e) {
        console.error("Accounting auto-post failed for purchase", purchase._id, e.message);
      }

      res.status(201).json({ message: "Purchase recorded", purchase });
    } catch (err) {
      // Undo partial work so a failed purchase never leaves phantom stock.
      for (const l of moved) {
        await recordMovement({
          businessId, outletId: purchase?.outletId || req.body.outletId, itemId: l.itemId, variantId: l.variantId, type: "OUT", quantity: -l.quantity,
          reason: "Rollback", refType: "purchase", refId: purchase._id, performedBy: req.user._id,
        }).catch(() => {});
      }
      if (purchase?._id) await Purchase.deleteOne({ _id: purchase._id }).catch(() => {});
      send(res, err, "Failed to record purchase");
    }
  },

  async getPurchases(req, res) {
    try {
      const { outlet, supplier, from, to, paymentStatus } = req.query;
      const filter = { businessId: req.user.businessId };
      if (outlet) filter.outletId = outlet;
      if (supplier) filter.supplierId = supplier;
      if (paymentStatus) filter.paymentStatus = paymentStatus;
      if (from || to) filter.date = { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to) }) };
      const purchases = await Purchase.find(filter).populate("supplierId", "name").populate("createdBy", "name").sort({ date: -1 }).limit(300);
      res.json({ purchases });
    } catch (err) { send(res, err, "Failed to fetch purchases"); }
  },

  async getPurchaseById(req, res) {
    try {
      const purchase = await Purchase.findOne({ _id: req.params.id, businessId: req.user.businessId })
        .populate("supplierId", "name phone").populate("createdBy", "name");
      if (!purchase) throw fail(404, "Purchase not found");
      res.json({ purchase });
    } catch (err) { send(res, err, "Failed to fetch purchase"); }
  },

  // Settle part or all of an outstanding purchase.
  async addPayment(req, res) {
    try {
      const { method, amount } = req.body;
      if (!PAY_METHODS.includes(method) || !(amount > 0)) throw fail(400, "Valid method and amount are required");
      const purchase = await Purchase.findOne({ _id: req.params.id, businessId: req.user.businessId });
      if (!purchase) throw fail(404, "Purchase not found");
      if (purchase.amountDue <= 0) throw fail(400, "This purchase is already fully paid");
      if (amount > purchase.amountDue + 0.01) throw fail(400, `Amount exceeds the outstanding balance of ₹${purchase.amountDue.toFixed(2)}`);

      purchase.payments.push({ method, amount, paidBy: req.user._id });
      purchase.recalculate();
      await purchase.save();
      try {
        await postPurchasePayment(purchase, purchase.payments[purchase.payments.length - 1]);
      } catch (e) {
        console.error("Accounting auto-post failed for purchase payment", e.message);
      }
      res.status(201).json({ message: "Payment recorded", purchase });
    } catch (err) { send(res, err, "Failed to record payment"); }
  },
};

module.exports = purchaseController;