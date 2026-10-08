const Invoice = require("../models/Invoice");
const Payment = require("../models/Payment");
const Subscription = require("../models/Subscription");
const PricingPlan = require("../models/PricingPlan");
const Business = require("../../../shared/models/Business");
const App = require("../../../shared/models/app");

async function appMaps() {
  const apps = await App.find({}, "slug name");
  return {
    slugById: new Map(apps.map((a) => [String(a._id), a.slug])),
    idBySlug: new Map(apps.map((a) => [a.slug, a._id])),
  };
}

const withAppType = (b, maps) =>
  b
    ? {
        ...b,
        appType: maps.slugById.get(String(b.appId)) || null,
      }
    : b;

const shapeSub = (s) =>
  s && {
    ...s,
    plan: s.planId?.key,
    planName: s.planId?.name,
    planId: s.planId?._id || s.planId,
    pendingPlan: s.pendingPlanId?.key,
    pendingPlanName: s.pendingPlanId?.name,
    pendingPlanId: s.pendingPlanId?._id || s.pendingPlanId,
  };

async function paidTotals(invoiceIds) {
  const rows = await Payment.aggregate([
    {
      $match: {
        invoiceId: { $in: invoiceIds },
        status: "paid",
      },
    },
    {
      $group: {
        _id: "$invoiceId",
        total: { $sum: "$amount" },
      },
    },
  ]);

  return new Map(rows.map((r) => [String(r._id), r.total]));
}

async function nextInvoiceNumber() {
  const last = await Invoice.findOne({}, "invoiceNumber")
    .sort({ createdAt: -1 })
    .lean();

  const n = last
    ? parseInt(last.invoiceNumber.replace(/\D/g, ""), 10) || 0
    : 0;

  return `INV-${String(n + 1).padStart(4, "0")}`;
}

async function sweepOverdue() {
  await Invoice.updateMany(
    {
      status: "sent",
      dueDate: { $lt: new Date() },
    },
    {
      $set: { status: "overdue" },
    }
  );
}

async function extendSubscription(subscriptionId) {
  const sub = await Subscription.findById(subscriptionId);

  if (!sub || sub.status === "CANCELLED") return;

  if (sub.pendingPlanId) {
  const plan = await PricingPlan.findById(sub.pendingPlanId);
  if (plan) {
    const cycle = sub.pendingBillingCycle || "monthly";
    sub.planId = plan._id;
    sub.billingCycle = cycle;
    sub.amount = cycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
    sub.limits = { maxOutlets: plan.limits.maxOutlets, maxStaff: plan.limits.maxStaff };
    sub.trialEndsAt = undefined;
    sub.currentPeriodEnd = undefined; // new period starts from now, not stacked on leftover trial days
  }
  sub.pendingPlanId = undefined;
  sub.pendingBillingCycle = undefined;
}

  const now = new Date();

  const end =
    sub.currentPeriodEnd && sub.currentPeriodEnd > now
      ? new Date(sub.currentPeriodEnd)
      : new Date(now);

  if (sub.billingCycle === "yearly") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }

  sub.status = "ACTIVE";
  sub.currentPeriodStart = now;
  sub.currentPeriodEnd = end;

  await sub.save();
}

async function syncInvoice(invoiceId) {
  const invoice = await Invoice.findById(invoiceId);

  if (!invoice || ["draft", "cancelled"].includes(invoice.status)) {
    return invoice;
  }

  const paid =
    (await paidTotals([invoice._id])).get(String(invoice._id)) || 0;

  const wasPaid = invoice.status === "paid";

  if (invoice.total > 0 && paid + 0.01 >= invoice.total) {
    invoice.status = "paid";
    invoice.paidAt = invoice.paidAt || new Date();
  } else if (wasPaid) {
    invoice.status =
      invoice.dueDate < new Date() ? "overdue" : "sent";

    invoice.paidAt = null;
  }

  await invoice.save();

  if (
    !wasPaid &&
    invoice.status === "paid" &&
    invoice.subscriptionId
  ) {
    await extendSubscription(invoice.subscriptionId);
  }

  return invoice;
}

async function clientOptions() {
  const [clients, subs, maps] = await Promise.all([
    Business.find({}, "name appId")
      .sort({ name: 1 })
      .limit(500)
      .lean(),

    Subscription.find(
      {},
      "businessId planId billingCycle amount"
    )
      .populate("planId", "key name")
      .lean(),

    appMaps(),
  ]);

  const byClient = new Map(
    subs.map((s) => [String(s.businessId), shapeSub(s)])
  );

  return clients.map((c) => ({
    ...withAppType(c, maps),
    subscription:
      byClient.get(String(c._id)) || null,
  }));
}

async function sweepSubscriptions() {
  const now = new Date();
  const expiredTrials = await Subscription.find({ status: "TRIAL", trialEndsAt: { $lt: now } }, "_id businessId").lean();
  const pastDue = await Subscription.find({ status: "ACTIVE", currentPeriodEnd: { $lt: now } }, "_id businessId").lean();
  if (expiredTrials.length) await Subscription.updateMany({ _id: { $in: expiredTrials.map((s) => s._id) } }, { $set: { status: "EXPIRED" } });
  if (pastDue.length) await Subscription.updateMany({ _id: { $in: pastDue.map((s) => s._id) } }, { $set: { status: "PAST_DUE" } });
  return { expiredTrials, pastDue };
}

async function createRenewalInvoice(sub, adminId, status = "draft", override) {
  const amount = override?.amount ?? sub.amount;
  const cycle = override?.billingCycle || sub.billingCycle;
  if (!amount || amount <= 0) return { skipped: "free plan" };

  const open = await Invoice.exists({
  subscriptionId: sub._id, kind: "subscription",
  status: { $in: ["draft", "sent", "overdue"] },
});

  if (open) {
    return { skipped: "open invoice exists" };
  }

  const plan = await PricingPlan.findById(override?.planId || sub.planId, "name key");
  const planName = plan?.name || plan?.key || "Subscription";

  const due = override
    ? new Date(Date.now() + 7 * 864e5)
    : sub.currentPeriodEnd && sub.currentPeriodEnd > new Date() ? sub.currentPeriodEnd : new Date(Date.now() + 7 * 864e5);
  const label = `${planName} plan (${cycle}) — ${override ? "plan change" : "renewal"}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const invoice = new Invoice({
        invoiceNumber: await nextInvoiceNumber(),
        kind: "subscription",
        businessId:
          sub.businessId?._id || sub.businessId,

        subscriptionId: sub._id,

        lineItems: [
          {
            description: label,
            quantity: 1,
            unitPrice: amount,
            amount: amount,
          },
        ],

        dueDate: due,
        status,
        createdBy: adminId,
      });

      invoice.recalculate();

      await invoice.save();

      return { invoice };
    } catch (err) {
      if (err.code !== 11000) {
        throw err;
      }
    }
  }

  return {
    skipped: "couldn't allocate an invoice number",
  };
}

module.exports = {
  appMaps,
  withAppType,
  shapeSub,
  paidTotals,
  nextInvoiceNumber,
  sweepOverdue,
  syncInvoice,
  clientOptions,
  sweepSubscriptions,
  createRenewalInvoice,
  extendSubscription,
};