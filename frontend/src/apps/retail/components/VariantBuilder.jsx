import { useState } from "react";
import BarcodeImage from "../../../shared/components/BarcodeImage";
import { generateEan13, printBarcodeLabels } from "../../../shared/utils/barcode";

// Builds Product.variants: each row is one SKU with its own attributes
// (Size/Color/etc as free-form name:value pairs), price, cost, and barcode.
// This is the schema-level embodiment of the planning doc's "Product +
// Variant is more flexible than Restaurant Menu Item" — RepeatableRow.jsx
// only handled name+price; this needs attributes too.
const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-2 py-1.5 text-sm text-cream outline-none focus:border-saffron";

function emptyVariant() {
  return { sku: "", barcode: "", attributes: [{ name: "", value: "" }], price: "", costPrice: "" };
}

export default function VariantBuilder({ variants, onChange }) {
  const [rows, setRows] = useState(variants.length ? variants : [emptyVariant()]);

  function commit(next) {
    setRows(next);
    onChange(next);
  }

  function updateRow(i, field, value) {
    commit(rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function updateAttribute(i, attrIdx, field, value) {
    commit(
      rows.map((r, idx) => {
        if (idx !== i) return r;
        const attributes = r.attributes.map((a, ai) => (ai === attrIdx ? { ...a, [field]: value } : a));
        return { ...r, attributes };
      })
    );
  }

  function addAttribute(i) {
    commit(rows.map((r, idx) => (idx === i ? { ...r, attributes: [...r.attributes, { name: "", value: "" }] } : r)));
  }

  function removeAttribute(i, attrIdx) {
    commit(rows.map((r, idx) => (idx === i ? { ...r, attributes: r.attributes.filter((_, ai) => ai !== attrIdx) } : r)));
  }

  function addRow() {
    commit([...rows, emptyVariant()]);
  }

  function removeRow(i) {
    if (rows.length === 1) return; // always keep at least one variant — a product with zero SKUs can't be sold
    commit(rows.filter((_, idx) => idx !== i));
  }

  function duplicateRow(i) {
    const source = rows[i];
    commit([...rows, { ...source, sku: "", barcode: "", attributes: source.attributes.map((a) => ({ ...a })) }]);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-cream">Variants (SKUs)</span>
        <button type="button" onClick={addRow} className="text-sm font-medium text-saffron hover:text-saffron-dark">
          + Add Variant
        </button>
      </div>

      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded-sm border border-charcoal-lighter p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs text-muted">SKU *</label>
                <input value={row.sku} onChange={(e) => updateRow(i, "sku", e.target.value)} placeholder="TSHIRT-M-BLK" className={inputCls} required />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Barcode</label>
                <div className="flex gap-1">
                  <input value={row.barcode} onChange={(e) => updateRow(i, "barcode", e.target.value)} placeholder="Optional" className={inputCls} />
                  <button type="button" onClick={() => updateRow(i, "barcode", generateEan13())}
                    className="shrink-0 rounded-sm border border-charcoal-lighter px-2 text-xs text-saffron hover:border-saffron">Auto</button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Price (₹) *</label>
                <input type="number" min="0" step="0.01" value={row.price} onChange={(e) => updateRow(i, "price", e.target.value)} className={inputCls} required />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Cost Price (₹)</label>
                <input type="number" min="0" step="0.01" value={row.costPrice} onChange={(e) => updateRow(i, "costPrice", e.target.value)} className={inputCls} />
              </div>
            </div>

            <div className="mt-2">
              <label className="mb-1 block text-xs text-muted">Attributes (e.g. Size: M, Color: Black)</label>
              <div className="space-y-1.5">
                {row.attributes.map((attr, ai) => (
                  <div key={ai} className="flex items-center gap-2">
                    <input value={attr.name} onChange={(e) => updateAttribute(i, ai, "name", e.target.value)} placeholder="Size" className={`${inputCls} max-w-[120px]`} />
                    <input value={attr.value} onChange={(e) => updateAttribute(i, ai, "value", e.target.value)} placeholder="M" className={`${inputCls} max-w-[120px]`} />
                    <button type="button" onClick={() => removeAttribute(i, ai)} className="px-1 text-sm text-muted hover:text-brick">✕</button>
                  </div>
                ))}
                <button type="button" onClick={() => addAttribute(i)} className="text-xs text-saffron hover:text-saffron-dark">
                  + Add attribute
                </button>
              </div>
            </div>

            <div className="mt-2 flex justify-end gap-3 border-t border-charcoal-lighter pt-2">
              <button type="button" onClick={() => duplicateRow(i)} className="text-xs text-muted hover:text-cream">Duplicate</button>
              {rows.length > 1 && (
                <button type="button" onClick={() => removeRow(i)} className="text-xs text-brick hover:underline">Remove variant</button>
              )}
              {(row.barcode || row.sku) && (
                <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-charcoal-lighter pt-2">
                  <BarcodeImage value={row.barcode || row.sku} height={40} />
                  <button type="button"
                    onClick={() => printBarcodeLabels([{ value: row.barcode || row.sku, name: "Product", variant: row.attributes.map((a) => a.value).join("/"), price: row.price, copies: 1 }])}
                    className="text-xs text-saffron hover:underline">Print label</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}