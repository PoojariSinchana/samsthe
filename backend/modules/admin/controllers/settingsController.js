const PlatformSettings = require("../models/PlatformSettings");
const { refreshSettings } = require("../utils/settings");
const { fail, send } = require("../../../shared/utils/httpError");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (v, max = 200) => String(v ?? "").trim().slice(0, max);
function int(v, min, max, label) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw fail(400, `${label} must be a whole number from ${min} to ${max}`);
  return n;
}

module.exports = {
  async getSettings(req, res) {
    try { res.json({ settings: await PlatformSettings.get() }); }
    catch (err) { send(res, err, "Failed to load settings"); }
  },

  async updateSettings(req, res) {
    try {
      const doc = await PlatformSettings.get();
      const { company, invoicing, billing } = req.body || {};

      if (company) {
        if (company.name !== undefined) {
          if (!text(company.name)) throw fail(400, "Company name is required");
          doc.company.name = text(company.name);
        }
        if (company.supportEmail !== undefined) {
          const e = text(company.supportEmail).toLowerCase();
          if (e && !EMAIL_RE.test(e)) throw fail(400, "Please enter a valid support email");
          doc.company.supportEmail = e;
        }
        if (company.supportPhone !== undefined) doc.company.supportPhone = text(company.supportPhone, 30);
        if (company.address !== undefined) doc.company.address = text(company.address, 500);
        if (company.gstin !== undefined) {
          const g = text(company.gstin, 15).toUpperCase();
          if (g && !/^[0-9A-Z]{15}$/.test(g)) throw fail(400, "GSTIN must be 15 letters/digits");
          doc.company.gstin = g;
        }
      }

      if (invoicing) {
        if (invoicing.prefix !== undefined) {
          const p = text(invoicing.prefix, 6).toUpperCase();
          // Letters only: the next invoice number is derived from the digits of the last one.
          if (!/^[A-Z]{1,6}$/.test(p)) throw fail(400, "Invoice prefix must be 1 to 6 letters");
          doc.invoicing.prefix = p;
        }
        if (invoicing.defaultDueDays !== undefined) doc.invoicing.defaultDueDays = int(invoicing.defaultDueDays, 0, 90, "Default due days");
      }

      if (billing) {
        if (billing.graceDays !== undefined) doc.billing.graceDays = int(billing.graceDays, 0, 30, "Grace days");
        if (billing.renewalLeadDays !== undefined) doc.billing.renewalLeadDays = int(billing.renewalLeadDays, 1, 30, "Renewal lead days");
        if (billing.trialReminderDays !== undefined) doc.billing.trialReminderDays = int(billing.trialReminderDays, 1, 14, "Trial reminder days");
      }

      doc.updatedBy = req.admin._id;
      await doc.save();
      await refreshSettings();
      res.json({ message: "Settings saved", settings: doc });
    } catch (err) { send(res, err, "Failed to save settings"); }
  },
};