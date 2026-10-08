import { useEffect, useMemo, useState } from 'react';
import * as menuApi from '../api/menuApi';
import MenuItemModal from '../components/menu/MenuItemModal';
import { useOrderBuilder } from '../context/OrderBuilderContext';

export default function MenuSection({ onNavigate }) {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalItem, setModalItem] = useState(null); // null = closed, {} = new, {..} = edit
  const [newCategoryName, setNewCategoryName] = useState('');
  const [expandedItemId, setExpandedItemId] = useState(null);

  const { isBuilding, addToCart, qtyFor, addConfiguredLine, cartCount, cartTotal, details } = useOrderBuilder();

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [cats, its] = await Promise.all([menuApi.getCategories(), menuApi.getItems()]);
      setCategories(cats);
      setItems(its);
    } catch (err) {
      setError('Could not load the menu. Check that the server is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const visibleItems = useMemo(() => {
    if (activeCategory === 'all') return items;
    return items.filter((i) => (i.category?._id || i.category) === activeCategory);
  }, [items, activeCategory]);

  const handleSaveItem = async (payload, existingId) => {
    if (existingId) {
      const updated = await menuApi.updateItem(existingId, payload);
      setItems((prev) => prev.map((i) => (i._id === existingId ? updated : i)));
    } else {
      const created = await menuApi.createItem(payload);
      setItems((prev) => [...prev, created]);
    }
  };

  const handleDeleteItem = async (id) => {
    if (!confirm('Remove this item from the menu?')) return;
    await menuApi.deleteItem(id);
    setItems((prev) => prev.filter((i) => i._id !== id));
  };

  const handleToggleAvailability = async (id) => {
    const updated = await menuApi.toggleAvailability(id);
    setItems((prev) => prev.map((i) => (i._id === id ? updated : i)));
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const created = await menuApi.createCategory({ name: newCategoryName.trim() });
    setCategories((prev) => [...prev, created]);
    setNewCategoryName('');
  };

  const priceLabel = (item) => {
    if (item.variants?.length) {
      const min = Math.min(...item.variants.map((v) => v.price));
      return `From ₹${min}`;
    }
    return `₹${item.price}`;
  };

  return (
    <div className="min-h-full pb-24">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Menu</h1>
          <p className="mt-1 text-sm text-muted">
            Categories, items, add-ons and pricing — exactly how guests will order.
          </p>
        </div>
        {isBuilding && (
          <span className="rounded-sm border border-saffron bg-saffron/10 px-3 py-1.5 text-sm font-medium text-saffron">
            Building an order — tap items below to add
          </span>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-sm border border-brick/40 bg-brick/10 px-4 py-3 text-sm text-brick">
          {error}
        </div>
      )}

      {/* Category strip */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveCategory('all')}
          className={`whitespace-nowrap rounded-sm border px-4 py-1.5 text-sm font-medium transition-colors ${
            activeCategory === 'all'
              ? 'border-saffron bg-saffron text-charcoal'
              : 'border-charcoal-lighter text-muted hover:border-saffron hover:text-cream'
          }`}
        >
          All items
        </button>
        {categories.map((c) => (
          <button
            key={c._id}
            onClick={() => setActiveCategory(c._id)}
            className={`whitespace-nowrap rounded-sm border px-4 py-1.5 text-sm font-medium transition-colors ${
              activeCategory === c._id
                ? 'border-saffron bg-saffron text-charcoal'
                : 'border-charcoal-lighter text-muted hover:border-saffron hover:text-cream'
            }`}
          >
            {c.name}
          </button>
        ))}

        {!isBuilding && (
          <form onSubmit={handleAddCategory} className="ml-2 flex items-center gap-1">
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New category"
              className="w-32 rounded-sm border border-dashed border-charcoal-lighter bg-charcoal-light px-3 py-1.5 text-sm text-cream outline-none focus:border-saffron"
            />
            <button type="submit" className="px-2 text-sm font-medium text-saffron hover:text-saffron-dark">
              + Add
            </button>
          </form>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-muted">
          {visibleItems.length} item{visibleItems.length !== 1 ? 's' : ''}
        </span>
        {!isBuilding && (
          <button
            onClick={() => setModalItem({})}
            className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark"
          >
            + Add item
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading menu…</p>
      ) : visibleItems.length === 0 ? (
        <div className="receipt-card rounded-sm py-16 text-center">
          <span className="receipt-notch left-1/2 -translate-x-1/2" />
          <p className="text-muted">No items here yet.</p>
          {!isBuilding && (
            <button
              onClick={() => setModalItem({})}
              className="mt-3 text-sm font-medium text-saffron hover:text-saffron-dark"
            >
              Add your first item
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visibleItems.map((item) => {
            const qty = qtyFor(item._id);
            const hasOptions = (item.variants?.length || 0) > 0 || (item.addOns?.length || 0) > 0;
            return (
              <div key={item._id} className="receipt-card relative rounded-sm px-5 pb-5 pt-7">
                <span className="receipt-notch left-6" />

                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-sm border ${
                        item.isVeg ? 'border-sage bg-sage' : 'border-brick bg-brick'
                      }`}
                    />
                    <h3 className="font-display text-lg text-cream">{item.name}</h3>
                  </div>
                  <span className="font-display text-lg text-saffron">{priceLabel(item)}</span>
                </div>

                {item.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{item.description}</p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {item.category?.name && (
                    <span className="rounded-full bg-charcoal-lighter px-2 py-0.5 text-xs text-muted">
                      {item.category.name}
                    </span>
                  )}
                  {item.addOns?.length > 0 && (
                    <span className="rounded-full bg-saffron/10 px-2 py-0.5 text-xs text-saffron">
                      {item.addOns.length} add-on{item.addOns.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {item.variants?.length > 0 && (
                    <span className="rounded-full bg-sage/10 px-2 py-0.5 text-xs text-sage">
                      {item.variants.length} sizes
                    </span>
                  )}
                </div>

                {isBuilding ? (
                  <div className="mt-4 border-t border-charcoal-lighter pt-3">
                    {!item.isAvailable ? (
                      <span className="text-xs text-muted">Sold out</span>
                    ) : hasOptions ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted">Has sizes/add-ons</span>
                          <button
                            onClick={() => setExpandedItemId(expandedItemId === item._id ? null : item._id)}
                            className="text-sm font-medium text-saffron hover:text-saffron-dark"
                          >
                            {expandedItemId === item._id ? 'Close' : 'Add'}
                          </button>
                        </div>
                        {expandedItemId === item._id && (
                          <OrderOptionsPanel
                            item={item}
                            orderType={details.orderType}
                            onAdd={(config) => {
                              addConfiguredLine(item, config);
                              setExpandedItemId(null);
                            }}
                          />
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-end">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => addToCart(item, -1)}
                            disabled={qty === 0}
                            className="h-7 w-7 rounded-full border border-charcoal-lighter text-cream hover:border-saffron disabled:opacity-30"
                          >
                            −
                          </button>
                          <span className="w-4 text-center text-sm text-cream">{qty}</span>
                          <button
                            onClick={() => addToCart(item, 1)}
                            className="h-7 w-7 rounded-full border border-charcoal-lighter text-cream hover:border-saffron"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 flex items-center justify-between border-t border-charcoal-lighter pt-3">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
                      <input
                        type="checkbox"
                        checked={item.isAvailable}
                        onChange={() => handleToggleAvailability(item._id)}
                        className="accent-saffron"
                      />
                      {item.isAvailable ? 'Available' : 'Sold out'}
                    </label>
                    <div className="flex items-center gap-3 text-sm">
                      <button onClick={() => setModalItem(item)} className="text-muted hover:text-saffron">
                        Edit
                      </button>
                      <button onClick={() => handleDeleteItem(item._id)} className="text-muted hover:text-brick">
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalItem !== null && (
        <MenuItemModal
          categories={categories}
          initialItem={modalItem._id ? modalItem : null}
          onClose={() => setModalItem(null)}
          onSave={handleSaveItem}
        />
      )}

      {isBuilding && cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between border-t border-charcoal-lighter bg-charcoal-light px-6 py-3 shadow-lg lg:left-60 md:bottom-0">
          <span className="text-sm text-cream">
            {cartCount} item{cartCount !== 1 ? 's' : ''} · ₹{cartTotal.toFixed(2)}
          </span>
          <button
            onClick={() => onNavigate('orders')}
            className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark"
          >
            Back to Order
          </button>
        </div>
      )}
    </div>
  );
}

function OrderOptionsPanel({ item, orderType, onAdd }) {
  const [variantLabel, setVariantLabel] = useState(item.variants?.[0]?.label || '');
  const [addOnNames, setAddOnNames] = useState([]);
  const [quantity, setQuantity] = useState(1);

  const toggleAddOn = (name) => {
    setAddOnNames((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  };

  let unitPrice = variantLabel
    ? item.variants.find((v) => v.label === variantLabel)?.price ?? item.price
    : item.pricingByOrderType?.[orderType] ?? item.price;
  for (const name of addOnNames) {
    const addOn = item.addOns?.find((a) => a.name === name);
    if (addOn) unitPrice += addOn.price;
  }

  return (
    <div className="mt-3 space-y-3 rounded-sm border border-charcoal-lighter bg-charcoal p-3">
      {item.variants?.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Size</p>
          <div className="flex flex-wrap gap-2">
            {item.variants.map((v) => (
              <label
                key={v.label}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
                  variantLabel === v.label ? 'border-saffron bg-saffron text-charcoal' : 'border-charcoal-lighter text-muted'
                }`}
              >
                <input
                  type="radio"
                  name={`variant-${item._id}`}
                  className="hidden"
                  checked={variantLabel === v.label}
                  onChange={() => setVariantLabel(v.label)}
                />
                {v.label} · ₹{v.price}
              </label>
            ))}
          </div>
        </div>
      )}

      {item.addOns?.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Add-ons</p>
          <div className="flex flex-wrap gap-2">
            {item.addOns.map((a) => (
              <label
                key={a.name}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
                  addOnNames.includes(a.name) ? 'border-saffron bg-saffron text-charcoal' : 'border-charcoal-lighter text-muted'
                }`}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={addOnNames.includes(a.name)}
                  onChange={() => toggleAddOn(a.name)}
                />
                {a.name} · +₹{a.price}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="h-7 w-7 rounded-full border border-charcoal-lighter text-cream hover:border-saffron">−</button>
          <span className="w-4 text-center text-sm text-cream">{quantity}</span>
          <button onClick={() => setQuantity((q) => q + 1)} className="h-7 w-7 rounded-full border border-charcoal-lighter text-cream hover:border-saffron">+</button>
        </div>
        <button
          onClick={() => onAdd({ variantLabel, addOnNames, quantity })}
          className="rounded-sm bg-saffron px-3 py-1.5 text-xs font-medium text-charcoal hover:bg-saffron-dark"
        >
          Add · ₹{(unitPrice * quantity).toFixed(2)}
        </button>
      </div>
    </div>
  );
}