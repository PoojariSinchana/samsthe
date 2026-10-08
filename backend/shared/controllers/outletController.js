const Outlet = require("../models/Outlet");
const { UNRESTRICTED_ROLES } = require("../middleware/permissionMiddleware");
// @route POST /api/outlets
// @access owner, manager
async function createOutlet(req, res) {
  const { name, address, phone } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Outlet name is required" });
  }

  try {
    const outlet = await Outlet.create({
      businessId: req.user.businessId,
      name,
      address,
      phone,
    });
    res.status(201).json({ message: "Outlet created", outlet });
  } catch (err) {
    res.status(500).json({ message: "Failed to create outlet", error: err.message });
  }
}

// @route GET /api/outlets
// @access any authenticated user (scoped to their own restaurant)
async function getOutlets(req, res) {
  try {
    const filter = { businessId: req.user.businessId };
    if (!UNRESTRICTED_ROLES.includes(req.user.role)) {
      filter._id = { $in: req.user.outletAccess || [] };
    }
    const outlets = await Outlet.find(filter).sort({ createdAt: 1 });
    res.json({ outlets, restrictedToOwnOutlets: !UNRESTRICTED_ROLES.includes(req.user.role) });
  } catch (err) {
    res.status(500).json({ message: "Failed to load outlets", error: err.message });
  }
}

// @route PUT /api/outlets/:id
// @access owner, manager
async function updateOutlet(req, res) {
  const { name, address, phone, isActive } = req.body;

  try {
    // Scope the lookup to the caller's own restaurant so one restaurant can
    // never read or modify another restaurant's outlet by guessing an id.
    const outlet = await Outlet.findOne({ _id: req.params.id, businessId: req.user.businessId });
    if (!outlet) {
      return res.status(404).json({ message: "Outlet not found" });
    }

    if (name !== undefined) outlet.name = name;
    if (address !== undefined) outlet.address = address;
    if (phone !== undefined) outlet.phone = phone;
    if (isActive !== undefined) outlet.isActive = isActive;

    await outlet.save();
    res.json({ message: "Outlet updated", outlet });
  } catch (err) {
    res.status(500).json({ message: "Failed to update outlet", error: err.message });
  }
}

// @route DELETE /api/outlets/:id
// @access owner, manager
async function deleteOutlet(req, res) {
  try {
    const outlet = await Outlet.findOneAndDelete({ _id: req.params.id, businessId: req.user.businessId });
    if (!outlet) {
      return res.status(404).json({ message: "Outlet not found" });
    }
    res.json({ message: "Outlet deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete outlet", error: err.message });
  }
}

module.exports = { createOutlet, getOutlets, updateOutlet, deleteOutlet };