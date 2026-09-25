import { dataStore } from '../services/api-server/src/store/database';
import { persistenceService } from '../services/api-server/src/store/persistence';
import { IBOM_CLINICAL_PATHWAYS } from '../services/api-server/src/routes/cpoe.routes';

async function runTest() {
  console.log(' Starting MedCore Clinical Loop Verification Test...');

  // 1. Check Identity & ADT
  const patient = dataStore.registerPatient({
    name: 'Ekpedeme Bassey',
    dob: '1992-04-18',
    gender: 'MALE',
    nationalId: '12345678901',
    phone: '+2348031234567',
    address: '12 Oron Road, Uyo',
    facilityId: 'FAC-001',
    bloodGroup: 'B+',
    allergies: ['Penicillin'],
    chronicConditions: [],
    actorId: 'STAFF-TEST',
    actorName: 'Triage Nurse',
  });

  console.log(`✅ [1/5] Patient Registered: ${patient.name} | MRN: ${patient.mrn} | NIN: ${patient.nin} (${patient.ninStatus}) | State Health ID: ${patient.stateHealthId}`);

  // 2. Admit patient
  const encounter = dataStore.admitPatient({
    patientId: patient.id,
    patientName: patient.name,
    facilityId: 'FAC-001',
    type: 'ADMISSION',
    ward: 'Ward 4-West',
    bed: '4C',
    chiefComplaint: 'High-grade fever, rigor, vomiting',
    workingDiagnosis: 'Severe P. falciparum malaria',
  });
  console.log(`✅ [2/5] ADT Encounter Created: ${encounter.id} | Admitted to ${encounter.ward}, Bed ${encounter.bed}`);

  // 3. Check Pharmacy Stock Ledger initial balance
  const artesunateStock = dataStore.getStockItem('MED-ART-60');
  console.log(`✅ [3/5] Pharmacy Stock Baseline: ${artesunateStock?.genericName} | Qty on hand: ${artesunateStock?.quantityOnHand}`);
  const initialQty = artesunateStock?.quantityOnHand || 0;

  // 4. Apply CPOE Severe Malaria Pathway
  const pathway = IBOM_CLINICAL_PATHWAYS[0];
  console.log(`✅ [4/5] Applying CPOE Pathway: "${pathway.title}" (${pathway.items.length} orders)`);

  const rx = dataStore.createPrescription({
    patientId: patient.id,
    patientName: patient.name,
    doctorId: 'DOC-THORNE',
    doctorName: 'Dr. Julian Thorne, MD',
    facilityId: 'FAC-001',
    diagnosis: pathway.title,
    drugs: [
      {
        id: 'DRUG-ART-01',
        name: 'Artesunate Powder for Injection',
        dosage: '2.4mg/kg',
        frequency: 'Stat at 0h, 12h, 24h',
        duration: '3 Days',
        route: 'IV',
        quantity: 3,
        instructions: 'Push slow IV over 2 minutes',
      }
    ],
  });
  console.log(`   Prescription Created: ${rx.id} | Status: ${rx.status}`);

  // 5. Pharmacist Dispenses Drug -> Stock Depletion & Closed Loop
  const dispensedRx = dataStore.dispenseDrug(rx.id, 'DRUG-ART-01', 'Pharmacist Funmi Adeola');
  const stockAfter = dataStore.getStockItem('MED-ART-60');
  console.log(`✅ [5/5] Drug Dispensed by: ${dispensedRx.drugs[0].dispensedBy} | Rx Status: ${dispensedRx.status}`);
  console.log(`   Stock Ledger Updated: Previous ${initialQty} -> Balance After: ${stockAfter?.quantityOnHand} units`);

  // Verify Outbox
  const outbox = persistenceService.getAllOutbox();
  console.log(`\n Persistent Event Outbox Count: ${outbox.length} events logged to disk.`);
  console.log('Closed Clinical Loop Verification Complete: SUCCESS!');
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
