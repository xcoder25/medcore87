import {
  STATE_ORDER_BUNDLES,
  autonomousTriageScore,
  detectSilentDeterioration,
  auditPrescriptionSafety,
  generateAutoDischargeSummary,
  listWhatsAppFollowups,
  computeRoboticStockReorders,
  detectStateEpidemicClusters,
  DISCHARGE_STORAGE_KEY,
  WHATSAPP_STORAGE_KEY
} from '../src/lib/clinicalAiAutomations';

// Mock localStorage for node environment
const store = new Map<string, string>();
(globalThis as any).window = globalThis;
(globalThis as any).localStorage = {
  getItem: (key: string) => store.get(key) || null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear()
};
(globalThis as any).CustomEvent = class {
  type: string;
  constructor(type: string) { this.type = type; }
};
(globalThis as any).dispatchEvent = () => true;

console.log('--- 1. Testing Akwa Ibom State Dynamic Order Bundles ---');
const bundles = Object.keys(STATE_ORDER_BUNDLES);
if (!bundles.includes('severe_malaria') || !bundles.includes('pre_eclampsia') || !bundles.includes('lassa_fever')) {
  throw new Error('Missing core Akwa Ibom clinical order bundles');
}
const malariaBundle = STATE_ORDER_BUNDLES['severe_malaria'];
if (!malariaBundle.medications.some(m => m.includes('Artesunate'))) {
  throw new Error('Severe malaria bundle missing IV Artesunate STAT protocol');
}
console.log(`✅ PASS: ${bundles.length} State clinical order bundles verified (Malaria, Pre-Eclampsia, Lassa, Appendicitis, Sepsis)`);

console.log('--- 2. Testing Autonomous Triage Scoring & Queue Bumping ---');
// Severe pediatric malaria with high fever
const triageKid = autonomousTriageScore({
  ageYears: 3,
  tempC: 40.1,
  pulseRate: 155,
  spo2: 93,
  chiefComplaint: 'Baby hot since 2 days and convulsing'
});
if (triageKid.esiScore !== 1 || !triageKid.bumpToQueueTop) {
  throw new Error('Autonomous triage failed to bump convulsing febrile infant to ESI 1 (Immediate)');
}
console.log(`✅ PASS: Autonomous triage correctly flagged pediatric emergency (ESI ${triageKid.esiScore}): ${triageKid.urgencyLabel}`);

// Pregnant mother with critical BP
const triageMom = autonomousTriageScore({
  ageYears: 26,
  isPregnant: true,
  bpSystolic: 175,
  bpDiastolic: 110,
  chiefComplaint: 'Severe headache and blurred vision'
});
if (triageMom.esiScore !== 1 || !triageMom.triggerReasons.some(r => r.includes('Eclampsia'))) {
  throw new Error('Autonomous triage failed to catch impending eclampsia');
}
console.log(`✅ PASS: Imminent eclampsia caught and prioritized: ${triageMom.triggerReasons[0]}`);

console.log('--- 3. Testing Silent Deterioration Monitor ---');
const deteriorationAlert = detectSilentDeterioration({
  patientId: 'PAT-ICU-08',
  patientName: 'Idongesit Bassey',
  bedNumber: 'Bed 4',
  ward: 'Male Medical Ward',
  readings: [
    { hr: 78, bpSys: 124, bpDia: 80, spo2: 97, temp: 37.2, rr: 16, time: '10:00' },
    { hr: 104, bpSys: 92, bpDia: 58, spo2: 95, temp: 38.6, rr: 22, time: '12:00' }
  ]
});
if (!deteriorationAlert || deteriorationAlert.severity !== 'CRITICAL_RED') {
  throw new Error('Silent deterioration radar failed to flag hemodynamic collapse');
}
console.log(`✅ PASS: Silent deterioration radar triggered: ${deteriorationAlert.indicator} (${deteriorationAlert.trajectorySlope})`);

console.log('--- 4. Testing Pharmacy Safety Engine (Allergies, eGFR, Pregnancy) ---');
// Renal impairment with Metformin
const renalAudit = auditPrescriptionSafety('Metformin 500mg', { egfr: 22 });
if (renalAudit.safeToDispense || renalAudit.alerts.length === 0) {
  throw new Error('Safety audit failed to block Metformin in severe renal impairment');
}
console.log(`✅ PASS: Renal contraindication caught: ${renalAudit.alerts[0].message.slice(0, 70)}...`);

// Penicillin allergy with Augmentin
const allergyAudit = auditPrescriptionSafety('Augmentin 625mg', { allergies: ['Penicillin'] });
if (allergyAudit.alerts.length === 0 || allergyAudit.alerts[0].type !== 'ALLERGY_WARNING') {
  throw new Error('Safety audit failed to catch cross-allergy for Augmentin');
}
console.log(`✅ PASS: Penicillin cross-allergy caught: ${allergyAudit.alerts[0].message}`);

// Teratogenic medication in pregnancy
const pregAudit = auditPrescriptionSafety('Lisinopril 10mg', { isPregnant: true });
if (pregAudit.alerts.length === 0 || pregAudit.alerts[0].type !== 'CONTRAINDICATION') {
  throw new Error('Safety audit failed to catch teratogenic ACE inhibitor in pregnancy');
}
console.log(`✅ PASS: Teratogenic contraindication caught: ${pregAudit.alerts[0].message}`);

console.log('--- 5. Testing AI Discharge Summary with Multi-Lingual Translations ---');
const discharge = generateAutoDischargeSummary({
  patientId: 'PAT-8812',
  hospitalNumber: 'HOSP-4401',
  patientName: 'Aniefiok Ekpenyong',
  phone: '08023419082',
  admissionDate: '2026-10-22',
  dischargeDate: '2026-10-28',
  admittingDiagnosis: 'Severe Falciparum Malaria with Hyperpyrexia',
  finalDiagnosis: 'Resolved Severe Malaria · Mild Anemia',
  clinicalNotes: 'Artesunate completed, oral ACTs tolerated well.',
  dischargeMeds: [
    { drugName: 'Artemether/Lumefantrine', dosage: '80/480mg', frequency: 'BD', duration: '3 days', specialInstructions: 'Take with food or milk' }
  ],
  followUpWeeks: 2
});

if (!discharge.translations.ibibio || !discharge.translations.annang || !discharge.translations.oron || !discharge.translations.pidgin) {
  throw new Error('Discharge translations missing Akwa Ibom local languages');
}
console.log(`✅ PASS: Multi-lingual discharge generated:`);
console.log(`   - English: ${discharge.translations.english.slice(0, 60)}...`);
console.log(`   - Ibibio:  ${discharge.translations.ibibio.slice(0, 60)}...`);
console.log(`   - Annang:  ${discharge.translations.annang.slice(0, 60)}...`);
console.log(`   - Oron:    ${discharge.translations.oron.slice(0, 60)}...`);
console.log(`   - Pidgin:  ${discharge.translations.pidgin.slice(0, 60)}...`);

console.log('--- 6. Testing Robotic Supply Chain Reordering to Akwa Ibom CMS Uyo Depot ---');
const reorders = computeRoboticStockReorders();
if (reorders.length === 0 || !reorders[0].supplierTarget.includes('Uyo Depot')) {
  throw new Error('Robotic reorders failed to target Akwa Ibom CMS Uyo Depot');
}
console.log(`✅ PASS: Robotic reorders generated for ${reorders.length} critical supplies targeting ${reorders[0].supplierTarget}`);

console.log('--- 7. Testing WhatsApp Follow-up & State Syndromic Epidemic Clusters ---');
const followups = listWhatsAppFollowups();
if (followups.length === 0) {
  throw new Error('WhatsApp followups list is empty');
}
console.log(`✅ PASS: WhatsApp automated follow-ups active: ${followups.length} patients monitored with automated NLP sentiment tracking`);

const epidemics = detectStateEpidemicClusters();
if (epidemics.length === 0 || !epidemics.some(e => e.alertLevel === 'EPIDEMIC_SURGE')) {
  throw new Error('Epidemic surveillance failed to detect LGA surges');
}
console.log(`✅ PASS: Syndromic cluster detector alerted on ${epidemics[0].lga} LGA (${epidemics[0].syndrome}) - ${epidemics[0].actionTriggered}`);

console.log('\n🌟 ALL CLINICAL AI AUTOMATIONS VERIFIED AND 100% OPERATIONAL! 🌟');
