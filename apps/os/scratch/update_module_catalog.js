const fs = require('fs');
const path = 'c:\\Users\\Dell\\OneDrive\\Desktop\\medcore\\apps\\os\\src\\lib\\rolePermissionsStore.ts';
let c = fs.readFileSync(path, 'utf8');

const targetClinical = "  { key: 'workflow-intelligence', label: '7-Workflow intelligence suite', group: 'Clinical' },";

const extraClinical = `  { key: 'workflow-intelligence', label: '7-Workflow intelligence suite', group: 'Clinical' },
  { key: 'ophthalmology', label: 'Ophthalmology & Eye Clinic Exam Grid', group: 'Clinical' },
  { key: 'fluid-balance', label: 'Nursing Fluid Balance & 24hr I/O Flowsheet', group: 'Clinical' },
  { key: 'consent-legal', label: 'Digital Treatment & Surgical Consent Pad', group: 'Clinical' },
  { key: 'dialysis', label: 'Renal Dialysis & Hemodialysis Station', group: 'Clinical' },
  { key: 'physiotherapy', label: 'Physiotherapy & Physical Rehabilitation', group: 'Clinical' },
  { key: 'dental', label: 'Dental Clinic & Odontogram', group: 'Clinical' },
  { key: 'nutrition', label: 'Clinical Nutrition & Dietetics', group: 'Clinical' },`;

const targetPatient = "  { key: 'patient.full_chart', label: 'Full clinical chart (all patient data)', group: 'Patient data' },";

const extraPatient = `  { key: 'patient.full_chart', label: 'Full clinical chart (all patient data)', group: 'Patient data' },
  { key: 'patient.consents', label: 'Signed legal consents & NDPR releases', group: 'Patient data' },
  { key: 'patient.eye_records', label: 'Visual acuity & fundus recordings', group: 'Patient data' },
  { key: 'patient.fluid_charts', label: 'Hourly intake & output balances', group: 'Patient data' },`;

if (c.includes(targetClinical)) {
  c = c.replace(targetClinical, extraClinical);
  console.log('✅ Added extra clinical tools to MODULE_CATALOG');
} else {
  console.log('⚠️ Could not match targetClinical');
}

if (c.includes(targetPatient)) {
  c = c.replace(targetPatient, extraPatient);
  console.log('✅ Added extra patient scopes to MODULE_CATALOG');
} else {
  console.log('⚠️ Could not match targetPatient');
}

fs.writeFileSync(path, c, 'utf8');
console.log('✅ Done updating rolePermissionsStore.ts');

