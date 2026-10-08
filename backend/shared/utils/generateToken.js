const jwt = require("jsonwebtoken");

// businessType: "restaurant" | "retail"
// businessId: the Restaurant._id or RetailBusiness._id the login is scoped to
function generateToken({ userId, businessType, businessId }) {
  return jwt.sign(
    { id: userId, businessType, businessId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || "7d" }
  );
}

module.exports = generateToken;