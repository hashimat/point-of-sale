import React, { useEffect } from 'react';
import { Download, Printer, X } from 'lucide-react';
import { Sale, StoreSettings } from '../types/pos';
import { formatCompactGHS, formatDateTime } from '../utils/currency';

interface ThermalReceiptModalProps {
  sale: Sale | null;
  settings: StoreSettings;
  onClose: () => void;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  sale,
  settings,
  onClose,
}) => {
  useEffect(() => {
    if (!sale) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sale, onClose]);

  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadTxt = () => {
    const lines: string[] = [
      settings.storeName.toUpperCase(),
      settings.storeAddress,
      `Tel: ${settings.storePhone}`,
      `GRA TIN: ${settings.tinNumber}`,
      '----------------------------------------',
      `Receipt #: ${sale.receiptNumber}`,
      `Date:      ${formatDateTime(sale.createdAt)}`,
      `Cashier:   ${sale.cashierName}`,
      `Customer:  ${sale.customerName}`,
      '----------------------------------------',
      'ITEM                     QTY      AMOUNT',
      '----------------------------------------',
    ];

    for (const item of sale.items) {
      lines.push(item.name.slice(0, 40));
      const qtyPrice = `  ${item.quantity} x ${formatCompactGHS(item.unitPrice)}`;
      const amt = formatCompactGHS(item.lineTotal);
      lines.push(qtyPrice.padEnd(28, ' ') + amt.padStart(12, ' '));
      if (item.itemDiscountAmount > 0) {
        lines.push(`  Item Disc: -GHS ${formatCompactGHS(item.itemDiscountAmount)}`);
      }
    }

    lines.push('----------------------------------------');
    if (sale.totalDiscount > 0) {
      lines.push(
        `Discount:`.padEnd(24, ' ') + `-GHS ${formatCompactGHS(sale.totalDiscount)}`.padStart(16, ' ')
      );
    }
    lines.push(
      `Tax Mode: ${sale.taxMode === 'inclusive' ? 'Inclusive (21%)' : 'Added (21%)'}`
    );
    lines.push(
      `  VAT (15.0%):`.padEnd(24, ' ') + `GHS ${formatCompactGHS(sale.taxBreakdown.vat15)}`.padStart(16, ' ')
    );
    lines.push(
      `  NHIL (2.5%):`.padEnd(24, ' ') + `GHS ${formatCompactGHS(sale.taxBreakdown.nhil2_5)}`.padStart(16, ' ')
    );
    lines.push(
      `  GETFund (2.5%):`.padEnd(24, ' ') + `GHS ${formatCompactGHS(sale.taxBreakdown.getfund2_5)}`.padStart(16, ' ')
    );
    lines.push(
      `  COVID-19 (1.0%):`.padEnd(24, ' ') + `GHS ${formatCompactGHS(sale.taxBreakdown.covid1)}`.padStart(16, ' ')
    );
    lines.push('========================================');
    lines.push(
      `TOTAL:`.padEnd(20, ' ') + `GHS ${formatCompactGHS(sale.grandTotal)}`.padStart(20, ' ')
    );
    lines.push('========================================');

    for (const p of sale.payments) {
      if (p.method === 'cash') {
        lines.push(
          `Cash Tendered:`.padEnd(24, ' ') +
            `GHS ${formatCompactGHS(p.tendered ?? p.amount)}`.padStart(16, ' ')
        );
      } else if (p.method === 'momo') {
        lines.push(
          `${p.momoNetwork}:`.padEnd(24, ' ') + `GHS ${formatCompactGHS(p.amount)}`.padStart(16, ' ')
        );
        if (p.momoReference) lines.push(`  MoMo Ref: ${p.momoReference}`);
        if (p.momoPhone) lines.push(`  Phone: ${p.momoPhone}`);
      } else {
        lines.push(
          `Card (${p.cardScheme}):`.padEnd(24, ' ') + `GHS ${formatCompactGHS(p.amount)}`.padStart(16, ' ')
        );
        if (p.cardReference) lines.push(`  Auth: ${p.cardReference}`);
      }
    }

    if (sale.changeDue > 0) {
      lines.push(
        `Change Due:`.padEnd(24, ' ') + `GHS ${formatCompactGHS(sale.changeDue)}`.padStart(16, ' ')
      );
    }

    lines.push('----------------------------------------');
    lines.push(settings.receiptFooter);
    lines.push('');

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sale.receiptNumber}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/65 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="80mm Thermal Receipt Preview"
    >
      <div className="bg-slate-100 border border-slate-200 rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden shadow-xl">
        {/* Top Controls */}
        <div className="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Thermal Receipt (80mm)
            </h2>
            <p className="text-xs text-slate-500 font-mono">{sale.receiptNumber}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTxt}
              className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
              title="Download receipt text"
            >
              <Download className="w-3.5 h-3.5" />
              TXT
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="h-9 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white inline-flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              Print 80mm
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100"
              aria-label="Close receipt preview"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Scrollable 80mm Paper Preview */}
        <div className="flex-1 overflow-y-auto p-5 flex justify-center">
          <div
            id="thermal-receipt-print-area"
            className="w-[302px] bg-white text-black font-mono text-[11px] leading-snug p-4 border border-slate-300 shadow-sm h-fit"
          >
            {/* Store Header */}
            <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-black/40">
              <div className="text-xs font-bold tracking-tight uppercase">
                {settings.storeName}
              </div>
              <div className="text-[10px] leading-tight">{settings.storeAddress}</div>
              <div className="text-[10px]">Tel: {settings.storePhone}</div>
              <div className="text-[10px] font-semibold">GRA TIN: {settings.tinNumber}</div>
              {sale.status === 'voided' && (
                <div className="mt-1 py-0.5 border border-black font-bold text-xs uppercase">
                  *** VOIDED RECEIPT ***
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="py-2 border-b border-dashed border-black/40 space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span>Receipt #:</span>
                <span className="font-bold">{sale.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{formatDateTime(sale.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>{sale.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span>{sale.customerName}</span>
              </div>
            </div>

            {/* Itemized List */}
            <div className="py-2 border-b border-dashed border-black/40">
              <div className="flex justify-between font-bold text-[10px] pb-1 border-b border-black/20 mb-1.5">
                <span>ITEM / QTY</span>
                <span>AMOUNT (GHS)</span>
              </div>
              <div className="space-y-1.5">
                {sale.items.map((item, idx) => (
                  <div key={`${item.productId}-${idx}`}>
                    <div className="font-semibold leading-tight">{item.name}</div>
                    <div className="flex justify-between text-[10px] tabular-nums pl-1">
                      <span>
                        {item.quantity} x {formatCompactGHS(item.unitPrice)}
                      </span>
                      <span className="font-semibold">{formatCompactGHS(item.lineTotal)}</span>
                    </div>
                    {item.itemDiscountAmount > 0 && (
                      <div className="flex justify-between text-[10px] pl-1">
                        <span>Item Discount</span>
                        <span>-{formatCompactGHS(item.itemDiscountAmount)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Totals & Ghana Tax Breakdown */}
            <div className="py-2 border-b border-dashed border-black/40 space-y-0.5 text-[10px] tabular-nums">
              <div className="flex justify-between">
                <span>Gross Subtotal</span>
                <span>{formatCompactGHS(sale.grossSubtotal)}</span>
              </div>
              {sale.totalDiscount > 0 && (
                <div className="flex justify-between">
                  <span>Total Discount</span>
                  <span>-{formatCompactGHS(sale.totalDiscount)}</span>
                </div>
              )}
              <div className="pt-1 text-[10px]">
                <div className="font-semibold">
                  Ghana Tax ({sale.taxMode === 'inclusive' ? 'Included in Price' : 'Added 21%'})
                </div>
                <div className="flex justify-between pl-2">
                  <span>VAT (15.0%)</span>
                  <span>{formatCompactGHS(sale.taxBreakdown.vat15)}</span>
                </div>
                <div className="flex justify-between pl-2">
                  <span>NHIL (2.5%)</span>
                  <span>{formatCompactGHS(sale.taxBreakdown.nhil2_5)}</span>
                </div>
                <div className="flex justify-between pl-2">
                  <span>GETFund (2.5%)</span>
                  <span>{formatCompactGHS(sale.taxBreakdown.getfund2_5)}</span>
                </div>
                <div className="flex justify-between pl-2">
                  <span>COVID-19 Levy (1.0%)</span>
                  <span>{formatCompactGHS(sale.taxBreakdown.covid1)}</span>
                </div>
              </div>
            </div>

            {/* Grand Total */}
            <div className="py-2 border-b border-dashed border-black/40 flex justify-between items-center text-sm font-bold tabular-nums">
              <span>TOTAL (GHS)</span>
              <span>{formatCompactGHS(sale.grandTotal)}</span>
            </div>

            {/* Payment Details */}
            <div className="py-2 border-b border-dashed border-black/40 space-y-1 text-[10px] tabular-nums">
              <div className="font-bold uppercase">Payment Details</div>
              {sale.payments.map((p) => (
                <div key={p.id} className="space-y-0.5">
                  <div className="flex justify-between">
                    <span>
                      {p.method === 'cash'
                        ? 'Cash (GHS)'
                        : p.method === 'momo'
                        ? p.momoNetwork
                        : `Card (${p.cardScheme})`}
                    </span>
                    <span className="font-semibold">
                      {formatCompactGHS(p.method === 'cash' ? p.tendered ?? p.amount : p.amount)}
                    </span>
                  </div>
                  {p.momoReference && (
                    <div className="pl-2 text-[10px]">MoMo Ref: {p.momoReference}</div>
                  )}
                  {p.momoPhone && (
                    <div className="pl-2 text-[10px]">Wallet: {p.momoPhone}</div>
                  )}
                  {p.cardReference && (
                    <div className="pl-2 text-[10px]">Auth Code: {p.cardReference}</div>
                  )}
                </div>
              ))}
              {sale.changeDue > 0 && (
                <div className="flex justify-between font-bold pt-0.5">
                  <span>Change Given</span>
                  <span>{formatCompactGHS(sale.changeDue)}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-2.5 text-center text-[10px] space-y-1">
              <p className="leading-snug">{settings.receiptFooter}</p>
              <p className="font-bold pt-1">*** THANK YOU ***</p>
            </div>
          </div>
        </div>

        {/* Bottom Close Action */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-sm font-bold text-white"
          >
            Done · Start Next Sale
          </button>
        </div>
      </div>
    </div>
  );
};
