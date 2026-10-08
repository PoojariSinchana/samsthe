import { useEffect, useMemo, useState } from "react";
import StatCard from "../components/StatCard";

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const labelCls = "mb-1 block text-xs text-muted";
const rupees = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;

export default function CalculatorSection() {
  const [tab, setTab] = useState("basic");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-cream sm:text-3xl">Calculator</h1>
        <p className="mt-1 text-sm text-muted">Quick maths and loan planning.</p>
      </div>
      <div className="flex gap-2 border-b border-charcoal-lighter">
        {[["basic", "Calculator"], ["emi", "Loan & EMI"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-2 text-sm ${tab === k ? "border-b-2 border-saffron text-saffron" : "text-muted hover:text-cream"}`}>{l}</button>
        ))}
      </div>
      {tab === "basic" ? <BasicCalculator /> : <EmiCalculator />}
    </div>
  );
}

// ── Basic calculator (no eval — a small state machine) ──────────────────
const fmt = (n) => (Number.isFinite(n) ? String(parseFloat(n.toPrecision(12))) : "Error");
const OPS = { "+": (a, b) => a + b, "-": (a, b) => a - b, "×": (a, b) => a * b, "÷": (a, b) => (b === 0 ? NaN : a / b) };
const KEYMAP = { "*": "×", "/": "÷", Enter: "=", "=": "=", Backspace: "⌫", Escape: "C", Delete: "C" };

function BasicCalculator() {
  const [display, setDisplay] = useState("0");
  const [acc, setAcc] = useState(null);
  const [op, setOp] = useState(null);
  const [fresh, setFresh] = useState(true);
  const [history, setHistory] = useState("");

  function press(k) {
    const err = display === "Error";
    if (/^\d$/.test(k)) {
      setDisplay(fresh || err || display === "0" ? k : display + k);
      setFresh(false);
    } else if (k === ".") {
      if (fresh || err) { setDisplay("0."); setFresh(false); }
      else if (!display.includes(".")) setDisplay(display + ".");
    } else if (OPS[k]) {
      if (err) return;
      const cur = parseFloat(display);
      if (acc !== null && op && !fresh) {
        const r = OPS[op](acc, cur);
        setAcc(r); setDisplay(fmt(r)); setHistory(`${fmt(r)} ${k}`);
      } else { setAcc(cur); setHistory(`${fmt(cur)} ${k}`); }
      setOp(k); setFresh(true);
    } else if (k === "=") {
      if (!op || acc === null || err) return;
      const cur = parseFloat(display);
      setHistory(`${fmt(acc)} ${op} ${fmt(cur)} =`);
      setDisplay(fmt(OPS[op](acc, cur)));
      setAcc(null); setOp(null); setFresh(true);
    } else if (k === "C") {
      setDisplay("0"); setAcc(null); setOp(null); setFresh(true); setHistory("");
    } else if (k === "⌫") {
      if (fresh || err) return;
      setDisplay(display.length > 1 ? display.slice(0, -1) : "0");
    } else if (k === "±") {
      if (!err && display !== "0") setDisplay(display.startsWith("-") ? display.slice(1) : "-" + display);
    } else if (k === "%") {
      if (!err) { setDisplay(fmt(parseFloat(display) / 100)); setFresh(true); }
    }
  }

  useEffect(() => {
    function onKey(e) {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      const k = KEYMAP[e.key] || e.key;
      if (/^[\d.+\-×÷=%C⌫]$/.test(k)) { e.preventDefault(); press(k); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const keys = ["C", "±", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "-", "1", "2", "3", "+", "0", ".", "⌫", "="];
  return (
    <div className="receipt-card relative max-w-xs rounded-sm px-4 pb-5 pt-8">
      <span className="receipt-notch left-6" />
      <p className="h-5 text-right text-xs text-muted">{history}</p>
      <p className="mb-4 truncate text-right font-display text-4xl text-cream">{display}</p>
      <div className="grid grid-cols-4 gap-2">
        {keys.map((k) => {
          const isOp = OPS[k] || k === "=";
          return (
            <button key={k} onClick={() => press(k)}
              className={`rounded-sm py-3 text-lg transition-colors ${
                k === "=" ? "bg-saffron font-medium text-charcoal hover:bg-saffron-dark"
                : isOp ? "border border-saffron text-saffron hover:bg-saffron hover:text-charcoal"
                : "border border-charcoal-lighter text-cream hover:border-saffron"}`}>
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Loan / EMI ──────────────────────────────────────────────────────────
function EmiCalculator() {
  const [amount, setAmount] = useState(500000);
  const [rate, setRate] = useState(9.5);
  const [tenure, setTenure] = useState(5);
  const [unit, setUnit] = useState("years");
  const [showSchedule, setShowSchedule] = useState(false);

  const res = useMemo(() => {
    const P = Number(amount), annual = Number(rate);
    const n = Math.round(unit === "years" ? Number(tenure) * 12 : Number(tenure));
    if (!(P > 0) || !(n > 0) || !(annual >= 0)) return null;
    const r = annual / 1200;
    const emi = r === 0 ? P / n : (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    let bal = P;
    const schedule = Array.from({ length: n }, (_, i) => {
      const interest = bal * r;
      const principal = emi - interest;
      bal = Math.max(bal - principal, 0);
      return { month: i + 1, principal, interest, balance: bal };
    });
    const total = emi * n;
    return { emi, total, interest: total - P, principal: P, n, schedule };
  }, [amount, rate, tenure, unit]);

  return (
    <div className="space-y-6">
      <div className="receipt-card relative rounded-sm px-5 pb-5 pt-8">
        <span className="receipt-notch left-6" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div><label className={labelCls}>Loan amount (₹)</label>
            <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Interest rate (% per year)</label>
            <input type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Tenure</label>
            <div className="flex gap-2">
              <input type="number" min="1" value={tenure} onChange={(e) => setTenure(e.target.value)} className={inputCls} />
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className={`${inputCls} w-28`}>
                <option value="years">Years</option><option value="months">Months</option>
              </select>
            </div></div>
        </div>
      </div>

      {!res ? <p className="text-sm text-muted">Enter a valid amount, rate and tenure.</p> : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <StatCard label="Monthly EMI" value={rupees(res.emi)} accent="saffron" />
            <StatCard label="Total interest" value={rupees(res.interest)} accent="brick" />
            <StatCard label="Total payment" value={rupees(res.total)} accent="sage" />
          </div>

          <div className="receipt-card relative rounded-sm px-5 pb-6 pt-8">
            <span className="receipt-notch left-6" />
            <p className="mb-2 text-sm text-cream">Principal vs interest</p>
            <div className="flex h-3 overflow-hidden rounded-full bg-charcoal-lighter">
              <div className="bg-saffron" style={{ width: `${(res.principal / res.total) * 100}%` }} />
              <div className="bg-brick" style={{ width: `${(res.interest / res.total) * 100}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted">
              <span>Principal {Math.round((res.principal / res.total) * 100)}%</span>
              <span>Interest {Math.round((res.interest / res.total) * 100)}%</span>
            </div>
            <button onClick={() => setShowSchedule((v) => !v)} className="mt-4 text-sm text-saffron hover:underline">
              {showSchedule ? "Hide" : "Show"} repayment schedule ({res.n} months)
            </button>
            {showSchedule && (
              <div className="mt-3 max-h-96 overflow-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead className="sticky top-0 bg-charcoal-light">
                    <tr className="border-b border-charcoal-lighter text-left text-xs text-muted">
                      <th className="py-2 pr-3">Month</th><th className="py-2 pr-3 text-right">Principal</th>
                      <th className="py-2 pr-3 text-right">Interest</th><th className="py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.schedule.map((r) => (
                      <tr key={r.month} className="border-b border-charcoal-lighter/50">
                        <td className="py-1.5 pr-3 text-muted">{r.month}</td>
                        <td className="py-1.5 pr-3 text-right text-cream">{rupees(r.principal)}</td>
                        <td className="py-1.5 pr-3 text-right text-brick">{rupees(r.interest)}</td>
                        <td className="py-1.5 text-right text-cream">{rupees(r.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}