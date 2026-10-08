const Item = require("../models/Item");
const Category = require("../models/Category");
const Brand = require("../models/Brand");
const StockLevel = require("../models/StockLevel");
const Outlet = require("../models/Outlet");
const { recordMovement } = require("../services/stockService");
const { fail, send } = require("../utils/httpError");

const CATEGORY_KIND_FOR = { menu: "menu", product: "product", ingredient: "ingredient" };
const escapeRe = (s) => s.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const clean = (s) => (typeof s === "string" && s.trim() ? s.trim() : undefined);

// ---- validation helpers -------------------------------------------------------------

function cleanVariants(input, type) {
  if (!Array.isArray(input) || !input.length) throw fail(400, "At least one variant is required");
  const out = input.map((v) => {
    const price = Number(v.price);
    if (Number.isNaN(price) || price < 0) throw fail(400, "Every variant needs a price of 0 or more");
    const attributes = (v.attributes || []).filter((a) => a?.name && a?.value);
    const sku = clean(v.sku);
    if (type === "product" && !sku) throw fail(400, "Every product variant needs a SKU");
    return {
      _id: v._id, sku, barcode: clean(v.barcode), attributes, price,
      label: clean(v.label) || attributes.map((a) => a.value).join("/") || sku || "Regular",
      costPrice: Number(v.costPrice) || 0, image: v.image || "", isDefault: !!v.isDefault,
    };
  });
  if (!out.some((v) => v.isDefault)) out[0].isDefault = true;
  return out;
}

// SKU / barcode must be unique per business across every item (a barcode scan looks up either field).
async function assertUniqueCodes(businessId, variants, excludeId) {
  for (const field of ["sku", "barcode"]) {
    const codes = variants.map((v) => v[field]).filter(Boolean);
    const dupe = codes.find((c, i) => codes.indexOf(c) !== i);
    if (dupe) throw fail(409, `Duplicate ${field} in request: ${dupe}`);
  }
  const codes = variants.flatMap((v) => [v.sku, v.barcode]).filter(Boolean);
  if (!codes.length) return;
  const filter = { businessId, $or: [{ "variants.sku": { $in: codes } }, { "variants.barcode": { $in: codes } }] };
  if (excludeId) filter._id = { $ne: excludeId };
  const clash = await Item.findOne(filter, "name variants");
  if (clash) {
    const hit = clash.variants.find((v) => codes.includes(v.sku) || codes.includes(v.barcode));
    throw fail(409, `Code "${hit.sku && codes.includes(hit.sku) ? hit.sku : hit.barcode}" is already used by "${clash.name}"`);
  }
}

async function assertCategory(businessId, categoryId, type) {
  if (!categoryId) throw fail(400, "Category is required");
  if (!(await Category.exists({ _id: categoryId, businessId, kind: CATEGORY_KIND_FOR[type] }))) throw fail(400, `That ${type} category does not exist on your business`);
}
async function assertBrand(businessId, brandId) {
  if (brandId && !(await Brand.exists({ _id: brandId, businessId }))) throw fail(400, "That brand does not exist on your business");
}

function cleanMenu(m = {}) {
  const p = m.pricingByOrderType || {};
  const num = (v) => (v === "" || v == null ? undefined : Number(v));
  return {
    isVeg: m.isVeg !== false,
    addOns: (m.addOns || []).filter((a) => a?.name && a.price !== "" && a.price != null).map((a) => ({ name: a.name.trim(), price: Number(a.price), isActive: a.isActive !== false })),
    pricingByOrderType: { dineIn: num(p.dineIn), takeaway: num(p.takeaway), delivery: num(p.delivery) },
  };
}

const populateItem = (q) => q.populate("categoryId", "name sortOrder").populate("brandId", "name logo");

// ---- controller ---------------------------------------------------------------------

const itemController = {
  async getItems(req, res) {
    try {
      const { type, category, brand, search, available, includeInactive } = req.query;
      const filter = { businessId: req.user.businessId };
      if (includeInactive !== "true") filter.isActive = true;
      if (type) filter.type = type;
      if (category) filter.categoryId = category;
      if (brand) filter.brandId = brand;
      if (available === "true") filter.isAvailable = true;
      if (search) {
        const re = new RegExp(escapeRe(search), "i");
        filter.$or = [{ name: re }, { "variants.sku": re }, { "variants.barcode": re }];
      }
      const items = await populateItem(Item.find(filter)).sort({ name: 1 });
      res.json({ items });
    } catch (err) { send(res, err, "Failed to fetch items"); }
  },

  async getItemById(req, res) {
    try {
      const item = await populateItem(Item.findOne({ _id: req.params.id, businessId: req.user.businessId }));
      if (!item) throw fail(404, "Item not found");
      res.json({ item });
    } catch (err) { send(res, err, "Failed to fetch item"); }
  },

  // POS barcode/SKU scan: code -> item + variant + stock at the given outlet.
  async lookupByCode(req, res) {
    try {
      const { code, outlet } = req.query;
      if (!code || !outlet) throw fail(400, "code and outlet are required");
      const item = await Item.findOne({
        businessId: req.user.businessId, isActive: true, type: "product",
        $or: [{ "variants.sku": code }, { "variants.barcode": code }],
      }).populate("categoryId", "name");
      if (!item) throw fail(404, "No product found for that code");
      const variant = item.variants.find((v) => v.sku === code || v.barcode === code);
      const level = await StockLevel.findOne({ businessId: req.user.businessId, outletId: outlet, itemId: item._id, variantId: variant._id });
      res.json({ item, variant, stock: level?.currentStock ?? 0 });
    } catch (err) { send(res, err, "Failed to look up product"); }
  },

  async createItem(req, res) {
    try {
      const { businessId } = req.user;
      const { type, name, description, categoryId, brandId, images, tags, unit, menu, openingStock } = req.body;
      if (!Item.ITEM_TYPES.includes(type)) throw fail(400, `type must be one of: ${Item.ITEM_TYPES.join(", ")}`);
      if (!clean(name)) throw fail(400, "Name is required");
      if (type === "ingredient" && !Item.UNITS.includes(unit)) throw fail(400, `An ingredient needs a unit: ${Item.UNITS.join(", ")}`);
      await assertCategory(businessId, categoryId, type);
      if (type === "product") await assertBrand(businessId, brandId);

      const variants = cleanVariants(req.body.variants, type);
      variants.forEach((v) => delete v._id);                 // new item: let Mongo assign variant ids
      await assertUniqueCodes(businessId, variants);

      const item = await Item.create({
        businessId, type, name: name.trim(), description: description || "", categoryId,
        brandId: type === "product" ? brandId || undefined : undefined,
        images: images || [], tags: tags || [], unit: type === "ingredient" ? unit : undefined,
        menu: type === "menu" ? cleanMenu(menu) : undefined, variants,
        isAvailable: req.body.isAvailable !== false,
      });

      // Opening stock: [{ outletId, variantIndex (default 0), quantity }] recorded as a real movement.
      const opening = [];
      if (type !== "menu" && Array.isArray(openingStock)) {
        for (const o of openingStock) {
          const qty = Number(o.quantity);
          if (!(qty > 0)) continue;
          if (!(await Outlet.exists({ _id: o.outletId, businessId }))) throw fail(400, "Invalid outlet in opening stock");
          const variant = item.variants[Number(o.variantIndex) || 0];
          if (!variant) continue;
          await recordMovement({
            businessId, outletId: o.outletId, itemId: item._id, variantId: variant._id, type: "IN", quantity: qty,
            reason: "Opening stock", costPerUnit: variant.costPrice, refType: "opening", performedBy: req.user._id,
          });
          opening.push({ outletId: o.outletId, variantId: variant._id, quantity: qty });
        }
      }
      res.status(201).json({ message: "Item created", item, openingStock: opening });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ message: "That SKU is already in use" });
      send(res, err, "Failed to create item");
    }
  },

  async updateItem(req, res) {
    try {
      const { businessId } = req.user;
      const item = await Item.findOne({ _id: req.params.id, businessId });
      if (!item) throw fail(404, "Item not found");
      const b = req.body;                                    // businessId and type are never editable

      if (b.name !== undefined) { if (!clean(b.name)) throw fail(400, "Name is required"); item.name = b.name.trim(); }
      if (b.description !== undefined) item.description = b.description;
      if (b.categoryId !== undefined) { await assertCategory(businessId, b.categoryId, item.type); item.categoryId = b.categoryId; }
      if (b.brandId !== undefined && item.type === "product") { await assertBrand(businessId, b.brandId); item.brandId = b.brandId || undefined; }
      if (b.images !== undefined) item.images = b.images;
      if (b.tags !== undefined) item.tags = b.tags;
      if (b.isAvailable !== undefined) item.isAvailable = !!b.isAvailable;
      if (b.unit !== undefined && item.type === "ingredient") {
        if (!Item.UNITS.includes(b.unit)) throw fail(400, "Invalid unit");
        item.unit = b.unit;
      }
      if (b.menu !== undefined && item.type === "menu") item.menu = cleanMenu(b.menu);

      if (b.variants !== undefined) {
        const incoming = cleanVariants(b.variants, item.type);
        await assertUniqueCodes(businessId, incoming, item._id);
        // Variants are referenced by stock, orders and purchases, so an omitted variant is retired
        // (isActive=false), never deleted. New rows (no known _id) are appended.
        const keep = new Set(incoming.filter((v) => v._id && item.variants.id(v._id)).map((v) => String(v._id)));
        item.variants.forEach((v) => { if (!keep.has(String(v._id))) v.isActive = false; });
        for (const v of incoming) {
          const { _id, ...fields } = v;
          const existing = _id && item.variants.id(_id);
          if (existing) existing.set({ ...fields, isActive: true });
          else item.variants.push({ ...fields, isActive: true });
        }
        const active = item.variants.filter((v) => v.isActive !== false);
        if (!active.length) throw fail(400, "At least one active variant is required");
        if (!active.some((v) => v.isDefault)) active[0].isDefault = true;
      }
      await item.save();
      res.json({ message: "Item updated", item: await populateItem(Item.findById(item._id)) });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ message: "That SKU is already in use" });
      send(res, err, "Failed to update item");
    }
  },

  async toggleAvailability(req, res) {
    try {
      const item = await Item.findOne({ _id: req.params.id, businessId: req.user.businessId });
      if (!item) throw fail(404, "Item not found");
      item.isAvailable = !item.isAvailable;
      await item.save();
      res.json({ item });
    } catch (err) { send(res, err, "Failed to update availability"); }
  },

  // Soft delete: history (orders, purchases, stock movements) keeps pointing at it.
  async deleteItem(req, res) {
    try {
      const item = await Item.findOneAndUpdate({ _id: req.params.id, businessId: req.user.businessId }, { isActive: false }, { new: true });
      if (!item) throw fail(404, "Item not found");
      res.json({ message: "Item deactivated", item });
    } catch (err) { send(res, err, "Failed to deactivate item"); }
  },

  async addAddOn(req, res) {
    try {
      const { name, price } = req.body;
      if (!clean(name) || price === undefined || price === "" || Number(price) < 0) throw fail(400, "Add-on name and price are required");
      const item = await Item.findOne({ _id: req.params.id, businessId: req.user.businessId, type: "menu" });
      if (!item) throw fail(404, "Menu item not found");
      item.menu.addOns.push({ name: name.trim(), price: Number(price) });
      await item.save();
      res.status(201).json({ item });
    } catch (err) { send(res, err, "Failed to add add-on"); }
  },

  async removeAddOn(req, res) {
    try {
      const item = await Item.findOne({ _id: req.params.id, businessId: req.user.businessId, type: "menu" });
      if (!item) throw fail(404, "Menu item not found");
      item.menu.addOns.id(req.params.addOnId)?.deleteOne();
      await item.save();
      res.json({ item });
    } catch (err) { send(res, err, "Failed to remove add-on"); }
  },

  async uploadImage(req, res) {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    res.json({ message: "Image uploaded", url: `/uploads/${req.file.filename}` });
  },
};

module.exports = itemController;