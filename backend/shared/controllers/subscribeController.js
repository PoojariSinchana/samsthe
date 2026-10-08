const PricingPlan = require("../../modules/admin/models/PricingPlan");
const Subscription = require("../../modules/admin/models/Subscription");
const Invoice = require("../../modules/admin/models/Invoice");
const Payment = require("../../modules/admin/models/Payment");
const { createRenewalInvoice, paidTotals, extendSubscription } = require("../../modules/admin/utils/billing");
const Business = require("../models/Business");
const App = require("../models/app");
const { fail, send } = require("../utils/httpError");
const { needsPlan, countOutlets, countStaffLogins } = require("../middleware/planLimits");

const HIDE = "-createdAt -updatedAt -__v";
const OPEN = ["draft", "sent", "overdue"];
const slugOf = async (b) => (await App.findById(b.appId, "slug"))?.slug;
const priceOf = (plan, cycle) => (cycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice);

// Cancels open subscription invoices; refuses if money is already against one.
async function cancelOpenSubscriptionInvoices(sub) {
  const open = await Invoice.find({ subscriptionId: sub._id, kind: "subscription", status: { $in: OPEN } }, "_id");
  if (!open.length) return;
  const paid = await paidTotals(open.map((i) => i._id));
  if (open.some((i) => paid.get(String(i._id)) > 0)) {
    throw fail(409, "A payment is already in progress on your current invoice. Please contact support.");
  }
  await Invoice.updateMany({ _id: { $in: open.map((i) => i._id) } }, { status: "cancelled" });
}

// GET /api/business/me/plans (used by the /choose-plan page)
async function getPlans(req, res) {
  try {
    const business = await Business.findById(req.user.businessId);
    const appType = await slugOf(business);
    const [plans, trial, sub] = await Promise.all([
      PricingPlan.find({ appType, isActive: true, isPublic: true, isTrial: false }, HIDE).sort({ sortOrder: 1, monthlyPrice: 1 }),
      business.trialUsedAt ? null : PricingPlan.findOne({ appType, isActive: true, isTrial: true }, HIDE),
      Subscription.findOne({ businessId: business._id }).populate("planId", "key name").lean(),
    ]);
    const invoice = sub?.status === "PENDING"
      ? await Invoice.findOne({ subscriptionId: sub._id, kind: "subscription", status: { $in: ["sent", "overdue"] } }, "invoiceNumber total dueDate").sort({ createdAt: -1 }).lean()
      : null;
    res.json({
      plans, trial, trialUsed: !!business.trialUsedAt, invoice,
      subscription: sub ? { status: sub.status, planName: sub.planId?.name, billingCycle: sub.billingCycle } : null,
    });
  } catch (err) { send(res, err, "Failed to load plans"); }
}

// POST /api/business/me/subscribe: only for businesses with no plan yet, or a lapsed/PENDING one.
async function subscribe(req, res) {
  try {
    const { planKey, billingCycle = "monthly" } = req.body;
    if (!["monthly", "yearly"].includes(billingCycle)) throw fail(400, "Invalid billing cycle");

    const business = await Business.findById(req.user.businessId);
    const appType = await slugOf(business);
    const plan = await PricingPlan.findOne({ appType, key: String(planKey || "").toLowerCase(), isActive: true });
    if (!plan || (!plan.isTrial && !plan.isPublic)) throw fail(404, "Plan not found");

    let sub = await Subscription.findOne({ businessId: business._id });
    if (sub && !needsPlan(sub)) throw fail(409, "You already have a plan. Use Subscription to change it.");
    if (sub) { sub.cancelledAt = null; sub.cancelReason = ""; sub.pendingPlanId = undefined; sub.pendingBillingCycle = undefined; }
    if (plan.isTrial && business.trialUsedAt) throw fail(403, "The free trial has already been used. Please choose a paid plan.");

    if (!sub) sub = new Subscription({ businessId: business._id });
    const now = new Date();
    sub.planId = plan._id;
    sub.limits = { maxOutlets: plan.limits.maxOutlets, maxStaff: plan.limits.maxStaff };

    if (plan.isTrial) {
      const end = new Date(now.getTime() + (plan.trialDays || 0) * 864e5);
      Object.assign(sub, { status: "TRIAL", amount: 0, billingCycle: "monthly", trialEndsAt: end, currentPeriodStart: now, currentPeriodEnd: end });
      await sub.save();
      business.trialUsedAt = now;
      await business.save();
      return res.status(201).json({ message: "Free trial started", status: "TRIAL" });
    }

    const amount = priceOf(plan, billingCycle);
    sub.billingCycle = billingCycle;
    sub.amount = amount;
    sub.trialEndsAt = undefined;

    if (amount <= 0) {
      const end = new Date(now);
      billingCycle === "yearly" ? end.setFullYear(end.getFullYear() + 1) : end.setMonth(end.getMonth() + 1);
      Object.assign(sub, { status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: end });
      await sub.save();
      return res.status(201).json({ message: "Plan activated", status: "ACTIVE" });
    }

    Object.assign(sub, { status: "PENDING", currentPeriodStart: now, currentPeriodEnd: undefined });
    await sub.save();
    await Invoice.updateMany({ subscriptionId: sub._id, kind: "subscription", status: { $in: OPEN } }, { status: "cancelled" });
    await Payment.updateMany({ subscriptionId: sub._id, status: "pending" }, { status: "failed", rejectReason: "Plan changed before verification" });
    const { invoice } = await createRenewalInvoice(sub, undefined, "sent");
    res.status(201).json({
      message: "Plan selected. Your invoice has been sent.", status: "PENDING",
      invoice: invoice ? { invoiceNumber: invoice.invoiceNumber, total: invoice.total, dueDate: invoice.dueDate } : null,
    });
  } catch (err) { send(res, err, "Failed to select plan"); }
}

// GET /api/business/me/subscription: everything the Subscription page shows.
async function mySubscription(req, res) {
  try {
    const business = await Business.findById(req.user.businessId);
    const appType = await slugOf(business);
    const sub = await Subscription.findOne({ businessId: business._id })
      .populate("planId", "key name description features modules limits isTrial")
      .populate("pendingPlanId", "key name monthlyPrice yearlyPrice").lean();

    const [invoices, payments, outlets, staff, plans] = await Promise.all([
      Invoice.find({ businessId: business._id, status: { $ne: "draft" } }).sort({ createdAt: -1 }).limit(24).lean(),
      Payment.find({ businessId: business._id, status: { $in: ["paid", "refunded"] } }).sort({ createdAt: -1 }).limit(24).populate("invoiceId", "invoiceNumber").lean(),
      countOutlets(business._id),
      countStaffLogins(business._id),
      PricingPlan.find({ appType, isActive: true, isPublic: true, isTrial: false }, HIDE).sort({ sortOrder: 1, monthlyPrice: 1 }).lean(),
    ]);
    const paid = await paidTotals(invoices.map((i) => i._id));
    const shaped = invoices.map((i) => {
      const amountPaid = paid.get(String(i._id)) || 0;
      return { ...i, amountPaid, amountDue: Math.max(0, i.total - amountPaid) };
    });
    const open = shaped.find((i) => i.kind === "subscription" && ["sent", "overdue"].includes(i.status));

    const pc = sub?.pendingPlanId?.key ? (sub.pendingBillingCycle || "monthly") : null;
    res.json({
      subscription: sub && {
        status: sub.status, planKey: sub.planId?.key, planName: sub.planId?.name, description: sub.planId?.description,
        isTrial: !!sub.planId?.isTrial, billingCycle: sub.billingCycle, amount: sub.amount,
        memberSince: sub.createdAt, trialEndsAt: sub.trialEndsAt,
        currentPeriodStart: sub.currentPeriodStart, currentPeriodEnd: sub.currentPeriodEnd,
        endsAt: sub.status === "TRIAL" ? sub.trialEndsAt || sub.currentPeriodEnd : sub.currentPeriodEnd,
        cancelReason: sub.cancelReason,
        features: sub.planId?.features || [],
        modules: Array.isArray(sub.planId?.modules) ? sub.planId.modules : null,
        pending: pc && { planKey: sub.pendingPlanId.key, planName: sub.pendingPlanId.name, billingCycle: pc, amount: priceOf(sub.pendingPlanId, pc) },
      },
      usage: {
        outlets: { used: outlets, max: sub?.limits?.maxOutlets ?? null },
        staff: { used: staff, max: sub?.limits?.maxStaff ?? null },
      },
      openInvoice: open && { invoiceNumber: open.invoiceNumber, total: open.total, dueDate: open.dueDate, amountDue: open.amountDue, status: open.status },
      invoices: shaped,
      payments: payments.map((p) => ({
        _id: p._id, amount: p.amount, method: p.method, status: p.status,
        paidAt: p.paidAt || p.createdAt, invoiceNumber: p.invoiceId?.invoiceNumber, reference: p.gatewayReference,
      })),
      plans: plans.map((p) => ({
        ...p,
        blocked: outlets > p.limits.maxOutlets || staff > p.limits.maxStaff
          ? `You currently use ${outlets} outlet(s) and ${staff} staff login(s). ${p.name} allows ${p.limits.maxOutlets} and ${p.limits.maxStaff}.`
          : null,
      })),
      trialUsed: !!business.trialUsedAt,
    });
  } catch (err) { send(res, err, "Failed to load subscription"); }
}

// POST /api/business/me/subscription/change { planKey, billingCycle }
// Upgrade, downgrade, switch cycle, or renew the same plan. The new plan starts when the invoice is paid.
async function changePlan(req, res) {
  try {
    const { planKey, billingCycle = "monthly" } = req.body;
    if (!["monthly", "yearly"].includes(billingCycle)) throw fail(400, "Invalid billing cycle");

    const business = await Business.findById(req.user.businessId);
    const appType = await slugOf(business);
    const plan = await PricingPlan.findOne({ appType, key: String(planKey || "").toLowerCase(), isActive: true, isPublic: true, isTrial: false });
    if (!plan) throw fail(404, "Plan not found");

    const sub = await Subscription.findOne({ businessId: business._id });
    if (!sub) throw fail(409, "Please choose your first plan.");
    if (sub.status === "SUSPENDED") throw fail(403, "This account is suspended. Please contact support.");
    if (needsPlan(sub)) throw fail(409, "Your subscription has ended. Choose a plan to reactivate it.");

    const [outlets, staff] = await Promise.all([countOutlets(business._id), countStaffLogins(business._id)]);
    if (outlets > plan.limits.maxOutlets || staff > plan.limits.maxStaff) {
      throw fail(409, `You use ${outlets} outlet(s) and ${staff} staff login(s), but ${plan.name} allows ${plan.limits.maxOutlets} and ${plan.limits.maxStaff}. Remove some first.`);
    }

    await cancelOpenSubscriptionInvoices(sub);
    const amount = priceOf(plan, billingCycle);
    sub.pendingPlanId = plan._id;
    sub.pendingBillingCycle = billingCycle;
    await sub.save();

    if (amount <= 0) { // free paid-tier: apply right away
      await extendSubscription(sub._id);
      return res.status(201).json({ message: `Switched to ${plan.name}`, applied: true });
    }

    const { invoice, skipped } = await createRenewalInvoice(sub, undefined, "sent", { amount, billingCycle, planId: plan._id });
    if (!invoice) {
      sub.pendingPlanId = undefined; sub.pendingBillingCycle = undefined; await sub.save();
      throw fail(500, `Couldn't create the invoice (${skipped}). Please try again.`);
    }
    res.status(201).json({
      message: `${plan.name} selected. Pay invoice ${invoice.invoiceNumber} to activate it.`,
      invoice: { invoiceNumber: invoice.invoiceNumber, total: invoice.total, dueDate: invoice.dueDate },
    });
  } catch (err) { send(res, err, "Couldn't change your plan"); }
}

// DELETE /api/business/me/subscription/change: drop an unpaid plan change.
async function cancelChange(req, res) {
  try {
    const sub = await Subscription.findOne({ businessId: req.user.businessId });
    if (!sub?.pendingPlanId) throw fail(409, "There's no plan change in progress");
    await cancelOpenSubscriptionInvoices(sub);
    sub.pendingPlanId = undefined;
    sub.pendingBillingCycle = undefined;
    await sub.save();
    res.json({ message: "Plan change cancelled" });
  } catch (err) { send(res, err, "Couldn't cancel the plan change"); }
}

module.exports = { getPlans, subscribe, mySubscription, changePlan, cancelChange };