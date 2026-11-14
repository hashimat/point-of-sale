import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, CreditCard, Plus, Smartphone, Split, Trash2, X } from 'lucide-react';
import {
  CardScheme,
  CartTotals,
  MoMoNetwork,
  PaymentLeg,
  PaymentMethodType,
} from '../types/pos';
import { formatGHS, roundCurrency } from '../utils/currency';

interface PaymentModalProps {
  isOpen: boolean;
  totals: CartTotals;
  customerName: string;
  onClose: () => void;
  onCompleteSale: (payload: {
    paymentSummaryType: PaymentMethodType;
    payments: PaymentLeg[];
    totalTendered: number;
    changeDue: number;
  }) => void;
}

const QUICK_CASH_NOTES = [10, 20, 50, 100, 200];
const MOMO_NETWORKS: MoMoNetwork[] = ['MTN MoMo', 'Telecel Cash', 'ATMoney'];
const CARD_SCHEMES: CardScheme[] = ['Gh-Link', 'Visa', 'Mastercard'];

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  totals,
  customerName,
  onClose,
  onCompleteSale,
}) => {
  const [activeMethod, setActiveMethod] = useState<PaymentMethodType>('cash');

  // Cash state
  const [cashTenderedStr, setCashTenderedStr] = useState<string>('');

  // MoMo state
  const [momoNetwork, setMomoNetwork] = useState<MoMoNetwork>('MTN MoMo');
  const [momoPhone, setMomoPhone] = useState('');
  const [momoRef, setMomoRef] = useState('');

  // Card state
  const [cardScheme, setCardScheme] = useState<CardScheme>('Visa');
  const [cardRef, setCardRef] = useState('');

  // Split state
  const [splitLegs, setSplitLegs] = useState<PaymentLeg[]>([]);
  const [splitDraftMethod, setSplitDraftMethod] = useState<'cash' | 'momo' | 'card'>('cash');
  const [splitDraftAmount, setSplitDraftAmount] = useState('');
  const [splitMomoNetwork, setSplitMomoNetwork] = useState<MoMoNetwork>('MTN MoMo');
  const [splitMomoRef, setSplitMomoRef] = useState('');
  const [splitCardScheme, setSplitCardScheme] = useState<CardScheme>('Visa');
  const [splitCardRef, setSplitCardRef] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveMethod('cash');
      setCashTenderedStr(totals.grandTotal.toFixed(2));
      setMomoNetwork('MTN MoMo');
      setMomoPhone('');
      setMomoRef('');
      setCardScheme('Visa');
      setCardRef('');
      setSplitLegs([]);
      setSplitDraftMethod('cash');
      setSplitDraftAmount('');
      setSplitMomoRef('');
      setSplitCardRef('');
      setErrorMsg(null);
    }
  }, [isOpen, totals.grandTotal]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const cashTendered = useMemo(() => {
    const val = parseFloat(cashTenderedStr);
    return Number.isFinite(val) ? roundCurrency(Math.max(0, val)) : 0;
  }, [cashTenderedStr]);

  const cashChange = useMemo(
    () => roundCurrency(Math.max(0, cashTendered - totals.grandTotal)),
    [cashTendered, totals.grandTotal]
  );

  const splitTotalPaid = useMemo(
    () => roundCurrency(splitLegs.reduce((sum, leg) => sum + leg.amount, 0)),
    [splitLegs]
  );

  const splitRemaining = useMemo(
    () => roundCurrency(Math.max(0, totals.grandTotal - splitTotalPaid)),
    [totals.grandTotal, splitTotalPaid]
  );

  const splitOverpayChange = useMemo(
    () => roundCurrency(Math.max(0, splitTotalPaid - totals.grandTotal)),
    [splitTotalPaid, totals.grandTotal]
  );

  if (!isOpen) return null;

  const handleAddCashNote = (note: number) => {
    setErrorMsg(null);
    setCashTenderedStr(note.toFixed(2));
  };

  const handleIncrementCashNote = (note: number) => {
    setErrorMsg(null);
    const next = roundCurrency(cashTendered + note);
    setCashTenderedStr(next.toFixed(2));
  };

  const handleAddSplitLeg = () => {
    setErrorMsg(null);
    const amt = roundCurrency(parseFloat(splitDraftAmount) || 0);
    if (amt <= 0) {
      setErrorMsg('Enter a valid amount greater than GHS 0.00 for this payment leg.');
      return;
    }
    if (splitDraftMethod === 'momo' && !splitMomoRef.trim()) {
      setErrorMsg('MoMo Transaction Reference ID is required for Mobile Money legs.');
      return;
    }

    const newLeg: PaymentLeg = {
      id: `leg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      method: splitDraftMethod,
      amount: amt,
      ...(splitDraftMethod === 'cash' ? { tendered: amt, change: 0 } : {}),
      ...(splitDraftMethod === 'momo'
        ? {
            momoNetwork: splitMomoNetwork,
            momoReference: splitMomoRef.trim(),
          }
        : {}),
      ...(splitDraftMethod === 'card'
        ? {
            cardScheme: splitCardScheme,
            cardReference: splitCardRef.trim() || undefined,
          }
        : {}),
    };

    const nextLegs = [...splitLegs, newLeg];
    setSplitLegs(nextLegs);
    const nextPaid = roundCurrency(nextLegs.reduce((s, l) => s + l.amount, 0));
    const nextRem = roundCurrency(Math.max(0, totals.grandTotal - nextPaid));
    setSplitDraftAmount(nextRem > 0 ? nextRem.toFixed(2) : '');
    setSplitMomoRef('');
    setSplitCardRef('');
  };

  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (activeMethod === 'cash') {
      if (cashTendered < totals.grandTotal) {
        setErrorMsg(
          `Cash tendered (${formatGHS(cashTendered)}) is less than amount due (${formatGHS(totals.grandTotal)}).`
        );
        return;
      }
      onCompleteSale({
        paymentSummaryType: 'cash',
        payments: [
          {
            id: `pay-${Date.now()}`,
            method: 'cash',
            amount: totals.grandTotal,
            tendered: cashTendered,
            change: cashChange,
          },
        ],
        totalTendered: cashTendered,
        changeDue: cashChange,
      });
      return;
    }

    if (activeMethod === 'momo') {
      if (!momoRef.trim()) {
        setErrorMsg('Please enter the MoMo Transaction Reference ID from the confirmation SMS.');
        return;
      }
      onCompleteSale({
        paymentSummaryType: 'momo',
        payments: [
          {
            id: `pay-${Date.now()}`,
            method: 'momo',
            amount: totals.grandTotal,
            momoNetwork,
            momoPhone: momoPhone.trim() || undefined,
            momoReference: momoRef.trim(),
          },
        ],
        totalTendered: totals.grandTotal,
        changeDue: 0,
      });
      return;
    }

    if (activeMethod === 'card') {
      onCompleteSale({
        paymentSummaryType: 'card',
        payments: [
          {
            id: `pay-${Date.now()}`,
            method: 'card',
            amount: totals.grandTotal,
            cardScheme,
            cardReference: cardRef.trim() || undefined,
          },
        ],
        totalTendered: totals.grandTotal,
        changeDue: 0,
      });
      return;
    }

    // Split payment validation
    if (splitTotalPaid < totals.grandTotal) {
      setErrorMsg(`Remaining balance of ${formatGHS(splitRemaining)} must be covered before completing sale.`);
      return;
    }

    // Normalize final cash leg if overpaid for change tracking
    const normalizedLegs = splitLegs.map((leg) => ({ ...leg }));
    if (splitOverpayChange > 0) {
      const cashLegIdx = normalizedLegs.findIndex((l) => l.method === 'cash');
      if (cashLegIdx >= 0) {
        const orig = normalizedLegs[cashLegIdx];
        orig.tendered = orig.amount;
        orig.amount = roundCurrency(Math.max(0, orig.amount - splitOverpayChange));
        orig.change = splitOverpayChange;
      }
    }

    onCompleteSale({
      paymentSummaryType: 'split',
      payments: normalizedLegs,
      totalTendered: splitTotalPaid,
      changeDue: splitOverpayChange,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl overflow-hidden shadow-xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 id="payment-modal-title" className="text-lg font-bold text-slate-900">
              Complete Payment
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Customer: {customerName} · {totals.taxMode === 'inclusive' ? 'Tax-Inclusive' : 'Tax Breakdown Included'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-900"
            aria-label="Close payment modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Amount Due Banner */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <span className="text-sm font-medium text-slate-300">Total Amount Due</span>
          <span className="text-3xl font-extrabold font-mono tabular-nums">
            {formatGHS(totals.grandTotal)}
          </span>
        </div>

        {/* Payment Method Selector Tabs */}
        <div className="px-6 pt-4 pb-2 border-b border-slate-100">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                { id: 'cash', label: 'Cash (GHS)', icon: Banknote },
                { id: 'momo', label: 'Mobile Money', icon: Smartphone },
                { id: 'card', label: 'Card POS', icon: CreditCard },
                { id: 'split', label: 'Split Pay', icon: Split },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeMethod === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveMethod(tab.id);
                    setErrorMsg(null);
                    if (tab.id === 'split' && splitLegs.length === 0) {
                      setSplitDraftAmount(totals.grandTotal.toFixed(2));
                    }
                  }}
                  className={`h-11 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-emerald-700 border-emerald-700 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConfirmPayment} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-800">
              {errorMsg}
            </div>
          )}

          {/* CASH PAYMENT */}
          {activeMethod === 'cash' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Cash Tendered (GHS)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    autoFocus
                    value={cashTenderedStr}
                    onChange={(e) => {
                      setCashTenderedStr(e.target.value);
                      setErrorMsg(null);
                    }}
                    className="flex-1 h-12 px-4 text-xl font-bold font-mono tabular-nums border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => setCashTenderedStr(totals.grandTotal.toFixed(2))}
                    className="h-12 px-4 text-xs font-semibold bg-slate-100 border border-slate-300 text-slate-800 rounded-xl hover:bg-slate-200 whitespace-nowrap"
                  >
                    Exact
                  </button>
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-500 mb-2">
                  Quick Cash Denominations (Set Amount)
                </span>
                <div className="grid grid-cols-5 gap-2">
                  {QUICK_CASH_NOTES.map((note) => (
                    <button
                      key={note}
                      type="button"
                      onClick={() => handleAddCashNote(note)}
                      className="h-11 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 active:bg-slate-200 text-sm font-bold font-mono tabular-nums text-slate-900"
                    >
                      GHS {note}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] text-slate-500 mr-1">Add note:</span>
                  {[10, 20, 50, 100].map((note) => (
                    <button
                      key={`add-${note}`}
                      type="button"
                      onClick={() => handleIncrementCashNote(note)}
                      className="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-mono font-semibold text-slate-700"
                    >
                      +{note}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">
                  {cashTendered >= totals.grandTotal ? 'Change Due to Customer' : 'Shortfall Remaining'}
                </span>
                <span
                  className={`text-2xl font-extrabold font-mono tabular-nums ${
                    cashTendered >= totals.grandTotal ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {cashTendered >= totals.grandTotal
                    ? formatGHS(cashChange)
                    : formatGHS(roundCurrency(totals.grandTotal - cashTendered))}
                </span>
              </div>
            </div>
          )}

          {/* MOBILE MONEY PAYMENT */}
          {activeMethod === 'momo' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mobile Money Network Provider
                </label>
                <select
                  value={momoNetwork}
                  onChange={(e) => setMomoNetwork(e.target.value as MoMoNetwork)}
                  className="w-full h-11 px-3.5 text-sm font-semibold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  {MOMO_NETWORKS.map((net) => (
                    <option key={net} value={net}>
                      {net}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  MoMo Transaction Reference ID <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={momoRef}
                  onChange={(e) => {
                    setMomoRef(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="e.g. 24098173645 / MP241114.1234"
                  className="w-full h-11 px-3.5 text-sm font-mono bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Enter the Transaction ID from the {momoNetwork} merchant SMS alert for Z-Report reconciliation.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Customer Wallet Number (Optional)
                </label>
                <input
                  type="tel"
                  value={momoPhone}
                  onChange={(e) => setMomoPhone(e.target.value)}
                  placeholder="e.g. 024 123 4567"
                  className="w-full h-11 px-3.5 text-sm font-mono bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>
          )}

          {/* CARD PAYMENT */}
          {activeMethod === 'card' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Card Network
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {CARD_SCHEMES.map((scheme) => (
                    <button
                      key={scheme}
                      type="button"
                      onClick={() => setCardScheme(scheme)}
                      className={`h-11 rounded-xl border text-xs font-semibold ${
                        cardScheme === scheme
                          ? 'bg-slate-900 border-slate-900 text-white'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {scheme}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  POS Terminal Auth / Approval Code (Optional)
                </label>
                <input
                  type="text"
                  value={cardRef}
                  onChange={(e) => setCardRef(e.target.value)}
                  placeholder="e.g. AUTH-884210"
                  className="w-full h-11 px-3.5 text-sm font-mono bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>
          )}

          {/* SPLIT PAYMENT */}
          {activeMethod === 'split' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 block">Remaining Balance</span>
                  <span
                    className={`text-lg font-bold font-mono tabular-nums ${
                      splitRemaining > 0 ? 'text-amber-700' : 'text-emerald-700'
                    }`}
                  >
                    {formatGHS(splitRemaining)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 block">
                    {splitOverpayChange > 0 ? 'Change Due' : 'Added So Far'}
                  </span>
                  <span className="text-lg font-bold font-mono tabular-nums text-slate-900">
                    {splitOverpayChange > 0
                      ? formatGHS(splitOverpayChange)
                      : formatGHS(splitTotalPaid)}
                  </span>
                </div>
              </div>

              {/* Add Leg Box */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'momo', 'card'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSplitDraftMethod(m)}
                      className={`h-9 rounded-lg border text-xs font-semibold capitalize ${
                        splitDraftMethod === m
                          ? 'bg-slate-900 border-slate-900 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      {m === 'momo' ? 'MoMo' : m}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={splitDraftAmount}
                    onChange={(e) => setSplitDraftAmount(e.target.value)}
                    placeholder="Amount (GHS)"
                    className="sm:w-36 h-10 px-3 text-sm font-mono tabular-nums border border-slate-300 rounded-lg"
                  />
                  {splitDraftMethod === 'momo' && (
                    <>
                      <select
                        value={splitMomoNetwork}
                        onChange={(e) => setSplitMomoNetwork(e.target.value as MoMoNetwork)}
                        className="h-10 px-2.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
                      >
                        {MOMO_NETWORKS.map((net) => (
                          <option key={net} value={net}>
                            {net}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={splitMomoRef}
                        onChange={(e) => setSplitMomoRef(e.target.value)}
                        placeholder="MoMo Ref ID *"
                        className="flex-1 h-10 px-3 text-xs font-mono border border-slate-300 rounded-lg"
                      />
                    </>
                  )}
                  {splitDraftMethod === 'card' && (
                    <>
                      <select
                        value={splitCardScheme}
                        onChange={(e) => setSplitCardScheme(e.target.value as CardScheme)}
                        className="h-10 px-2.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
                      >
                        {CARD_SCHEMES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={splitCardRef}
                        onChange={(e) => setSplitCardRef(e.target.value)}
                        placeholder="Auth Code (optional)"
                        className="flex-1 h-10 px-3 text-xs font-mono border border-slate-300 rounded-lg"
                      />
                    </>
                  )}
                  <button
                    type="button"
                    onClick={handleAddSplitLeg}
                    className="h-10 px-4 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 inline-flex items-center justify-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
              </div>

              {/* Added Split Legs List */}
              {splitLegs.length > 0 && (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {splitLegs.map((leg) => (
                    <div
                      key={leg.id}
                      className="px-3.5 py-2.5 bg-white flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-900">
                          {leg.method === 'cash'
                            ? 'Cash (GHS)'
                            : leg.method === 'momo'
                            ? `${leg.momoNetwork}`
                            : `Card (${leg.cardScheme})`}
                        </span>
                        {leg.momoReference && (
                          <span className="text-slate-500 font-mono ml-2">
                            Ref: {leg.momoReference}
                          </span>
                        )}
                        {leg.cardReference && (
                          <span className="text-slate-500 font-mono ml-2">
                            Auth: {leg.cardReference}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold tabular-nums text-slate-900">
                          {formatGHS(leg.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSplitLegs((prev) => prev.filter((l) => l.id !== leg.id))
                          }
                          className="p-1 text-slate-400 hover:text-red-700"
                          aria-label="Remove payment leg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Submit Footer */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel (Esc)
            </button>
            <button
              type="submit"
              className="h-11 px-6 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-sm font-bold text-white shadow-xs"
            >
              Complete Sale &amp; Print Receipt
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
