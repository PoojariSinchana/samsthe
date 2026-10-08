// IST-local day/period bucketing shared by the dashboard (was copy-pasted in two controllers).
// IST has no DST so a fixed offset is safe; swap for luxon if outlets ever span time zones.
const TZ = "Asia/Kolkata";
const TZ_OFFSET = "+05:30";

const VALID_PERIODS = ["today", "week", "month", "year"];
const PERIOD_CHANGE_LABEL = { today: "vs yesterday", week: "vs last week", month: "vs last month", year: "vs last year" };

function localParts(d) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t).value;
  return { y: get("year"), m: get("month"), d: get("day") };
}
const localMidnight = (d) => { const { y, m, d: day } = localParts(d); return new Date(`${y}-${m}-${day}T00:00:00${TZ_OFFSET}`); };
const firstOfMonthLocal = (d) => { const { y, m } = localParts(d); return new Date(`${y}-${m}-01T00:00:00${TZ_OFFSET}`); };
const firstOfYearLocal = (d) => { const { y } = localParts(d); return new Date(`${y}-01-01T00:00:00${TZ_OFFSET}`); };
const addDays = (d, n) => new Date(d.getTime() + n * 24 * 60 * 60 * 1000);

function pctChange(curr, prev, decimals = 0) {
  if (!prev) return curr > 0 ? 100 : 0;
  const f = 10 ** decimals;
  return Math.round(((curr - prev) / prev) * 100 * f) / f;
}

function rangeForPeriod(period, today0, tomorrow0) {
  if (period === "today") return { from: today0, to: tomorrow0 };
  if (period === "week") return { from: addDays(today0, -6), to: tomorrow0 };
  if (period === "year") return { from: firstOfYearLocal(today0), to: tomorrow0 };
  return { from: firstOfMonthLocal(today0), to: tomorrow0 };
}

function previousRangeForPeriod(period, from, to, today0) {
  if (period === "today") return { from: addDays(today0, -1), to: today0 };
  if (period === "week") return { from: addDays(from, -7), to: from };
  if (period === "year") {
    const f = localParts(from), t = localParts(to);
    return {
      from: new Date(`${Number(f.y) - 1}-${f.m}-${f.d}T00:00:00${TZ_OFFSET}`),
      to: new Date(`${Number(t.y) - 1}-${t.m}-${t.d}T00:00:00${TZ_OFFSET}`),
    };
  }
  const { y, m } = localParts(from);
  let prevY = Number(y), prevM = Number(m) - 1;
  if (prevM === 0) { prevM = 12; prevY -= 1; }
  const prevStart = new Date(`${prevY}-${String(prevM).padStart(2, "0")}-01T00:00:00${TZ_OFFSET}`);
  return { from: prevStart, to: addDays(prevStart, Number(localParts(today0).d)) };
}

function generateBuckets(period, from, to) {
  const buckets = [];
  if (period === "today") {
    for (let h = 0; h < 24; h++) buckets.push({ key: h, label: h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM` });
    return buckets;
  }
  if (period === "year") {
    let cursor = firstOfYearLocal(from);
    const end = firstOfMonthLocal(to);
    while (cursor <= end) {
      const { y, m } = localParts(cursor);
      buckets.push({ key: `${y}-${m}`, label: cursor.toLocaleDateString("en-IN", { month: "short", timeZone: TZ }) });
      const nm = Number(m) === 12 ? 1 : Number(m) + 1;
      const ny = Number(m) === 12 ? Number(y) + 1 : Number(y);
      cursor = new Date(`${ny}-${String(nm).padStart(2, "0")}-01T00:00:00${TZ_OFFSET}`);
    }
    return buckets;
  }
  let cursor = localMidnight(from);
  while (cursor < to) {
    const { y, m, d } = localParts(cursor);
    buckets.push({ key: `${y}-${m}-${d}`, label: cursor.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: TZ }) });
    cursor = addDays(cursor, 1);
  }
  return buckets;
}

function groupExprForPeriod(period, dateField) {
  if (period === "today") return { $hour: { date: `$${dateField}`, timezone: TZ } };
  if (period === "year") return { $dateToString: { format: "%Y-%m", date: `$${dateField}`, timezone: TZ } };
  return { $dateToString: { format: "%Y-%m-%d", date: `$${dateField}`, timezone: TZ } };
}

module.exports = {
  TZ, TZ_OFFSET, VALID_PERIODS, PERIOD_CHANGE_LABEL,
  localParts, localMidnight, firstOfMonthLocal, firstOfYearLocal, addDays, pctChange,
  rangeForPeriod, previousRangeForPeriod, generateBuckets, groupExprForPeriod,
};