import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Edit3,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Product, ProductCategory } from '../types/pos';
import { formatGHS, roundCurrency } from '../utils/currency';

interface InventoryManagerProps {
  products: Product[];
  prefillBarcode?: string | null;
  onClearPrefillBarcode?: () => void;
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
}

const CATEGORIES: ProductCategory[] = [
  'Pantry & Grains',
  'Dairy & Beverages',
  'Snacks & Bakery',
  'Household & Care',
];

interface ProductFormState {
  id?: string;
  barcode: string;
  name: string;
  category: ProductCategory;
  costPrice: string;
  sellingPrice: string;
  stock: string;
  lowStockThreshold: string;
  unit: string;
}

const EMPTY_FORM: ProductFormState = {
  barcode: '',
  name: '',
  category: 'Pantry & Grains',
  costPrice: '',
  sellingPrice: '',
  stock: '',
  lowStockThreshold: '5',
  unit: 'pcs',
};

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  products,
  prefillBarcode,
  onClearPrefillBarcode,
  onSaveProduct,
  onDeleteProduct,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | ProductCategory>('All');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState<ProductFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const [restockTarget, setRestockTarget] = useState<Product | null>(null);
  const [restockQtyStr, setRestockQtyStr] = useState('10');

  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<Product | null>(null);

  useEffect(() => {
    if (prefillBarcode) {
      setFormState({
        ...EMPTY_FORM,
        barcode: prefillBarcode,
      });
      setFormError(null);
      setIsModalOpen(true);
      onClearPrefillBarcode?.();
    }
  }, [prefillBarcode, onClearPrefillBarcode]);

  const metrics = useMemo(() => {
    let totalUnits = 0;
    let totalCostValue = 0;
    let totalRetailValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const p of products) {
      const qty = Math.max(0, p.stock);
      totalUnits += qty;
      totalCostValue += qty * p.costPrice;
      totalRetailValue += qty * p.sellingPrice;
      if (p.stock <= 0) outOfStockCount += 1;
      else if (p.stock <= p.lowStockThreshold) lowStockCount += 1;
    }

    return {
      totalSkus: products.length,
      totalUnits,
      totalCostValue: roundCurrency(totalCostValue),
      totalRetailValue: roundCurrency(totalRetailValue),
      lowStockCount,
      outOfStockCount,
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
      if (lowStockOnly && p.stock > p.lowStockThreshold) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, searchQuery, categoryFilter, lowStockOnly]);

  const openAddModal = () => {
    setFormState({
      ...EMPTY_FORM,
      barcode: `603${Math.floor(1000000000 + Math.random() * 8999999999)}`,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setFormState({
      id: product.id,
      barcode: product.barcode,
      name: product.name,
      category: product.category,
      costPrice: String(product.costPrice),
      sellingPrice: String(product.sellingPrice),
      stock: String(product.stock),
      lowStockThreshold: String(product.lowStockThreshold),
      unit: product.unit || 'pcs',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const barcode = formState.barcode.trim();
    const name = formState.name.trim();
    const costPrice = parseFloat(formState.costPrice);
    const sellingPrice = parseFloat(formState.sellingPrice);
    const stock = parseInt(formState.stock, 10);
    const lowStockThreshold = parseInt(formState.lowStockThreshold, 10);

    if (!barcode || !name) {
      setFormError('Barcode and Product Name are required.');
      return;
    }
    const duplicate = products.find(
      (p) => p.barcode.toLowerCase() === barcode.toLowerCase() && p.id !== formState.id
    );
    if (duplicate) {
      setFormError(`Barcode "${barcode}" is already assigned to "${duplicate.name}".`);
      return;
    }
    if (!Number.isFinite(costPrice) || costPrice < 0 || !Number.isFinite(sellingPrice) || sellingPrice <= 0) {
      setFormError('Enter valid Cost Price (>= 0) and Selling Price (> 0) in GHS.');
      return;
    }
    if (!Number.isFinite(stock) || stock < 0 || !Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) {
      setFormError('Stock quantity and low-stock alert threshold must be 0 or greater.');
      return;
    }

    const saved: Product = {
      id: formState.id || `prod-${Date.now()}`,
      barcode,
      name,
      category: formState.category,
      costPrice: roundCurrency(costPrice),
      sellingPrice: roundCurrency(sellingPrice),
      stock,
      lowStockThreshold,
      unit: formState.unit.trim() || 'pcs',
      updatedAt: new Date().toISOString(),
    };

    onSaveProduct(saved);
    setIsModalOpen(false);
  };

  const handleConfirmRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockTarget) return;
    const addQty = parseInt(restockQtyStr, 10);
    if (!Number.isFinite(addQty) || addQty <= 0) return;

    onSaveProduct({
      ...restockTarget,
      stock: restockTarget.stock + addQty,
      updatedAt: new Date().toISOString(),
    });
    setRestockTarget(null);
    setRestockQtyStr('10');
  };

  const liveCost = parseFloat(formState.costPrice) || 0;
  const liveSell = parseFloat(formState.sellingPrice) || 0;
  const liveMarginPct = liveSell > 0 ? ((liveSell - liveCost) / liveSell) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Catalog SKUs</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {metrics.totalSkus}
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            {metrics.totalUnits.toLocaleString()} total units in store
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Stock Valuation (Cost)</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {formatGHS(metrics.totalCostValue)}
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            Retail Value: {formatGHS(metrics.totalRetailValue)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Low-Stock Alerts</div>
          <div className="text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1">
            {metrics.lowStockCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            At or below reorder threshold
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Out of Stock</div>
          <div className="text-2xl font-bold text-red-700 font-mono tabular-nums mt-1">
            {metrics.outOfStockCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Needs immediate restocking
          </div>
        </div>
      </div>

      {/* Controls & Table Container */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by product name or barcode..."
                className="w-full h-10 pl-9 pr-3 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as 'All' | ProductCategory)}
              aria-label="Filter by category"
              className="h-10 px-3 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-700"
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setLowStockOnly((v) => !v)}
              className={`h-10 px-3.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                lowStockOnly
                  ? 'bg-amber-50 border-amber-400 text-amber-900'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Low / Out of Stock ({metrics.lowStockCount + metrics.outOfStockCount})
            </button>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="h-10 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>

        {/* Inventory Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="py-2.5 px-4">Barcode</th>
                <th className="py-2.5 px-4">Product Name</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4 text-right">Cost (GHS)</th>
                <th className="py-2.5 px-4 text-right">Selling (GHS)</th>
                <th className="py-2.5 px-4 text-right">Margin</th>
                <th className="py-2.5 px-4 text-right">Stock</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No inventory items found</p>
                    <p className="text-xs mt-1">Try adjusting your search or add a new product.</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const marginPct =
                    product.sellingPrice > 0
                      ? ((product.sellingPrice - product.costPrice) / product.sellingPrice) * 100
                      : 0;
                  const isOut = product.stock <= 0;
                  const isLow = product.stock > 0 && product.stock <= product.lowStockThreshold;

                  return (
                    <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                        {product.barcode}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        {product.name}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                        {product.category}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {formatGHS(product.costPrice)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums text-slate-900 whitespace-nowrap">
                        {formatGHS(product.sellingPrice)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {marginPct.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums text-slate-900 whitespace-nowrap">
                        {product.stock}{' '}
                        <span className="font-sans font-normal text-slate-400">
                          / {product.lowStockThreshold}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Low Stock
                          </span>
                        ) : (
                          <span className="font-medium text-emerald-700">In Stock</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setRestockTarget(product);
                              setRestockQtyStr('12');
                            }}
                            className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-xs font-semibold text-emerald-800"
                          >
                            + Restock
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(product)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                            aria-label={`Edit ${product.name}`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmTarget(product)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-700 hover:bg-red-50"
                            aria-label={`Delete ${product.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">
                {formState.id ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-800">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Barcode / SKU *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.barcode}
                    onChange={(e) => setFormState({ ...formState, barcode: e.target.value })}
                    className="w-full h-10 px-3 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={formState.category}
                    onChange={(e) =>
                      setFormState({ ...formState, category: e.target.value as ProductCategory })
                    }
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={formState.name}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  placeholder="e.g. Ideal Milk Evaporated (160g Tin)"
                  className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cost Price (GHS) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formState.costPrice}
                    onChange={(e) => setFormState({ ...formState, costPrice: e.target.value })}
                    className="w-full h-10 px-3 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Selling Price (GHS) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formState.sellingPrice}
                    onChange={(e) => setFormState({ ...formState, sellingPrice: e.target.value })}
                    className="w-full h-10 px-3 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {liveSell > 0 && (
                <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex justify-between">
                  <span>Estimated Gross Profit / Unit</span>
                  <span className="font-mono font-bold tabular-nums text-slate-900">
                    {formatGHS(liveSell - liveCost)} ({liveMarginPct.toFixed(1)}%)
                  </span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Stock Qty *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formState.stock}
                    onChange={(e) => setFormState({ ...formState, stock: e.target.value })}
                    className="w-full h-10 px-3 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Low-Stock Alert *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formState.lowStockThreshold}
                    onChange={(e) =>
                      setFormState({ ...formState, lowStockThreshold: e.target.value })
                    }
                    className="w-full h-10 px-3 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={formState.unit}
                    onChange={(e) => setFormState({ ...formState, unit: e.target.value })}
                    placeholder="tin, bottle, bag"
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-10 px-4 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Restock Modal */}
      {restockTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleConfirmRestock}
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-xl"
          >
            <div>
              <h3 className="text-base font-bold text-slate-900">Restock Inventory</h3>
              <p className="text-xs text-slate-500 mt-0.5">{restockTarget.name}</p>
            </div>
            <div className="text-xs text-slate-600 flex justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span>Current Stock</span>
              <span className="font-mono font-bold text-slate-900">
                {restockTarget.stock} {restockTarget.unit || 'pcs'}
              </span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quantity Received (+)
              </label>
              <input
                type="number"
                min="1"
                autoFocus
                required
                value={restockQtyStr}
                onChange={(e) => setRestockQtyStr(e.target.value)}
                className="w-full h-11 px-3 text-base font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRestockTarget(null)}
                className="h-10 px-4 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-10 px-5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white"
              >
                Add Stock
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Delete Product?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Remove <span className="font-semibold text-slate-900">{deleteConfirmTarget.name}</span>{' '}
              ({deleteConfirmTarget.barcode}) from inventory? Past sales records will remain intact.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="h-10 px-4 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteProduct(deleteConfirmTarget.id);
                  setDeleteConfirmTarget(null);
                }}
                className="h-10 px-4 rounded-lg bg-red-700 hover:bg-red-800 text-xs font-bold text-white"
              >
                Delete Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
