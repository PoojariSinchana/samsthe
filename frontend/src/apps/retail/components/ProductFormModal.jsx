import { useState } from "react";
import VariantBuilder from "./VariantBuilder";
import ImageUploadField from "../../../shared/components/ImageUploadField";

const inputCls = "w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron";
const labelCls = "mb-1 block text-sm text-muted";

const emptyForm = {
  name: "",
  description: "",
  category: "",
  brand: "",
  tags: "",
  images: [],
  variants: [],
};

export default function ProductFormModal({ categories, brands, initialProduct, onClose, onSave }) {
  const [form, setForm] = useState(() =>
    initialProduct
      ? {
          ...emptyForm,
          ...initialProduct,
          category: initialProduct.category?._id || initialProduct.category || "",
          brand: initialProduct.brand?._id || initialProduct.brand || "",
          tags: (initialProduct.tags || []).join(", "),
          images: initialProduct.images || [],
          variants: initialProduct.variants || [],
        }
      : emptyForm
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  function addImage(url) {
    setForm((f) => ({ ...f, images: [...f.images, url] }));
  }
  function removeImage(url) {
    setForm((f) => ({ ...f, images: f.images.filter((i) => i !== url) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.name || !form.category) return setError("Name and category are required");
    if (form.variants.length === 0) return setError("At least one variant is required");
    for (const v of form.variants) {
      if (!v.sku || v.price === "" || v.price === undefined) {
        return setError("Every variant needs a SKU and price");
      }
    }

    setSaving(true);
    const payload = {
      name: form.name,
      description: form.description,
      category: form.category,
      brand: form.brand || undefined,
      images: form.images,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      variants: form.variants.map((v) => ({
        _id: v._id,  
        sku: v.sku,
        barcode: v.barcode || "",
        attributes: (v.attributes || []).filter((a) => a.name && a.value),
        price: Number(v.price),
        costPrice: v.costPrice === "" ? 0 : Number(v.costPrice),
      })),
    };

    try {
      await onSave(payload, initialProduct?._id);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <form onSubmit={handleSubmit} className="receipt-card relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-sm px-6 pb-6 pt-8">
        <span className="receipt-notch left-1/2 -translate-x-1/2" />

        <div className="flex items-center justify-between border-b border-charcoal-lighter pb-4">
          <h2 className="font-display text-xl text-cream">{initialProduct ? "Edit Product" : "Add Product"}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-cream">✕</button>
        </div>

        {error && <p className="mt-3 text-sm text-brick">{error}</p>}

        <div className="space-y-5 pt-5">
          <div>
            <label className={labelCls}>Product name</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Classic Cotton T-Shirt" className={inputCls} required />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <select value={form.category} onChange={(e) => set("category", e.target.value)} className={inputCls} required>
                <option value="">Select category</option>
                {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Brand</label>
              <select value={form.brand} onChange={(e) => set("brand", e.target.value)} className={inputCls}>
                <option value="">No brand</option>
                {brands.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Tags (comma separated)</label>
            <input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="bestseller, new-arrival" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Product images</label>
            <div className="flex flex-wrap gap-3">
              {form.images.map((url) => (
                <div key={url} className="relative">
                  <img src={url} alt="" className="h-16 w-16 rounded-sm border border-charcoal-lighter object-cover" />
                  <button type="button" onClick={() => removeImage(url)} className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brick text-xs text-cream">
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2">
              <ImageUploadField
                label="Add an image"
                value=""
                uploadUrl="/catalog/items/upload-image"
                formFieldName="image"
                shape="square"
                onUploaded={addImage}
              />
            </div>
          </div>

          <VariantBuilder variants={form.variants} onChange={(v) => set("variants", v)} />

          <div className="flex justify-end gap-3 border-t border-charcoal-lighter pt-4">
            <button type="button" onClick={onClose} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-sm text-cream hover:border-saffron">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50">
              {saving ? "Saving…" : "Save Product"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}