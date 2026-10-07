import { issuePaymentReceipt } from './paymentReceiptModule';
/** Simple browser print helpers — queue ticket, receipt, staff note */

export function printHtml(title: string, bodyHtml: string) {
  const w = window.open('', '_blank', 'width=420,height=640');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 16px; color: #0f172a; }
      h1 { font-size: 16px; margin: 0 0 8px; }
      .muted { color: #64748b; font-size: 12px; }
      .big { font-size: 28px; font-weight: 800; letter-spacing: 0.05em; }
      .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin: 12px 0; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      td { padding: 4px 0; }
      @media print { button { display: none; } }
    </style></head><body>
    ${bodyHtml}
    <p class="muted">MedCore Hospital OS · ${new Date().toLocaleString()}</p>
    <button onclick="window.print()">Print</button>
    </body></html>`);
  w.document.close();
}

export function printQueueTicket(input: {
  queueNumber: string;
  patientName: string;
  hospitalNumber: string;
  department: string;
  facilityName: string;
}) {
  printHtml(
    `Queue ${input.queueNumber}`,
    `<h1>${input.facilityName}</h1>
     <div class="box">
       <div class="muted">Queue number</div>
       <div class="big">${input.queueNumber}</div>
       <div style="margin-top:12px"><strong>${input.patientName}</strong></div>
       <div class="muted">${input.hospitalNumber}</div>
       <div style="margin-top:8px">${input.department}</div>
     </div>
     <p class="muted">Please wait to be called. Keep this ticket.</p>`
  );
}

export function printPaymentReceipt(input: {
  reference: string;
  patientName: string;
  hospitalNumber: string;
  amount: number;
  method: string;
  purpose: string;
  facilityName: string;
  facilityId?: string;
  patientId?: string;
  cashier?: string;
  cashierBadge?: string;
  paystackRef?: string;
  channel?: string;
  paymentId?: string;
  visitId?: string;
  print?: boolean;
}) {
  return issuePaymentReceipt(
    {
      facilityId: input.facilityId || 'IGH-EKT',
      facilityName: input.facilityName,
      patientId: input.patientId,
      patientName: input.patientName,
      hospitalNumber: input.hospitalNumber,
      amountNgn: input.amount,
      method: input.method,
      channel: input.channel,
      purpose: input.purpose,
      reference: input.reference,
      paystackRef: input.paystackRef,
      paymentId: input.paymentId,
      visitId: input.visitId,
      cashier: input.cashier,
      cashierBadge: input.cashierBadge,
    },
    { print: input.print !== false }
  );
}

