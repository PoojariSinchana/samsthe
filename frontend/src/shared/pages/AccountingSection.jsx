import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import * as acc from "../api/accountingApi";
import * as pur from "../api/purchasesApi";
import { getOutlets } from "../api/outlets";
import { todayStr, startOfLocalDay, endOfLocalDay } from "../utils/dateRange";
import { usePlan } from "../context/PlanContext";
const FULL_TABS = ["Chart of Accounts", "Journal Entries", "General Ledger", "Financial Statements"];


const TABS = ["Overview", "Receivables", "Payables", "Chart of Accounts", "Journal Entries", "General Ledger", "Financial Statements"];
const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"];

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const smallInputCls = "rounded-sm border border-charcoal-lighter bg-charcoal px-3 py-2 text-sm text-cream focus:border-saffron focus:outline-none";
const labelCls = "mb-1 block text-xs text-muted";
const TYPE_COLOR = { asset: "text-sage", liability: "text-brick", equity: "text-saffron", revenue: "text-sage", expense: "text-brick" };



function money(n) {
  return `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function firstOfMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function AccountingSection() {
  const { user } = useAuth();
  const isOwner = user.role === "owner";
  const { isLocked, openUpgrade } = usePlan();

  const [tab, setTab] = useState("Overview");
  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [ledgerAccountId, setLedgerAccountId] = useState("");
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [outlets, setOutlets] = useState([]);
  const [outlet, setOutlet] = useState("");

  const [from, setFrom] = useState(firstOfMonthStr());
  const [to, setTo] = useState(todayStr());
  const [asOf, setAsOf] = useState(todayStr());

  useEffect(() => { getOutlets().then((res) => setOutlets(res.outlets)); }, []);

  const loadAccounts = useCallback(async () => {
    const res = await acc.getAccounts();
    setAccounts(res.accounts);
    return res.accounts;
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        if (["Chart of Accounts", "General Ledger", "Journal Entries"].includes(tab)) {
          const accts = await loadAccounts();
          if (tab === "Journal Entries") setEntries((await acc.getEntries()).entries);
          if (tab === "General Ledger" && !ledgerAccountId && accts.length) setLedgerAccountId(accts[0]._id);
        }
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load accounting data");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab === "General Ledger" && ledgerAccountId) {
      acc.getLedger(ledgerAccountId).then(setLedger).catch(() => setLedger(null));
    }
  }, [tab, ledgerAccountId]);

  async function reloadAfterNewEntry() {
    setShowNewEntry(false);
    setEntries((await acc.getEntries()).entries);
  }

  const periodParams = useMemo(() => ({ from: startOfLocalDay(from), to: endOfLocalDay(to) }), [from, to]);
  const asOfParams = useMemo(() => ({ asOf: endOfLocalDay(asOf) }), [asOf]);
  const showPeriodFilter = ["Overview", "Financial Statements"].includes(tab);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream">Accounting</h1>
          <p className="mt-1 text-sm text-muted">Every sale posts here automatically — use manual entries for adjustments, rent, payroll, etc.</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-charcoal-lighter">
        {TABS.map((t) => (
          <button key={t} onClick={() => (FULL_TABS.includes(t) && isLocked("accounting_full") ? openUpgrade("accounting_full") : setTab(t))}
            className={`whitespace-nowrap px-3 py-2 text-sm ${tab === t ? "border-b-2 border-saffron text-saffron" : "text-muted hover:text-cream"}`}>
            {t}
          </button>
        ))}
      </div>

      {showPeriodFilter && (
        <div className="receipt-card relative rounded-sm px-5 pb-4 pt-7">
          <span className="receipt-notch left-6" />
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className={labelCls}>Period from</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={smallInputCls} />
            </div>
            <div>
              <label className={labelCls}>Period to</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={smallInputCls} />
            </div>
            <div className="h-8 w-px bg-charcoal-lighter" />
            <div>
              <label className={labelCls}>As of (Balance Sheet / Trial Balance)</label>
              <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className={smallInputCls} />
            </div>
            {outlets.length > 1 && (
              <div>
                <label className={labelCls}>Outlet</label>
                <select value={outlet} onChange={(e) => setOutlet(e.target.value)} className={smallInputCls}>
                  <option value="">All outlets</option>
                  {outlets.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
                </select>
              </div>
            )}
            <button
              onClick={() => { setFrom(firstOfMonthStr()); setTo(todayStr()); setAsOf(todayStr()); }}
              className="pb-2 text-sm text-muted hover:text-cream"
            >
              Reset to this month
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-brick">{error}</p>}

      {tab === "Overview" && <OverviewTab periodParams={periodParams} asOfParams={asOfParams} outlet={outlet} />}
      {tab === "Receivables" && <ReceivablesTab />}
      {tab === "Payables" && <PayablesTab />}

      {tab === "Chart of Accounts" && (
        <ChartOfAccountsTab
          accounts={accounts}
          loading={loading}
          canManage={isOwner}
          onAdd={() => setShowNewAccount(true)}
          onDeactivate={async (id) => {
            try {
              await acc.deactivateAccount(id);
              loadAccounts();
            } catch (err) {
              setError(err.response?.data?.message || "Failed to deactivate account");
            }
          }}
        />
      )}

      {tab === "Journal Entries" && (
        <JournalEntriesTab entries={entries} loading={loading} onNew={() => setShowNewEntry(true)} />
      )}

      {tab === "General Ledger" && (
        <GeneralLedgerTab accounts={accounts} accountId={ledgerAccountId} onSelectAccount={setLedgerAccountId} ledger={ledger} />
      )}

      {tab === "Financial Statements" && (
        <FinancialStatementsTab periodParams={periodParams} asOfParams={asOfParams} />
      )}

      {showNewAccount && (
        <NewAccountModal onClose={() => setShowNewAccount(false)} onSaved={async () => { setShowNewAccount(false); await loadAccounts(); }} />
      )}
      {showNewEntry && (
        <ManualEntryModal accounts={accounts} onClose={() => setShowNewEntry(false)} onSaved={reloadAfterNewEntry} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Overview — date-aware
// ═══════════════════════════════════════════════════════════════════════
function OverviewTab({ periodParams, asOfParams, outlet }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = { ...periodParams, ...asOfParams };
    if (outlet) params.outlet = outlet;
    acc.getOverview(params)
      .then(setData)
      .catch((err) => setError(err.response?.data?.message || "Failed to load overview"))
      .finally(() => setLoading(false));
  }, [periodParams, asOfParams, outlet]);

  if (loading) return <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">Loading…</div>;
  if (error) return <p className="text-sm text-brick">{error}</p>;
  if (!data) return null;

  return (
    <div className="receipt-card rounded-sm px-5 pb-6 pt-8">
      <span className="receipt-notch left-6" />
      <p className="mb-3 text-xs text-muted">
        Balance-sheet figures as of {new Date(data.asOf).toLocaleDateString("en-IN")} · Revenue/Expenses for{" "}
        {new Date(data.period.from).toLocaleDateString("en-IN")} – {new Date(data.period.to).toLocaleDateString("en-IN")}
      </p>
      <table className="w-full text-sm">
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.label} className={`border-b border-charcoal-lighter/50 ${r.isNet ? "font-medium" : ""}`}>
              <td className="py-2.5 pr-3 text-cream">{r.label}</td>
              <td className={`py-2.5 text-right ${r.isNet ? (r.amount >= 0 ? "text-sage" : "text-brick") : r.isPayable || r.isExpense ? "text-brick" : "text-cream"}`}>
                {money(r.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Receivables — unchanged
// ═══════════════════════════════════════════════════════════════════════
function ReceivablesTab() {
  const [status, setStatus] = useState("outstanding");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    acc.getReceivables({ status: status === "all" ? undefined : status })
      .then(setData)
      .catch((err) => setError(err.response?.data?.message || "Failed to load receivables"))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {["outstanding", "overdue", "all"].map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`rounded-sm border px-3 py-1.5 text-sm capitalize ${status === s ? "border-saffron text-saffron" : "border-charcoal-lighter text-muted hover:text-cream"}`}>
              {s}
            </button>
          ))}
        </div>
        {data && <p className="text-sm text-muted">Total outstanding: <span className="text-brick font-medium">{money(data.totalOutstanding)}</span></p>}
      </div>

      {error && <p className="text-sm text-brick">{error}</p>}

      <div className="receipt-card rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <p className="mb-3 text-xs text-muted">
          Operational AR from unpaid order bills — not yet a journal-backed Customer Receivable balance, since revenue currently posts only when payment is received.
        </p>
        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : !data?.receivables.length ? (
          <p className="text-muted">Nothing outstanding.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-charcoal-lighter text-left text-muted">
                  <th className="py-2 pr-3">Order</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Outlet / Table</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3 text-right">Total</th>
                  <th className="py-2 pr-3 text-right">Paid</th>
                  <th className="py-2 pr-3 text-right">Due</th>
                </tr>
              </thead>
              <tbody>
                {data.receivables.map((o) => (
                  <tr key={o._id} className="border-b border-charcoal-lighter/50">
                    <td className="py-2 pr-3 text-cream">{o.orderNumber}</td>
                    <td className="py-2 pr-3 text-muted">{o.customer?.name || "—"}</td>
                    <td className="py-2 pr-3 text-muted">{o.outlet?.name}{o.table ? ` · ${o.table.name || o.table.tableNumber}` : ""}</td>
                    <td className="py-2 pr-3 text-muted">{new Date(o.createdAt).toLocaleDateString("en-IN")}</td>
                    <td className="py-2 pr-3 text-right text-cream">{money(o.total)}</td>
                    <td className="py-2 pr-3 text-right text-sage">{money(o.amountPaid)}</td>
                    <td className="py-2 pr-3 text-right text-brick">{money(o.amountDue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Payables — unchanged
// ═══════════════════════════════════════════════════════════════════════
function PayablesTab() {
  const [status, setStatus] = useState("outstanding");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payingId, setPayingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await acc.getPayables({ status: status === "all" ? undefined : status });
      setData(res);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load payables");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {["outstanding", "overdue", "all"].map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`rounded-sm border px-3 py-1.5 text-sm capitalize ${status === s ? "border-saffron text-saffron" : "border-charcoal-lighter text-muted hover:text-cream"}`}>
              {s}
            </button>
          ))}
        </div>
        {data && <p className="text-sm text-muted">Total outstanding: <span className="text-brick font-medium">{money(data.totalOutstanding)}</span></p>}
      </div>

      {error && <p className="text-sm text-brick">{error}</p>}

      <div className="receipt-card rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : !data?.payables.length ? (
          <p className="text-muted">Nothing outstanding. Purchases bought on credit will show up here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-charcoal-lighter text-left text-muted">
                  <th className="py-2 pr-3">Supplier</th>
                  <th className="py-2 pr-3">Outlet</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Total</th>
                  <th className="py-2 pr-3 text-right">Paid</th>
                  <th className="py-2 pr-3 text-right">Due</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.payables.map((p) => (
                  <tr key={p._id} className="border-b border-charcoal-lighter/50">
                    <td className="py-2 pr-3 text-cream">{p.supplier?.name || "—"}</td>
                    <td className="py-2 pr-3 text-muted">{p.outlet?.name}</td>
                    <td className="py-2 pr-3 text-muted">{new Date(p.date).toLocaleDateString("en-IN")}</td>
                    <td className="py-2 pr-3 capitalize text-muted">{p.paymentStatus}</td>
                    <td className="py-2 pr-3 text-right text-cream">{money(p.totalAmount)}</td>
                    <td className="py-2 pr-3 text-right text-sage">{money(p.amountPaid)}</td>
                    <td className="py-2 pr-3 text-right text-brick">{money(p.amountDue)}</td>
                    <td className="py-2 pr-3 text-right">
                      {p.amountDue > 0 && (
                        <button onClick={() => setPayingId(p._id)} className="text-xs text-saffron hover:underline">Pay</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {payingId && (
        <PayPurchaseModal
          purchase={data.payables.find((p) => p._id === payingId)}
          onClose={() => setPayingId(null)}
          onSaved={() => { setPayingId(null); load(); }}
        />
      )}
    </div>
  );
}

function PayPurchaseModal({ purchase, onClose, onSaved }) {
  const [amount, setAmount] = useState(purchase.amountDue.toFixed(2));
  const [method, setMethod] = useState("cash");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await pur.addPurchasePayment(purchase._id, { method, amount: Number(amount) });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to record payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={handleSubmit} className="receipt-card w-full max-w-sm rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-cream">Pay {purchase.supplier?.name}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-cream">✕</button>
        </div>
        <p className="mt-1 text-xs text-muted">Outstanding: {money(purchase.amountDue)}</p>
        {error && <p className="mt-2 text-sm text-brick">{error}</p>}
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs text-muted">Amount</label>
            <input type="number" min="0.01" step="0.01" max={purchase.amountDue} value={amount} onChange={(e) => setAmount(e.target.value)} required className={`mt-1 ${inputCls}`} />
          </div>
          <div>
            <label className="text-xs text-muted">Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={`mt-1 ${inputCls}`}>
              {["cash", "card", "upi", "bank", "other"].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
          <button disabled={saving} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">
            {saving ? "Saving…" : "Record payment"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Financial Statements — date-aware
// ═══════════════════════════════════════════════════════════════════════
const STATEMENTS = ["Profit & Loss", "Balance Sheet", "Cash Flow", "Owner's Equity", "Trial Balance"];

function FinancialStatementsTab({ periodParams, asOfParams }) {
  const [statement, setStatement] = useState("Profit & Loss");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {STATEMENTS.map((s) => (
          <button key={s} onClick={() => setStatement(s)}
            className={`rounded-sm border px-3 py-1.5 text-sm ${statement === s ? "border-saffron text-saffron" : "border-charcoal-lighter text-muted hover:text-cream"}`}>
            {s}
          </button>
        ))}
      </div>
      {statement === "Profit & Loss" && <ProfitAndLossView periodParams={periodParams} />}
      {statement === "Balance Sheet" && <BalanceSheetView asOfParams={asOfParams} />}
      {statement === "Cash Flow" && <CashFlowView periodParams={periodParams} />}
      {statement === "Owner's Equity" && <OwnersEquityView periodParams={periodParams} />}
      {statement === "Trial Balance" && <TrialBalanceView asOfParams={asOfParams} />}
    </div>
  );
}

function ProfitAndLossView({ periodParams }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    acc.getProfitAndLoss(periodParams).then(setData).finally(() => setLoading(false));
  }, [periodParams]);

  if (loading) return <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">Loading…</div>;
  if (!data) return null;

  return (
    <div className="receipt-card rounded-sm px-5 pb-6 pt-8">
      <span className="receipt-notch left-6" />
      <p className="mb-3 text-xs text-muted">
        {new Date(data.period.from).toLocaleDateString("en-IN")} – {new Date(data.period.to).toLocaleDateString("en-IN")}
      </p>

      <p className="text-sm font-medium text-cream">Revenue</p>
      <table className="mt-1 w-full text-sm">
        <tbody>
          {data.revenue.lines.map((l) => (
            <tr key={l.code} className="border-b border-charcoal-lighter/50">
              <td className="py-1.5 pl-3 text-muted">{l.name}</td>
              <td className="py-1.5 text-right text-cream">{money(l.amount)}</td>
            </tr>
          ))}
          <tr className="font-medium text-cream">
            <td className="py-1.5">Total Revenue</td>
            <td className="py-1.5 text-right text-sage">{money(data.revenue.total)}</td>
          </tr>
        </tbody>
      </table>

      <p className="mt-4 text-sm font-medium text-cream">Expenses</p>
      <table className="mt-1 w-full text-sm">
        <tbody>
          {data.expenses.lines.map((l) => (
            <tr key={l.code} className="border-b border-charcoal-lighter/50">
              <td className="py-1.5 pl-3 text-muted">{l.name}</td>
              <td className="py-1.5 text-right text-cream">{money(l.amount)}</td>
            </tr>
          ))}
          <tr className="font-medium text-cream">
            <td className="py-1.5">Total Expenses</td>
            <td className="py-1.5 text-right text-brick">{money(data.expenses.total)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-4 flex justify-between border-t-2 border-charcoal-lighter pt-3 text-base font-medium">
        <span className="text-cream">Net Profit</span>
        <span className={data.netProfit >= 0 ? "text-sage" : "text-brick"}>{money(data.netProfit)}</span>
      </div>

      <p className="mt-4 text-xs italic text-muted">{data.note}</p>
    </div>
  );
}

function BalanceSheetView({ asOfParams }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    acc.getBalanceSheet(asOfParams).then(setData).finally(() => setLoading(false));
  }, [asOfParams]);

  if (loading) return <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">Loading…</div>;
  if (!data) return null;

  const section = (title, lines, total, extraRow) => (
    <div>
      <p className="text-sm font-medium text-cream">{title}</p>
      <table className="mt-1 w-full text-sm">
        <tbody>
          {lines.map((l) => (
            <tr key={l.code} className="border-b border-charcoal-lighter/50">
              <td className="py-1.5 pl-3 text-muted">{l.name}</td>
              <td className="py-1.5 text-right text-cream">{money(l.balance)}</td>
            </tr>
          ))}
          {extraRow}
          <tr className="font-medium text-cream">
            <td className="py-1.5">Total {title}</td>
            <td className="py-1.5 text-right">{money(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="receipt-card space-y-4 rounded-sm px-5 pb-6 pt-8">
      <span className="receipt-notch left-6" />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">As of {new Date(data.asOf).toLocaleDateString("en-IN")}</p>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${data.balanced ? "bg-sage/10 text-sage" : "bg-brick/10 text-brick"}`}>
          {data.balanced ? "Balanced ✓" : "Out of balance ⚠"}
        </span>
      </div>
      {section("Assets", data.assets.lines, data.assets.total)}
      {section("Liabilities", data.liabilities.lines, data.liabilities.total)}
      {section(
        "Equity",
        data.equity.lines,
        data.equity.total,
        <tr className="border-b border-charcoal-lighter/50">
          <td className="py-1.5 pl-3 text-muted">Retained Earnings</td>
          <td className="py-1.5 text-right text-cream">{money(data.equity.retainedEarnings)}</td>
        </tr>
      )}
    </div>
  );
}

function CashFlowView({ periodParams }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    acc.getCashFlow(periodParams).then(setData).finally(() => setLoading(false));
  }, [periodParams]);

  if (loading) return <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">Loading…</div>;
  if (!data) return null;

  return (
    <div className="receipt-card rounded-sm px-5 pb-6 pt-8">
      <span className="receipt-notch left-6" />
      <p className="mb-3 text-xs text-muted">
        {new Date(data.period.from).toLocaleDateString("en-IN")} – {new Date(data.period.to).toLocaleDateString("en-IN")}
      </p>
      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b border-charcoal-lighter/50">
            <td className="py-2 text-cream">Operating Activities</td>
            <td className={`py-2 text-right ${data.operating >= 0 ? "text-sage" : "text-brick"}`}>{money(data.operating)}</td>
          </tr>
          <tr className="border-b border-charcoal-lighter/50">
            <td className="py-2 text-cream">Investing Activities</td>
            <td className={`py-2 text-right ${data.investing >= 0 ? "text-sage" : "text-brick"}`}>{money(data.investing)}</td>
          </tr>
          <tr className="border-b border-charcoal-lighter/50">
            <td className="py-2 text-cream">Financing Activities</td>
            <td className={`py-2 text-right ${data.financing >= 0 ? "text-sage" : "text-brick"}`}>{money(data.financing)}</td>
          </tr>
          <tr className="font-medium text-cream">
            <td className="py-2">Net Change in Cash</td>
            <td className={`py-2 text-right ${data.netChange >= 0 ? "text-sage" : "text-brick"}`}>{money(data.netChange)}</td>
          </tr>
        </tbody>
      </table>

      {data.lines.length > 0 && (
        <>
          <p className="mt-5 mb-2 text-xs font-medium uppercase tracking-wide text-muted">Movements</p>
          <table className="w-full text-sm">
            <tbody>
              {data.lines.map((l, i) => (
                <tr key={i} className="border-b border-charcoal-lighter/50">
                  <td className="py-1.5 text-muted">{new Date(l.date).toLocaleDateString("en-IN")}</td>
                  <td className="py-1.5 text-cream">{l.description}</td>
                  <td className="py-1.5 capitalize text-muted">{l.bucket}</td>
                  <td className={`py-1.5 text-right ${l.amount >= 0 ? "text-sage" : "text-brick"}`}>{money(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function OwnersEquityView({ periodParams }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    acc.getOwnersEquity(periodParams).then(setData).finally(() => setLoading(false));
  }, [periodParams]);

  if (loading) return <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">Loading…</div>;
  if (!data) return null;

  const rows = [
    { label: "Opening Capital", amount: data.openingCapital },
    { label: "+ Additional Investment", amount: data.additionalInvestment },
    { label: "+ Net Profit", amount: data.netProfit },
    { label: "- Owner Drawings", amount: -data.withdrawals },
  ];

  return (
    <div className="receipt-card rounded-sm px-5 pb-6 pt-8">
      <span className="receipt-notch left-6" />
      <p className="mb-3 text-xs text-muted">
        {new Date(data.period.from).toLocaleDateString("en-IN")} – {new Date(data.period.to).toLocaleDateString("en-IN")}
      </p>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-charcoal-lighter/50">
              <td className="py-2 text-cream">{r.label}</td>
              <td className={`py-2 text-right ${r.amount < 0 ? "text-brick" : "text-cream"}`}>{money(r.amount)}</td>
            </tr>
          ))}
          <tr className="font-medium text-cream">
            <td className="py-2">Closing Owner's Equity</td>
            <td className="py-2 text-right">{money(data.closingCapital)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function TrialBalanceView({ asOfParams }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    acc.getTrialBalance(asOfParams).then(setData).finally(() => setLoading(false));
  }, [asOfParams]);

  if (loading || !data) return <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">Loading…</div>;

  return (
    <div className="receipt-card rounded-sm px-5 pb-6 pt-8">
      <span className="receipt-notch left-6" />
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted">As of {new Date(asOfParams.asOf).toLocaleDateString("en-IN")}</p>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${data.balanced ? "bg-sage/10 text-sage" : "bg-brick/10 text-brick"}`}>
          {data.balanced ? "Balanced ✓" : "Out of balance ⚠"}
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-charcoal-lighter text-left text-muted">
            <th className="py-2 pr-3">Account</th>
            <th className="py-2 pr-3 text-right">Debit</th>
            <th className="py-2 pr-3 text-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.code} className="border-b border-charcoal-lighter/50">
              <td className="py-2 pr-3 text-cream">{r.code} · {r.name}</td>
              <td className="py-2 pr-3 text-right text-cream">{r.debit > 0 ? money(r.debit) : ""}</td>
              <td className="py-2 pr-3 text-right text-muted">{r.credit > 0 ? money(r.credit) : ""}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-charcoal-lighter font-medium text-cream">
            <td className="py-2 pr-3">Total</td>
            <td className="py-2 pr-3 text-right">{money(data.totalDebit)}</td>
            <td className="py-2 pr-3 text-right">{money(data.totalCredit)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Chart of Accounts / Journal Entries / General Ledger — unchanged
// ═══════════════════════════════════════════════════════════════════════
function ChartOfAccountsTab({ accounts, loading, canManage, onAdd, onDeactivate }) {
  return (
    <div className="receipt-card rounded-sm px-5 pb-6 pt-8">
      <span className="receipt-notch left-6" />
      <div className="mb-3 flex justify-end">
        <button onClick={onAdd} className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark">
          + Add Account
        </button>
      </div>
      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-charcoal-lighter text-left text-muted">
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Status</th>
                {canManage && <th className="py-2 pr-3"></th>}
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a._id} className="border-b border-charcoal-lighter/50">
                  <td className="py-2 pr-3 text-muted">{a.code}</td>
                  <td className="py-2 pr-3 text-cream">{a.name}{a.isSystemAccount && <span className="ml-2 text-xs text-muted">(system)</span>}</td>
                  <td className={`py-2 pr-3 capitalize ${TYPE_COLOR[a.type]}`}>{a.type}</td>
                  <td className="py-2 pr-3 text-muted">{a.isActive ? "Active" : "Inactive"}</td>
                  {canManage && (
                    <td className="py-2 pr-3">
                      {!a.isSystemAccount && a.isActive && (
                        <button onClick={() => onDeactivate(a._id)} className="text-xs text-brick hover:underline">Deactivate</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function JournalEntriesTab({ entries, loading, onNew }) {
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button onClick={onNew} className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark">
          + Manual Journal Entry
        </button>
      </div>
      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">No journal entries yet.</div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry._id} className="receipt-card relative rounded-sm px-5 pb-5 pt-7">
              <span className="receipt-notch left-6" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-cream">{entry.description}</p>
                  <p className="text-xs text-muted">
                    {new Date(entry.date).toLocaleDateString("en-IN")}
                    {entry.sourceType !== "manual" && <span className="ml-2 rounded-full bg-saffron/10 px-2 py-0.5 text-saffron">{entry.sourceType.replace("_", " ")}</span>}
                    {entry.sourceType === "manual" && entry.createdBy?.name && <span className="ml-2">by {entry.createdBy.name}</span>}
                  </p>
                </div>
              </div>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {entry.lines.map((line, i) => (
                    <tr key={i} className="border-t border-charcoal-lighter/50">
                      <td className="py-1.5 pr-3 text-cream">{line.account?.code} · {line.account?.name}</td>
                      <td className="py-1.5 pr-3 text-right text-cream">{line.debit > 0 ? money(line.debit) : ""}</td>
                      <td className="py-1.5 text-right text-muted">{line.credit > 0 ? money(line.credit) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GeneralLedgerTab({ accounts, accountId, onSelectAccount, ledger }) {
  return (
    <div className="receipt-card rounded-sm px-5 pb-6 pt-8">
      <span className="receipt-notch left-6" />
      <select value={accountId} onChange={(e) => onSelectAccount(e.target.value)} className={`${inputCls} max-w-xs`}>
        {accounts.map((a) => <option key={a._id} value={a._id}>{a.code} · {a.name}</option>)}
      </select>

      {!ledger ? (
        <p className="mt-4 text-muted">Loading…</p>
      ) : ledger.rows.length === 0 ? (
        <p className="mt-4 text-muted">No activity on this account yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-charcoal-lighter text-left text-muted">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 pr-3 text-right">Debit</th>
                <th className="py-2 pr-3 text-right">Credit</th>
                <th className="py-2 pr-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledger.rows.map((r, i) => (
                <tr key={i} className="border-b border-charcoal-lighter/50">
                  <td className="py-2 pr-3 text-muted">{new Date(r.date).toLocaleDateString("en-IN")}</td>
                  <td className="py-2 pr-3 text-cream">{r.description}</td>
                  <td className="py-2 pr-3 text-right text-cream">{r.debit > 0 ? money(r.debit) : ""}</td>
                  <td className="py-2 pr-3 text-right text-muted">{r.credit > 0 ? money(r.credit) : ""}</td>
                  <td className="py-2 pr-3 text-right font-medium text-cream">{money(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NewAccountModal({ onClose, onSaved }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("expense");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await acc.createAccount({ code, name, type });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create account");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={handleSubmit} className="receipt-card w-full max-w-sm rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-cream">Add Account</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-cream">✕</button>
        </div>
        {error && <p className="mt-2 text-sm text-brick">{error}</p>}
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs text-muted">Code</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 5050" required className={`mt-1 ${inputCls}`} />
          </div>
          <div>
            <label className="text-xs text-muted">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marketing Expense" required className={`mt-1 ${inputCls}`} />
          </div>
          <div>
            <label className="text-xs text-muted">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={`mt-1 ${inputCls}`}>
              {ACCOUNT_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
          <button className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark">Create</button>
        </div>
      </form>
    </div>
  );
}

function ManualEntryModal({ accounts, onClose, onSaved }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState([{ account: "", debit: "", credit: "" }, { account: "", debit: "", credit: "" }]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  function updateLine(i, field, value) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { account: "", debit: "", credit: "" }]);
  }
  function removeLine(i) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!balanced) return setError("Debits and credits must balance before you can save.");
    if (lines.some((l) => !l.account)) return setError("Every line needs an account selected.");

    setSubmitting(true);
    try {
      await acc.createManualEntry({
        date,
        description,
        lines: lines.map((l) => ({ account: l.account, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create entry");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={handleSubmit} className="receipt-card w-full max-w-lg rounded-sm px-5 pb-6 pt-8">
        <span className="receipt-notch left-6" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-cream">Manual Journal Entry</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-cream">✕</button>
        </div>
        {error && <p className="mt-2 text-sm text-brick">{error}</p>}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`mt-1 ${inputCls}`} />
          </div>
          <div>
            <label className="text-xs text-muted">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} required placeholder="e.g. Office rent — September" className={`mt-1 ${inputCls}`} />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="grid grid-cols-[1fr_100px_100px_28px] gap-2 text-xs text-muted">
            <span>Account</span><span className="text-right">Debit</span><span className="text-right">Credit</span><span></span>
          </div>
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-[1fr_100px_100px_28px] items-center gap-2">
              <select value={line.account} onChange={(e) => updateLine(i, "account", e.target.value)} className={inputCls}>
                <option value="">Select…</option>
                {accounts.map((a) => <option key={a._id} value={a._id}>{a.code} · {a.name}</option>)}
              </select>
              <input type="number" min="0" step="0.01" value={line.debit} onChange={(e) => updateLine(i, "debit", e.target.value)} className={`${inputCls} text-right`} />
              <input type="number" min="0" step="0.01" value={line.credit} onChange={(e) => updateLine(i, "credit", e.target.value)} className={`${inputCls} text-right`} />
              {lines.length > 2 && (
                <button type="button" onClick={() => removeLine(i)} className="text-muted hover:text-brick">✕</button>
              )}
            </div>
          ))}
          <button type="button" onClick={addLine} className="text-sm text-saffron hover:text-saffron-dark">+ Add line</button>
        </div>

        <div className={`mt-4 flex justify-between text-sm ${balanced ? "text-sage" : "text-brick"}`}>
          <span>Debit total: {money(totalDebit)}</span>
          <span>Credit total: {money(totalCredit)}</span>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-cream hover:border-saffron">Cancel</button>
          <button disabled={!balanced || submitting} className="rounded-sm bg-saffron px-4 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">
            {submitting ? "Saving…" : "Post Entry"}
          </button>
        </div>
      </form>
    </div>
  );
}