/**
 * Nigerian public / secondary hospital OPD pathway — canonical MedCore model.
 * Pay-before-service checkpoints + auto-routing (no paper folder carrying).
 *
 * Stages (live visit status maps to these labels on the queue board):
 *   arrival → folder_payment → triage_vitals → waiting → called → with_provider
 *   → orders_pending_pay → lab_rx_released → pharmacy → disposition
 */
export const NIGERIAN_OPD_STAGES = [
  {
    id: 'arrival_registration',
    label: 'Arrival & registration',
    desk: 'Front Desk / Records',
    manual:
      'Patient arrives; receptionist guides registration. New folder or retrieve card number. NHIA/HMO ID shown if insured.',
    emr:
      'Search by name, phone, hospital number, or NIN. Prevent double registration. Optional QR/biometric check-in. Insurance verify when API available. Active visit stamped.',
    autoRouteTo: 'folder_payment',
  },
  {
    id: 'folder_payment',
    label: 'Card / folder fee (Accounts)',
    desk: 'Accounts / Cashier',
    manual:
      'Pay hospital card/folder at cash point; MRO opens file after receipt stamp.',
    emr:
      'Front Desk sends folder fee invoice to Accounts. Status awaiting_payment until PAID. Visit paymentStatus flips paid; check-in/queue may continue per facility policy.',
    autoRouteTo: 'triage_vitals',
  },
  {
    id: 'triage_vitals',
    label: 'Triage & vitals (where available)',
    desk: 'Nursing station',
    manual:
      'Nurse checks BP, pulse, temp, weight. Many public facilities are first-come-first-served; tertiary may use ESI triage.',
    emr:
      'Nurse queue dashboard. Vitals form; critical flags (e.g. BP > 180/120) escalate to Urgent and top of doctor list. Saving vitals routes to doctor consultation queue.',
    autoRouteTo: 'waiting',
  },
  {
    id: 'waiting',
    label: 'Nursing / OPD waiting queue',
    desk: 'Waiting area',
    manual: 'Patient waits; high volume, limited physicians common in public hospitals.',
    emr: 'Live queue board by department. Desk Call next when room free.',
    autoRouteTo: 'called',
  },
  {
    id: 'called',
    label: 'Called to consult',
    desk: 'Front Desk / Nurse',
    manual: 'Name called into consulting room.',
    emr: 'Desk presses Call next. Status called until doctor opens chart.',
    autoRouteTo: 'with_provider',
  },
  {
    id: 'with_provider',
    label: 'Medical consultation',
    desk: 'Doctor',
    manual: 'History, exam, diagnosis; paper Rx and lab forms given to patient to carry.',
    emr:
      'Doctor opens file → with_provider auto. Timeline, vitals, allergies. CPOE for lab/imaging/Rx with interaction checks. Submit orders → bills to Accounts + orders pending payment.',
    autoRouteTo: 'orders_billing',
  },
  {
    id: 'orders_billing',
    label: 'Billing clearance (Nigerian core checkpoint)',
    desk: 'Accounts / Cashier',
    manual:
      'Pay-before-service: patient walks to cash point; stamped PAID on request forms.',
    emr:
      'Itemized invoice from orders. Cash / POS / transfer / HMO. On PAID, orders release to Lab, Radiology, Pharmacy worklists.',
    autoRouteTo: 'diagnostics_pharmacy',
  },
  {
    id: 'diagnostics_pharmacy',
    label: 'Lab / Radiology / Pharmacy',
    desk: 'Ancillary + Pharmacy',
    manual:
      'Samples, results return to doctor; pharmacy dispenses after payment; stock-outs → external Rx.',
    emr:
      'Paid orders on department worklists. Results post to clinical bus + doctor alert. Pharmacy dispense decrements stock and closes Rx loop.',
    autoRouteTo: 'disposition',
  },
  {
    id: 'disposition',
    label: 'Disposition / exit / admission',
    desk: 'Doctor / Ward',
    manual: 'Home with advice, specialist referral, or ward admission.',
    emr:
      'Discharge or Admit. Admit shows live bed board. Visit status completed when consult path finishes (orders placed or explicit discharge).',
    autoRouteTo: null,
  },
] as const;

/** Short text for Celestia / staff training */
export const NIGERIAN_OPD_SUMMARY = `
Nigerian OPD (MedCore model) — pay-before-service, multi-desk, auto-routing:

1. Arrival & registration (Front Desk) — search-before-create; hospital number; NHIA/HMO if any.
2. Folder/card fee (Accounts) — invoice from Front Desk; PAID unlocks care path.
3. Triage & vitals (Nursing, where available) — critical vitals escalate queue priority.
4. Waiting → Call next (desk) → With doctor (auto when doctor opens consult).
5. Orders (CPOE) → bills to Accounts; lab/Rx/imaging stay pending until PAID.
6. Lab / Radiology / Pharmacy execute only after payment release.
7. Disposition — discharge, referral, or admit (bed board).

Queue board: desk only CALLS the next patient. In-room and complete are driven by doctor activity and orders — not manual Done/Pay on the clinical row.
`.trim();

export function opdStageHint(visitStatus: string, paymentStatus: string): string {
  if (paymentStatus === 'pending') {
    return 'Awaiting Accounts (folder or order fees) — pay-before-service.';
  }
  switch (visitStatus) {
    case 'waiting':
      return 'In OPD wait — Call next when a consult room is free.';
    case 'called':
      return 'Called — becomes With doctor when the clinician opens the chart.';
    case 'with_provider':
      return 'With doctor — completes when Rx/lab/imaging orders are submitted.';
    case 'completed':
      return 'Consult path complete — pharmacy/lab may still run if orders were paid.';
    default:
      return 'Follow Nigerian OPD auto-route stages.';
  }
}
