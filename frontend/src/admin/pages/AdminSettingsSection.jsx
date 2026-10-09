import { useEffect, useState } from "react";
import * as settingsApi from "../api/adminSettingsApi";

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const labelCls = "mb-1 block text-xs text-muted";

export default function AdminSettingsSection() {
  const [f, setF] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi.getSettings()
      .then(({ settings: s }) => { setF({ company: s.company, invoicing: s.invoicing, billing: s.billing }); setUpdatedAt(s.updatedAt); })
      .catch((e) => setError(e.response?.data?.message || "Couldn't load settings."));
  }, []);

  const set = (section, key) => (e) => {
    setF((p) => ({ ...p, [section]: { ...p[section], [key]: e.target.value } }));
    setSaved(false);
  };

  async function submit(e) {
    e.preventDefault();
    setError(""); setSaving(true);
    try {
      const { settings: s } = await settingsApi.saveSettings(f);
      setF({ company: s.company, invoicing: s.invoicing, billing: s.billing });
      setUpdatedAt(s.updatedAt);
      setSaved(true);
    } catch (err) { setError(err.response?.data?.message || "Couldn't save settings."); }
    finally { setSaving(false); }
  }

  if (!f) return error ? <p role="alert" className="text-sm text-brick">{error}</p> : <p className="text-muted">Loading…</p>;

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-cream sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted">Company details and the billing rules the platform follows.</p>
      </div>

      <Section title="Company" note="Your own details, for invoices and client support.">
        <Field label="Company name *"><input value={f.company.name} onChange={set("company", "name")} required className={inputCls} /></Field>
        <Field label="GSTIN"><input value={f.company.gstin} onChange={set("company", "gstin")} maxLength={15} className={inputCls} /></Field>
        <Field label="Support email"><input type="email" value={f.company.supportEmail} onChange={set("company", "supportEmail")} className={inputCls} /></Field>
        <Field label="Support phone"><input value={f.company.supportPhone} onChange={set("company", "supportPhone")} className={inputCls} /></Field>
        <Field label="Address" wide><textarea rows={2} value={f.company.address} onChange={set("company", "address")} className={inputCls} /></Field>
      </Section>

      <Section title="Invoicing">
        <Field label="Invoice prefix (letters only)" hint="Numbering continues, e.g. INV-0012 then SAM-0013.">
          <input value={f.invoicing.prefix} onChange={set("invoicing", "prefix")} maxLength={6} className={`${inputCls} uppercase`} /></Field>
        <Field label="Default due days" hint="Pre-fills the due date on new invoices.">
          <input type="number" min="0" max="90" value={f.invoicing.defaultDueDays} onChange={set("invoicing", "defaultDueDays")} className={inputCls} /></Field>
      </Section>

      <Section title="Billing automation" note="Applies to every client.">
        <Field label="Grace days after a period ends" hint="Clients keep access this long before being asked to pay.">
          <input type="number" min="0" max="30" value={f.billing.graceDays} onChange={set("billing", "graceDays")} className={inputCls} /></Field>
        <Field label="Send renewal invoice (days before end)">
          <input type="number" min="1" max="30" value={f.billing.renewalLeadDays} onChange={set("billing", "renewalLeadDays")} className={inputCls} /></Field>
        <Field label="Trial-ending reminder (days before end)">
          <input type="number" min="1" max="14" value={f.billing.trialReminderDays} onChange={set("billing", "trialReminderDays")} className={inputCls} /></Field>
      </Section>

      {error && <p role="alert" className="text-sm text-brick">{error}</p>}
      <div className="flex items-center gap-4">
        <button disabled={saving} className="rounded-sm bg-saffron px-5 py-2.5 font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">{saving ? "Saving…" : "Save settings"}</button>
        {saved && <span className="text-sm text-sage">Saved.</span>}
        {updatedAt && !saved && <span className="text-xs text-muted">Last changed {new Date(updatedAt).toLocaleString("en-IN")}</span>}
      </div>
    </form>
  );
}

function Section({ title, note, children }) {
  return (
    <section className="receipt-card relative max-w-3xl rounded-sm px-5 pb-6 pt-8">
      <span className="receipt-notch left-6" />
      <h2 className="font-display text-lg text-cream">{title}</h2>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}
function Field({ label, hint, wide, children }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className={labelCls}>{label}</label>{children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}