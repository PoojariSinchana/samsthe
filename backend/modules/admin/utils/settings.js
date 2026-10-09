const PlatformSettings = require("../models/PlatformSettings");

const DEFAULTS = {
  company: {},
  invoicing: { prefix: "INV", defaultDueDays: 7 },
  billing: { graceDays: 3, renewalLeadDays: 7, trialReminderDays: 3 },
};
let current = DEFAULTS;

async function refreshSettings() {
  try {
    const d = (await PlatformSettings.get()).toObject();
    current = {
      company: d.company || {},
      invoicing: { ...DEFAULTS.invoicing, ...d.invoicing },
      billing: { ...DEFAULTS.billing, ...d.billing },
    };
  } catch (e) {
    console.error("Settings refresh failed:", e.message);
  }
  return current;
}

const settings = () => current;

// Saves refresh the local copy instantly; other instances pick it up within a minute.
function startSettingsRefresh() {
  refreshSettings();
  setInterval(refreshSettings, 60 * 1000).unref();
}

module.exports = { settings, refreshSettings, startSettingsRefresh };