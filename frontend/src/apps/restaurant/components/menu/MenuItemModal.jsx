import { useState } from 'react';
import RepeatableRow from './RepeatableRow';

const inputCls =
  'w-full rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2.5 text-cream outline-none focus:border-saffron';
const labelCls = 'mb-1 block text-sm text-muted';

const emptyForm = {
  name: '',
  description: '',
  category: '',
  price: '',
  isVeg: true,
  isAvailable: true,
  usePerOrderTypePricing: false,
  pricingByOrderType: { dineIn: '', takeaway: '', delivery: '' },
  variants: [],
  addOns: [],
};

function resizeImageToDataUri(file, maxDimension = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not load image'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function MenuItemModal({ categories, initialItem, onClose, onSave }) {
  const [form, setForm] = useState(() =>
    initialItem
      ? {
          ...emptyForm,
          ...initialItem,
          category: initialItem.category?._id || initialItem.category || '',
          usePerOrderTypePricing: Boolean(
            initialItem.pricingByOrderType &&
              Object.values(initialItem.pricingByOrderType).some(Boolean)
          ),
          pricingByOrderType: {
            dineIn: initialItem.pricingByOrderType?.dineIn ?? '',
            takeaway: initialItem.pricingByOrderType?.takeaway ?? '',
            delivery: initialItem.pricingByOrderType?.delivery ?? '',
          },
          variants: initialItem.variants?.map((v) => ({ name: v.label, price: v.price })) || [],
          addOns: initialItem.addOns?.map((a) => ({ name: a.name, price: a.price })) || [],
        }
      : emptyForm
  );
  const [saving, setSaving] = useState(false);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.category || form.price === '') return;

    setSaving(true);
    const payload = {
      name: form.name,
      description: form.description,
      category: form.category,
      price: Number(form.price),
      isVeg: form.isVeg,
      isAvailable: form.isAvailable,
      pricingByOrderType: form.usePerOrderTypePricing
        ? {
            dineIn: form.pricingByOrderType.dineIn === '' ? undefined : Number(form.pricingByOrderType.dineIn),
            takeaway: form.pricingByOrderType.takeaway === '' ? undefined : Number(form.pricingByOrderType.takeaway),
            delivery: form.pricingByOrderType.delivery === '' ? undefined : Number(form.pricingByOrderType.delivery),
          }
        : undefined,
      variants: form.variants
        .filter((v) => v.name && v.price !== '')
        .map((v) => ({ label: v.name, price: Number(v.price) })),
      addOns: form.addOns
        .filter((a) => a.name && a.price !== '')
        .map((a) => ({ name: a.name, price: Number(a.price) })),
    };

    try {
      await onSave(payload, initialItem?._id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <form
        onSubmit={handleSubmit}
        className="receipt-card relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-sm px-6 pb-6 pt-8"
      >
        <span className="receipt-notch left-1/2 -translate-x-1/2" />

        <div className="flex items-center justify-between border-b border-charcoal-lighter pb-4">
          <h2 className="font-display text-xl text-cream">
            {initialItem ? 'Edit item' : 'Add menu item'}
          </h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-cream">
            ✕
          </button>
        </div>

        <div className="space-y-5 pt-5">
          <div>
            <label className={labelCls}>Item name</label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Chicken Biryani"
              className={inputCls}
              required
            />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              placeholder="Short description shown to guests"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <select
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                className={inputCls}
                required
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Base price</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm text-muted">₹</span>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => set('price', e.target.value)}
                  className={`${inputCls} pl-6`}
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-cream">
              <input
                type="checkbox"
                checked={form.isVeg}
                onChange={(e) => set('isVeg', e.target.checked)}
                className="accent-saffron"
              />
              Vegetarian
            </label>
            <label className="flex items-center gap-2 text-sm text-cream">
              <input
                type="checkbox"
                checked={form.isAvailable}
                onChange={(e) => set('isAvailable', e.target.checked)}
                className="accent-saffron"
              />
              Available today
            </label>
          </div>

          <div className="rounded-sm border border-charcoal-lighter p-4">
            <label className="mb-3 flex items-center gap-2 text-sm font-medium text-cream">
              <input
                type="checkbox"
                checked={form.usePerOrderTypePricing}
                onChange={(e) => set('usePerOrderTypePricing', e.target.checked)}
                className="accent-saffron"
              />
              Different price for dine-in / takeaway / delivery
            </label>
            {form.usePerOrderTypePricing && (
              <div className="grid grid-cols-3 gap-2">
                {['dineIn', 'takeaway', 'delivery'].map((key) => (
                  <div key={key} className="relative">
                    <span className="absolute left-3 top-2.5 text-sm text-muted">₹</span>
                    <input
                      type="number"
                      placeholder={key === 'dineIn' ? 'Dine-in' : key === 'takeaway' ? 'Takeaway' : 'Delivery'}
                      value={form.pricingByOrderType[key]}
                      onChange={(e) =>
                        set('pricingByOrderType', { ...form.pricingByOrderType, [key]: e.target.value })
                      }
                      className={`${inputCls} pl-6`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <RepeatableRow
            label="Variants (sizes)"
            labelPlaceholder="e.g. Small"
            rows={form.variants}
            onChange={(rows) => set('variants', rows)}
          />

          <RepeatableRow
            label="Add-ons"
            labelPlaceholder="e.g. Extra Cheese"
            rows={form.addOns}
            onChange={(rows) => set('addOns', rows)}
          />

          <div className="flex justify-end gap-3 border-t border-charcoal-lighter pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm border border-charcoal-lighter px-4 py-2 text-sm text-cream hover:border-saffron"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save item'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}