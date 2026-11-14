import React, { useMemo, useState } from 'react';
import {
  Ban,
  Calendar,
  Download,
  FileSpreadsheet,
  Printer,
  Receipt,
} from 'lucide-react';
import { MoMoNetwork, Sale, StoreSettings } from '../types/pos';
import {
  formatCompactGHS,
  formatGHS,
  formatTimeOnly,
  getLocalDateKey,
  roundCurrency,
} from '../utils/currency';

interface ZReportDashboardProps {
  sales: Sale[];
  settings: StoreSettings;
  onReprintReceipt: (sale: Sale) => void;
  onVoidSale: (saleId: string) => void;
}

export const ZReportDashboard: React.FC<ZReportDashboardProps> = ({
  sales,
  settings,
  onReprintReceipt,
  onVoidSale,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateKey());
  const [scopeMode, setScopeMode] = useState<'date' | 'all'>('date');
  const [openingFloatStr, setOpeningFloatStr] = useState('200.00');
  const [countedCashStr, setCountedCashStr] = useState('');
  const [voidConfirmSale, setVoidConfirmSale] = useState<Sale | null>(null);

  const scopedSales = useMemo(() => {
    if (scopeMode === 'all') return sales;
    return sales.filter((s) => getLocalDateKey(s.createdAt) === selectedDate);
  }, [sales, scopeMode, selectedDate]);

  const completedSales = useMemo(
    () => scopedSales.filter((s) => s.status === 'completed'),
    [scopedSales]
  );

  const report = useMemo(() => {
    let grossSales = 0;
    let totalDiscounts = 0;
    let netSales = 0;
    let totalCost = 0;
    let totalProfit = 0;

    let vat15 = 0;
    let nhil2_5 = 0;
    let getfund2_5 = 0;
    let covid1 = 0;
    let totalTax = 0;

    let cashCollected = 0;
    let cashTxCount = 0;
    let cardCollected = 0;
    let cardTxCount = 0;

    const momoByNetwork: Record<MoMoNetwork, { amount: number; count: number }> = {
      'MTN MoMo': { amount: 0, count: 0 },
      'Telecel Cash': { amount: 0, count: 0 },
      ATMoney: { amount: 0, count: 0 },
    };

    for (const sale of completedSales) {
      grossSales += sale.grossSubtotal;
      totalDiscounts += sale.totalDiscount;
      netSales += sale.grandTotal;
      totalCost += sale.totalCost;
      totalProfit += sale.grossProfit;

      vat15 += sale.taxBreakdown.vat15;
      nhil2_5 += sale.taxBreakdown.nhil2_5;
      getfund2_5 += sale.taxBreakdown.getfund2_5;
      covid1 += sale.taxBreakdown.covid1;
      totalTax += sale.taxBreakdown.totalTax;

      for (const leg of sale.payments) {
        if (leg.method === 'cash') {
          cashCollected += leg.amount;
          cashTxCount += 1;
        } else if (leg.method === 'momo') {
          const net = leg.momoNetwork || 'MTN MoMo';
          momoByNetwork[net].amount += leg.amount;
          momoByNetwork[net].count += 1;
        } else if (leg.method === 'card') {
          cardCollected += leg.amount;
          cardTxCount += 1;
        }
      }
    }

    const totalMomo =
      momoByNetwork['MTN MoMo'].amount +
      momoByNetwork['Telecel Cash'].amount +
      momoByNetwork.ATMoney.amount;

    const profitMarginPct = netSales > 0 ? (totalProfit / netSales) * 100 : 0;
    const avgBasket = completedSales.length > 0 ? netSales / completedSales.length : 0;

    return {
      txCount: completedSales.length,
      voidedCount: scopedSales.length - completedSales.length,
      grossSales: roundCurrency(grossSales),
      totalDiscounts: roundCurrency(totalDiscounts),
      netSales: roundCurrency(netSales),
      totalCost: roundCurrency(totalCost),
      totalProfit: roundCurrency(totalProfit),
      profitMarginPct,
      avgBasket: roundCurrency(avgBasket),
      tax: {
        vat15: roundCurrency(vat15),
        nhil2_5: roundCurrency(nhil2_5),
        getfund2_5: roundCurrency(getfund2_5),
        covid1: roundCurrency(covid1),
        totalTax: roundCurrency(totalTax),
      },
      cashCollected: roundCurrency(cashCollected),
      cashTxCount,
      cardCollected: roundCurrency(cardCollected),
      cardTxCount,
      momoByNetwork: {
        'MTN MoMo': {
          amount: roundCurrency(momoByNetwork['MTN MoMo'].amount),
          count: momoByNetwork['MTN MoMo'].count,
        },
        'Telecel Cash': {
          amount: roundCurrency(momoByNetwork['Telecel Cash'].amount),
          count: momoByNetwork['Telecel Cash'].count,
        },
        ATMoney: {
          amount: roundCurrency(momoByNetwork.ATMoney.amount),
          count: momoByNetwork.ATMoney.count,
        },
      },
      totalMomo: roundCurrency(totalMomo),
    };
  }, [completedSales, scopedSales.length]);

  const openingFloat = parseFloat(openingFloatStr) || 0;
  const expectedCashInDrawer = roundCurrency(openingFloat + report.cashCollected);
  const countedCash = countedCashStr.trim() === '' ? null : parseFloat(countedCashStr);
  const cashVariance =
    countedCash !== null && Number.isFinite(countedCash)
      ? roundCurrency(countedCash - expectedCashInDrawer)
      : null;

  const handleExportCsv = () => {
    const csvRows: string[] = [];
    const esc = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;

    csvRows.push([esc('Z-REPORT RECONCILIATION SUMMARY'), esc(settings.storeName)].join(','));
    csvRows.push([esc('GRA TIN'), esc(settings.tinNumber)].join(','));
    csvRows.push([esc('Period'), esc(scopeMode === 'all' ? 'All Dates' : selectedDate)].join(','));
    csvRows.push([esc('Generated At'), esc(new Date().toISOString())].join(','));
    csvRows.push('');
    csvRows.push([esc('Metric'), esc('Value (GHS / Count)')].join(','));
    csvRows.push([esc('Completed Transactions'), report.txCount].join(','));
    csvRows.push([esc('Voided Transactions'), report.voidedCount].join(','));
    csvRows.push([esc('Gross Sales (GHS)'), formatCompactGHS(report.grossSales)].join(','));
    csvRows.push([esc('Total Discounts (GHS)'), formatCompactGHS(report.totalDiscounts)].join(','));
    csvRows.push([esc('Net Sales Collected (GHS)'), formatCompactGHS(report.netSales)].join(','));
    csvRows.push([esc('Estimated Cost of Goods (GHS)'), formatCompactGHS(report.totalCost)].join(','));
    csvRows.push([esc('Estimated Gross Profit (GHS)'), formatCompactGHS(report.totalProfit)].join(','));
    csvRows.push([esc('Profit Margin (%)'), `${report.profitMarginPct.toFixed(2)}%`].join(','));
    csvRows.push([esc('VAT 15% (GHS)'), formatCompactGHS(report.tax.vat15)].join(','));
    csvRows.push([esc('NHIL 2.5% (GHS)'), formatCompactGHS(report.tax.nhil2_5)].join(','));
    csvRows.push([esc('GETFund 2.5% (GHS)'), formatCompactGHS(report.tax.getfund2_5)].join(','));
    csvRows.push([esc('COVID-19 Levy 1% (GHS)'), formatCompactGHS(report.tax.covid1)].join(','));
    csvRows.push([esc('Cash Collected (GHS)'), formatCompactGHS(report.cashCollected)].join(','));
    csvRows.push([esc('MTN MoMo Collected (GHS)'), formatCompactGHS(report.momoByNetwork['MTN MoMo'].amount)].join(','));
    csvRows.push([esc('Telecel Cash Collected (GHS)'), formatCompactGHS(report.momoByNetwork['Telecel Cash'].amount)].join(','));
    csvRows.push([esc('ATMoney Collected (GHS)'), formatCompactGHS(report.momoByNetwork.ATMoney.amount)].join(','));
    csvRows.push([esc('Card Collected (GHS)'), formatCompactGHS(report.cardCollected)].join(','));
    csvRows.push('');
    csvRows.push(
      [
        'Receipt #',
        'Timestamp',
        'Status',
        'Cashier',
        'Customer',
        'Payment Method',
        'MoMo / Card References',
        'Items Count',
        'Discount (GHS)',
        'Total Tax (GHS)',
        'Grand Total (GHS)',
        'Gross Profit (GHS)',
      ]
        .map(esc)
        .join(',')
    );

    for (const s of scopedSales) {
      const refs = s.payments
        .map((p) => {
          if (p.method === 'momo') return `${p.momoNetwork}: ${p.momoReference || '-'}`;
          if (p.method === 'card') return `${p.cardScheme}: ${p.cardReference || '-'}`;
          return 'Cash';
        })
        .join(' | ');
      const itemsCount = s.items.reduce((sum, i) => sum + i.quantity, 0);

      csvRows.push(
        [
          esc(s.receiptNumber),
          esc(s.createdAt),
          esc(s.status),
          esc(s.cashierName),
          esc(s.customerName),
          esc(s.paymentSummaryType.toUpperCase()),
          esc(refs),
          itemsCount,
          s.totalDiscount.toFixed(2),
          s.taxBreakdown.totalTax.toFixed(2),
          s.grandTotal.toFixed(2),
          s.grossProfit.toFixed(2),
        ].join(',')
      );
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Z-Report_${scopeMode === 'all' ? 'All-Dates' : selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Header & Date Scope Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            End-of-Day Z-Report &amp; Sales Reconciliation
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {settings.storeName} · GRA TIN {settings.tinNumber}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => setScopeMode('date')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                scopeMode === 'date'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daily Shift
            </button>
            <button
              type="button"
              onClick={() => setScopeMode('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                scopeMode === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Sales
            </button>
          </div>

          {scopeMode === 'date' && (
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                aria-label="Filter Z-Report date"
                className="h-9 pl-8 pr-3 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-lg text-slate-800"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Top Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Total Net Sales</div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums mt-1">
            {formatGHS(report.netSales)}
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            {report.txCount} sales · Avg {formatGHS(report.avgBasket)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Gross Profit &amp; Margin</div>
          <div className="text-2xl font-extrabold text-emerald-700 font-mono tabular-nums mt-1">
            {formatGHS(report.totalProfit)}
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            Margin: {report.profitMarginPct.toFixed(1)}% · COGS {formatGHS(report.totalCost)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Cash Collected</div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums mt-1">
            {formatGHS(report.cashCollected)}
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            {report.cashTxCount} cash legs · Discounts {formatGHS(report.totalDiscounts)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Total MoMo Collected</div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums mt-1">
            {formatGHS(report.totalMomo)}
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            Card POS: {formatGHS(report.cardCollected)} ({report.cardTxCount})
          </div>
        </div>
      </div>

      {/* Middle 3-Column Reconciliation Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* MoMo Breakdown by Network */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-900">Mobile Money by Network</h3>
            <span className="text-xs font-mono font-bold text-slate-900 tabular-nums">
              {formatGHS(report.totalMomo)}
            </span>
          </div>
          <div className="space-y-2.5 text-xs">
            {(['MTN MoMo', 'Telecel Cash', 'ATMoney'] as MoMoNetwork[]).map((network) => {
              const data = report.momoByNetwork[network];
              return (
                <div
                  key={network}
                  className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0"
                >
                  <div>
                    <div className="font-semibold text-slate-800">{network}</div>
                    <div className="text-[11px] text-slate-500 tabular-nums">
                      {data.count} {data.count === 1 ? 'transaction' : 'transactions'}
                    </div>
                  </div>
                  <div className="font-mono font-bold text-slate-900 tabular-nums">
                    {formatGHS(data.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ghana Tax Summary */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-900">Ghana GRA Tax Summary</h3>
            <span className="text-xs font-mono font-bold text-slate-900 tabular-nums">
              {formatGHS(report.tax.totalTax)}
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">VAT (15.0%)</span>
              <span className="font-mono font-semibold tabular-nums text-slate-900">
                {formatGHS(report.tax.vat15)}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">NHIL (2.5%)</span>
              <span className="font-mono font-semibold tabular-nums text-slate-900">
                {formatGHS(report.tax.nhil2_5)}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">GETFund Levy (2.5%)</span>
              <span className="font-mono font-semibold tabular-nums text-slate-900">
                {formatGHS(report.tax.getfund2_5)}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-600">COVID-19 Recovery Levy (1.0%)</span>
              <span className="font-mono font-semibold tabular-nums text-slate-900">
                {formatGHS(report.tax.covid1)}
              </span>
            </div>
          </div>
        </div>

        {/* Cash Drawer Reconciliation */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-900">Cash Drawer Count</h3>
          </div>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <label className="text-slate-600">Opening Float (GHS)</label>
              <input
                type="number"
                step="0.01"
                value={openingFloatStr}
                onChange={(e) => setOpeningFloatStr(e.target.value)}
                className="w-28 h-8 px-2 text-right font-mono tabular-nums border border-slate-300 rounded-md"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Expected Cash in Till</span>
              <span className="font-mono font-bold tabular-nums text-slate-900">
                {formatGHS(expectedCashInDrawer)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-slate-600">Actual Counted Cash</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={countedCashStr}
                onChange={(e) => setCountedCashStr(e.target.value)}
                className="w-28 h-8 px-2 text-right font-mono tabular-nums border border-slate-300 rounded-md"
              />
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="font-semibold text-slate-800">Drawer Variance</span>
              {cashVariance === null ? (
                <span className="text-slate-400">Enter count above</span>
              ) : (
                <span
                  className={`font-mono font-bold tabular-nums ${
                    cashVariance === 0
                      ? 'text-emerald-700'
                      : cashVariance > 0
                      ? 'text-amber-700'
                      : 'text-red-700'
                  }`}
                >
                  {cashVariance > 0 ? '+' : ''}
                  {formatGHS(cashVariance)} {cashVariance === 0 ? '(Balanced)' : cashVariance > 0 ? '(Over)' : '(Short)'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sales Transactions Ledger */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-900">Sales Ledger</h3>
            <span className="text-xs text-slate-500 tabular-nums">
              · {scopedSales.length} receipts
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="py-2.5 px-4">Receipt #</th>
                <th className="py-2.5 px-4">Time</th>
                <th className="py-2.5 px-4">Cashier</th>
                <th className="py-2.5 px-4">Payment &amp; MoMo Ref</th>
                <th className="py-2.5 px-4 text-right">Items</th>
                <th className="py-2.5 px-4 text-right">Total (GHS)</th>
                <th className="py-2.5 px-4 text-right">Profit</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {scopedSales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No sales recorded for this period</p>
                    <p className="text-xs mt-1">
                      Complete a checkout in the POS Terminal to populate Z-Report figures.
                    </p>
                  </td>
                </tr>
              ) : (
                scopedSales.map((sale) => {
                  const itemQty = sale.items.reduce((s, i) => s + i.quantity, 0);
                  const paymentDesc = sale.payments
                    .map((p) => {
                      if (p.method === 'cash') return `Cash ${formatCompactGHS(p.amount)}`;
                      if (p.method === 'momo')
                        return `${p.momoNetwork} (${p.momoReference || 'No Ref'})`;
                      return `${p.cardScheme}`;
                    })
                    .join(' + ');

                  return (
                    <tr
                      key={sale.id}
                      className={`hover:bg-slate-50/70 ${
                        sale.status === 'voided' ? 'opacity-60 bg-red-50/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {sale.receiptNumber}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap tabular-nums">
                        {formatTimeOnly(sale.createdAt)}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                        {sale.cashierName}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 max-w-xs truncate">
                        {paymentDesc}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                        {itemQty}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums text-slate-900 whitespace-nowrap">
                        {formatGHS(sale.grandTotal)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700 whitespace-nowrap">
                        {formatGHS(sale.grossProfit)}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {sale.status === 'voided' ? (
                          <span className="font-semibold text-red-700">Voided</span>
                        ) : (
                          <span className="font-medium text-emerald-700">Completed</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onReprintReceipt(sale)}
                            className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-xs font-medium text-slate-700 inline-flex items-center gap-1"
                          >
                            <Printer className="w-3 h-3" />
                            Receipt
                          </button>
                          {sale.status === 'completed' && (
                            <button
                              type="button"
                              onClick={() => setVoidConfirmSale(sale)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-700 hover:bg-red-50"
                              title="Void sale and restore stock"
                              aria-label={`Void ${sale.receiptNumber}`}
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
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

      {/* Void Confirmation Modal */}
      {voidConfirmSale && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Void Receipt?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Voiding <span className="font-mono font-bold text-slate-900">{voidConfirmSale.receiptNumber}</span>{' '}
              ({formatGHS(voidConfirmSale.grandTotal)}) will exclude it from Z-Report totals and restore all sold quantities back into inventory.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVoidConfirmSale(null)}
                className="h-10 px-4 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Keep Sale
              </button>
              <button
                type="button"
                onClick={() => {
                  onVoidSale(voidConfirmSale.id);
                  setVoidConfirmSale(null);
                }}
                className="h-10 px-4 rounded-lg bg-red-700 hover:bg-red-800 text-xs font-bold text-white"
              >
                Confirm Void
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
