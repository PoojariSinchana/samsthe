import { useEffect, useMemo, useState } from "react";
import * as productsApi from "../api/productsApi";
import * as categoriesApi from "../api/productCategoriesApi";
import * as brandsApi from "../api/brandsApi";
import ProductFormModal from "../components/ProductFormModal";
import { useShopSaleBuilder } from "../context/ShopSaleBuilderContext";

export default function ProductsSection({ onNavigate }) {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalProduct, setModalProduct] = useState(null); // null=closed, {}=new, {..}=edit
  const [newCategoryName, setNewCategoryName] = useState("");

  const { isBuilding, addToCart, qtyFor, cartCount, cartSubtotal } = useShopSaleBuilder();

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [cats, brandsRes, productsRes] = await Promise.all([
        categoriesApi.getCategories(),
        brandsApi.getBrands(),
        productsApi.getProducts(search ? { search } : {}),
      ]);
      setCategories(cats.categories);
      setBrands(brandsRes.brands);
      setProducts(productsRes.products);
    } catch (err) {
      setError("Could not load products. Check that the server is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(loadAll, search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const visibleProducts = useMemo(() => {
    if (activeCategory === "all") return products;
    return products.filter((p) => (p.category?._id || p.category) === activeCategory);
  }, [products, activeCategory]);

  const handleSaveProduct = async (payload, existingId) => {
    if (existingId) {
      const { product } = await productsApi.updateProduct(existingId, payload);
      setProducts((prev) => prev.map((p) => (p._id === existingId ? product : p)));
    } else {
      const { product } = await productsApi.createProduct(payload);
      setProducts((prev) => [...prev, product]);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm("Deactivate this product? It will no longer be sellable.")) return;
    await productsApi.deleteProduct(id);
    setProducts((prev) => prev.map((p) => (p._id === id ? { ...p, isActive: false } : p)));
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const { category } = await categoriesApi.createCategory({ name: newCategoryName.trim() });
    setCategories((prev) => [...prev, category]);
    setNewCategoryName("");
  };

  function priceLabel(product) {
    const prices = product.variants.map((v) => v.price);
    const min = Math.min(...prices), max = Math.max(...prices);
    return min === max ? `₹${min}` : `From ₹${min}`;
  }

  return (
    <div className="min-h-full pb-24">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Products</h1>
          <p className="mt-1 text-sm text-muted">Catalog, categories, brands and variant pricing.</p>
        </div>
        {isBuilding && (
          <span className="rounded-sm border border-saffron bg-saffron/10 px-3 py-1.5 text-sm font-medium text-saffron">
            Building a sale — tap products below to add
          </span>
        )}
      </div>

      {error && <div className="mb-6 rounded-sm border border-brick/40 bg-brick/10 px-4 py-3 text-sm text-brick">{error}</div>}

      <div className="mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, SKU, or barcode…"
          className="w-full max-w-md rounded-sm border border-charcoal-lighter bg-charcoal-light px-3 py-2 text-sm text-cream outline-none focus:border-saffron"
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveCategory("all")}
          className={`whitespace-nowrap rounded-sm border px-4 py-1.5 text-sm font-medium transition-colors ${
            activeCategory === "all" ? "border-saffron bg-saffron text-charcoal" : "border-charcoal-lighter text-muted hover:border-saffron hover:text-cream"
          }`}
        >
          All products
        </button>
        {categories.map((c) => (
          <button
            key={c._id}
            onClick={() => setActiveCategory(c._id)}
            className={`whitespace-nowrap rounded-sm border px-4 py-1.5 text-sm font-medium transition-colors ${
              activeCategory === c._id ? "border-saffron bg-saffron text-charcoal" : "border-charcoal-lighter text-muted hover:border-saffron hover:text-cream"
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
            <button type="submit" className="px-2 text-sm font-medium text-saffron hover:text-saffron-dark">+ Add</button>
          </form>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-muted">{visibleProducts.length} product{visibleProducts.length !== 1 ? "s" : ""}</span>
        {!isBuilding && (
          <button onClick={() => setModalProduct({})} className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark">
            + Add Product
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading products…</p>
      ) : visibleProducts.length === 0 ? (
        <div className="receipt-card rounded-sm py-16 text-center">
          <span className="receipt-notch left-1/2 -translate-x-1/2" />
          <p className="text-muted">No products here yet.</p>
          {!isBuilding && (
            <button onClick={() => setModalProduct({})} className="mt-3 text-sm font-medium text-saffron hover:text-saffron-dark">
              Add your first product
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visibleProducts.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              priceLabel={priceLabel(product)}
              isBuilding={isBuilding}
              qtyFor={qtyFor}
              addToCart={addToCart}
              onEdit={() => setModalProduct(product)}
              onDelete={() => handleDeleteProduct(product._id)}
            />
          ))}
        </div>
      )}

      {modalProduct !== null && (
        <ProductFormModal
          categories={categories}
          brands={brands}
          initialProduct={modalProduct._id ? modalProduct : null}
          onClose={() => setModalProduct(null)}
          onSave={handleSaveProduct}
        />
      )}

      {isBuilding && cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between border-t border-charcoal-lighter bg-charcoal-light px-6 py-3 shadow-lg lg:left-60 md:bottom-0">
          <span className="text-sm text-cream">{cartCount} item{cartCount !== 1 ? "s" : ""} · ₹{cartSubtotal.toFixed(2)}</span>
          <button onClick={() => onNavigate("pos")} className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark">
            Back to Sale
          </button>
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, priceLabel, isBuilding, qtyFor, addToCart, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const singleVariant = product.variants.length === 1;

  return (
    <div className="receipt-card relative rounded-sm px-5 pb-5 pt-7">
      <span className="receipt-notch left-6" />
      {product.images?.[0] && <img src={product.images[0]} alt="" className="mb-3 h-32 w-full rounded-sm object-cover" />}

      <div className="flex items-start justify-between">
        <h3 className="font-display text-lg text-cream">{product.name}</h3>
        <span className="font-display text-lg text-saffron">{priceLabel}</span>
      </div>

      {product.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{product.description}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {product.category?.name && <span className="rounded-full bg-charcoal-lighter px-2 py-0.5 text-xs text-muted">{product.category.name}</span>}
        {product.brand?.name && <span className="rounded-full bg-sage/10 px-2 py-0.5 text-xs text-sage">{product.brand.name}</span>}
        <span className="rounded-full bg-saffron/10 px-2 py-0.5 text-xs text-saffron">{product.variants.length} SKU{product.variants.length !== 1 ? "s" : ""}</span>
      </div>

      {isBuilding ? (
        <div className="mt-4 border-t border-charcoal-lighter pt-3">
          {singleVariant ? (
            <SingleVariantStepper product={product} variant={product.variants[0]} qtyFor={qtyFor} addToCart={addToCart} />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">{product.variants.length} variants</span>
                <button onClick={() => setExpanded((v) => !v)} className="text-sm font-medium text-saffron hover:text-saffron-dark">
                  {expanded ? "Close" : "Choose"}
                </button>
              </div>
              {expanded && (
                <ul className="mt-2 space-y-1.5">
                  {product.variants.map((v) => (
                    <li key={v._id} className="flex items-center justify-between rounded-sm border border-charcoal-lighter px-2 py-1.5">
                      <span className="text-xs text-cream">
                        {v.attributes.map((a) => a.value).join("/") || v.sku} · ₹{v.price}
                      </span>
                      <SingleVariantStepper product={product} variant={v} qtyFor={qtyFor} addToCart={addToCart} compact />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between border-t border-charcoal-lighter pt-3">
          <span className={`text-xs ${product.isActive ? "text-sage" : "text-muted"}`}>{product.isActive ? "Active" : "Inactive"}</span>
          <div className="flex items-center gap-3 text-sm">
            <button onClick={onEdit} className="text-muted hover:text-saffron">Edit</button>
            <button onClick={onDelete} className="text-muted hover:text-brick">Deactivate</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SingleVariantStepper({ product, variant, qtyFor, addToCart, compact }) {
  const qty = qtyFor(product._id, variant._id);
  return (
    <div className={`flex items-center gap-3 ${compact ? "" : "justify-end"}`}>
      <button onClick={() => addToCart(product, variant, -1)} disabled={qty === 0} className="h-7 w-7 rounded-full border border-charcoal-lighter text-cream hover:border-saffron disabled:opacity-30">−</button>
      <span className="w-4 text-center text-sm text-cream">{qty}</span>
      <button onClick={() => addToCart(product, variant, 1)} className="h-7 w-7 rounded-full border border-charcoal-lighter text-cream hover:border-saffron">+</button>
    </div>
  );
}