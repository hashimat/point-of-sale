import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, X } from 'lucide-react';
import { InventoryManager } from './components/InventoryManager';
import { PaymentModal } from './components/PaymentModal';
import { PosTerminal } from './components/PosTerminal';
import { StoreSettingsView } from './components/StoreSettingsView';
import { ThermalReceiptModal } from './components/ThermalReceiptModal';
import { ZReportDashboard } from './components/ZReportDashboard';
import { DEFAULT_STORE_SETTINGS } from './data/seedInventory';
import {
  deleteParkedCartById,
  deleteProductById,
  importBackupSnapshot,
  initializePosDb,
  resetAllToDemoData,
  saveParkedCart,
  saveProduct,
  saveProductsBulk,
  saveSaleRecord,
  saveStoreSettings,
} from './db/posDb';
import {
  AppView,
  CartItem,
  Customer,
  DiscountSpec,
  ParkedCart,
  PaymentLeg,
  PaymentMethodType,
  Product,
  Sale,
  StoreSettings,
  TaxMode,
} from './types/pos';
import {
  calculateCartTotals,
  calculateItemDiscountAmount,
  generateReceiptNumber,
  playBeep,
  roundCurrency,
} from './utils/currency';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [storageEngine, setStorageEngine] = useState<'IndexedDB' | 'localStorage'>('IndexedDB');
  const [activeView, setActiveView] = useState<AppView>('terminal');

  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [parkedCarts, setParkedCarts] = useState<ParkedCart[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);

  // Active Cart State
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartDiscount, setCartDiscount] = useState<DiscountSpec>({ mode: 'fixed', value: 0 });
  const [taxMode, setTaxMode] = useState<TaxMode>('inclusive');
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('Walk-in Customer');

  // Modals & UI Feedback
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [activeReceiptSale, setActiveReceiptSale] = useState<Sale | null>(null);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [prefillBarcodeForInventory, setPrefillBarcodeForInventory] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  const showScanFeedback = useCallback(
    (type: 'success' | 'error', message: string) => {
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
      }
      setScanFeedback({ type, message });
      feedbackTimerRef.current = window.setTimeout(() => {
        setScanFeedback(null);
      }, 3200);
    },
    []
  );

  // Initialize Offline Database
  useEffect(() => {
    let mounted = true;
    initializePosDb().then((data) => {
      if (!mounted) return;
      setProducts(data.products);
      setSales(data.sales);
      setParkedCarts(data.parkedCarts);
      setCustomers(data.customers);
      setSettings(data.settings);
      setTaxMode(data.settings.defaultTaxMode);
      setStorageEngine(data.storageEngine);
      setIsReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const totals = useMemo(
    () => calculateCartTotals(cartItems, cartDiscount, taxMode),
    [cartItems, cartDiscount, taxMode]
  );

  const lowStockCount = useMemo(
    () => products.filter((p) => p.stock <= p.lowStockThreshold).length,
    [products]
  );

  const addProductToCart = useCallback(
    (product: Product) => {
      if (product.stock <= 0) {
        playBeep('error', settings.soundEnabled);
        showScanFeedback('error', `${product.name} is out of stock.`);
        return;
      }

      setCartItems((prev) => {
        const existing = prev.find((i) => i.productId === product.id);
        if (existing) {
          if (existing.quantity + 1 > product.stock) {
            playBeep('error', settings.soundEnabled);
            showScanFeedback(
              'error',
              `Only ${product.stock} ${product.unit || 'units'} of ${product.name} available in stock.`
            );
            return prev;
          }
          playBeep('scan', settings.soundEnabled);
          showScanFeedback('success', `Added ${product.name} (Qty: ${existing.quantity + 1})`);
          return prev.map((i) =>
            i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
          );
        }

        playBeep('scan', settings.soundEnabled);
        showScanFeedback('success', `Added ${product.name} to cart`);
        return [
          ...prev,
          {
            productId: product.id,
            barcode: product.barcode,
            name: product.name,
            unitPrice: product.sellingPrice,
            costPrice: product.costPrice,
            quantity: 1,
            discount: { mode: 'fixed', value: 0 },
          },
        ];
      });
    },
    [settings.soundEnabled, showScanFeedback]
  );

  const handleBarcodeSubmit = useCallback(
    (query: string) => {
      const q = query.trim().toLowerCase();
      if (!q) return;

      // 1. Exact barcode match takes top priority
      const exactBarcode = products.find((p) => p.barcode.toLowerCase() === q);
      if (exactBarcode) {
        addProductToCart(exactBarcode);
        return;
      }

      // 2. Single product match by name or partial barcode
      const matches = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q)
      );

      if (matches.length === 1) {
        addProductToCart(matches[0]);
        return;
      }

      if (matches.length > 1) {
        playBeep('error', settings.soundEnabled);
        showScanFeedback(
          'error',
          `${matches.length} items match "${query}". Tap a product card below to add.`
        );
        return;
      }

      playBeep('error', settings.soundEnabled);
      showScanFeedback('error', `No product found for "${query}".`);
    },
    [products, addProductToCart, settings.soundEnabled, showScanFeedback]
  );

  const handleUpdateQty = useCallback(
    (productId: string, newQty: number) => {
      if (newQty <= 0) {
        setCartItems((prev) => prev.filter((i) => i.productId !== productId));
        return;
      }
      const prod = products.find((p) => p.id === productId);
      if (prod && newQty > prod.stock) {
        playBeep('error', settings.soundEnabled);
        showScanFeedback(
          'error',
          `Maximum stock reached for ${prod.name} (${prod.stock} available).`
        );
        return;
      }
      setCartItems((prev) =>
        prev.map((i) => (i.productId === productId ? { ...i, quantity: newQty } : i))
      );
    },
    [products, settings.soundEnabled, showScanFeedback]
  );

  const handleRemoveItem = useCallback((productId: string) => {
    setCartItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const handleUpdateItemDiscount = useCallback(
    (productId: string, discount: DiscountSpec) => {
      setCartItems((prev) =>
        prev.map((i) => (i.productId === productId ? { ...i, discount } : i))
      );
    },
    []
  );

  const handleClearCart = useCallback(() => {
    setCartItems([]);
    setCartDiscount({ mode: 'fixed', value: 0 });
    setSelectedCustomerName('Walk-in Customer');
  }, []);

  const handleParkCart = useCallback(
    async (customLabel?: string) => {
      if (cartItems.length === 0) return;
      const parked: ParkedCart = {
        id: `park-${Date.now()}`,
        label:
          customLabel ||
          (selectedCustomerName !== 'Walk-in Customer'
            ? selectedCustomerName
            : `Held Sale (${cartItems.length} items)`),
        parkedAt: new Date().toISOString(),
        cashierName: settings.activeCashier,
        customerName: selectedCustomerName,
        items: cartItems,
        cartDiscount,
        taxMode,
      };
      await saveParkedCart(parked);
      setParkedCarts((prev) => [parked, ...prev]);
      handleClearCart();
      showScanFeedback('success', `Cart parked as "${parked.label}"`);
    },
    [
      cartItems,
      selectedCustomerName,
      settings.activeCashier,
      cartDiscount,
      taxMode,
      handleClearCart,
      showScanFeedback,
    ]
  );

  const handleRestoreParkedCart = useCallback(
    async (parkedId: string) => {
      const target = parkedCarts.find((c) => c.id === parkedId);
      if (!target) return;

      // If current cart is non-empty, park it automatically first so nothing is lost
      if (cartItems.length > 0) {
        const autoParked: ParkedCart = {
          id: `park-${Date.now()}-auto`,
          label: `Auto-Held (${cartItems.length} items)`,
          parkedAt: new Date().toISOString(),
          cashierName: settings.activeCashier,
          customerName: selectedCustomerName,
          items: cartItems,
          cartDiscount,
          taxMode,
        };
        await saveParkedCart(autoParked);
        setParkedCarts((prev) => [autoParked, ...prev.filter((p) => p.id !== parkedId)]);
      } else {
        setParkedCarts((prev) => prev.filter((p) => p.id !== parkedId));
      }

      await deleteParkedCartById(parkedId);
      setCartItems(target.items);
      setCartDiscount(target.cartDiscount);
      setTaxMode(target.taxMode);
      setSelectedCustomerName(target.customerName);
    },
    [
      parkedCarts,
      cartItems,
      settings.activeCashier,
      selectedCustomerName,
      cartDiscount,
      taxMode,
    ]
  );

  const handleDeleteParkedCart = useCallback(async (parkedId: string) => {
    await deleteParkedCartById(parkedId);
    setParkedCarts((prev) => prev.filter((p) => p.id !== parkedId));
  }, []);

  const handleCompleteSale = useCallback(
    async (paymentPayload: {
      paymentSummaryType: PaymentMethodType;
      payments: PaymentLeg[];
      totalTendered: number;
      changeDue: number;
    }) => {
      const nowIso = new Date().toISOString();
      const receiptNumber = generateReceiptNumber(sales.length);

      const saleItems = cartItems.map((item) => {
        const itemDiscountAmount = calculateItemDiscountAmount(item);
        const lineTotal = roundCurrency(item.unitPrice * item.quantity - itemDiscountAmount);
        return {
          productId: item.productId,
          barcode: item.barcode,
          name: item.name,
          unitPrice: item.unitPrice,
          costPrice: item.costPrice,
          quantity: item.quantity,
          itemDiscountAmount,
          lineTotal,
        };
      });

      const newSale: Sale = {
        id: `sale-${Date.now()}`,
        receiptNumber,
        createdAt: nowIso,
        cashierName: settings.activeCashier,
        customerName: selectedCustomerName,
        items: saleItems,
        grossSubtotal: totals.grossItemsTotal,
        totalDiscount: roundCurrency(totals.itemDiscountsTotal + totals.cartDiscountAmount),
        taxMode: totals.taxMode,
        taxBreakdown: totals.taxBreakdown,
        grandTotal: totals.grandTotal,
        totalCost: totals.estimatedCost,
        grossProfit: totals.estimatedProfit,
        paymentSummaryType: paymentPayload.paymentSummaryType,
        payments: paymentPayload.payments,
        totalTendered: paymentPayload.totalTendered,
        changeDue: paymentPayload.changeDue,
        status: 'completed',
      };

      // Deduct inventory stock
      const qtySoldMap = new Map<string, number>();
      for (const item of cartItems) {
        qtySoldMap.set(item.productId, (qtySoldMap.get(item.productId) || 0) + item.quantity);
      }

      const updatedProducts: Product[] = [];
      const nextProducts = products.map((p) => {
        const soldQty = qtySoldMap.get(p.id);
        if (!soldQty) return p;
        const updated: Product = {
          ...p,
          stock: Math.max(0, p.stock - soldQty),
          updatedAt: nowIso,
        };
        updatedProducts.push(updated);
        return updated;
      });

      await saveProductsBulk(updatedProducts);
      await saveSaleRecord(newSale);

      setProducts(nextProducts);
      setSales((prev) => [newSale, ...prev]);
      setIsPaymentModalOpen(false);
      handleClearCart();
      playBeep('success', settings.soundEnabled);
      setActiveReceiptSale(newSale);
    },
    [
      sales.length,
      cartItems,
      settings.activeCashier,
      settings.soundEnabled,
      selectedCustomerName,
      totals,
      products,
      handleClearCart,
    ]
  );

  const handleSaveProduct = useCallback(async (product: Product) => {
    await saveProduct(product);
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      const next = exists
        ? prev.map((p) => (p.id === product.id ? product : p))
        : [...prev, product];
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
  }, []);

  const handleDeleteProduct = useCallback(async (productId: string) => {
    await deleteProductById(productId);
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  }, []);

  const handleVoidSale = useCallback(
    async (saleId: string) => {
      const target = sales.find((s) => s.id === saleId);
      if (!target || target.status === 'voided') return;

      const nowIso = new Date().toISOString();
      const voidedSale: Sale = {
        ...target,
        status: 'voided',
        voidedAt: nowIso,
      };

      // Restore stock quantities
      const restoreMap = new Map<string, number>();
      for (const item of target.items) {
        restoreMap.set(
          item.productId,
          (restoreMap.get(item.productId) || 0) + item.quantity
        );
      }

      const modifiedProducts: Product[] = [];
      const nextProducts = products.map((p) => {
        const qty = restoreMap.get(p.id);
        if (!qty) return p;
        const updated: Product = {
          ...p,
          stock: p.stock + qty,
          updatedAt: nowIso,
        };
        modifiedProducts.push(updated);
        return updated;
      });

      await saveProductsBulk(modifiedProducts);
      await saveSaleRecord(voidedSale);

      setProducts(nextProducts);
      setSales((prev) => prev.map((s) => (s.id === saleId ? voidedSale : s)));
    },
    [sales, products]
  );

  const handleSaveSettings = useCallback(async (nextSettings: StoreSettings) => {
    await saveStoreSettings(nextSettings);
    setSettings(nextSettings);
  }, []);

  const handleResetDemoData = useCallback(async () => {
    const data = await resetAllToDemoData();
    setProducts(data.products);
    setSales(data.sales);
    setParkedCarts(data.parkedCarts);
    setCustomers(data.customers);
    setSettings(data.settings);
    setTaxMode(data.settings.defaultTaxMode);
    handleClearCart();
  }, [handleClearCart]);

  const handleImportSnapshot = useCallback(
    async (snapshot: {
      products: Product[];
      sales: Sale[];
      parkedCarts: ParkedCart[];
      customers: Customer[];
      settings: StoreSettings;
    }) => {
      await importBackupSnapshot(snapshot);
      setProducts(snapshot.products.sort((a, b) => a.name.localeCompare(b.name)));
      setSales(snapshot.sales.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setParkedCarts(snapshot.parkedCarts);
      setCustomers(snapshot.customers);
      setSettings(snapshot.settings);
      setTaxMode(snapshot.settings.defaultTaxMode);
    },
    []
  );

  // Global POS Keyboard Shortcuts (F1, F2, F4, F8)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setActiveView('terminal');
      } else if (e.key === 'F2') {
        e.preventDefault();
        setActiveView('terminal');
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 30);
      } else if (e.key === 'F4') {
        if (activeView === 'terminal' && cartItems.length > 0 && !isPaymentModalOpen) {
          e.preventDefault();
          handleParkCart();
        }
      } else if (e.key === 'F8') {
        if (activeView === 'terminal' && cartItems.length > 0 && !isPaymentModalOpen && !activeReceiptSale) {
          e.preventDefault();
          setIsPaymentModalOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeView, cartItems.length, isPaymentModalOpen, activeReceiptSale, handleParkCart]);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm font-medium text-slate-600">Loading offline supermarket database...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones (1-line brand, 4 concise nav links, 1 primary action) */}
      <header className="bg-white border-b border-slate-200 px-4 lg:px-6 h-14 shrink-0 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => setActiveView('terminal')}
          className="text-base font-display font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 truncate max-w-[230px] sm:max-w-xs text-left"
        >
          {settings.storeName}
        </button>

        {/* Zone 2: Primary Navigation Links */}
        <nav className="flex items-center gap-5 sm:gap-7 overflow-x-auto">
          {(
            [
              { id: 'terminal', label: 'Terminal' },
              {
                id: 'inventory',
                label: lowStockCount > 0 ? `Inventory (${lowStockCount})` : 'Inventory',
              },
              { id: 'zreport', label: 'Z-Report' },
              { id: 'settings', label: 'Settings' },
            ] as { id: AppView; label: string }[]
          ).map((nav) => {
            const active = activeView === nav.id;
            return (
              <button
                key={nav.id}
                type="button"
                onClick={() => setActiveView(nav.id)}
                className={`py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  active
                    ? 'text-slate-900 border-emerald-700 font-semibold'
                    : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {nav.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Utility Action */}
        <div className="shrink-0 hidden sm:flex items-center">
          <button
            type="button"
            onClick={() => setIsShortcutsModalOpen(true)}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>{settings.activeCashier}</span>
          </button>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main
        className={`flex-1 p-3 sm:p-4 ${
          activeView === 'terminal' ? 'lg:overflow-hidden' : 'overflow-y-auto'
        }`}
      >
        {activeView === 'terminal' && (
          <PosTerminal
            products={products}
            customers={customers}
            cartItems={cartItems}
            cartDiscount={cartDiscount}
            taxMode={taxMode}
            totals={totals}
            selectedCustomerName={selectedCustomerName}
            parkedCarts={parkedCarts}
            searchInputRef={searchInputRef}
            scanFeedback={scanFeedback}
            onAddToCart={addProductToCart}
            onBarcodeSubmit={handleBarcodeSubmit}
            onUpdateQty={handleUpdateQty}
            onRemoveItem={handleRemoveItem}
            onUpdateItemDiscount={handleUpdateItemDiscount}
            onUpdateCartDiscount={setCartDiscount}
            onToggleTaxMode={setTaxMode}
            onSelectCustomer={setSelectedCustomerName}
            onClearCart={handleClearCart}
            onParkCart={handleParkCart}
            onRestoreParkedCart={handleRestoreParkedCart}
            onDeleteParkedCart={handleDeleteParkedCart}
            onOpenCheckout={() => setIsPaymentModalOpen(true)}
            onQuickCreateProductFromBarcode={(barcode) => {
              setPrefillBarcodeForInventory(barcode);
              setActiveView('inventory');
            }}
          />
        )}

        {activeView === 'inventory' && (
          <InventoryManager
            products={products}
            prefillBarcode={prefillBarcodeForInventory}
            onClearPrefillBarcode={() => setPrefillBarcodeForInventory(null)}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
          />
        )}

        {activeView === 'zreport' && (
          <ZReportDashboard
            sales={sales}
            settings={settings}
            onReprintReceipt={(sale) => setActiveReceiptSale(sale)}
            onVoidSale={handleVoidSale}
          />
        )}

        {activeView === 'settings' && (
          <StoreSettingsView
            settings={settings}
            storageEngine={storageEngine}
            products={products}
            sales={sales}
            parkedCarts={parkedCarts}
            customers={customers}
            onSaveSettings={handleSaveSettings}
            onResetDemoData={handleResetDemoData}
            onImportSnapshot={handleImportSnapshot}
          />
        )}
      </main>

      {/* Ghana Payment Modal (F8) */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        totals={totals}
        customerName={selectedCustomerName}
        onClose={() => setIsPaymentModalOpen(false)}
        onCompleteSale={handleCompleteSale}
      />

      {/* 80mm Thermal Receipt Generator Modal */}
      <ThermalReceiptModal
        sale={activeReceiptSale}
        settings={settings}
        onClose={() => {
          setActiveReceiptSale(null);
          if (activeView === 'terminal') {
            setTimeout(() => searchInputRef.current?.focus(), 40);
          }
        }}
      />

      {/* Active Cashier & Keyboard Shortcuts Quick Modal */}
      {isShortcutsModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Shift Cashier &amp; Keyboard Shortcuts
              </h3>
              <button
                type="button"
                onClick={() => setIsShortcutsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Active Cashier on Shift
              </label>
              <select
                value={settings.activeCashier}
                onChange={(e) =>
                  handleSaveSettings({ ...settings, activeCashier: e.target.value })
                }
                className="w-full h-10 px-3 text-sm font-semibold border border-slate-300 rounded-lg bg-white"
              >
                {settings.cashiers.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700">Cashier Keyboard Shortcuts</div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                {[
                  { key: 'F1', desc: 'Switch to Checkout Terminal' },
                  { key: 'F2', desc: 'Focus Barcode / Product Search Bar' },
                  { key: 'Enter', desc: 'Auto-add scanned barcode or single search match' },
                  { key: 'F4', desc: 'Hold / Park current cart for next customer' },
                  { key: 'F8', desc: 'Open Payment & Checkout Modal' },
                  { key: 'Esc', desc: 'Close active payment or receipt modal' },
                ].map((row) => (
                  <div key={row.key} className="px-3.5 py-2.5 flex items-center justify-between bg-white">
                    <span className="text-slate-700">{row.desc}</span>
                    <kbd className="px-2 py-0.5 font-mono text-[11px] font-bold bg-slate-100 border border-slate-300 rounded text-slate-800">
                      {row.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsShortcutsModalOpen(false)}
                className="h-10 px-5 rounded-lg bg-slate-900 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
