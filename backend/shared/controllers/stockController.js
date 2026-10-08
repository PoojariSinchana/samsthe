const Item = require("../models/Item");
const StockLevel = require("../models/StockLevel");
const StockMovement = require("../models/StockMovement");
const Outlet = require("../models/Outlet");
const { recordMovement } = require("../services/stockService");
const { fail, send } = require("../utils/httpError");

const STOCKABLE = ["ingredient", "product"];
const escapeRe = (s) => s.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function assertOutlet(outletId, businessId) {
  if (!outletId || !(await Outlet.exists({ _id: outletId, businessId }))) throw fail(400, "Invalid outlet for this business");
}

// One row per (item, variant) for an outlet, INCLUDING never-stocked ones (shown as 0), so a newly
// created item appears in the stock list before its first purchase.
async function buildRows(businessId, outletId, { type, search } = {}) {
  const itemFilter = { businessId, isActive: true, type: type && STOCKABLE.includes(type) ? type : { $in: STOCKABLE } };
  if (search) {
    const re = new RegExp(escapeRe(search), "i");
    itemFilter.$or = [{ name: re }, { "variants.sku": re }, { "variants.barcode": re }];
  }
  const [items, levels] = await Promise.all([
    Item.find(itemFilter).populate("categoryId", "name").populate("brandId", "name").sort({ name: 1 }),
    StockLevel.find({ businessId, outletId }),
  ]);
  const byKey = new Map(levels.map((l) => [`${l.itemId}|${l.variantId}`, l]));

  const rows = [];
  for (const item of items) {
    for (const v of item.variants) {
      if (v.isActive === false) continue;
      const lvl = byKey.get(`${item._id}|${v._id}`);
      rows.push({
        _id: lvl?._id || null, outletId,
        item: { _id: item._id, name: item.name, type: item.type, unit: item.unit, category: item.categoryId, brand: item.brandId, images: item.images },
        variant: { _id: v._id, label: v.label, sku: v.sku, barcode: v.barcode, attributes: v.attributes, price: v.price, costPrice: v.costPrice },
        currentStock: lvl?.currentStock ?? 0, minStock: lvl?.minStock ?? 0,
      });
    }
  }
  return rows;
}

const isLow = (r) => r.currentStock > 0 && r.currentStock <= r.minStock;

async function resolveStockable(businessId, itemId, variantId) {
  const item = await Item.findOne({ _id: itemId, businessId, type: { $in: STOCKABLE } });
  if (!item) throw fail(404, "Item not found");
  const variant = variantId ? item.variants.id(variantId) : item.variants.find((v) => v.isDefault) || item.variants[0];
  if (!variant) throw fail(404, "Variant not found on this item");
  return { item, variant };
}

const stockController = {
  async getMeta(req, res) {
    res.json({ adjustReasons: StockMovement.ADJUST_REASONS, units: Item.UNITS });
  },

  async getStock(req, res) {
    try {
      const { outlet, status, type, search } = req.query;
      await assertOutlet(outlet, req.user.businessId);
      let rows = await buildRows(req.user.businessId, outlet, { type, search });
      if (status === "low") rows = rows.filter(isLow);
      if (status === "out") rows = rows.filter((r) => r.currentStock === 0);
      res.json({ stock: rows });
    } catch (err) { send(res, err, "Failed to fetch stock"); }
  },

  async getOverview(req, res) {
    try {
      const { outlet, type } = req.query;
      await assertOutlet(outlet, req.user.businessId);
      const rows = await buildRows(req.user.businessId, outlet, { type });
      res.json({
        totalSkus: rows.length,
        lowStock: rows.filter(isLow).length,
        outOfStock: rows.filter((r) => r.currentStock === 0).length,
        stockValue: rows.reduce((s, r) => s + r.currentStock * (r.variant.costPrice || 0), 0),
      });
    } catch (err) { send(res, err, "Failed to fetch overview"); }
  },

  async setMinStock(req, res) {
    try {
      const { outletId, itemId, variantId, minStock } = req.body;
      if (!(Number(minStock) >= 0)) throw fail(400, "minStock must be 0 or more");
      await assertOutlet(outletId, req.user.businessId);
      const { item, variant } = await resolveStockable(req.user.businessId, itemId, variantId);
      const stock = await StockLevel.findOneAndUpdate(
        { businessId: req.user.businessId, outletId, itemId: item._id, variantId: variant._id },
        { $set: { minStock: Number(minStock) } },
        { new: true, upsert: true }
      );
      res.json({ message: "Minimum stock updated", stock });
    } catch (err) { send(res, err, "Failed to update minimum stock"); }
  },

  // Stock increases only come from Purchases (or the future opening-stock flow), never from here.
  async stockOut(req, res) {
    try {
      const { outletId, itemId, variantId, quantity, reason, notes } = req.body;
      if (!(Number(quantity) > 0)) throw fail(400, "A positive quantity is required");
      await assertOutlet(outletId, req.user.businessId);
      const { item, variant } = await resolveStockable(req.user.businessId, itemId, variantId);
      const stock = await recordMovement({
        businessId: req.user.businessId, outletId, itemId: item._id, variantId: variant._id, type: "OUT",
        quantity: -Math.abs(Number(quantity)), reason: reason || "Stock out", notes, refType: "manual", performedBy: req.user._id,
      });
      res.status(201).json({ message: "Stock removed", stock });
    } catch (err) { send(res, err, "Failed to record stock out"); }
  },

  async stockAdjust(req, res) {
    try {
      const { outletId, itemId, variantId, quantity, reason, notes } = req.body;
      const qty = Number(quantity);
      if (!qty) throw fail(400, "A non-zero quantity is required");
      if (!StockMovement.ADJUST_REASONS.includes(reason)) throw fail(400, `reason must be one of: ${StockMovement.ADJUST_REASONS.join(", ")}`);
      await assertOutlet(outletId, req.user.businessId);
      const { item, variant } = await resolveStockable(req.user.businessId, itemId, variantId);
      const stock = await recordMovement({
        businessId: req.user.businessId, outletId, itemId: item._id, variantId: variant._id, type: "ADJUST",
        quantity: qty, reason, notes, refType: "manual", performedBy: req.user._id,
      });
      res.status(201).json({ message: "Stock adjusted", stock });
    } catch (err) { send(res, err, "Failed to record adjustment"); }
  },

  async getHistory(req, res) {
    try {
      const { outlet, item, type, from, to } = req.query;
      const filter = { businessId: req.user.businessId };
      if (outlet) filter.outletId = outlet;
      if (item) filter.itemId = item;
      if (type) filter.type = type;
      if (from || to) filter.createdAt = { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to) }) };
      const movements = await StockMovement.find(filter).populate("itemId", "name unit type").populate("performedBy", "name").sort({ createdAt: -1 }).limit(200);
      res.json({ movements });
    } catch (err) { send(res, err, "Failed to fetch history"); }
  },
};

module.exports = stockController;