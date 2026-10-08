const Category = require("../models/Category");
const Brand = require("../models/Brand");
const Item = require("../models/Item");
const { fail, send } = require("../utils/httpError");

const dupe = (err, msg) => (err.code === 11000 ? Object.assign(new Error(msg), { status: 409 }) : err);

const categoryController = {
  async getCategories(req, res) {
    try {
      const filter = { businessId: req.user.businessId };
      if (req.query.kind) filter.kind = req.query.kind;
      const categories = await Category.find(filter).sort({ sortOrder: 1, name: 1 });
      res.json({ categories });
    } catch (err) { send(res, err, "Failed to fetch categories"); }
  },

  async createCategory(req, res) {
    try {
      const { kind, name, description, sortOrder } = req.body;
      if (!Category.CATEGORY_KINDS.includes(kind)) throw fail(400, `kind must be one of: ${Category.CATEGORY_KINDS.join(", ")}`);
      if (!name?.trim()) throw fail(400, "Category name is required");
      const category = await Category.create({ businessId: req.user.businessId, kind, name: name.trim(), description, sortOrder });
      res.status(201).json({ message: "Category created", category });
    } catch (err) { send(res, dupe(err, `"${req.body.name}" already exists`), "Failed to create category"); }
  },

  async updateCategory(req, res) {
    try {
      const { name, description, sortOrder, isActive } = req.body;            // kind and businessId are not editable
      const update = {};
      if (name !== undefined) update.name = name.trim();
      if (description !== undefined) update.description = description;
      if (sortOrder !== undefined) update.sortOrder = sortOrder;
      if (isActive !== undefined) update.isActive = isActive;
      const category = await Category.findOneAndUpdate({ _id: req.params.id, businessId: req.user.businessId }, update, { new: true, runValidators: true });
      if (!category) throw fail(404, "Category not found");
      res.json({ message: "Category updated", category });
    } catch (err) { send(res, dupe(err, "A category with this name already exists"), "Failed to update category"); }
  },

  async deleteCategory(req, res) {
    try {
      const category = await Category.findOne({ _id: req.params.id, businessId: req.user.businessId });
      if (!category) throw fail(404, "Category not found");
      const inUse = await Item.countDocuments({ categoryId: category._id, businessId: req.user.businessId, isActive: true });
      if (inUse) throw fail(409, `${inUse} item(s) still use this category, reassign or deactivate them first`);
      await category.deleteOne();
      res.json({ message: "Category deleted" });
    } catch (err) { send(res, err, "Failed to delete category"); }
  },

  // ---- brands (shops) ----
  async getBrands(req, res) {
    try {
      res.json({ brands: await Brand.find({ businessId: req.user.businessId, isActive: true }).sort({ name: 1 }) });
    } catch (err) { send(res, err, "Failed to fetch brands"); }
  },

  async createBrand(req, res) {
    try {
      if (!req.body.name?.trim()) throw fail(400, "Brand name is required");
      const logo = req.file ? `/uploads/${req.file.filename}` : req.body.logo || "";
      const brand = await Brand.create({ businessId: req.user.businessId, name: req.body.name.trim(), logo });
      res.status(201).json({ message: "Brand created", brand });
    } catch (err) { send(res, dupe(err, `"${req.body.name}" already exists`), "Failed to create brand"); }
  },

  async updateBrand(req, res) {
    try {
      const brand = await Brand.findOne({ _id: req.params.id, businessId: req.user.businessId });
      if (!brand) throw fail(404, "Brand not found");
      if (req.body.name !== undefined) brand.name = req.body.name.trim();
      if (req.body.isActive !== undefined) brand.isActive = req.body.isActive;
      if (req.file) brand.logo = `/uploads/${req.file.filename}`;
      await brand.save();
      res.json({ message: "Brand updated", brand });
    } catch (err) { send(res, dupe(err, "A brand with this name already exists"), "Failed to update brand"); }
  },

  async deleteBrand(req, res) {
    try {
      const brand = await Brand.findOne({ _id: req.params.id, businessId: req.user.businessId });
      if (!brand) throw fail(404, "Brand not found");
      const inUse = await Item.countDocuments({ brandId: brand._id, businessId: req.user.businessId, isActive: true });
      if (inUse) throw fail(409, `${inUse} product(s) still use this brand, reassign or deactivate them first`);
      await brand.deleteOne();
      res.json({ message: "Brand deleted" });
    } catch (err) { send(res, err, "Failed to delete brand"); }
  },
};

module.exports = categoryController;