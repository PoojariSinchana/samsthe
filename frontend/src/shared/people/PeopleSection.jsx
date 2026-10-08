import { useState } from "react";
import StaffSection from "./staff/Staffsection";
import CustomersTab from "./CustomersTab";
import SuppliersTab from "./SuppliersTab";
import OwnersPartnersTab from "./OwnersPartnersTab";

const TABS = [
  { key: "staff", label: "Staff" },
  { key: "customers", label: "Customers" },
  { key: "suppliers", label: "Suppliers" },
  { key: "owners", label: "Owners / Partners" },
];

export default function PeopleSection({ initialTab }) {
  const [tab, setTab] = useState(TABS.some((t) => t.key === initialTab) ? initialTab : "staff");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-cream sm:text-3xl">People</h1>
        <p className="mt-1 text-sm text-muted">Your team, customers, suppliers and owners in one place.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-charcoal-lighter">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`whitespace-nowrap px-3 py-2 text-sm ${tab === t.key ? "border-b-2 border-saffron text-saffron" : "text-muted hover:text-cream"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "staff" && <StaffSection />}
      {tab === "customers" && <CustomersTab />}
      {tab === "suppliers" && <SuppliersTab />}
      {tab === "owners" && <OwnersPartnersTab />}
    </div>
  );
}
