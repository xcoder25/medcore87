/**
 * Payment receipt generation module — MedCore Hospital OS
 *
 * - Issues official receipt numbers
 * - Persists receipt records (reprint / audit)
 * - Prints branded HTML (MedCore + Arise)
 * - Used after Cash / HMO / Waiver and after Paystack-verified DIGITAL payments
 */
import { publishFacilityData } from './roleSyncBus';
import { getReceptionSettings } from './receptionSettingsStore';

export const PAYMENT_RECEIPTS_KEY = 'medcore_os_payment_receipts_v1';
export const PAYMENT_RECEIPTS_EVENT = 'medcore-payment-receipts';

export type ReceiptChannel =
  | 'cash'
  | 'card'
  | 'transfer'
  | 'hmo'
  | 'waiver'
  | 'pos'
  | 'paystack'
  | 'other';

export type PaymentReceiptRecord = {
  id: string;
  receiptNo: string;
  facilityId: string;
  facilityName: string;
  patientId?: string;
  patientName: string;
  hospitalNumber: string;
  amountNgn: number;
  currency: 'NGN';
  method: string;
  channel?: string;
  purpose: string;
  reference: string;
  paystackRef?: string;
  paymentId?: string;
  visitId?: string;
  cashier?: string;
  cashierBadge?: string;
  status: 'issued' | 'void';
  issuedAt: string;
  voidedAt?: string;
  voidReason?: string;
  /** DIGITAL vs HOSPITAL DESK */
  category: 'digital' | 'hospital_desk';
  header?: string;
  footer?: string;
  taxId?: string;
};

function readAll(): PaymentReceiptRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PAYMENT_RECEIPTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(list: PaymentReceiptRecord[]) {
  if (typeof window === 'undefined') return;
  const next = list.slice(0, 2000);
  localStorage.setItem(PAYMENT_RECEIPTS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(PAYMENT_RECEIPTS_EVENT, { detail: next }));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: PAYMENT_RECEIPTS_KEY } }));
  const fid = next[0]?.facilityId || 'IGH-EKT';
  try {
    publishFacilityData(fid, PAYMENT_RECEIPTS_KEY, next);
  } catch {
    /* offline */
  }
}

export function listPaymentReceipts(
  facilityId: string,
  opts?: { patientId?: string; hospitalNumber?: string; day?: string }
): PaymentReceiptRecord[] {
  let list = readAll().filter((r) => r.facilityId === facilityId && r.status !== 'void');
  if (opts?.patientId) list = list.filter((r) => r.patientId === opts.patientId);
  if (opts?.hospitalNumber) {
    list = list.filter((r) => r.hospitalNumber === opts.hospitalNumber);
  }
  if (opts?.day) {
    list = list.filter((r) => (r.issuedAt || '').slice(0, 10) === opts.day);
  }
  return list.sort((a, b) => (b.issuedAt || '').localeCompare(a.issuedAt || ''));
}

export function getPaymentReceipt(receiptNoOrId: string): PaymentReceiptRecord | undefined {
  const key = String(receiptNoOrId || '').toUpperCase();
  return readAll().find(
    (r) => r.id.toUpperCase() === key || r.receiptNo.toUpperCase() === key
  );
}

function nextReceiptNo(facilityId: string): string {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = (facilityId || 'MC').replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase() || 'MC';
  const todayCount = readAll().filter(
    (r) => r.facilityId === facilityId && (r.issuedAt || '').slice(0, 10) === new Date().toISOString().slice(0, 10)
  ).length;
  const seq = String(todayCount + 1).padStart(4, '0');
  return `RCP-${prefix}-${day}-${seq}`;
}

function inferCategory(method: string, channel?: string): 'digital' | 'hospital_desk' {
  const m = `${method} ${channel || ''}`.toLowerCase();
  if (m.includes('card') || m.includes('transfer') || m.includes('paystack') || m.includes('ussd') || m.includes('bank')) {
    return 'digital';
  }
  return 'hospital_desk';
}

export type IssueReceiptInput = {
  facilityId: string;
  facilityName: string;
  patientId?: string;
  patientName: string;
  hospitalNumber: string;
  amountNgn: number;
  method: string;
  channel?: string;
  purpose: string;
  reference: string;
  paystackRef?: string;
  paymentId?: string;
  visitId?: string;
  cashier?: string;
  cashierBadge?: string;
};

/** Create + persist receipt, then optionally print */
export function issuePaymentReceipt(
  input: IssueReceiptInput,
  opts?: { print?: boolean }
): PaymentReceiptRecord {
  const settings = (() => {
    try {
      return getReceptionSettings(input.facilityId);
    } catch {
      return null;
    }
  })();

  const receipt: PaymentReceiptRecord = {
    id: `RCPT-${Date.now().toString(36).toUpperCase()}`,
    receiptNo: nextReceiptNo(input.facilityId),
    facilityId: input.facilityId,
    facilityName: input.facilityName,
    patientId: input.patientId,
    patientName: input.patientName,
    hospitalNumber: input.hospitalNumber,
    amountNgn: Number(input.amountNgn) || 0,
    currency: 'NGN',
    method: input.method,
    channel: input.channel,
    purpose: input.purpose || 'Hospital payment',
    reference: input.reference,
    paystackRef: input.paystackRef,
    paymentId: input.paymentId,
    visitId: input.visitId,
    cashier: input.cashier,
    cashierBadge: input.cashierBadge,
    status: 'issued',
    issuedAt: new Date().toISOString(),
    category: inferCategory(input.method, input.channel),
    header: settings?.receiptHeader,
    footer: settings?.receiptFooter,
    taxId: settings?.receiptTaxId,
  };

  writeAll([receipt, ...readAll()]);
  if (opts?.print !== false) {
    printPaymentReceiptDocument(receipt);
  }
  return receipt;
}

export function voidPaymentReceipt(receiptNo: string, reason?: string): boolean {
  const list = readAll();
  const i = list.findIndex(
    (r) => r.receiptNo === receiptNo || r.id === receiptNo
  );
  if (i < 0) return false;
  list[i] = {
    ...list[i],
    status: 'void',
    voidedAt: new Date().toISOString(),
    voidReason: reason || 'Voided',
  };
  writeAll(list);
  return true;
}

export function reprintPaymentReceipt(receiptNoOrId: string): boolean {
  const r = getPaymentReceipt(receiptNoOrId);
  if (!r || r.status === 'void') return false;
  printPaymentReceiptDocument(r);
  return true;
}

function methodDisplay(r: PaymentReceiptRecord): string {
  const parts = [r.method, r.channel].filter(Boolean);
  return parts.join(' · ').toUpperCase();
}

function categoryLabel(r: PaymentReceiptRecord): string {
  return r.category === 'digital' ? 'DIGITAL (Paystack)' : 'HOSPITAL DESK';
}

/** Branded HTML receipt document */
export function buildReceiptHtml(r: PaymentReceiptRecord): string {
  const header = r.header || `${r.facilityName} — Official Receipt`;
  const footer = r.footer || 'Thank you. Keep this receipt for your records.';
  const issued = r.issuedAt ? new Date(r.issuedAt).toLocaleString() : '';
  return `
  <div style="text-align:center;margin-bottom:14px">
    <img src="/medcore-logo.png" alt="MedCore" style="height:40px;vertical-align:middle;margin-right:12px" onerror="this.style.display='none'" />
    <img src="/arise-logo.png" alt="Arise" style="height:36px;vertical-align:middle" onerror="this.style.display='none'" />
  </div>
  <h1 style="text-align:center;font-size:15px;margin:0 0 4px">${escapeHtml(header)}</h1>
  <div class="muted" style="text-align:center">${escapeHtml(r.facilityName)}</div>
  ${r.taxId ? `<div class="muted" style="text-align:center">Tax / TIN: ${escapeHtml(r.taxId)}</div>` : ''}
  <div class="box" style="margin-top:14px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">
      <div>
        <div class="muted">Receipt No.</div>
        <div style="font-weight:800;font-size:16px;letter-spacing:0.04em">${escapeHtml(r.receiptNo)}</div>
      </div>
      <div style="text-align:right">
        <div class="muted">${escapeHtml(categoryLabel(r))}</div>
        <div style="font-size:11px;font-weight:700;color:#059669">ISSUED</div>
      </div>
    </div>
    <table>
      <tr><td class="muted">Patient</td><td style="text-align:right;font-weight:700">${escapeHtml(r.patientName)}</td></tr>
      <tr><td class="muted">Hospital No.</td><td style="text-align:right">${escapeHtml(r.hospitalNumber)}</td></tr>
      <tr><td class="muted">Purpose</td><td style="text-align:right">${escapeHtml(r.purpose)}</td></tr>
      <tr><td class="muted">Method</td><td style="text-align:right">${escapeHtml(methodDisplay(r))}</td></tr>
      <tr><td class="muted">Reference</td><td style="text-align:right;font-family:ui-monospace,monospace;font-size:12px">${escapeHtml(r.reference)}</td></tr>
      ${r.paystackRef ? `<tr><td class="muted">Paystack</td><td style="text-align:right;font-family:ui-monospace,monospace;font-size:12px">${escapeHtml(r.paystackRef)}</td></tr>` : ''}
      <tr><td class="muted">Cashier</td><td style="text-align:right">${escapeHtml(r.cashier || '—')}</td></tr>
      <tr><td class="muted">Date</td><td style="text-align:right">${escapeHtml(issued)}</td></tr>
    </table>
    <div style="margin-top:14px;padding-top:12px;border-top:1px dashed #cbd5e1;text-align:center">
      <div class="muted">Amount paid</div>
      <div class="big">₦${Number(r.amountNgn || 0).toLocaleString()}</div>
    </div>
  </div>
  <p class="muted" style="margin-top:14px;text-align:center">${escapeHtml(footer)}</p>
  <p class="muted" style="text-align:center;font-size:10px">MedCore Hospital OS · Official payment receipt</p>
  `;
}

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function printPaymentReceiptDocument(r: PaymentReceiptRecord): void {
  if (typeof window === 'undefined') return;
  const w = window.open('', '_blank', 'width=440,height=720');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>${r.receiptNo}</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; color: #0f172a; max-width: 400px; margin: 0 auto; }
      h1 { font-size: 15px; margin: 0 0 4px; }
      .muted { color: #64748b; font-size: 12px; }
      .big { font-size: 28px; font-weight: 800; letter-spacing: 0.02em; margin-top: 4px; }
      .box { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin: 12px 0; background: #fafbfc; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      td { padding: 5px 0; vertical-align: top; }
      @media print {
        button { display: none !important; }
        body { padding: 0; }
      }
    </style></head><body>
    ${buildReceiptHtml(r)}
    <div style="margin-top:16px;text-align:center">
      <button onclick="window.print()" style="padding:10px 18px;border-radius:10px;border:none;background:#0052D4;color:#fff;font-weight:700;cursor:pointer">Print receipt</button>
    </div>
    </body></html>`);
  w.document.close();
  try {
    w.focus();
  } catch {
    /* ignore */
  }
}

export function subscribePaymentReceipts(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener(PAYMENT_RECEIPTS_EVENT, fn);
  window.addEventListener('storage', fn);
  return () => {
    window.removeEventListener(PAYMENT_RECEIPTS_EVENT, fn);
    window.removeEventListener('storage', fn);
  };
}
