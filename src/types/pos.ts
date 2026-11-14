export type ProductCategory =
  | 'Pantry & Grains'
  | 'Dairy & Beverages'
  | 'Snacks & Bakery'
  | 'Household & Care';

export interface Product {
  id: string;
  barcode: string;
  name: string;
  category: ProductCategory;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  lowStockThreshold: number;
  unit?: string;
  updatedAt: string;
}

export type DiscountMode = 'fixed' | 'percent';

export interface DiscountSpec {
  mode: DiscountMode;
  value: number;
}

export interface CartItem {
  productId: string;
  barcode: string;
  name: string;
  unitPrice: number;
  costPrice: number;
  quantity: number;
  discount: DiscountSpec;
}

export type TaxMode = 'inclusive' | 'exclusive';

export interface GhanaTaxBreakdown {
  vat15: number;       // 15.0%
  nhil2_5: number;     // 2.5%
  getfund2_5: number;  // 2.5%
  covid1: number;      // 1.0%
  totalTax: number;    // 21.0% combined
}

export interface CartTotals {
  grossItemsTotal: number;
  itemDiscountsTotal: number;
  afterItemDiscounts: number;
  cartDiscountAmount: number;
  netBeforeTax: number;
  taxMode: TaxMode;
  taxBreakdown: GhanaTaxBreakdown;
  grandTotal: number;
  estimatedCost: number;
  estimatedProfit: number;
}

export type MoMoNetwork = 'MTN MoMo' | 'Telecel Cash' | 'ATMoney';
export type CardScheme = 'Gh-Link' | 'Visa' | 'Mastercard';
export type PaymentMethodType = 'cash' | 'momo' | 'card' | 'split';

export interface PaymentLeg {
  id: string;
  method: 'cash' | 'momo' | 'card';
  amount: number;         // Applied towards sale total
  tendered?: number;      // For cash: amount handed over by customer
  change?: number;        // For cash: change returned
  momoNetwork?: MoMoNetwork;
  momoPhone?: string;
  momoReference?: string;
  cardScheme?: CardScheme;
  cardReference?: string;
}

export interface Sale {
  id: string;
  receiptNumber: string;
  createdAt: string;      // ISO timestamp
  cashierName: string;
  customerName: string;
  items: {
    productId: string;
    barcode: string;
    name: string;
    unitPrice: number;
    costPrice: number;
    quantity: number;
    itemDiscountAmount: number;
    lineTotal: number;
  }[];
  grossSubtotal: number;
  totalDiscount: number;
  taxMode: TaxMode;
  taxBreakdown: GhanaTaxBreakdown;
  grandTotal: number;
  totalCost: number;
  grossProfit: number;
  paymentSummaryType: PaymentMethodType;
  payments: PaymentLeg[];
  totalTendered: number;
  changeDue: number;
  status: 'completed' | 'voided';
  voidedAt?: string;
}

export interface ParkedCart {
  id: string;
  label: string;
  parkedAt: string;
  cashierName: string;
  customerName: string;
  items: CartItem[];
  cartDiscount: DiscountSpec;
  taxMode: TaxMode;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  notes?: string;
}

export interface StoreSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  tinNumber: string;
  receiptFooter: string;
  defaultTaxMode: TaxMode;
  soundEnabled: boolean;
  cashiers: string[];
  activeCashier: string;
}

export type AppView = 'terminal' | 'inventory' | 'zreport' | 'settings';
