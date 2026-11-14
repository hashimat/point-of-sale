import { DEFAULT_STORE_SETTINGS, SEED_CUSTOMERS, SEED_PRODUCTS } from '../data/seedInventory';
import { Customer, ParkedCart, Product, Sale, StoreSettings } from '../types/pos';

const DB_NAME = 'tamale_central_pos_db';
const DB_VERSION = 1;

const STORES = {
  PRODUCTS: 'products',
  SALES: 'sales',
  PARKED_CARTS: 'parkedCarts',
  CUSTOMERS: 'customers',
  SETTINGS: 'settings',
} as const;

const LS_FALLBACK_KEY = 'tamale_pos_fallback_v1';

interface FallbackState {
  products: Product[];
  sales: Sale[];
  parkedCarts: ParkedCart[];
  customers: Customer[];
  settings: StoreSettings;
  initialized: boolean;
}

function readFallback(): FallbackState {
  try {
    const raw = localStorage.getItem(LS_FALLBACK_KEY);
    if (raw) {
      return JSON.parse(raw) as FallbackState;
    }
  } catch {
    // ignore storage parse error
  }
  const initial: FallbackState = {
    products: [...SEED_PRODUCTS],
    sales: [],
    parkedCarts: [],
    customers: [...SEED_CUSTOMERS],
    settings: { ...DEFAULT_STORE_SETTINGS },
    initialized: true,
  };
  writeFallback(initial);
  return initial;
}

function writeFallback(state: FallbackState): void {
  try {
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(state));
  } catch {
    // ignore quota error
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
        const ps = db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id' });
        ps.createIndex('barcode', 'barcode', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.SALES)) {
        const ss = db.createObjectStore(STORES.SALES, { keyPath: 'id' });
        ss.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.PARKED_CARTS)) {
        db.createObjectStore(STORES.PARKED_CARTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
        db.createObjectStore(STORES.CUSTOMERS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

async function idbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function idbPut<T>(storeName: string, item: T): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put(item);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function idbPutMany<T>(storeName: string, items: T[], clearFirst = false): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    if (clearFirst) {
      store.clear();
    }
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function idbDelete(storeName: string, key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.delete(key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function idbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export interface PosBootstrapData {
  products: Product[];
  sales: Sale[];
  parkedCarts: ParkedCart[];
  customers: Customer[];
  settings: StoreSettings;
  storageEngine: 'IndexedDB' | 'localStorage';
}

export async function initializePosDb(): Promise<PosBootstrapData> {
  try {
    const existingSettings = await idbGet<{ key: string; value: StoreSettings }>(
      STORES.SETTINGS,
      'store_config'
    );
    let products = await idbGetAll<Product>(STORES.PRODUCTS);
    let customers = await idbGetAll<Customer>(STORES.CUSTOMERS);
    const sales = await idbGetAll<Sale>(STORES.SALES);
    const parkedCarts = await idbGetAll<ParkedCart>(STORES.PARKED_CARTS);

    const initializedFlag = localStorage.getItem('tamale_pos_seeded_v1');

    if (!existingSettings && !initializedFlag) {
      await idbPut(STORES.SETTINGS, { key: 'store_config', value: DEFAULT_STORE_SETTINGS });
      await idbPutMany(STORES.PRODUCTS, SEED_PRODUCTS, true);
      await idbPutMany(STORES.CUSTOMERS, SEED_CUSTOMERS, true);
      localStorage.setItem('tamale_pos_seeded_v1', '1');
      products = [...SEED_PRODUCTS];
      customers = [...SEED_CUSTOMERS];
    } else if (products.length === 0 && !initializedFlag) {
      await idbPutMany(STORES.PRODUCTS, SEED_PRODUCTS, false);
      products = [...SEED_PRODUCTS];
      localStorage.setItem('tamale_pos_seeded_v1', '1');
    }

    const settings = existingSettings?.value ?? { ...DEFAULT_STORE_SETTINGS };
    if (customers.length === 0) {
      await idbPutMany(STORES.CUSTOMERS, SEED_CUSTOMERS, false);
      customers = [...SEED_CUSTOMERS];
    }

    // Mirror to localStorage as safety backup
    writeFallback({
      products,
      sales,
      parkedCarts,
      customers,
      settings,
      initialized: true,
    });

    return {
      products: products.sort((a, b) => a.name.localeCompare(b.name)),
      sales: sales.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      parkedCarts: parkedCarts.sort((a, b) => b.parkedAt.localeCompare(a.parkedAt)),
      customers,
      settings,
      storageEngine: 'IndexedDB',
    };
  } catch {
    const fb = readFallback();
    return {
      products: fb.products.sort((a, b) => a.name.localeCompare(b.name)),
      sales: fb.sales.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      parkedCarts: fb.parkedCarts.sort((a, b) => b.parkedAt.localeCompare(a.parkedAt)),
      customers: fb.customers,
      settings: fb.settings,
      storageEngine: 'localStorage',
    };
  }
}

export async function saveProduct(product: Product): Promise<void> {
  try {
    await idbPut(STORES.PRODUCTS, product);
  } catch {
    // fallback handled below
  }
  const fb = readFallback();
  const idx = fb.products.findIndex((p) => p.id === product.id);
  if (idx >= 0) fb.products[idx] = product;
  else fb.products.push(product);
  writeFallback(fb);
}

export async function saveProductsBulk(products: Product[]): Promise<void> {
  try {
    await idbPutMany(STORES.PRODUCTS, products, false);
  } catch {
    // fallback handled below
  }
  const fb = readFallback();
  const map = new Map(fb.products.map((p) => [p.id, p]));
  for (const p of products) {
    map.set(p.id, p);
  }
  fb.products = Array.from(map.values());
  writeFallback(fb);
}

export async function deleteProductById(productId: string): Promise<void> {
  try {
    await idbDelete(STORES.PRODUCTS, productId);
  } catch {
    // fallback
  }
  const fb = readFallback();
  fb.products = fb.products.filter((p) => p.id !== productId);
  writeFallback(fb);
}

export async function saveSaleRecord(sale: Sale): Promise<void> {
  try {
    await idbPut(STORES.SALES, sale);
  } catch {
    // fallback
  }
  const fb = readFallback();
  const idx = fb.sales.findIndex((s) => s.id === sale.id);
  if (idx >= 0) fb.sales[idx] = sale;
  else fb.sales.unshift(sale);
  writeFallback(fb);
}

export async function saveParkedCart(cart: ParkedCart): Promise<void> {
  try {
    await idbPut(STORES.PARKED_CARTS, cart);
  } catch {
    // fallback
  }
  const fb = readFallback();
  const idx = fb.parkedCarts.findIndex((c) => c.id === cart.id);
  if (idx >= 0) fb.parkedCarts[idx] = cart;
  else fb.parkedCarts.unshift(cart);
  writeFallback(fb);
}

export async function deleteParkedCartById(cartId: string): Promise<void> {
  try {
    await idbDelete(STORES.PARKED_CARTS, cartId);
  } catch {
    // fallback
  }
  const fb = readFallback();
  fb.parkedCarts = fb.parkedCarts.filter((c) => c.id !== cartId);
  writeFallback(fb);
}

export async function saveStoreSettings(settings: StoreSettings): Promise<void> {
  try {
    await idbPut(STORES.SETTINGS, { key: 'store_config', value: settings });
  } catch {
    // fallback
  }
  const fb = readFallback();
  fb.settings = settings;
  writeFallback(fb);
}

export async function saveCustomer(customer: Customer): Promise<void> {
  try {
    await idbPut(STORES.CUSTOMERS, customer);
  } catch {
    // fallback
  }
  const fb = readFallback();
  const idx = fb.customers.findIndex((c) => c.id === customer.id);
  if (idx >= 0) fb.customers[idx] = customer;
  else fb.customers.push(customer);
  writeFallback(fb);
}

export async function resetAllToDemoData(): Promise<PosBootstrapData> {
  localStorage.setItem('tamale_pos_seeded_v1', '1');
  const freshSettings = { ...DEFAULT_STORE_SETTINGS };
  const freshProducts = SEED_PRODUCTS.map((p) => ({ ...p, updatedAt: new Date().toISOString() }));
  const freshCustomers = [...SEED_CUSTOMERS];
  try {
    await idbPut(STORES.SETTINGS, { key: 'store_config', value: freshSettings });
    await idbPutMany(STORES.PRODUCTS, freshProducts, true);
    await idbPutMany(STORES.CUSTOMERS, freshCustomers, true);
    await idbPutMany(STORES.SALES, [], true);
    await idbPutMany(STORES.PARKED_CARTS, [], true);
  } catch {
    // ignore
  }
  writeFallback({
    products: freshProducts,
    sales: [],
    parkedCarts: [],
    customers: freshCustomers,
    settings: freshSettings,
    initialized: true,
  });
  return {
    products: freshProducts.sort((a, b) => a.name.localeCompare(b.name)),
    sales: [],
    parkedCarts: [],
    customers: freshCustomers,
    settings: freshSettings,
    storageEngine: 'IndexedDB',
  };
}

export async function importBackupSnapshot(snapshot: {
  products: Product[];
  sales: Sale[];
  parkedCarts: ParkedCart[];
  customers: Customer[];
  settings: StoreSettings;
}): Promise<void> {
  try {
    await idbPut(STORES.SETTINGS, { key: 'store_config', value: snapshot.settings });
    await idbPutMany(STORES.PRODUCTS, snapshot.products, true);
    await idbPutMany(STORES.SALES, snapshot.sales, true);
    await idbPutMany(STORES.PARKED_CARTS, snapshot.parkedCarts || [], true);
    await idbPutMany(STORES.CUSTOMERS, snapshot.customers || SEED_CUSTOMERS, true);
  } catch {
    // ignore
  }
  writeFallback({
    products: snapshot.products,
    sales: snapshot.sales,
    parkedCarts: snapshot.parkedCarts || [],
    customers: snapshot.customers || SEED_CUSTOMERS,
    settings: snapshot.settings,
    initialized: true,
  });
}
