const jwt = require("jsonwebtoken");

// Admin tokens are signed with their OWN secret and carry scope:"admin".
// The customer-side protect() verifies with JWT_SECRET, so an admin token
// fails there (wrong signature); adminProtect() below does the reverse and
// also checks the scope claim. Neither token type works on the other side.
function getAdminSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("ADMIN_JWT_SECRET is not set");
  if (secret === process.env.JWT_SECRET) throw new Error("ADMIN_JWT_SECRET must differ from JWT_SECRET");
  return secret;
}

function generateAdminToken(adminId) {
  return jwt.sign({ adminId, scope: "admin" }, getAdminSecret(), {
    expiresIn: process.env.ADMIN_JWT_EXPIRE || "12h", // shorter than customer sessions on purpose
  });
}

module.exports = { generateAdminToken, getAdminSecret };