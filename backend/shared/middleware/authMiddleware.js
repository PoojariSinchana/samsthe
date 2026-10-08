const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function protect(req, res, next) {
  const h = req.headers.authorization;
  const token = h?.startsWith("Bearer ") ? h.split(" ")[1] : null;
  if (!token) return res.status(401).json({ message: "Not authorized, no token provided" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.id) return res.status(401).json({ message: "Not authorized, invalid token" }); // rejects select-business tokens
    const user = await User.findById(decoded.id);
    if (!user || user.status !== "active") return res.status(401).json({ message: "Not authorized" });
    req.user = user; // has businessId, role, hasPermission()
    next();
  } catch {
    res.status(401).json({ message: "Not authorized, token invalid or expired" });
  }
}
module.exports = { protect };