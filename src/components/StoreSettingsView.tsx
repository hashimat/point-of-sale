import React, { useRef, useState } from 'react';
import { Check, Download, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import { Customer, ParkedCart, Product, Sale, StoreSettings, TaxMode } from '../types/pos';

interface StoreSettingsViewProps {
  settings: StoreSettings;
  storageEngine: 'IndexedDB' | 'localStorage';
  products: Product[];
  sales: Sale[];
  parkedCarts: ParkedCart[];
  customers: Customer[];
  onSaveSettings: (settings: StoreSettings) => void;
  onResetDemoData: () => void;
  onImportSnapshot: (data: {
    products: Product[];
    sales: Sale[];
    parkedCarts: ParkedCart[];
    customers: Customer[];
    settings: StoreSettings;
  }) => void;
}

export const StoreSettingsView: React.FC<StoreSettingsViewProps> = ({
  settings,
  storageEngine,
  products,
  sales,
  parkedCarts,
  customers,
  onSaveSettings,
  onResetDemoData,
  onImportSnapshot,
}) => {
  const [draft, setDraft] = useState<StoreSettings>(settings);
  const [newCashier, setNewCashier] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(draft);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleAddCashier = () => {
    const trimmed = newCashier.trim();
    if (!trimmed) return;
    if (draft.cashiers.includes(trimmed)) {
      setNewCashier('');
      return;
    }
    const updated = {
      ...draft,
      cashiers: [...draft.cashiers, trimmed],
    };
    setDraft(updated);
    onSaveSettings(updated);
    setNewCashier('');
  };

  const handleRemoveCashier = (name: string) => {
    if (draft.cashiers.length <= 1) return;
    const remaining = draft.cashiers.filter((c) => c !== name);
    const updated: StoreSettings = {
      ...draft,
      cashiers: remaining,
      activeCashier: draft.activeCashier === name ? remaining[0] : draft.activeCashier,
    };
    setDraft(updated);
    onSaveSettings(updated);
  };

  const handleExportBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      settings,
      products,
      sales,
      parkedCarts,
      customers,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tamale-pos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed.products) || !parsed.settings) {
          setImportError('Invalid backup file format.');
          return;
        }
        onImportSnapshot({
          products: parsed.products,
          sales: Array.isArray(parsed.sales) ? parsed.sales : [],
          parkedCarts: Array.isArray(parsed.parkedCarts) ? parsed.parkedCarts : [],
          customers: Array.isArray(parsed.customers) ? parsed.customers : customers,
          settings: parsed.settings,
        });
        setDraft(parsed.settings);
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 2500);
      } catch {
        setImportError('Failed to parse JSON backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Store & Receipt Header Config */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Supermarket Header &amp; Receipt Settings
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Printed on all 80mm thermal receipts and CSV Z-Reports.
            </p>
          </div>
          {savedNotice && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <Check className="w-4 h-4" />
              Settings Saved
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Supermarket Name
            </label>
            <input
              type="text"
              required
              value={draft.storeName}
              onChange={(e) => setDraft({ ...draft, storeName: e.target.value })}
              className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              GRA TIN Number
            </label>
            <input
              type="text"
              required
              value={draft.tinNumber}
              onChange={(e) => setDraft({ ...draft, tinNumber: e.target.value })}
              className="w-full h-10 px-3 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Location / Address
            </label>
            <input
              type="text"
              required
              value={draft.storeAddress}
              onChange={(e) => setDraft({ ...draft, storeAddress: e.target.value })}
              className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Phone Number
            </label>
            <input
              type="text"
              required
              value={draft.storePhone}
              onChange={(e) => setDraft({ ...draft, storePhone: e.target.value })}
              className="w-full h-10 px-3 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Receipt Footer Message
          </label>
          <input
            type="text"
            value={draft.receiptFooter}
            onChange={(e) => setDraft({ ...draft, receiptFooter: e.target.value })}
            className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Default Tax Pricing Mode
            </label>
            <select
              value={draft.defaultTaxMode}
              onChange={(e) =>
                setDraft({ ...draft, defaultTaxMode: e.target.value as TaxMode })
              }
              className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="inclusive">Tax-Inclusive (Shelf prices include 21% tax)</option>
              <option value="exclusive">Tax-Exclusive (+21% Ghana Tax added at checkout)</option>
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2.5 h-10 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.soundEnabled}
                onChange={(e) => setDraft({ ...draft, soundEnabled: e.target.checked })}
                className="w-4 h-4 accent-emerald-700 rounded"
              />
              <span className="text-sm font-medium text-slate-800">
                Enable barcode scanner beep &amp; checkout chime
              </span>
            </label>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="h-10 px-5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
          >
            Save Store Settings
          </button>
        </div>
      </form>

      {/* Cashier Profiles */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Cashier Profiles</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Active cashier is printed on every receipt and logged in Z-Reports.
          </p>
        </div>

        <div className="flex gap-2 max-w-md">
          <input
            type="text"
            value={newCashier}
            onChange={(e) => setNewCashier(e.target.value)}
            placeholder="Add cashier full name..."
            className="flex-1 h-10 px-3 text-sm border border-slate-300 rounded-lg"
          />
          <button
            type="button"
            onClick={handleAddCashier}
            className="h-10 px-4 rounded-lg bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {draft.cashiers.map((name) => {
            const isActive = draft.activeCashier === name;
            return (
              <div
                key={name}
                className="px-4 py-2.5 flex items-center justify-between text-sm bg-white"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{name}</span>
                  {isActive && (
                    <span className="text-xs font-semibold text-emerald-700">
                      · Active Shift
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...draft, activeCashier: name };
                        setDraft(updated);
                        onSaveSettings(updated);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      Set Active
                    </button>
                  )}
                  {draft.cashiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCashier(name)}
                      className="p-1.5 text-slate-400 hover:text-red-700 rounded"
                      aria-label={`Remove ${name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Offline Storage Backup & Reset */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Offline Data Backup &amp; Recovery
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Storage Engine: {storageEngine} · {products.length} products · {sales.length} receipts stored locally
            </p>
          </div>
        </div>

        {importError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-800">
            {importError}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportBackup}
            className="h-10 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Download Full JSON Backup
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-10 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            Restore from JSON
          </button>

          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="h-10 px-4 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-800 inline-flex items-center gap-1.5 ml-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Sample Inventory
          </button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Reset POS Data?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will restore the default Tamale mini supermarket inventory and clear all local sales history. Download a JSON backup first if you need existing records.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="h-10 px-4 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetDemoData();
                  setShowResetConfirm(false);
                }}
                className="h-10 px-4 rounded-lg bg-red-700 hover:bg-red-800 text-xs font-bold text-white"
              >
                Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
