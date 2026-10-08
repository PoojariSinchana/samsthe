const Supplier = require("../models/Supplier");

const supplierController = {
  async createSupplier(req, res) {
    try {
      const { name, phone, notes } = req.body;
      if (!name) return res.status(400).json({ message: "Supplier name is required" });
      const supplier = await Supplier.create({ businessId: req.user.businessId, name, phone, notes });
      res.status(201).json({ message: "Supplier created", supplier });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ message: `"${req.body.name}" already exists` });
      res.status(500).json({ message: "Failed to create supplier", error: err.message });
    }
  },

  async getSuppliers(req, res) {
    try {
      const suppliers = await Supplier.find({ businessId: req.user.businessId, isActive: true }).sort({ name: 1 });
      res.json({ suppliers });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch suppliers", error: err.message });
    }
  },

  async updateSupplier(req, res) {
    try {
      const { name, phone, notes } = req.body;
      const supplier = await Supplier.findOne({ _id: req.params.id, businessId: req.user.businessId });
      if (!supplier) return res.status(404).json({ message: "Supplier not found" });
      if (name !== undefined) supplier.name = name;
      if (phone !== undefined) supplier.phone = phone;
      if (notes !== undefined) supplier.notes = notes;
      await supplier.save();
      res.json({ message: "Supplier updated", supplier });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ message: "A supplier with this name already exists" });
      res.status(500).json({ message: "Failed to update supplier", error: err.message });
    }
  },

  async deactivateSupplier(req, res) {
    try {
      const supplier = await Supplier.findOneAndUpdate(
        { _id: req.params.id, businessId: req.user.businessId },
        { isActive: false },
        { new: true }
      );
      if (!supplier) return res.status(404).json({ message: "Supplier not found" });
      res.json({ message: "Supplier deactivated", supplier });
    } catch (err) {
      res.status(500).json({ message: "Failed to deactivate supplier", error: err.message });
    }
  },
};

module.exports = supplierController;