// Small reusable "label + price" row list, used for both Add-ons and Variants
// inside the menu item form. Keeping it generic avoids duplicating the same
// add/remove logic twice.
export default function RepeatableRow({ label, rows, labelPlaceholder, onChange }) {
  const update = (index, field, value) => {
    const next = rows.map((row, i) => (i === index ? { ...row, [field]: value } : row));
    onChange(next);
  };

  const addRow = () => onChange([...rows, { name: '', price: '' }]);
  const removeRow = (index) => onChange(rows.filter((_, i) => i !== index));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-cream">{label}</span>
        <button
          type="button"
          onClick={addRow}
          className="text-sm font-medium text-saffron hover:text-saffron-dark"
        >
          + Add
        </button>
      </div>

      {rows.length === 0 && <p className="pb-1 text-sm italic text-muted">None yet</p>}

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              placeholder={labelPlaceholder}
              value={row.name}
              onChange={(e) => update(i, 'name', e.target.value)}
              className="flex-1 rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-1.5 text-sm text-cream outline-none focus:border-saffron"
            />
            <div className="relative w-28">
              <span className="absolute left-3 top-1.5 text-sm text-muted">₹</span>
              <input
                type="number"
                placeholder="0"
                value={row.price}
                onChange={(e) => update(i, 'price', e.target.value)}
                className="w-full rounded-sm border border-charcoal-lighter bg-charcoal-light py-1.5 pl-6 pr-2 text-sm text-cream outline-none focus:border-saffron"
              />
            </div>
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="px-1 text-sm text-muted hover:text-brick"
              aria-label="Remove row"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}