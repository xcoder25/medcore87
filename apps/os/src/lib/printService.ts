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

export function printAppointmentSlip(input: {
  patientName: string;
  hospitalNumber: string;
  department: string;
  doctor?: string;
  scheduledAt: string;
  status: string;
  reason?: string;
  facilityName: string;
}) {
  const dt = new Date(input.scheduledAt);
  const formatted = Number.isNaN(dt.getTime())
    ? input.scheduledAt
    : `${dt.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })} at ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  printHtml(
    `Appointment Slip — ${input.hospitalNumber}`,
    `
    <div style="border:1px solid #cbd5e1;border-radius:12px;padding:18px">
      <h2 style="margin:0">${input.facilityName}</h2>
      <p style="margin:4px 0 12px;color:#64748b">OFFICIAL OUTPATIENT APPOINTMENT SLIP</p>
      <hr/>
      <p><b>Patient:</b> ${input.patientName}</p>
      <p><b>Patient ID / MRN:</b> ${input.hospitalNumber}</p>
      <p><b>Clinic / Department:</b> ${input.department}</p>
      <p><b>Assigned Doctor:</b> ${input.doctor || 'Clinic Consultant'}</p>
      <p><b>Scheduled Date &amp; Time:</b> ${formatted}</p>
      <p><b>Status:</b> ${input.status.toUpperCase()}</p>
      ${input.reason ? `<p><b>Clinical Note / Reason:</b> ${input.reason}</p>` : ''}
      <hr/>
      <p style="font-size:11px;color:#64748b">Please arrive 15 minutes before your scheduled time with this slip. Printed ${new Date().toLocaleString()}</p>
    </div>
    `
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
  skipAkwaRemitSync?: boolean;
  akwaRemitRrr?: string;
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
      skipAkwaRemitSync: input.skipAkwaRemitSync,
      akwaRemitRrr: input.akwaRemitRrr,
    },
    { print: input.print !== false }
  );
}

