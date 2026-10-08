const Subscription = require("../../modules/admin/models/Subscription");
const Business = require("../models/Business");
const { sweepSubscriptions, sweepOverdue, createRenewalInvoice } = require("../../modules/admin/utils/billing");
const { notify } = require("../services/notify");

const DAY = 864e5;
const RENEW_DAYS = 7;
const fmt = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
let lastErrorLogged = 0;

async function tell(businessId, title, message) {
  const biz = await Business.findById(businessId, "ownerId").lean();
  await notify({ businessId, userId: biz?.ownerId, type: "subscription", title, message, section: "subscription" });
}

async function sweep() {
  const { expiredTrials, pastDue } = await sweepSubscriptions();
  await sweepOverdue();
  const now = new Date();

  for (const s of expiredTrials) await tell(s.businessId, "Your free trial has ended", "Choose a plan from Subscription to keep using Samsthe.");
  for (const s of pastDue) await tell(s.businessId, "Your subscription period has ended", "Pay your renewal invoice from Subscription to avoid losing access.");

  const ending = await Subscription.find({
    status: "TRIAL", trialEndsAt: { $gte: now, $lte: new Date(now.getTime() + 3 * DAY) }, trialReminderSentAt: null,
  }).limit(200);
  for (const s of ending) {
    s.trialReminderSentAt = now;
    await s.save();
    await tell(s.businessId, "Your free trial ends soon", `Your trial ends on ${fmt(s.trialEndsAt)}. Choose a plan from Subscription to keep going.`);
  }

  // Auto-send renewal invoices. createRenewalInvoice skips if one is already open, so this is safe to repeat.
  const renewing = await Subscription.find({
    status: { $in: ["ACTIVE", "PAST_DUE"] }, amount: { $gt: 0 },
    currentPeriodEnd: { $lte: new Date(now.getTime() + RENEW_DAYS * DAY) },
  }).limit(200);
  for (const s of renewing) {
    const { invoice } = await createRenewalInvoice(s, undefined, "sent");
    if (invoice) {
      await tell(s.businessId, "Renewal invoice ready",
        `${invoice.invoiceNumber} for ₹${invoice.total.toLocaleString("en-IN")} is due ${fmt(invoice.dueDate)}. Pay it from Subscription.`);
    }
  }
}

function startSubscriptionSweepJob() {
  const run = async () => {
    try { await sweep(); }
    catch (err) {
      if (Date.now() - lastErrorLogged > 5 * 60 * 1000) {
        console.error("Subscription sweep failed:", err.message);
        lastErrorLogged = Date.now();
      }
    }
  };
  run();
  setInterval(run, 10 * 60 * 1000);
}

module.exports = { startSubscriptionSweepJob };