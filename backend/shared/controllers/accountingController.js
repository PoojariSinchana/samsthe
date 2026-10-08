const mongoose = require("mongoose");
const ChartOfAccount = require("../models/ChartOfAccount");
const { NORMAL_BALANCE } = require("../models/ChartOfAccount");
const JournalEntry = require("../models/JournalEntry");
const Order = require("../models/Order");
const Purchase = require("../models/Purchase");
const { resolveOutletFilter } = require("../middleware/permissionMiddleware");

const oid = (v) => new mongoose.Types.ObjectId(v);

// Seeded the first time any business touches Accounting. isSystemAccount: auto-posting finds these by code.
const DEFAULT_ACCOUNTS = [
  { code: "1000", name: "Cash", type: "asset" },
  { code: "1010", name: "Bank", type: "asset" },
  { code: "1020", name: "UPI / Card Receivable", type: "asset" },
  { code: "1200", name: "Inventory", type: "asset" },
  { code: "2000", name: "Supplier Payable", type: "liability" },
  { code: "2010", name: "Salary Payable", type: "liability" },
  { code: "2020", name: "Tax Payable", type: "liability" },
  { code: "3000", name: "Owner Capital", type: "equity" },
  { code: "3010", name: "Retained Earnings", type: "equity" },
  { code: "4000", name: "Food & Beverage Sales", type: "revenue" },
  { code: "4010", name: "Delivery Sales", type: "revenue" },
  { code: "5000", name: "Cost of Goods Sold", type: "expense" },
  { code: "5010", name: "Rent Expense", type: "expense" },
  { code: "5020", name: "Salary Expense", type: "expense" },
  { code: "5030", name: "Utilities Expense", type: "expense" },
  { code: "5040", name: "Other Expenses", type: "expense" },
  { code: "1030", name: "Customer Receivable", type: "asset" },
  { code: "1300", name: "Equipment & Fixed Assets", type: "asset" },
  { code: "2030", name: "Bank Loan", type: "liability" },
  { code: "4020", name: "Other Income", type: "revenue" },
  { code: "5050", name: "Marketing Expense", type: "expense" },
  { code: "5060", name: "Repairs & Maintenance", type: "expense" },
  { code: "5070", name: "Internet Expense", type: "expense" },
  { code: "4030", name: "Product Sales", type: "revenue" }, // retail counter sales
];

async function ensureDefaultAccounts(businessId) {
  const id = new mongoose.Types.ObjectId(String(businessId));
  const existing = await ChartOfAccount.find({ businessId: id }, "code").lean();
  const have = new Set(existing.map((a) => a.code));
  const missing = DEFAULT_ACCOUNTS.filter((a) => !have.has(a.code));
  if (!missing.length) return;

  try {
    await ChartOfAccount.bulkWrite(
      missing.map((a) => ({
        updateOne: {
          filter: { businessId: id, code: a.code },
          update: { $setOnInsert: { ...a, businessId: id, isSystemAccount: true, isActive: true } },
          upsert: true,
        },
      })),
      { ordered: false }
    );
  } catch (err) {
    // A parallel request created the same accounts first. That's fine, they exist now.
    const dupOnly = err.code === 11000 || (err.writeErrors?.length && err.writeErrors.every((e) => (e.err?.code ?? e.code) === 11000));
    if (!dupOnly) throw err;
  }
}

// Returns the outlet filter, or null after sending the error response (restricted user asked for a foreign outlet).
function outletScope(req, res, field) {
  try {
    return resolveOutletFilter(req, req.query.outlet, field);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
    return null;
  }
}

const accountingController = {
  async getAccounts(req, res) {
    try {
      await ensureDefaultAccounts(req.user.businessId);
      const accounts = await ChartOfAccount.find({ businessId: req.user.businessId }).sort({ code: 1 });
      res.json({ accounts });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch accounts", error: err.message });
    }
  },

  async createAccount(req, res) {
    try {
      const { code, name, type } = req.body;
      if (!code || !name || !type) return res.status(400).json({ message: "code, name, and type are required" });
      const account = await ChartOfAccount.create({ businessId: req.user.businessId, code, name, type });
      res.status(201).json({ message: "Account created", account });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ message: `Account code "${req.body.code}" already exists` });
      res.status(500).json({ message: "Failed to create account", error: err.message });
    }
  },

  // Soft-disable only: an account referenced by journal lines must never disappear.
  async deactivateAccount(req, res) {
    try {
      const account = await ChartOfAccount.findOne({ _id: req.params.id, businessId: req.user.businessId });
      if (!account) return res.status(404).json({ message: "Account not found" });
      if (account.isSystemAccount) return res.status(400).json({ message: "System accounts can't be deactivated" });
      account.isActive = false;
      await account.save();
      res.json({ message: "Account deactivated", account });
    } catch (err) {
      res.status(500).json({ message: "Failed to deactivate account", error: err.message });
    }
  },

  async createManualEntry(req, res) {
    try {
      const { date, description, lines, outlet } = req.body;
      if (!description || !Array.isArray(lines) || lines.length < 2) {
        return res.status(400).json({ message: "description and at least two lines are required" });
      }

      const accountIds = lines.map((l) => l.account);
      const validCount = await ChartOfAccount.countDocuments({ _id: { $in: accountIds }, businessId: req.user.businessId });
      if (validCount !== new Set(accountIds.map(String)).size) {
        return res.status(400).json({ message: "One or more accounts are invalid for this business" });
      }

      const entry = await JournalEntry.create({
        businessId: req.user.businessId,
        outlet: outlet || undefined,
        date: date || Date.now(),
        description,
        lines: lines.map((l) => ({ account: l.account, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
        sourceType: "manual",
        createdBy: req.user._id,
      });

      res.status(201).json({ message: "Journal entry created", entry });
    } catch (err) {
      res.status(400).json({ message: err.message || "Failed to create journal entry" });
    }
  },

  async getEntries(req, res) {
    try {
      const { from, to, sourceType } = req.query;
      const filter = { businessId: req.user.businessId };
      if (sourceType) filter.sourceType = sourceType;
      if (from || to) {
        filter.date = {};
        if (from) filter.date.$gte = new Date(from);
        if (to) filter.date.$lte = new Date(to);
      }

      const entries = await JournalEntry.find(filter)
        .populate("lines.account", "code name")
        .populate("createdBy", "name")
        .sort({ date: -1, createdAt: -1 })
        .limit(200);

      res.json({ entries });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch journal entries", error: err.message });
    }
  },

  async getLedger(req, res) {
    try {
      const account = await ChartOfAccount.findOne({ _id: req.params.accountId, businessId: req.user.businessId });
      if (!account) return res.status(404).json({ message: "Account not found" });

      const { from, to } = req.query;
      const dateFilter = {};
      if (from) dateFilter.$gte = new Date(from);
      if (to) dateFilter.$lte = new Date(to);

      const match = { businessId: oid(req.user.businessId), "lines.account": account._id };
      if (Object.keys(dateFilter).length) match.date = dateFilter;

      const entries = await JournalEntry.find(match).sort({ date: 1, createdAt: 1 });

      const normal = account.normalBalance();
      let balance = 0;
      const rows = [];
      for (const entry of entries) {
        const line = entry.lines.find((l) => l.account.toString() === account._id.toString());
        if (!line) continue;
        balance += normal === "debit" ? line.debit - line.credit : line.credit - line.debit;
        rows.push({ date: entry.date, description: entry.description, debit: line.debit, credit: line.credit, balance, entryId: entry._id });
      }

      res.json({ account: { code: account.code, name: account.name, type: account.type }, rows });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch ledger", error: err.message });
    }
  },

  async getTrialBalance(req, res) {
    try {
      const { asOf } = req.query;
      const match = { businessId: oid(req.user.businessId) };
      if (asOf) match.date = { $lte: new Date(asOf) };

      const entries = await JournalEntry.find(match).populate("lines.account", "code name type");

      const totals = new Map();
      for (const entry of entries) {
        for (const line of entry.lines) {
          if (!line.account) continue;
          const key = line.account._id.toString();
          if (!totals.has(key)) {
            totals.set(key, { code: line.account.code, name: line.account.name, type: line.account.type, debit: 0, credit: 0 });
          }
          const t = totals.get(key);
          t.debit += line.debit;
          t.credit += line.credit;
        }
      }

      const rows = [...totals.values()]
        .map((t) => {
          const normal = NORMAL_BALANCE[t.type];
          const net = normal === "debit" ? t.debit - t.credit : t.credit - t.debit;
          return { code: t.code, name: t.name, type: t.type, debit: normal === "debit" && net > 0 ? net : 0, credit: normal === "credit" && net > 0 ? net : 0 };
        })
        .filter((r) => r.debit !== 0 || r.credit !== 0)
        .sort((a, b) => a.code.localeCompare(b.code));

      const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
      const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

      res.json({ rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch trial balance", error: err.message });
    }
  },

  // Balance-sheet rows are all-time balances as of `asOf`; Revenue/Expenses/Net Profit are for the period (default: this month).
  async getOverview(req, res) {
    try {
      await ensureDefaultAccounts(req.user.businessId);
      const businessId = req.user.businessId;
      const journalFilter = outletScope(req, res, "outlet");      // JournalEntry.outlet
      if (!journalFilter) return;
      const docFilter = outletScope(req, res, "outletId");        // Order.outletId / Purchase.outletId
      if (!docFilter) return;
      const { asOf, from, to } = req.query;

      const asOfDate = asOf ? new Date(asOf) : new Date();
      const periodStart = from ? new Date(from) : new Date(asOfDate.getFullYear(), asOfDate.getMonth(), 1);
      const periodEnd = to ? new Date(to) : asOfDate;

      const balances = await accountBalancesAsOf(businessId, asOfDate);
      const byCode = new Map(balances.map((b) => [b.code, b]));
      const cash = byCode.get("1000")?.balance || 0;
      const bank = byCode.get("1010")?.balance || 0;

      const [receivablesTotal, payablesTotal, periodTotals] = await Promise.all([
        Order.aggregate([
          { $match: { businessId: oid(businessId), status: { $ne: "cancelled" }, amountDue: { $gt: 0 }, ...docFilter } },
          { $group: { _id: null, total: { $sum: "$amountDue" } } },
        ]),
        Purchase.aggregate([
          { $match: { businessId: oid(businessId), amountDue: { $gt: 0 }, ...docFilter } },
          { $group: { _id: null, total: { $sum: "$amountDue" } } },
        ]),
        periodTotalsByType(businessId, periodStart, periodEnd, journalFilter),
      ]);

      const { revenue, expenses } = periodTotals;

      res.json({
        asOf: asOfDate,
        period: { from: periodStart, to: periodEnd },
        rows: [
          { label: "Cash", amount: cash },
          { label: "Bank", amount: bank },
          { label: "Accounts Receivable", amount: receivablesTotal[0]?.total || 0 },
          { label: "Accounts Payable", amount: payablesTotal[0]?.total || 0, isPayable: true },
          { label: "Revenue (period)", amount: revenue },
          { label: "Expenses (period)", amount: expenses, isExpense: true },
          { label: "Net Profit (period)", amount: revenue - expenses, isNet: true },
        ],
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch accounting overview", error: err.message });
    }
  },

  // Operational AR from Order.amountDue (what customers still owe on their bill), not a journal-backed balance:
  // revenue posts only when a payment lands (cash basis), so account 1030 stays at zero.
  async getReceivables(req, res) {
    try {
      const { status } = req.query; // "outstanding" | "overdue" | undefined
      const docFilter = outletScope(req, res, "outletId");
      if (!docFilter) return;
      const filter = { businessId: req.user.businessId, status: { $ne: "cancelled" }, ...docFilter };
      if (status === "outstanding" || status === "overdue") filter.amountDue = { $gt: 0 };

      let orders = await Order.find(filter)
        .select("number channel customerId customerSnapshot total amountPaid amountDue createdAt outletId tableId")
        .populate("outletId", "name")
        .populate("tableId", "name tableNumber")
        .sort({ createdAt: -1 })
        .limit(300);

      if (status === "overdue") {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        orders = orders.filter((o) => o.createdAt < sevenDaysAgo);
      }

      const totalOutstanding = orders.reduce((sum, o) => sum + o.amountDue, 0);
      res.json({ receivables: orders, totalOutstanding, count: orders.length });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch receivables", error: err.message });
    }
  },

  // Purchases bought on credit (or part-paid), backed by journal postings against Supplier Payable (2000).
  async getPayables(req, res) {
    try {
      const { status } = req.query;
      const docFilter = outletScope(req, res, "outletId");
      if (!docFilter) return;
      const filter = { businessId: req.user.businessId, ...docFilter };
      if (status === "outstanding" || status === "overdue") filter.amountDue = { $gt: 0 };

      let purchases = await Purchase.find(filter)
        .select("supplierId totalAmount amountPaid amountDue paymentStatus date outletId")
        .populate("supplierId", "name")
        .populate("outletId", "name")
        .sort({ date: -1 })
        .limit(300);

      if (status === "overdue") {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        purchases = purchases.filter((p) => p.date < thirtyDaysAgo);
      }

      const totalOutstanding = purchases.reduce((sum, p) => sum + p.amountDue, 0);
      res.json({ payables: purchases, totalOutstanding, count: purchases.length });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch payables", error: err.message });
    }
  },

  // COGS isn't split out: inventory purchases are booked as an asset, not expensed on consumption.
  async getProfitAndLoss(req, res) {
    try {
      const businessId = req.user.businessId;
      const to = req.query.to ? new Date(req.query.to) : new Date();
      const from = req.query.from ? new Date(req.query.from) : new Date(to.getFullYear(), to.getMonth(), 1);

      const { revenueLines, expenseLines, revenue, expenses } = await lineItemsByType(businessId, from, to, ["revenue", "expense"]);

      res.json({
        period: { from, to },
        revenue: { lines: revenueLines, total: revenue },
        expenses: { lines: expenseLines, total: expenses },
        netProfit: revenue - expenses,
        note: "Cost of Goods Sold is not yet split out — inventory purchases are booked as an asset, not expensed on consumption.",
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch profit & loss", error: err.message });
    }
  },

  // Equity includes all-time retained earnings so the sheet balances without a period-close step.
  async getBalanceSheet(req, res) {
    try {
      const businessId = req.user.businessId;
      const asOf = req.query.asOf ? new Date(req.query.asOf) : new Date();

      const balances = await accountBalancesAsOf(businessId, asOf);
      const assets = balances.filter((b) => b.type === "asset" && b.balance !== 0);
      const liabilities = balances.filter((b) => b.type === "liability" && b.balance !== 0);
      const equityAccounts = balances.filter((b) => b.type === "equity" && b.balance !== 0);

      const { revenue, expenses } = await periodTotalsByType(businessId, new Date(0), asOf);
      const retainedEarnings = revenue - expenses;

      const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
      const totalLiabilities = liabilities.reduce((s, l) => s + l.balance, 0);
      const totalEquity = equityAccounts.reduce((s, e) => s + e.balance, 0) + retainedEarnings;

      res.json({
        asOf,
        assets: { lines: assets, total: totalAssets },
        liabilities: { lines: liabilities, total: totalLiabilities },
        equity: { lines: equityAccounts, retainedEarnings, total: totalEquity },
        balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch balance sheet", error: err.message });
    }
  },

  // Cash/Bank lines classified by the counterpart account: revenue/expense=operating, asset=investing, liability/equity=financing.
  async getCashFlow(req, res) {
    try {
      const businessId = oid(req.user.businessId);
      const to = req.query.to ? new Date(req.query.to) : new Date();
      const from = req.query.from ? new Date(req.query.from) : new Date(to.getFullYear(), to.getMonth(), 1);

      const cashAccounts = await ChartOfAccount.find({ businessId, code: { $in: ["1000", "1010"] } });
      const cashAccountIds = new Set(cashAccounts.map((a) => a._id.toString()));
      if (cashAccountIds.size === 0) {
        return res.json({ period: { from, to }, operating: 0, investing: 0, financing: 0, netChange: 0, lines: [] });
      }

      const entries = await JournalEntry.find({
        businessId,
        date: { $gte: from, $lte: to },
        "lines.account": { $in: [...cashAccountIds] },
      }).populate("lines.account", "code name type");

      const buckets = { operating: 0, investing: 0, financing: 0 };
      const lines = [];

      for (const entry of entries) {
        const cashLine = entry.lines.find((l) => l.account && cashAccountIds.has(l.account._id.toString()));
        if (!cashLine) continue;
        const netCash = cashLine.debit - cashLine.credit;
        if (netCash === 0) continue;

        const counterpart = entry.lines.find((l) => l.account && !cashAccountIds.has(l.account._id.toString()));
        const counterpartType = counterpart?.account?.type;
        let bucket = "operating";
        if (counterpartType === "asset") bucket = "investing";
        else if (counterpartType === "liability" || counterpartType === "equity") bucket = "financing";

        buckets[bucket] += netCash;
        lines.push({ date: entry.date, description: entry.description, amount: netCash, bucket });
      }

      const netChange = buckets.operating + buckets.investing + buckets.financing;
      res.json({ period: { from, to }, ...buckets, netChange, lines: lines.sort((a, b) => new Date(b.date) - new Date(a.date)) });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch cash flow", error: err.message });
    }
  },

  // Opening Capital + Additional Investment + Net Profit - Drawings.
  async getOwnersEquity(req, res) {
    try {
      const businessId = req.user.businessId;
      const to = req.query.to ? new Date(req.query.to) : new Date();
      const from = req.query.from ? new Date(req.query.from) : new Date(to.getFullYear(), to.getMonth(), 1);

      const [periodMovement, periodProfit, priorProfit] = await Promise.all([
        periodEquityMovement(businessId, from, to),
        periodTotalsByType(businessId, from, to),
        periodTotalsByType(businessId, new Date(0), from),
      ]);

      const opening = await openingOwnersEquity(businessId, from, priorProfit.revenue - priorProfit.expenses);
      const netProfit = periodProfit.revenue - periodProfit.expenses;

      res.json({
        period: { from, to },
        openingCapital: opening,
        additionalInvestment: periodMovement.invested,
        withdrawals: periodMovement.withdrawn,
        netProfit,
        closingCapital: opening + periodMovement.invested - periodMovement.withdrawn + netProfit,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch owner's equity statement", error: err.message });
    }
  },
};

// ═══ Shared aggregation helpers ═══════════════════════════════════════════

async function accountBalancesAsOf(businessId, asOfDate) {
  const accounts = await ChartOfAccount.find({ businessId });
  const entries = await JournalEntry.find({ businessId, date: { $lte: asOfDate } });

  const totals = new Map(accounts.map((a) => [a._id.toString(), { code: a.code, name: a.name, type: a.type, debit: 0, credit: 0 }]));
  for (const entry of entries) {
    for (const line of entry.lines) {
      const t = totals.get(line.account.toString());
      if (!t) continue;
      t.debit += line.debit;
      t.credit += line.credit;
    }
  }

  return [...totals.values()].map((t) => {
    const normal = NORMAL_BALANCE[t.type];
    return { code: t.code, name: t.name, type: t.type, balance: normal === "debit" ? t.debit - t.credit : t.credit - t.debit };
  });
}

async function periodTotalsByType(businessId, from, to, journalFilter = {}) {
  const { revenue, expenses } = await lineItemsByType(businessId, from, to, ["revenue", "expense"], journalFilter);
  return { revenue, expenses };
}

async function lineItemsByType(businessId, from, to, types, journalFilter = {}) {
  const accounts = await ChartOfAccount.find({ businessId, type: { $in: types } });
  const accountIds = accounts.map((a) => a._id);
  const entries = await JournalEntry.find({
    businessId,
    date: { $gte: from, $lte: to },
    "lines.account": { $in: accountIds },
    ...journalFilter,
  });

  const totals = new Map(accounts.map((a) => [a._id.toString(), { code: a.code, name: a.name, type: a.type, amount: 0 }]));
  for (const entry of entries) {
    for (const line of entry.lines) {
      const t = totals.get(line.account.toString());
      if (!t) continue;
      t.amount += NORMAL_BALANCE[t.type] === "debit" ? line.debit - line.credit : line.credit - line.debit;
    }
  }

  const all = [...totals.values()].filter((t) => t.amount !== 0);
  const revenueLines = all.filter((t) => t.type === "revenue");
  const expenseLines = all.filter((t) => t.type === "expense");
  return {
    revenueLines,
    expenseLines,
    revenue: revenueLines.reduce((s, t) => s + t.amount, 0),
    expenses: expenseLines.reduce((s, t) => s + t.amount, 0),
  };
}

// Money the owner put in vs took out (equity credits vs debits), excluding trading profit.
async function periodEquityMovement(businessId, from, to) {
  const accounts = await ChartOfAccount.find({ businessId, type: "equity" });
  const accountIds = new Set(accounts.map((a) => a._id.toString()));
  const entries = await JournalEntry.find({
    businessId,
    date: { $gte: from, $lte: to },
    "lines.account": { $in: [...accountIds] },
  });

  let invested = 0;
  let withdrawn = 0;
  for (const entry of entries) {
    for (const line of entry.lines) {
      if (!accountIds.has(line.account.toString())) continue;
      invested += line.credit;
      withdrawn += line.debit;
    }
  }
  return { invested, withdrawn };
}

async function openingOwnersEquity(businessId, periodStart, priorNetProfit) {
  const balances = await accountBalancesAsOf(businessId, new Date(periodStart.getTime() - 1));
  const equityBalance = balances.filter((b) => b.type === "equity").reduce((s, b) => s + b.balance, 0);
  return equityBalance + priorNetProfit;
}

// ═══ Purchase (payables) postings ═════════════════════════════════════════
const PURCHASE_PAYMENT_ACCOUNT = { cash: "1000", bank: "1010", upi: "1020", card: "1020", other: "1000" };

// Debit Inventory / Credit Supplier Payable for the full purchase.
async function postPurchaseLiability(purchase) {
  await ensureDefaultAccounts(purchase.businessId);
  const [inventoryAccount, payableAccount] = await Promise.all([
    ChartOfAccount.findOne({ businessId: purchase.businessId, code: "1200" }),
    ChartOfAccount.findOne({ businessId: purchase.businessId, code: "2000" }),
  ]);
  if (!inventoryAccount || !payableAccount) return;

  await JournalEntry.deleteOne({ businessId: purchase.businessId, sourceType: "purchase", sourceId: purchase._id });
  await JournalEntry.create({
    businessId: purchase.businessId,
    outlet: purchase.outletId,
    date: purchase.date,
    description: `Purchase — ${purchase.lines.map((l) => l.name).join(", ")}`,
    lines: [
      { account: inventoryAccount._id, debit: purchase.totalAmount, credit: 0 },
      { account: payableAccount._id, debit: 0, credit: purchase.totalAmount },
    ],
    sourceType: "purchase",
    sourceId: purchase._id,
    createdBy: purchase.createdBy,
  });
}

// Debit Supplier Payable / Credit Cash|Bank|UPI for one payment.
async function postPurchasePayment(purchase, payment) {
  await ensureDefaultAccounts(purchase.businessId);
  const payAccountCode = PURCHASE_PAYMENT_ACCOUNT[payment.method] || "1000";
  const [payAccount, payableAccount] = await Promise.all([
    ChartOfAccount.findOne({ businessId: purchase.businessId, code: payAccountCode }),
    ChartOfAccount.findOne({ businessId: purchase.businessId, code: "2000" }),
  ]);
  if (!payAccount || !payableAccount) return;

  await JournalEntry.create({
    businessId: purchase.businessId,
    outlet: purchase.outletId,
    date: payment.paidAt,
    description: "Payment to supplier — purchase settlement",
    lines: [
      { account: payableAccount._id, debit: payment.amount, credit: 0 },
      { account: payAccount._id, debit: 0, credit: payment.amount },
    ],
    sourceType: "purchase",
    sourceId: payment._id,
    createdBy: purchase.createdBy,
  });
}

// ═══ Entry (manual / order-sourced) postings ══════════════════════════════
const ENTRY_PAYMENT_ACCOUNT = { cash: "1000", bank: "1010", upi: "1020", card: "1020", credit: "2000" };

const ENTRY_CATEGORY_ACCOUNT = {
  EXPENSE: { RENT: "5010", ELECTRICITY: "5030", INTERNET: "5070", SALARY: "5020", MARKETING: "5050", REPAIRS: "5060", OTHER: "5040" },
  INVENTORY: {},
  PURCHASE: {},
  ASSET: {},
  INCOME: { FOOD_SALES: "4000", BEVERAGE_SALES: "4000", DELIVERY_SALES: "4010", PRODUCT_SALES: "4030", OTHER_INCOME: "4020" },
  LIABILITY: { LOAN: "2030", TAX: "2020", OTHER: "2030" },
  EQUITY: { OWNER_CAPITAL: "3000", OWNER_WITHDRAWAL: "3000" },
};
const ENTRY_TYPE_FALLBACK_ACCOUNT = { INVENTORY: "1200", PURCHASE: "1200", ASSET: "1300", INCOME: "4020", EQUITY: "3000" };

function resolveEntryAccountCode(entryType, category) {
  return ENTRY_CATEGORY_ACCOUNT[entryType]?.[category] || ENTRY_TYPE_FALLBACK_ACCOUNT[entryType] || "5040";
}

async function postEntry(entry) {
  if (entry.status !== "CONFIRMED" || entry.entryType === "TRANSFER") return;

  await ensureDefaultAccounts(entry.businessId);
  const categoryCode = resolveEntryAccountCode(entry.entryType, entry.category);
  const paymentCode = ENTRY_PAYMENT_ACCOUNT[entry.paymentMethod] || "1000";

  const [categoryAccount, paymentAccount] = await Promise.all([
    ChartOfAccount.findOne({ businessId: entry.businessId, code: categoryCode }),
    ChartOfAccount.findOne({ businessId: entry.businessId, code: paymentCode }),
  ]);
  if (!categoryAccount || !paymentAccount) return;

  // Money coming in: INCOME, or LIABILITY/EQUITY with direction "in" (loan received, capital added).
  // Everything else (expenses, purchases, assets, repayments, drawings) is money going out.
  const moneyIn =
    entry.entryType === "INCOME" ||
    ((entry.entryType === "LIABILITY" || entry.entryType === "EQUITY") && entry.direction !== "out");

  const lines = moneyIn
    ? [
        { account: paymentAccount._id, debit: entry.amount, credit: 0 },
        { account: categoryAccount._id, debit: 0, credit: entry.amount },
      ]
    : [
        { account: categoryAccount._id, debit: entry.amount, credit: 0 },
        { account: paymentAccount._id, debit: 0, credit: entry.amount },
      ];

  await JournalEntry.deleteOne({ businessId: entry.businessId, sourceType: "entry", sourceId: entry._id });
  await JournalEntry.create({
    businessId: entry.businessId,
    outlet: entry.outlet,
    date: entry.date,
    description: entry.description,
    lines,
    sourceType: "entry",
    sourceId: entry._id,
    createdBy: entry.createdBy,
  });
}

async function voidEntryPosting(entry) {
  await JournalEntry.deleteOne({ businessId: entry.businessId, sourceType: "entry", sourceId: entry._id });
}

module.exports = accountingController;
module.exports.postEntry = postEntry;
module.exports.voidEntryPosting = voidEntryPosting;
module.exports.postPurchaseLiability = postPurchaseLiability;
module.exports.postPurchasePayment = postPurchasePayment;
module.exports.ensureDefaultAccounts = ensureDefaultAccounts;