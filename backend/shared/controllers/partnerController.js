const Partner = require("../models/Partner");

const partnerController = {
  async getPartners(req, res) {
    try {
      const partners = await Partner.find({ businessId: req.user.businessId, isActive: true }).sort({ createdAt: 1 });
      res.json({ partners });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch partners", error: err.message });
    }
  },

  async createPartner(req, res) {
    try {
      const { name, role, sharePercentage, phone, email, joinedDate, notes, photo } = req.body;
      if (!name) return res.status(400).json({ message: "Name is required" });
      const partner = await Partner.create({
        businessId: req.user.businessId,
        name, role, sharePercentage, phone, email, joinedDate, notes, photo,
      });
      res.status(201).json({ message: "Partner added", partner });
    } catch (err) {
      res.status(500).json({ message: "Failed to add partner", error: err.message });
    }
  },

  async updatePartner(req, res) {
    try {
      const partner = await Partner.findOne({ _id: req.params.id, businessId: req.user.businessId });
      if (!partner) return res.status(404).json({ message: "Partner not found" });
      const fields = ["name", "role", "sharePercentage", "phone", "email", "joinedDate", "notes", "photo"];
      for (const f of fields) {
        if (req.body[f] !== undefined) partner[f] = req.body[f];
      }
      await partner.save();
      res.json({ message: "Partner updated", partner });
    } catch (err) {
      res.status(500).json({ message: "Failed to update partner", error: err.message });
    }
  },

  async deactivatePartner(req, res) {
    try {
      const partner = await Partner.findOneAndUpdate(
        { _id: req.params.id, businessId: req.user.businessId },
        { isActive: false },
        { new: true }
      );
      if (!partner) return res.status(404).json({ message: "Partner not found" });
      res.json({ message: "Partner removed", partner });
    } catch (err) {
      res.status(500).json({ message: "Failed to remove partner", error: err.message });
    }
  },

  async uploadPhoto(req, res) {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const url = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    res.json({ message: "Photo uploaded", url });
  },
};

module.exports = partnerController;