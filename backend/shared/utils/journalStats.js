// Revenue / expense / balance queries over JournalEntry, shared by dashboard + analytics.
// `extra` is an optional journal match (e.g. an outlet filter on the `outlet` field).
const JournalEntry = require("../models/JournalEntry");
const { groupExprForPeriod } = require("./dateRanges");

const JOIN_ACCOUNT = [
  { $unwind: "$lines" },
  { $lookup: { from: "chartofaccounts", localField: "lines.account", foreignField: "_id", as: "acct" } },
  { $unwind: "$acct" },
];
const inRange = (businessId, from, to, extra = {}) => ({ $match: { businessId, date: { $gte: from, $lt: to }, ...extra } });

async function totalByType(businessId, from, to, type, side, extra) {
  const [agg] = await JournalEntry.aggregate([
    inRange(businessId, from, to, extra), ...JOIN_ACCOUNT,
    { $match: { "acct.type": type } },
    { $group: { _id: null, total: { $sum: `$lines.${side}` } } },
  ]);
  return agg?.total || 0;
}
const revenueTotalFor = (b, f, t, extra) => totalByType(b, f, t, "revenue", "credit", extra);
const expenseTotalFor = (b, f, t, extra) => totalByType(b, f, t, "expense", "debit", extra);

const byBucket = (businessId, period, from, to, type, side, extra) =>
  JournalEntry.aggregate([
    inRange(businessId, from, to, extra), ...JOIN_ACCOUNT,
    { $match: { "acct.type": type } },
    { $group: { _id: groupExprForPeriod(period, "date"), total: { $sum: `$lines.${side}` } } },
  ]);

// All-time balance for account codes, on the account type's normal side.
async function accountBalance(businessId, codes, normalSide) {
  const [agg] = await JournalEntry.aggregate([
    { $match: { businessId } }, ...JOIN_ACCOUNT,
    { $match: { "acct.code": { $in: codes } } },
    { $group: { _id: null, debit: { $sum: "$lines.debit" }, credit: { $sum: "$lines.credit" } } },
  ]);
  const d = agg?.debit || 0, c = agg?.credit || 0;
  return normalSide === "debit" ? d - c : c - d;
}

module.exports = { JOIN_ACCOUNT, inRange, revenueTotalFor, expenseTotalFor, byBucket, accountBalance };