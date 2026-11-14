import { CartItem, CartTotals, DiscountSpec, GhanaTaxBreakdown, TaxMode } from '../types/pos';

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatGHS(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `GHS ${safe.toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCompactGHS(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return safe.toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function calculateItemDiscountAmount(item: CartItem): number {
  const lineGross = item.unitPrice * item.quantity;
  if (item.discount.value <= 0) return 0;
  if (item.discount.mode === 'percent') {
    const pct = Math.min(100, Math.max(0, item.discount.value));
    return roundCurrency((lineGross * pct) / 100);
  }
  return roundCurrency(Math.min(lineGross, Math.max(0, item.discount.value)));
}

/**
 * Ghana Standard Tax Breakdown:
 * - VAT: 15.0%
 * - NHIL: 2.5%
 * - GETFund: 2.5%
 * - COVID-19 Health Recovery Levy: 1.0%
 * Total Tax Rate = 21.0%
 */
export function calculateGhanaTaxBreakdown(baseAmount: number, taxMode: TaxMode): GhanaTaxBreakdown {
  if (baseAmount <= 0) {
    return {
      vat15: 0,
      nhil2_5: 0,
      getfund2_5: 0,
      covid1: 0,
      totalTax: 0,
    };
  }

  if (taxMode === 'exclusive') {
    const vat15 = roundCurrency(baseAmount * 0.15);
    const nhil2_5 = roundCurrency(baseAmount * 0.025);
    const getfund2_5 = roundCurrency(baseAmount * 0.025);
    const covid1 = roundCurrency(baseAmount * 0.01);
    const totalTax = roundCurrency(vat15 + nhil2_5 + getfund2_5 + covid1);
    return { vat15, nhil2_5, getfund2_5, covid1, totalTax };
  }

  // Inclusive: shelf price already contains 21% combined tax (base = total / 1.21)
  const preTaxBase = baseAmount / 1.21;
  const vat15 = roundCurrency(preTaxBase * 0.15);
  const nhil2_5 = roundCurrency(preTaxBase * 0.025);
  const getfund2_5 = roundCurrency(preTaxBase * 0.025);
  const covid1 = roundCurrency(preTaxBase * 0.01);
  const totalTax = roundCurrency(vat15 + nhil2_5 + getfund2_5 + covid1);

  return { vat15, nhil2_5, getfund2_5, covid1, totalTax };
}

export function calculateCartTotals(
  items: CartItem[],
  cartDiscount: DiscountSpec,
  taxMode: TaxMode
): CartTotals {
  let grossItemsTotal = 0;
  let itemDiscountsTotal = 0;
  let estimatedCost = 0;

  for (const item of items) {
    const gross = roundCurrency(item.unitPrice * item.quantity);
    const disc = calculateItemDiscountAmount(item);
    grossItemsTotal += gross;
    itemDiscountsTotal += disc;
    estimatedCost += roundCurrency(item.costPrice * item.quantity);
  }

  grossItemsTotal = roundCurrency(grossItemsTotal);
  itemDiscountsTotal = roundCurrency(itemDiscountsTotal);
  const afterItemDiscounts = roundCurrency(Math.max(0, grossItemsTotal - itemDiscountsTotal));

  let cartDiscountAmount = 0;
  if (cartDiscount.value > 0 && afterItemDiscounts > 0) {
    if (cartDiscount.mode === 'percent') {
      const pct = Math.min(100, Math.max(0, cartDiscount.value));
      cartDiscountAmount = roundCurrency((afterItemDiscounts * pct) / 100);
    } else {
      cartDiscountAmount = roundCurrency(Math.min(afterItemDiscounts, Math.max(0, cartDiscount.value)));
    }
  }

  const netPayableBase = roundCurrency(Math.max(0, afterItemDiscounts - cartDiscountAmount));
  const taxBreakdown = calculateGhanaTaxBreakdown(netPayableBase, taxMode);

  const grandTotal =
    taxMode === 'exclusive'
      ? roundCurrency(netPayableBase + taxBreakdown.totalTax)
      : netPayableBase;

  const netBeforeTax =
    taxMode === 'exclusive'
      ? netPayableBase
      : roundCurrency(Math.max(0, netPayableBase - taxBreakdown.totalTax));

  // Profit calculated on ex-tax or retail revenue vs COGS; in Ghanaian retail POS
  // margin against shelf revenue (minus discounts) or net ex-tax is tracked cleanly.
  const estimatedProfit = roundCurrency(netPayableBase - estimatedCost);

  return {
    grossItemsTotal,
    itemDiscountsTotal,
    afterItemDiscounts,
    cartDiscountAmount,
    netBeforeTax,
    taxMode,
    taxBreakdown,
    grandTotal,
    estimatedCost: roundCurrency(estimatedCost),
    estimatedProfit,
  };
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatTimeOnly(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function getLocalDateKey(isoOrDate: string | Date = new Date()): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function generateReceiptNumber(salesCount: number): string {
  const d = new Date();
  const yymmdd =
    String(d.getFullYear()).slice(-2) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const seq = String(salesCount + 1).padStart(4, '0');
  return `TCM-${yymmdd}-${seq}`;
}

// Offline Web Audio scanner beep
let audioCtx: AudioContext | null = null;
export function playBeep(type: 'scan' | 'error' | 'success' = 'scan', enabled = true): void {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    if (type === 'scan') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1320, now + 0.08);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.23);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(240, now);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.19);
    }
  } catch {
    // Ignore audio context errors in headless environments
  }
}
