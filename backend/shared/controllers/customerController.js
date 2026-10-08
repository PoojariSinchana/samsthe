const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const Order = require("../models/Order");

const escapeRe = (s) => s.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Replaces customerController + shopCustomerController. Stats come live from Order.customerId.
const customerController = {
  async getCustomers(req, res) {
    try {
      const { search } = req.query;
      const businessId = req.user.businessId;
      const filter = { businessId, isActive: true };
      if (search) {
        const re = new RegExp(escapeRe(search), "i");
        filter.$or = [{ name: re }, { phone: re }, { email: re }];
      }
      const customers = await Customer.find(filter).sort({ name: 1 });

      const stats = await Order.aggregate([
        { $match: { businessId: new mongoose.Types.ObjectId(businessId), status: { $ne: "cancelled" }, customerId: { $in: customers.map((c) => c._id) } } },
        { $group: { _id: "$customerId", orderCount: { $sum: 1 }, totalSpent: { $sum: "$total" }, lastOrderAt: { $max: "$createdAt" } } },
      ]);
      const byId = new Map(stats.map((s) => [String(s._id), s]));

      res.json({
        customers: customers.map((c) => {
          const s = byId.get(String(c._id));
          return { ...c.toObject(), orderCount: s?.orderCount || 0, totalSpent: s?.totalSpent || 0, lastOrderAt: s?.lastOrderAt || null };
        }),
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch customers", error: err.message });
    }
  },

  async createCustomer(req, res) {
    try {
      const { name, phone, email, address, tags, notes } = req.body;
      if (!name || !phone) return res.status(400).json({ message: "Name and phone are required" });
      const customer = await Customer.create({ businessId: req.user.businessId, name, phone: phone.trim(), email, address, tags, notes });
      // Link earlier walk-in orders that used this phone, so their history shows up immediately.
      await Order.updateMany(
        { businessId: req.user.businessId, "customerSnapshot.phone": customer.phone, customerId: null },
        { $set: { customerId: customer._id } }
      );
      res.status(201).json({ message: "Customer added", customer });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ message: "A customer with this phone number already exists" });
      res.status(500).json({ message: "Failed to add customer", error: err.message });
    }
  },

  async updateCustomer(req, res) {
    try {
      const customer = await Customer.findOne({ _id: req.params.id, businessId: req.user.businessId });
      if (!customer) return res.status(404).json({ message: "Customer not found" });
      for (const f of ["name", "phone", "email", "address", "tags", "notes"]) if (req.body[f] !== undefined) customer[f] = req.body[f];
      await customer.save();
      res.json({ message: "Customer updated", customer });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ message: "A customer with this phone number already exists" });
      res.status(500).json({ message: "Failed to update customer", error: err.message });
    }
  },

  async deactivateCustomer(req, res) {
    try {
      const customer = await Customer.findOneAndUpdate({ _id: req.params.id, businessId: req.user.businessId }, { isActive: false }, { new: true });
      if (!customer) return res.status(404).json({ message: "Customer not found" });
      res.json({ message: "Customer removed", customer });
    } catch (err) {
      res.status(500).json({ message: "Failed to remove customer", error: err.message });
    }
  },
};

module.exports = customerController;