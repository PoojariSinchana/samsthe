const StockLevel = require("../models/StockLevel");
const StockMovement = require("../models/StockMovement");

// Single place that changes stock. Replaces recordMovement (restaurant) and recordShopMovement (retail).
// Decrements are guarded IN the update filter (currentStock >= qty), so two simultaneous sales
// can't both succeed and push stock negative (the old check-then-rollback approach could).
async function recordMovement({
  businessId, outletId, itemId, variantId, type, quantity, reason,
  costPerUnit, supplierName, refType = "manual", refId, notes, performedBy,
}) {
  const key = { businessId, outletId, itemId, variantId };
  let level;

  if (quantity < 0) {
    level = await StockLevel.findOneAndUpdate(
      { ...key, currentStock: { $gte: -quantity } },
      { $inc: { currentStock: quantity } },
      { new: true }
    );
    if (!level) {
      const err = new Error("Insufficient stock for this movement");
      err.status = 400;
      throw err;
    }
  } else {
    level = await StockLevel.findOneAndUpdate(
      key,
      { $inc: { currentStock: quantity }, $setOnInsert: { minStock: 0 } },
      { new: true, upsert: true }
    );
  }

  await StockMovement.create({
    ...key, type, quantity, reason, costPerUnit, supplierName, refType, refId, notes, performedBy,
  });
  return level;
}

module.exports = { recordMovement };