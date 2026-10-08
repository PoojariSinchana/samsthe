const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");
const { scopeToOutletAccess } = require("../middleware/permissionMiddleware");
const { requireFeature } = require("../middleware/planLimits");
const accountingController = require("../controllers/accountingController");

router.use(protect, authorize("owner", "manager", "investor", "partner"), scopeToOutletAccess);

const basic = requireFeature("accounting", "accounting_full");
const full = requireFeature("accounting_full");

// Plus and above
router.get("/overview", basic, accountingController.getOverview);
router.get("/receivables", basic, accountingController.getReceivables);
router.get("/payables", basic, accountingController.getPayables);
// P&L is also used by the Reports page, so either feature unlocks it
router.get("/statements/profit-and-loss", requireFeature("accounting_full", "reports"), accountingController.getProfitAndLoss);

// Pro and above
router.get("/accounts", full, accountingController.getAccounts);
router.post("/accounts", full, authorize("owner", "manager"), accountingController.createAccount);
router.delete("/accounts/:id", full, authorize("owner"), accountingController.deactivateAccount);
router.get("/entries", full, accountingController.getEntries);
router.post("/entries", full, authorize("owner", "manager"), accountingController.createManualEntry);
router.get("/ledger/:accountId", full, accountingController.getLedger);
router.get("/statements/balance-sheet", full, accountingController.getBalanceSheet);
router.get("/statements/cash-flow", full, accountingController.getCashFlow);
router.get("/statements/owners-equity", full, accountingController.getOwnersEquity);
router.get("/statements/trial-balance", full, accountingController.getTrialBalance);
router.get("/trial-balance", full, accountingController.getTrialBalance);

module.exports = router;