const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // req.user is set by `protect`, which must run before this.
    cb(null, `${req.user.businessId}-${Date.now()}${ext}`);
  },
});

const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const fileFilter = (req, file, cb) =>
  allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error("Only JPG, PNG, WEBP or GIF images are allowed"));

module.exports = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });