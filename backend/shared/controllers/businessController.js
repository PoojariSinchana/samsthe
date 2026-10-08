const path = require("path");
const fs = require("fs");
const Business = require("../models/Business");
const App = require("../models/app");
const { BUSINESS_TYPES, FINANCIAL_YEAR_OPTIONS } = require("../models/Business");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// `restaurant` is a temporary alias so the current frontend keeps working.
async function shape(b) {
  const app = await App.findById(b.appId, "slug");
  const business = { ...b.toObject(), appType: app?.slug || null };
  return { business, restaurant: business };
}

async function getMyBusiness(req, res) {
  try {
    const b = await Business.findById(req.user.businessId);
    if (!b) return res.status(404).json({ message: "Business not found" });
    res.json(await shape(b));
  } catch (err) {
    res.status(500).json({ message: "Failed to load business", error: err.message });
  }
}

// Best-effort: delete the old file when it was one of our own uploads.
function deleteIfLocalUpload(fileUrl) {
  if (!fileUrl) return;
  try {
    const marker = "/uploads/";
    const idx = fileUrl.indexOf(marker);
    if (idx === -1) return;
    const filePath = path.join(__dirname, "..", "uploads", fileUrl.slice(idx + marker.length));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* non-critical */ }
}

async function updateMyBusiness(req, res) {
  const { name, businessType, phone, email, address, city, state, country, financialYear, logoUrl, imageUrl, gstRegistered, gstNumber } = req.body;

  if (businessType && !BUSINESS_TYPES.includes(businessType)) return res.status(400).json({ message: `businessType must be one of: ${BUSINESS_TYPES.join(", ")}` });
  if (financialYear && !FINANCIAL_YEAR_OPTIONS.includes(financialYear)) return res.status(400).json({ message: `financialYear must be one of: ${FINANCIAL_YEAR_OPTIONS.join(", ")}` });
  if (email && !EMAIL_RE.test(email)) return res.status(400).json({ message: "Please enter a valid email address" });
  if (gstRegistered && (!gstNumber || gstNumber.trim().length < 15)) return res.status(400).json({ message: "A valid 15-character GST number is required when GST registered is checked" });

  try {
    const b = await Business.findById(req.user.businessId);
    if (!b) return res.status(404).json({ message: "Business not found" });

    if (name !== undefined && name.trim()) b.name = name.trim();
    if (businessType !== undefined) b.businessType = businessType;
    if (phone !== undefined && phone.trim()) b.phone = phone.trim();
    if (email !== undefined) b.email = email.trim().toLowerCase();
    if (address !== undefined) b.address = address;
    if (city !== undefined) b.city = city;
    if (state !== undefined) b.state = state;
    if (country !== undefined) b.country = country;
    if (financialYear !== undefined) b.financialYear = financialYear;

    if (logoUrl !== undefined && logoUrl !== b.logoUrl) { deleteIfLocalUpload(b.logoUrl); b.logoUrl = logoUrl; }
    if (imageUrl !== undefined && imageUrl !== b.imageUrl) { deleteIfLocalUpload(b.imageUrl); b.imageUrl = imageUrl; }

    if (gstRegistered !== undefined) b.gst.registered = gstRegistered;
    if (gstNumber !== undefined) b.gst.number = gstRegistered ? gstNumber.trim() : "";
    b.setupCompleted = true;

    await b.save();
    res.json({ message: "Business profile updated", ...(await shape(b)) });
  } catch (err) {
    res.status(500).json({ message: "Failed to update business", error: err.message });
  }
}

const fileUrl = (req, filename) => `${req.protocol}://${req.get("host")}/uploads/${filename}`;

// Upload only: the url is persisted when the form calls updateMyBusiness.
async function uploadLogo(req, res) {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  res.json({ message: "Logo uploaded", url: fileUrl(req, req.file.filename) });
}
async function uploadBannerImage(req, res) {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  res.json({ message: "Image uploaded", url: fileUrl(req, req.file.filename) });
}

module.exports = { getMyBusiness, updateMyBusiness, uploadLogo, uploadBannerImage };