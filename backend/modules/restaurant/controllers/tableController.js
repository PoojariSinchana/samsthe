const Table = require("../models/Table");
const Outlet = require("../../../shared/models/Outlet");
const { resolveOutletFilter } = require("../../../shared/middleware/permissionMiddleware");

async function verifyOutletBelongsToBusiness(outletId, businessId) {
  const outlet = await Outlet.findOne({ _id: outletId, businessId });
  return !!outlet;
}

async function resolveExpiredCleaning(businessId) {
  await Table.updateMany(
    { businessId, status: "CLEANING", cleaningUntil: { $lte: new Date() } },
    { status: "AVAILABLE", cleaningUntil: null, currentOrder: null }
  );
}

const tableController = {
  async createTable(req, res) {
    try {
      const { outlet, tableNumber, name, capacity, location, shape } = req.body;
      if (!outlet || !tableNumber || !capacity) {
        return res.status(400).json({ message: "outlet, tableNumber, and capacity are required" });
      }
      const outletValid = await verifyOutletBelongsToBusiness(outlet, req.user.businessId);
      if (!outletValid) return res.status(400).json({ message: "Invalid outlet for this business" });

      const table = await Table.create({
        businessId: req.user.businessId,
        outlet,
        tableNumber,
        name: name || tableNumber,
        capacity,
        location: location || "",
        shape: shape || "square",
      });
      res.status(201).json({ message: "Table created", table });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ message: `Table number "${req.body.tableNumber}" already exists in this outlet` });
      }
      res.status(500).json({ message: "Failed to create table", error: err.message });
    }
  },

  async getTables(req, res) {
    try {
      await resolveExpiredCleaning(req.user.businessId);

      // resolveOutletFilter keeps restricted staff inside their own outlets, even if they pass ?outlet=
      let outletFilter;
      try {
        outletFilter = resolveOutletFilter(req, req.query.outlet);
      } catch (err) {
        return res.status(err.status || 400).json({ message: err.message });
      }

      const filter = { businessId: req.user.businessId, ...outletFilter };
      if (req.query.status) filter.status = req.query.status;

      const tables = await Table.find(filter)
        .populate("currentOrder", "number guestCount status total paymentStatus")
        .sort({ tableNumber: 1 });
      res.json({ tables });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch tables", error: err.message });
    }
  },

  async getTableById(req, res) {
    try {
      await resolveExpiredCleaning(req.user.businessId);

      const table = await Table.findOne({ _id: req.params.id, businessId: req.user.businessId })
        .populate("currentOrder", "number status total paymentStatus");
      if (!table) return res.status(404).json({ message: "Table not found" });
      res.json({ table });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch table", error: err.message });
    }
  },

  async updateTable(req, res) {
    try {
      const { tableNumber, name, capacity, location, isActive, shape } = req.body;
      const table = await Table.findOne({ _id: req.params.id, businessId: req.user.businessId });
      if (!table) return res.status(404).json({ message: "Table not found" });

      if (tableNumber !== undefined) table.tableNumber = tableNumber;
      if (name !== undefined) table.name = name;
      if (capacity !== undefined) table.capacity = capacity;
      if (location !== undefined) table.location = location;
      if (isActive !== undefined) table.isActive = isActive;
      if (shape !== undefined) table.shape = shape;

      await table.save();
      res.json({ message: "Table updated", table });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ message: "Table number already exists in this outlet" });
      }
      res.status(500).json({ message: "Failed to update table", error: err.message });
    }
  },

  // Lightweight drag-save for re-arranging the floor.
  async updateTablePosition(req, res) {
    try {
      const { x, y } = req.body;
      if (typeof x !== "number" || typeof y !== "number") {
        return res.status(400).json({ message: "x and y must be numbers" });
      }
      const table = await Table.findOneAndUpdate(
        { _id: req.params.id, businessId: req.user.businessId },
        { position: { x, y } },
        { new: true }
      );
      if (!table) return res.status(404).json({ message: "Table not found" });
      res.json({ message: "Position updated", table });
    } catch (err) {
      res.status(500).json({ message: "Failed to update position", error: err.message });
    }
  },

  async updateTableStatus(req, res) {
    try {
      const { status } = req.body;
      const allowed = ["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"];
      if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid status" });

      const table = await Table.findOneAndUpdate(
        { _id: req.params.id, businessId: req.user.businessId },
        { status, cleaningUntil: null, ...(status === "AVAILABLE" ? { currentOrder: null } : {}) },
        { new: true }
      );
      if (!table) return res.status(404).json({ message: "Table not found" });
      res.json({ message: "Table status updated", table });
    } catch (err) {
      res.status(500).json({ message: "Failed to update table status", error: err.message });
    }
  },

  async deleteTable(req, res) {
    try {
      const table = await Table.findOneAndUpdate(
        { _id: req.params.id, businessId: req.user.businessId },
        { isActive: false },
        { new: true }
      );
      if (!table) return res.status(404).json({ message: "Table not found" });
      res.json({ message: "Table deactivated", table });
    } catch (err) {
      res.status(500).json({ message: "Failed to deactivate table", error: err.message });
    }
  },
};

module.exports = tableController;