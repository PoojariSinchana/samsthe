// Pipeline fragments for the unified Order model (lines / channel / customerId).
// Used by reports, analytics and the dashboard.
const LINE_OK = { "lines.status": { $nin: ["cancelled", "returned"] } };
const LINE_REV = { $subtract: [{ $multiply: ["$lines.price", "$lines.quantity"] }, { $ifNull: ["$lines.discount", 0] }] };

const lookupItem = [
  { $lookup: { from: "items", localField: "lines.itemId", foreignField: "_id", as: "itemDoc" } },
  { $unwind: { path: "$itemDoc", preserveNullAndEmptyArrays: true } },
];
const lookupCategory = [
  ...lookupItem,
  { $lookup: { from: "categories", localField: "itemDoc.categoryId", foreignField: "_id", as: "categoryDoc" } },
  { $unwind: { path: "$categoryDoc", preserveNullAndEmptyArrays: true } },
];
const lookupBrand = [
  ...lookupItem,
  { $lookup: { from: "brands", localField: "itemDoc.brandId", foreignField: "_id", as: "brandDoc" } },
  { $unwind: { path: "$brandDoc", preserveNullAndEmptyArrays: true } },
];

// match -> unwind lines -> drop cancelled/returned -> (lookups) -> group by `key`, sorted by revenue.
const linesRevenueBy = (match, key, { pre = [], acc = {}, limit } = {}) => [
  { $match: match }, { $unwind: "$lines" }, { $match: LINE_OK }, ...pre,
  { $group: { _id: key, revenue: { $sum: LINE_REV }, ...acc } },
  { $sort: { revenue: -1 } },
  ...(limit ? [{ $limit: limit }] : []),
];

// A customer is the saved Customer when linked, else the typed phone number (walk-ins who left a phone).
const CUSTOMER_KEY = { $ifNull: ["$customerId", "$customerSnapshot.phone"] };
const HAS_CUSTOMER = { $or: [{ customerId: { $exists: true, $ne: null } }, { "customerSnapshot.phone": { $nin: [null, ""] } }] };

module.exports = { LINE_OK, LINE_REV, lookupCategory, lookupBrand, linesRevenueBy, CUSTOMER_KEY, HAS_CUSTOMER };