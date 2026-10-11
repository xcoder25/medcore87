/** Pharmacy formulary + inventory (batch, expiry, stock) */
import { publishFacilityData } from './roleSyncBus';
import { emlAsSeedRows } from './aksEmlFormulary';

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
  try {
    const fid =
      (list[0] as { facilityId?: string } | undefined)?.facilityId ||
      (typeof window !== 'undefined' &&
        (window as unknown as { __medcoreFacilityId?: string }).__medcoreFacilityId) ||
      'IGH-EKT';
    publishFacilityData(String(fid), key, list);
  } catch {
    /* ignore */
  }
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

export interface DepleteResult {
  ok: boolean;
  drug?: FormularyDrug;
  depleted: { batchId: string; batchNo: string; expiry: string; qty: number }[];
  remaining: number;
  lowStock: boolean;
  controlled: boolean;
  reason?: string;
}

export interface PharmacyStockEvent {
  id: string;
  at: string;
  facilityId: string;
  type: 'receive' | 'dispense' | 'adjust' | 'alert';
  drugId: string;
  drugName: string;
  batchNo?: string;
  qty: number;
  actor: string;
  patientRef?: string;
  rxId?: string;
  controlled: boolean;
  detail?: string;
}

const LOG_KEY = 'medcore_os_pharmacy_stock_log_v1';

function readLog(): PharmacyStockEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  } catch {
    return [];
  }
}
function writeLog(list: PharmacyStockEvent[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOG_KEY, JSON.stringify(list.slice(0, 3000)));
  window.dispatchEvent(new CustomEvent(EVT));
  window.dispatchEvent(new CustomEvent('medcore-pharmacy-log', { detail: list }));
  try {
    const fid = list[0]?.facilityId || 'IGH-EKT';
    publishFacilityData(String(fid), LOG_KEY, list);
  } catch {
    /* ignore */
  }
}

export function appendPharmacyLog(
  input: Omit<PharmacyStockEvent, 'id' | 'at'>
): PharmacyStockEvent {
  const row: PharmacyStockEvent = {
    ...input,
    id: `PHL-${Date.now().toString(36).toUpperCase()}`,
    at: new Date().toISOString(),
  };
  writeLog([row, ...readLog()]);
  return row;
}

export function listPharmacyLog(facilityId: string, opts?: { controlledOnly?: boolean; limit?: number }) {
  let rows = readLog().filter((r) => r.facilityId === facilityId);
  if (opts?.controlledOnly) rows = rows.filter((r) => r.controlled);
  return rows.slice(0, opts?.limit ?? 100);
}

export function listControlledDispenses(facilityId: string, limit = 50) {
  return listPharmacyLog(facilityId, { controlledOnly: true, limit }).filter((r) => r.type === 'dispense');
}

/** FEFO deplete across batches; logs dispense; flags low stock */
export function depleteStockDetailed(
  facilityId: string,
  drugName: string,
  qty = 1,
  meta?: { actor?: string; patientRef?: string; rxId?: string }
): DepleteResult {
  const need = Math.max(1, Math.floor(qty));
  const drugs = listFormulary(facilityId).filter(
    (d) =>
      d.name.toLowerCase().includes(drugName.toLowerCase()) ||
      drugName.toLowerCase().includes(d.name.toLowerCase()) ||
      d.genericName.toLowerCase().includes(drugName.toLowerCase())
  );
  if (!drugs[0]) return { ok: false, depleted: [], remaining: 0, lowStock: false, controlled: false, reason: 'Drug not on formulary' };

  const drug = drugs[0];
  const ordered = listBatches(facilityId, drug.id)
    .filter((b) => b.qty > 0)
    .sort((a, b) => a.expiry.localeCompare(b.expiry)); // FEFO

  const available = ordered.reduce((s, b) => s + b.qty, 0);
  if (available < need) {
    return {
      ok: false,
      drug,
      depleted: [],
      remaining: available,
      lowStock: available <= drug.reorderLevel,
      controlled: drug.controlled,
      reason: `Insufficient stock (need ${need}, have ${available})`,
    };
  }

  let left = need;
  const depleted: DepleteResult['depleted'] = [];
  const all = read<StockBatch>(STOCK_KEY);
  for (const bat of ordered) {
    if (left <= 0) break;
    const idx = all.findIndex((x) => x.id === bat.id);
    if (idx < 0) continue;
    const take = Math.min(all[idx].qty, left);
    all[idx] = { ...all[idx], qty: all[idx].qty - take };
    depleted.push({ batchId: bat.id, batchNo: bat.batchNo, expiry: bat.expiry, qty: take });
    left -= take;
  }
  write(STOCK_KEY, all);

  const remaining = stockQty(facilityId, drug.id);
  const lowStock = remaining <= drug.reorderLevel;
  const actor = meta?.actor || 'Pharmacist';

  appendPharmacyLog({
    facilityId,
    type: 'dispense',
    drugId: drug.id,
    drugName: drug.name,
    batchNo: depleted.map((d) => d.batchNo).join('+'),
    qty: need,
    actor,
    patientRef: meta?.patientRef,
    rxId: meta?.rxId,
    controlled: drug.controlled,
    detail: `FEFO ${depleted.map((d) => `${d.batchNo}×${d.qty} exp ${d.expiry}`).join('; ')}${lowStock ? ' · LOW STOCK' : ''}`,
  });

  if (lowStock) {
    appendPharmacyLog({
      facilityId,
      type: 'alert',
      drugId: drug.id,
      drugName: drug.name,
      qty: remaining,
      actor: 'system',
      controlled: drug.controlled,
      detail: `Reorder alert: on-hand ${remaining} ≤ reorder level ${drug.reorderLevel}`,
    });
  }

  return { ok: true, drug, depleted, remaining, lowStock, controlled: drug.controlled };
}

export function depleteStock(facilityId: string, drugName: string, qty = 1): boolean {
  return depleteStockDetailed(facilityId, drugName, qty).ok;
}

export function seedDefaultFormulary(facilityId: string) {
  if (listFormulary(facilityId).length) return;
  seedFromAksEml(facilityId, 'adult');
}

/** Load official AKS EML into facility formulary + starter batches (CMS) */
export function seedFromAksEml(facilityId: string, audience: 'adult' | 'children' = 'adult') {
  const rows = emlAsSeedRows(audience);
  const stamp = Date.now().toString(36);
  rows.forEach((row, i) => {
    const id = `DRG-AKS-${audience === 'adult' ? 'A' : 'C'}-${i.toString(36).toUpperCase()}-${stamp}`;
    upsertDrug({
      id,
      facilityId,
      name: row.name,
      genericName: row.genericName,
      strength: row.strength,
      form: row.form,
      category: row.category,
      unitPriceNgn: row.unitPriceNgn,
      reorderLevel: row.reorderLevel,
      controlled: row.controlled,
    });
    addBatch({
      drugId: id,
      facilityId,
      batchNo: `CMS-${1000 + (i % 9000)}`,
      expiry: '2027-12-31',
      qty: row.controlled ? 40 : 120,
      supplier: 'CMS Nigeria / AKS EML',
    });
  });
}

/** Force re-seed from EML (admin action) — replaces facility formulary */
export function resealFormularyFromAksEml(facilityId: string) {
  const all = read<FormularyDrug>(DRUG_KEY).filter((d) => d.facilityId !== facilityId);
  write(DRUG_KEY, all);
  const stocks = read<StockBatch>(STOCK_KEY).filter((b) => b.facilityId !== facilityId);
  write(STOCK_KEY, stocks);
  seedFromAksEml(facilityId, 'adult');
}

export function deleteDrug(drugId: string) {
  write(
    DRUG_KEY,
    read<FormularyDrug>(DRUG_KEY).filter((d) => d.id !== drugId)
  );
  write(
    STOCK_KEY,
    read<StockBatch>(STOCK_KEY).filter((b) => b.drugId !== drugId)
  );
}

export function receiveStock(input: {
  facilityId: string;
  drugId: string;
  batchNo: string;
  expiry: string;
  qty: number;
  supplier?: string;
  actor?: string;
}): StockBatch {
  const row = addBatch({
    drugId: input.drugId,
    facilityId: input.facilityId,
    batchNo: input.batchNo,
    expiry: input.expiry,
    qty: Math.max(0, input.qty),
    supplier: input.supplier,
  });
  const drug = listFormulary(input.facilityId).find((d) => d.id === input.drugId);
  appendPharmacyLog({
    facilityId: input.facilityId,
    type: 'receive',
    drugId: input.drugId,
    drugName: drug?.name || input.drugId,
    batchNo: input.batchNo,
    qty: Math.max(0, input.qty),
    actor: input.actor || 'Pharmacy',
    controlled: !!drug?.controlled,
    detail: `Received batch ${input.batchNo} exp ${input.expiry}${input.supplier ? ` · ${input.supplier}` : ''}`,
  });
  return row;
}

export function formularyStats(facilityId: string) {
  const drugs = listFormulary(facilityId);
  let low = 0;
  let expiring = 0;
  let controlled = 0;
  let totalUnits = 0;
  const soon = Date.now() + 90 * 864e5;
  for (const d of drugs) {
    const q = stockQty(facilityId, d.id);
    totalUnits += q;
    if (q <= d.reorderLevel) low += 1;
    if (d.controlled) controlled += 1;
    for (const b of listBatches(facilityId, d.id)) {
      if (b.qty > 0 && new Date(b.expiry).getTime() < soon) expiring += 1;
    }
  }
  return {
    items: drugs.length,
    lowStock: low,
    expiringBatches: expiring,
    controlled,
    totalUnits,
  };
}

export function subscribeFormulary(cb: () => void) {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener(EVT, fn);
  window.addEventListener('medcore-admin-sync', fn);
  return () => {
    window.removeEventListener(EVT, fn);
    window.removeEventListener('medcore-admin-sync', fn);
  };
}

export const FORMULARY_KEYS = [DRUG_KEY, STOCK_KEY, LOG_KEY];
