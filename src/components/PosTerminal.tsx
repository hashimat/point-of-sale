import React, { useMemo, useState } from 'react';
import {
  Barcode,
  Check,
  Minus,
  PauseCircle,
  Percent,
  Play,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  User,
  X,
} from 'lucide-react';
import {
  CartItem,
  CartTotals,
  Customer,
  DiscountMode,
  DiscountSpec,
  ParkedCart,
  Product,
  ProductCategory,
  TaxMode,
} from '../types/pos';
import {
  calculateItemDiscountAmount,
  formatDateTime,
  formatGHS,
  roundCurrency,
} from '../utils/currency';

interface PosTerminalProps {
  products: Product[];
  customers: Customer[];
  cartItems: CartItem[];
  cartDiscount: DiscountSpec;
  taxMode: TaxMode;
  totals: CartTotals;
  selectedCustomerName: string;
  parkedCarts: ParkedCart[];
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  scanFeedback: { type: 'success' | 'error'; message: string } | null;
  onAddToCart: (product: Product) => void;
  onBarcodeSubmit: (query: string) => void;
  onUpdateQty: (productId: string, qty: number) => void;
  onRemoveItem: (productId: string) => void;
  onUpdateItemDiscount: (productId: string, discount: DiscountSpec) => void;
  onUpdateCartDiscount: (discount: DiscountSpec) => void;
  onToggleTaxMode: (mode: TaxMode) => void;
  onSelectCustomer: (name: string) => void;
  onClearCart: () => void;
  onParkCart: (label?: string) => void;
  onRestoreParkedCart: (parkedId: string) => void;
  onDeleteParkedCart: (parkedId: string) => void;
  onOpenCheckout: () => void;
  onQuickCreateProductFromBarcode: (barcode: string) => void;
}

const CATEGORIES: ('All' | ProductCategory)[] = [
  'All',
  'Pantry & Grains',
  'Dairy & Beverages',
  'Snacks & Bakery',
  'Household & Care',
];

export const PosTerminal: React.FC<PosTerminalProps> = ({
  products,
  customers,
  cartItems,
  cartDiscount,
  taxMode,
  totals,
  selectedCustomerName,
  parkedCarts,
  searchInputRef,
  scanFeedback,
  onAddToCart,
  onBarcodeSubmit,
  onUpdateQty,
  onRemoveItem,
  onUpdateItemDiscount,
  onUpdateCartDiscount,
  onToggleTaxMode,
  onSelectCustomer,
  onClearCart,
  onParkCart,
  onRestoreParkedCart,
  onDeleteParkedCart,
  onOpenCheckout,
  onQuickCreateProductFromBarcode,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | ProductCategory>('All');
  const [editingDiscountItemId, setEditingDiscountItemId] = useState<string | null>(null);
  const [showCartDiscountEditor, setShowCartDiscountEditor] = useState(false);
  const [showParkedDrawer, setShowCartParkedDrawer] = useState(false);
  const [parkLabelInput, setParkLabelInput] = useState('');
  const [showParkPrompt, setShowParkPrompt] = useState(false);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCat = activeCategory === 'All' || p.category === activeCategory;
      if (!matchesCat) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, searchQuery, activeCategory]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = searchQuery.trim();
      if (!trimmed) return;
      onBarcodeSubmit(trimmed);
      setSearchQuery('');
    }
  };

  const cartItemCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const cartQtyByProductId = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cartItems) {
      map.set(item.productId, item.quantity);
    }
    return map;
  }, [cartItems]);

  const handleConfirmPark = (e: React.FormEvent) => {
    e.preventDefault();
    onParkCart(parkLabelInput.trim() || undefined);
    setParkLabelInput('');
    setShowParkPrompt(false);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full min-h-0">
      {/* Left Pane: Search, Barcode Scanner Input & Product Catalog */}
      <section className="flex-1 flex flex-col min-w-0 bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Search & Barcode Bar */}
        <div className="p-4 border-b border-slate-200 space-y-3 bg-white">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Scan barcode or search product (e.g. Ideal Milk, Milo, Frytol)... [F2]"
                aria-label="Scan barcode or search product"
                className="w-full h-11 pl-10 pr-24 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:bg-white transition-colors"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 rounded"
                >
                  Clear
                </button>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1 absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono pointer-events-none">
                  <Barcode className="w-3.5 h-3.5" />
                  Enter to add
                </span>
              )}
            </div>
          </div>

          {/* Live Scanner / Search Feedback */}
          {scanFeedback && (
            <div
              role="status"
              className={`flex items-center justify-between gap-3 px-3.5 py-2 rounded-lg text-xs font-medium border ${
                scanFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <span>{scanFeedback.message}</span>
              {scanFeedback.type === 'error' && /^\d{4,}$/.test(searchQuery.trim()) && (
                <button
                  type="button"
                  onClick={() => onQuickCreateProductFromBarcode(searchQuery.trim())}
                  className="underline font-semibold whitespace-nowrap shrink-0"
                >
                  Add Product
                </button>
              )}
            </div>
          )}

          {/* Interactive Category Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {CATEGORIES.map((category) => {
              const active = activeCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 min-h-[36px] ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/70">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4">
              <p className="text-sm font-semibold text-slate-800">
                No products match &ldquo;{searchQuery}&rdquo;
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Check spelling, clear the category filter, or add this barcode directly to inventory.
              </p>
              <div className="flex items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategory('All');
                  }}
                  className="px-4 py-2 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100"
                >
                  Reset Filters
                </button>
                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => onQuickCreateProductFromBarcode(searchQuery.trim())}
                    className="px-4 py-2 text-xs font-medium bg-emerald-700 text-white rounded-lg hover:bg-emerald-800"
                  >
                    Create Product
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map((product) => {
                const inCartQty = cartQtyByProductId.get(product.id) || 0;
                const isOutOfStock = product.stock <= 0;
                const isLowStock = product.stock > 0 && product.stock <= product.lowStockThreshold;

                return (
                  <button
                    key={product.id}
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => onAddToCart(product)}
                    className={`group text-left flex flex-col justify-between p-3.5 rounded-xl border transition-all min-h-[126px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                      isOutOfStock
                        ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                        : inCartQty > 0
                        ? 'bg-emerald-50/40 border-emerald-600 hover:bg-emerald-50/80 active:scale-[0.99]'
                        : 'bg-white border-slate-200 hover:border-slate-400 hover:bg-slate-50/40 active:scale-[0.99]'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="truncate">{product.category}</span>
                        {inCartQty > 0 && (
                          <span className="font-mono font-semibold text-emerald-700 shrink-0 tabular-nums">
                            {inCartQty} in cart
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                        {product.name}
                      </h3>
                    </div>

                    <div className="pt-3 mt-2 border-t border-slate-100 flex items-end justify-between gap-2">
                      <div>
                        <div className="text-base font-bold text-slate-900 font-mono tabular-nums">
                          {formatGHS(product.sellingPrice)}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 tabular-nums truncate max-w-[110px]">
                          {product.barcode}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {isOutOfStock ? (
                          <span className="text-[11px] font-semibold text-red-700">
                            Out of stock
                          </span>
                        ) : isLowStock ? (
                          <span className="text-[11px] font-semibold text-amber-700 tabular-nums">
                            Low: {product.stock} left
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 tabular-nums">
                            {product.stock} {product.unit || 'pcs'}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Right Pane: Active Cart, Discounts, Ghana Tax Breakdown & Checkout */}
      <aside className="w-full lg:w-[420px] xl:w-[450px] shrink-0 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Cart Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 bg-white">
          <div className="flex items-center gap-2 min-w-0">
            <ShoppingBag className="w-4.5 h-4.5 text-slate-700 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900 whitespace-nowrap">
              Current Sale
            </h2>
            <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
              · {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowCartParkedDrawer((v) => !v)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 min-h-[34px] ${
                parkedCarts.length > 0
                  ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Held ({parkedCarts.length})
            </button>
            <button
              type="button"
              disabled={cartItems.length === 0}
              onClick={() => setShowParkPrompt(true)}
              title="Park / Hold Cart (F4)"
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0 min-h-[34px] inline-flex items-center gap-1"
            >
              <PauseCircle className="w-3.5 h-3.5" />
              Hold
            </button>
            <button
              type="button"
              disabled={cartItems.length === 0}
              onClick={onClearCart}
              title="Clear Cart"
              className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed min-h-[34px] min-w-[34px] flex items-center justify-center"
              aria-label="Clear cart"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Park Cart Label Prompt */}
        {showParkPrompt && (
          <form
            onSubmit={handleConfirmPark}
            className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={parkLabelInput}
              onChange={(e) => setParkLabelInput(e.target.value)}
              placeholder="Customer name or note (optional)..."
              autoFocus
              className="flex-1 h-9 px-2.5 text-xs bg-white border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button
              type="submit"
              className="px-3 h-9 text-xs font-semibold bg-amber-700 text-white rounded-md hover:bg-amber-800 whitespace-nowrap"
            >
              Park Sale
            </button>
            <button
              type="button"
              onClick={() => setShowParkPrompt(false)}
              className="p-1.5 text-amber-800 hover:bg-amber-100 rounded"
              aria-label="Cancel hold"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Held / Parked Carts Drawer */}
        {showParkedDrawer && (
          <div className="bg-slate-50 border-b border-slate-200 max-h-60 overflow-y-auto p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Held / Parked Carts
              </span>
              <button
                type="button"
                onClick={() => setShowCartParkedDrawer(false)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
            </div>
            {parkedCarts.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                No parked carts. Use Hold (F4) to pause a customer&apos;s basket.
              </p>
            ) : (
              parkedCarts.map((parked) => {
                const count = parked.items.reduce((s, i) => s + i.quantity, 0);
                const estTotal = parked.items.reduce(
                  (s, i) => s + i.unitPrice * i.quantity,
                  0
                );
                return (
                  <div
                    key={parked.id}
                    className="flex items-center justify-between gap-2 p-2.5 bg-white border border-slate-200 rounded-lg"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {parked.label}
                      </p>
                      <p className="text-[11px] text-slate-500 tabular-nums">
                        {count} items · {formatGHS(estTotal)} · {formatDateTime(parked.parkedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onRestoreParkedCart(parked.id);
                          setShowCartParkedDrawer(false);
                        }}
                        className="px-2.5 py-1.5 text-xs font-medium bg-emerald-700 text-white rounded-md hover:bg-emerald-800 inline-flex items-center gap-1"
                      >
                        <Play className="w-3 h-3" />
                        Resume
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteParkedCart(parked.id)}
                        className="p-1.5 text-slate-400 hover:text-red-700 rounded"
                        aria-label="Delete parked cart"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Customer Selector Bar */}
        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 shrink-0">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>Customer</span>
          </div>
          <select
            value={selectedCustomerName}
            onChange={(e) => onSelectCustomer(e.target.value)}
            aria-label="Select customer"
            className="text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-600 max-w-[230px]"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name} {c.phone ? `(${c.phone})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Cart Line Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
              <ShoppingBag className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">Cart is empty</p>
              <p className="text-xs text-slate-500 mt-1">
                Tap products on the left or scan a barcode and press Enter.
              </p>
            </div>
          ) : (
            cartItems.map((item) => {
              const itemDisc = calculateItemDiscountAmount(item);
              const lineGross = roundCurrency(item.unitPrice * item.quantity);
              const lineNet = roundCurrency(lineGross - itemDisc);
              const isEditingDisc = editingDiscountItemId === item.productId;

              return (
                <div key={item.productId} className="px-4 py-3 space-y-2 hover:bg-slate-50/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 leading-tight">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                        {formatGHS(item.unitPrice)} each
                        {itemDisc > 0 && (
                          <span className="text-amber-700 ml-2">
                            · Disc -{formatGHS(itemDisc)}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                        {formatGHS(lineNet)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onUpdateQty(item.productId, item.quantity - 1)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 active:bg-slate-200"
                        aria-label={`Decrease ${item.name}`}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!Number.isNaN(val) && val > 0) {
                            onUpdateQty(item.productId, val);
                          }
                        }}
                        aria-label={`Quantity for ${item.name}`}
                        className="w-12 h-9 text-center text-sm font-mono font-semibold tabular-nums border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => onUpdateQty(item.productId, item.quantity + 1)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 active:bg-slate-200"
                        aria-label={`Increase ${item.name}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingDiscountItemId(isEditingDisc ? null : item.productId)
                        }
                        className={`px-2.5 h-9 text-xs font-medium rounded-lg border transition-colors inline-flex items-center gap-1 ${
                          itemDisc > 0 || isEditingDisc
                            ? 'border-amber-300 bg-amber-50 text-amber-800'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <Percent className="w-3 h-3" />
                        Disc
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.productId)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50"
                        aria-label={`Remove ${item.name}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Per-Item Discount Editor */}
                  {isEditingDisc && (
                    <div className="flex items-center gap-2 pt-1">
                      <div className="inline-flex rounded-md border border-slate-200 overflow-hidden bg-slate-100 p-0.5">
                        {(['fixed', 'percent'] as DiscountMode[]).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() =>
                              onUpdateItemDiscount(item.productId, {
                                mode,
                                value: item.discount.value,
                              })
                            }
                            className={`px-2 py-1 text-[11px] font-medium rounded ${
                              item.discount.mode === mode
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600'
                            }`}
                          >
                            {mode === 'fixed' ? 'GHS' : '%'}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        value={item.discount.value || ''}
                        placeholder="0.00"
                        onChange={(e) =>
                          onUpdateItemDiscount(item.productId, {
                            mode: item.discount.mode,
                            value: Math.max(0, parseFloat(e.target.value) || 0),
                          })
                        }
                        className="w-24 h-8 px-2 text-xs font-mono tabular-nums border border-slate-300 rounded-md bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setEditingDiscountItemId(null)}
                        className="px-2.5 h-8 text-xs font-medium bg-slate-900 text-white rounded-md inline-flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        Done
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Totals, Tax Toggle & Checkout Action */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
          {/* Ghana Tax Mode Toggle */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-600">Pricing / Tax</span>
            <div className="inline-flex p-0.5 rounded-lg bg-slate-200/80 border border-slate-200">
              <button
                type="button"
                onClick={() => onToggleTaxMode('inclusive')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap ${
                  taxMode === 'inclusive'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tax-Inclusive
              </button>
              <button
                type="button"
                onClick={() => onToggleTaxMode('exclusive')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap ${
                  taxMode === 'exclusive'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                +21% Ghana Tax
              </button>
            </div>
          </div>

          {/* Cart Discount Row */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setShowCartDiscountEditor((v) => !v)}
                className="text-slate-600 hover:text-slate-900 font-medium underline decoration-dotted underline-offset-4"
              >
                {totals.cartDiscountAmount > 0 ? 'Edit Cart Discount' : '+ Add Cart Discount'}
              </button>
              <span className="font-mono tabular-nums text-slate-700">
                {totals.cartDiscountAmount > 0 ? `-${formatGHS(totals.cartDiscountAmount)}` : 'GHS 0.00'}
              </span>
            </div>

            {showCartDiscountEditor && (
              <div className="flex items-center justify-between gap-2 p-2 bg-white border border-slate-200 rounded-lg">
                <div className="inline-flex rounded-md bg-slate-100 p-0.5">
                  {(['fixed', 'percent'] as DiscountMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() =>
                        onUpdateCartDiscount({ mode, value: cartDiscount.value })
                      }
                      className={`px-2.5 py-1 text-xs font-medium rounded ${
                        cartDiscount.mode === mode
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      {mode === 'fixed' ? 'GHS' : '%'}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={cartDiscount.value || ''}
                  placeholder="0.00"
                  onChange={(e) =>
                    onUpdateCartDiscount({
                      mode: cartDiscount.mode,
                      value: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="w-28 h-8 px-2.5 text-xs font-mono tabular-nums border border-slate-300 rounded-md"
                />
                <button
                  type="button"
                  onClick={() => {
                    onUpdateCartDiscount({ mode: 'fixed', value: 0 });
                    setShowCartDiscountEditor(false);
                  }}
                  className="text-xs text-slate-500 hover:text-red-700 px-1.5"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Breakdown Summary */}
          <div className="space-y-1 text-xs text-slate-600 border-t border-slate-200 pt-2.5">
            <div className="flex justify-between">
              <span>{taxMode === 'inclusive' ? 'Subtotal (Tax Incl.)' : 'Net Subtotal'}</span>
              <span className="font-mono tabular-nums text-slate-800">
                {formatGHS(totals.afterItemDiscounts - totals.cartDiscountAmount)}
              </span>
            </div>

            {taxMode === 'exclusive' ? (
              <div className="pl-2 border-l border-slate-300 space-y-0.5 text-[11px] text-slate-500">
                <div className="flex justify-between">
                  <span>VAT (15.0%)</span>
                  <span className="font-mono tabular-nums">{formatGHS(totals.taxBreakdown.vat15)}</span>
                </div>
                <div className="flex justify-between">
                  <span>NHIL (2.5%) · GETFund (2.5%) · COVID (1%)</span>
                  <span className="font-mono tabular-nums">
                    {formatGHS(
                      roundCurrency(
                        totals.taxBreakdown.nhil2_5 +
                          totals.taxBreakdown.getfund2_5 +
                          totals.taxBreakdown.covid1
                      )
                    )}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Incl. VAT 15% + NHIL 2.5% + GETFund 2.5% + COVID 1%</span>
                <span className="font-mono tabular-nums">
                  {formatGHS(totals.taxBreakdown.totalTax)}
                </span>
              </div>
            )}
          </div>

          {/* Grand Total & Pay CTA */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-sm font-bold text-slate-900">Total Payable</span>
            <span className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums">
              {formatGHS(totals.grandTotal)}
            </span>
          </div>

          <button
            type="button"
            disabled={cartItems.length === 0}
            onClick={onOpenCheckout}
            className="w-full h-13 px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-display font-bold text-base flex items-center justify-between transition-colors shadow-xs"
          >
            <span>Charge &amp; Pay</span>
            <span className="font-mono tabular-nums text-sm bg-emerald-800/80 px-2.5 py-1 rounded-md">
              {formatGHS(totals.grandTotal)} · F8
            </span>
          </button>
        </div>
      </aside>
    </div>
  );
};
