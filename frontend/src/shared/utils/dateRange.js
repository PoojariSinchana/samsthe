// Shared helpers for "From"/"To" date-range filters.
//
// The bug this fixes: an <input type="date"> gives you a plain
// "YYYY-MM-DD" string with no time or timezone info. If you hand that
// straight to `new Date("2024-01-14")`, JavaScript parses it as
// 2024-01-14T00:00:00 UTC — midnight UTC, NOT midnight in the user's own
// timezone. For anyone east of UTC (e.g. India, UTC+5:30) that instant is
// already 5:30am *local time*, so a `$lte` filter using that value cuts
// off everything from 5:30am onward on the selected end date — the
// selected day looks "missing" its second half.
//
// The fix: compute the day boundary using the LOCAL Date constructor
// (which uses the browser's real timezone), then convert that instant to
// ISO before sending it to the backend. The backend just compares
// timestamps — it doesn't need to know about timezones at all as long as
// the client sends the correct absolute instant.

export function localDateStr(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function todayStr() {
  return localDateStr(new Date());
}

// Start of the given "YYYY-MM-DD" day (00:00:00.000) in LOCAL time, as ISO.
export function startOfLocalDay(dateStr) {
  if (!dateStr) return undefined;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

// End of the given "YYYY-MM-DD" day (23:59:59.999) in LOCAL time, as ISO —
// this is what makes the end date's whole day actually get included.
export function endOfLocalDay(dateStr) {
  if (!dateStr) return undefined;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}