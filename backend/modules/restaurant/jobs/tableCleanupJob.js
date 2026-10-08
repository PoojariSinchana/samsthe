const Table = require("../models/Table");

const SWEEP_INTERVAL_MS = 60 * 1000; // check once a minute

// Runs across all restaurants — cheap query, indexed on status, and this
// is the only place besides tableController's read-time check that
// touches cleaningUntil, so there's no risk of the two disagreeing.
// server/jobs/tableCleanupJob.js
let lastErrorLogged = 0;

function startTableCleanupJob() {
  setInterval(async () => {
    try {
      await Table.updateMany(
        { status: "CLEANING", cleaningUntil: { $lte: new Date() } },
        { status: "AVAILABLE", cleaningUntil: null, currentOrder: null }
      );
    } catch (err) {
      const now = Date.now();
      if (now - lastErrorLogged > 5 * 60 * 1000) { // log at most once per 5 min
        console.error("Table cleanup sweep failed:", err.message);
        lastErrorLogged = now;
      }
    }
  }, SWEEP_INTERVAL_MS);
}

module.exports = { startTableCleanupJob };