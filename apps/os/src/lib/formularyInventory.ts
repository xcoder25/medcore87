/** Pharmacy formulary + inventory (batch, expiry, stock) */
import { publishFacilityData } from './roleSyncBus';

export interface FormularyDrug {
  id: string;
  facilityId: string;
  name: string;
  genericName: string;
  strength: string;
  form: string;
  category: string;
  unitPriceNgn: number;
  reorderLevel: number;
  controlled: boolean;
}

export interface StockBatch {
  id: string;
  drugId: string;
  facilityId: string;
  batchNo: string;
  expiry: string;
  qty: number;
  supplier?: string;
}

const DRUG_KEY = 'medcore_os_formulary_v1';
const STOCK_KEY = 'medcore_os_drug_stock_v1';
const EVT = 'medcore-formulary';

function read<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}
function write(key: string, list: unknown[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(list.slice(0, 5000)));
  window.dispatchEvent(new CustomEvent(EVT));
  publishFacilityData('IGH-EKT', key, list);
}

export function listFormulary(facilityId: string): FormularyDrug[] {
  return read<FormularyDrug>(DRUG_KEY).filter((d) => d.facilityId === facilityId);
}

export function upsertDrug(d: FormularyDrug) {
  const all = read<FormularyDrug>(DRUG_KEY);
  const i = all.findIndex((x) => x.id === d.id);
  if (i >= 0) all[i] = d;
  else all.unshift(d);
  write(DRUG_KEY, all);
}

export function listBatches(facilityId: string, drugId?: string): StockBatch[] {
  let list = read<StockBatch>(STOCK_KEY).filter((b) => b.facilityId === facilityId);
  if (drugId) list = list.filter((b) => b.drugId === drugId);
  return list;
}

export function addBatch(b: Omit<StockBatch, 'id'>): StockBatch {
  const row: StockBatch = { ...b, id: `BAT-${Date.now().toString(36)}` };
  write(STOCK_KEY, [row, ...read(STOCK_KEY)]);
  return row;
}

export function stockQty(facilityId: string, drugId: string): number {
  return listBatches(facilityId, drugId).reduce((s, b) => s + b.qty, 0);
}

export function depleteStock(facilityId: string, drugName: string, qty = 1): boolean {
  const drugs = listFormulary(facilityId).filter((d) =>
    d.name.toLowerCase().includes(drugName.toLowerCase()) || drugName.toLowerCase().includes(d.name.toLowerCase())
  );
  if (!drugs[0]) return false;
  const batches = listBatches(facilityId, drugs[0].id)
    .filter((b) => b.qty > 0)
    .sort((a, b) => a.expiry.localeCompare(b.expiry));
  if (!batches[0]) return false;
  const all = read<StockBatch>(STOCK_KEY);
  const i = all.findIndex((x) => x.id === batches[0].id);
  if (i < 0) return false;
  all[i] = { ...all[i], qty: Math.max(0, all[i].qty - qty) };
  write(STOCK_KEY, all);
  return true;
}

export function seedDefaultFormulary(facilityId: string) {
  if (listFormulary(facilityId).length) return;
  const defaults = [
    ['Amoxicillin 500mg', 'Amoxicillin', '500mg', 'Capsule', 'Antibiotic', 350],
    ['Metformin 500mg', 'Metformin', '500mg', 'Tablet', 'Antidiabetic', 200],
    ['Paracetamol 500mg', 'Paracetamol', '500mg', 'Tablet', 'Analgesic', 50],
    ['Amlodipine 5mg', 'Amlodipine', '5mg', 'Tablet', 'Cardiovascular', 150],
    ['Artemether/Lumefantrine', 'AL', '20/120', 'Tablet', 'Antimalarial', 800],
  ];
  for (const [name, generic, strength, form, category, price] of defaults) {
    const id = `DRG-${generic.slice(0, 4).toUpperCase()}-${Date.now().toString(36)}`;
    upsertDrug({
      id,
      facilityId,
      name: name as string,
      genericName: generic as string,
      strength: strength as string,
      form: form as string,
      category: category as string,
      unitPriceNgn: price as number,
      reorderLevel: 50,
      controlled: false,
    });
    addBatch({
      drugId: id,
      facilityId,
      batchNo: `B${Math.floor(Math.random() * 9000 + 1000)}`,
      expiry: '2027-12-31',
      qty: 200,
      supplier: 'CMS Nigeria',
    });
  }
}

export function subscribeFormulary(cb: () => void) {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener(EVT, fn);
  return () => window.removeEventListener(EVT, fn);
}

export const FORMULARY_KEYS = [DRUG_KEY, STOCK_KEY];
