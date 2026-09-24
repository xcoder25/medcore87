import { Router, Request, Response } from 'express';
import { dataStore } from '../store/database';
import { auditLedger } from '../security/auditLedger';
import { IbomClinicalPathway } from '@medcore/types';

const router = Router();

export const IBOM_CLINICAL_PATHWAYS: IbomClinicalPathway[] = [
  {
    id: 'SEVERE_MALARIA_PROTOCOL',
    title: 'Severe Malaria Clinical Protocol (WHO / AKS-MoH)',
    description: 'Stat intervention bundle for severe P. falciparum malaria with danger signs (impaired consciousness, acidotic breathing, severe anaemia).',
    targetCohort: 'Pediatric & Adult Patients with Severe Malaria',
    clinicalRationale: 'Reduces mortality from 20% to <5% via rapid IV Artesunate parasite clearance and aggressive supportive monitoring.',
    items: [
      {
        category: 'LABORATORY',
        name: 'Rapid Malaria Diagnostic Test (RDT) + Giemsa Thick/Thin Film',
        urgency: 'STAT',
        instructions: 'Determine baseline parasite density prior to initiation of antimalarial therapy. Repeat at 24h.',
      },
      {
        category: 'LABORATORY',
        name: 'Full Blood Count (FBC) + Haemoglobin STAT',
        urgency: 'STAT',
        instructions: 'Screen for severe malarial anaemia (Hb < 5g/dL). Crossmatch 2 units if Hb < 7g/dL with respiratory distress.',
      },
      {
        category: 'LABORATORY',
        name: 'Random Blood Glucose (RBG) STAT',
        urgency: 'STAT',
        instructions: 'Rule out severe hypoglycemia (common with severe malaria & artesunate).',
      },
      {
        category: 'MEDICATION',
        name: 'IV Artesunate Injection 2.4mg/kg',
        dosage: '2.4mg/kg',
        route: 'IV',
        frequency: 'Stat at 0h, 12h, and 24h, then once daily',
        urgency: 'STAT',
        instructions: 'Dissolve in 5% sodium bicarbonate then dilute in 5mL 0.9% Normal Saline. Push over 2 mins.',
      },
      {
        category: 'MEDICATION',
        name: 'IV Paracetamol Infusion',
        dosage: '15mg/kg (Max 1g)',
        route: 'IV',
        frequency: 'Q6H PRN for temperature >= 38.5C',
        urgency: 'ROUTINE',
        instructions: 'Infuse over 15 mins. Avoid NSAIDs due to renal/bleeding risks.',
      },
      {
        category: 'NURSING',
        name: 'Neurological Observation & Coma Scale (Blantyre/GCS) Q2H',
        urgency: 'URGENT',
        instructions: 'Check pupil response, posture, and seizure activity. Strict fluid balance chart (avoid fluid overload/pulmonary oedema).',
      },
    ],
  },
  {
    id: 'PRE_ECLAMPSIA_ECLAMPSIA_PROTOCOL',
    title: 'Severe Pre-Eclampsia & Eclampsia Emergency Protocol',
    description: 'Emergency stabilization bundle for pregnant women >= 20 weeks with severe hypertension (>= 160/110 mmHg) and end-organ symptoms.',
    targetCohort: 'Obstetric patients with impending eclampsia or active eclamptic seizures',
    clinicalRationale: 'Pritchard / Zuspan Magnesium Sulfate regimen for seizure prophylaxis + acute BP reduction prevents maternal stroke and mortality.',
    items: [
      {
        category: 'MEDICATION',
        name: 'Magnesium Sulfate 50% Injection (Zuspan Loading Dose)',
        dosage: '4g IV over 15 min + 10g IM (5g each buttock deep IM with 1mL 2% lignocaine)',
        route: 'IV + IM',
        frequency: 'STAT Loading Dose',
        urgency: 'STAT',
        instructions: 'Maintain with 5g IM Q4H. Verify deep tendon reflexes, resp rate > 16/min, urine output > 30mL/hr before each dose.',
      },
      {
        category: 'MEDICATION',
        name: 'Hydralazine Injection 20mg/mL',
        dosage: '5mg slow IV over 5 mins',
        route: 'IV',
        frequency: 'Repeat 5-10mg every 20-30 mins if DBP >= 110 mmHg (Max 20mg)',
        urgency: 'STAT',
        instructions: 'Target BP 140/90 to 150/100 mmHg. Avoid sudden hypotensive drop compromising uteroplacental perfusion.',
      },
      {
        category: 'LABORATORY',
        name: 'Pre-Eclampsia Lab Panel (Urine Protein Dipstick, Serum Creatinine, Uric Acid, LFTs, Platelets)',
        urgency: 'STAT',
        instructions: 'Screen for HELLP Syndrome (Hemolysis, Elevated Liver enzymes, Low Platelets).',
      },
      {
        category: 'NURSING',
        name: 'Foley Catheter with Urometer Bag (Strict Hourly Output)',
        urgency: 'STAT',
        instructions: 'Urinary output must exceed 30mL/hr. Stop MgSO4 and administer IV Calcium Gluconate 10% if signs of toxicity appear.',
      },
      {
        category: 'NURSING',
        name: 'Continuous Cardiotocography (CTG) Fetal Monitoring',
        urgency: 'URGENT',
        instructions: 'Continuous fetal heart rate tracing. Alert Consultant Obstetrician for expedited delivery decision.',
      },
    ],
  },
  {
    id: 'SICKLE_CELL_VOC_PROTOCOL',
    title: 'Sickle Cell Vaso-Occlusive Pain Crisis (VOC) Pathway',
    description: 'Rapid pain management and rehydration bundle for acute painful sickle cell crises.',
    targetCohort: 'Known Sickle Cell Disease (HbSS/HbSC) presenting with severe bone/joint/abdominal pain',
    clinicalRationale: 'Prompt analgesia within 30 minutes and rehydration reduces duration of microvascular occlusion and acute chest syndrome.',
    items: [
      {
        category: 'MEDICATION',
        name: 'IV Tramadol Hydrochloride Injection',
        dosage: '50mg to 100mg',
        route: 'IV',
        frequency: 'Q6H slow IV diluted in 100mL Normal Saline',
        urgency: 'STAT',
        instructions: 'Administer within 30 minutes of triage. Monitor sedation score. Combine with oral Paracetamol 1g QDS.',
      },
      {
        category: 'MEDICATION',
        name: 'Intravenous Rehydration Fluid (0.45% Saline + 5% Dextrose)',
        dosage: '1.5 times maintenance (approx 100-125 mL/hr)',
        route: 'IV',
        frequency: 'Continuous Infusion',
        urgency: 'STAT',
        instructions: 'Hypotonic hydration reverses sickling. Avoid overhydration leading to pulmonary edema.',
      },
      {
        category: 'LABORATORY',
        name: 'Full Blood Count (FBC) + Reticulocyte Count STAT',
        urgency: 'STAT',
        instructions: 'Compare with steady-state baseline. Rule out aplastic crisis or splenic sequestration.',
      },
      {
        category: 'NURSING',
        name: 'Pulse Oximetry SpO2 & Incentive Spirometry (10 breaths/hour)',
        urgency: 'URGENT',
        instructions: 'Maintain SpO2 > 95%. Early incentive spirometry prevents hypoventilation and Acute Chest Syndrome (ACS).',
      },
    ],
  },
  {
    id: 'PEDIATRIC_SEPSIS_PROTOCOL',
    title: 'Pediatric & Neonatal Sepsis Protocol',
    description: 'First-hour pediatric septic shock resuscitation bundle.',
    targetCohort: 'Pediatric patients with suspected sepsis, hypothermia/hyperthermia, tachycardia, and prolonged capillary refill',
    clinicalRationale: 'Immediate broad-spectrum beta-lactams and fluid resuscitation within 60 minutes saves lives.',
    items: [
      {
        category: 'LABORATORY',
        name: 'Blood Cultures x 2 Sets STAT (Aerobic + Anaerobic)',
        urgency: 'STAT',
        instructions: 'Collect from separate peripheral venipuncture sites before administering antimicrobial therapy.',
      },
      {
        category: 'LABORATORY',
        name: 'Serum Lactate & Venous Blood Gas STAT',
        urgency: 'STAT',
        instructions: 'Marker of tissue hypoperfusion. Repeat in 2 hours to evaluate resuscitation clearance.',
      },
      {
        category: 'MEDICATION',
        name: 'IV Ceftriaxone Powder for Injection',
        dosage: '80mg/kg/day',
        route: 'IV',
        frequency: 'Once Daily slow IV infusion over 30 mins',
        urgency: 'STAT',
        instructions: 'First dose administered within 60 minutes of sepsis recognition.',
      },
      {
        category: 'MEDICATION',
        name: 'Normal Saline 0.9% Bolus (20mL/kg)',
        dosage: '20mL/kg',
        route: 'IV',
        frequency: 'Stat push over 15 minutes',
        urgency: 'STAT',
        instructions: 'Reassess after each bolus for signs of fluid responsiveness (cap refill, liver margin, crackles).',
      },
    ],
  },
  {
    id: 'EMERGENCY_CESAREAN_BUNDLE',
    title: 'Emergency Cesarean Section Pre-Op Bundle',
    description: 'Surgical preparation protocol for category 1 & 2 emergency cesarean deliveries.',
    targetCohort: 'Labour ward emergencies (fetal distress, obstructed labour, cord prolapse, antepartum hemorrhage)',
    clinicalRationale: 'Streamlines pre-op consent, blood readiness, surgical prophylaxis, and theatre booking within the 30-minute decision-to-delivery interval.',
    items: [
      {
        category: 'LABORATORY',
        name: 'Urgent Group & Save + Crossmatch 2 Units Whole Blood',
        urgency: 'STAT',
        instructions: 'Immediate blood bank reservation. Verify availability in blood bank refrigerator.',
      },
      {
        category: 'MEDICATION',
        name: 'Cefazolin 2g IV Prophylactic Antibiotic',
        dosage: '2g',
        route: 'IV',
        frequency: 'Stat within 30 minutes prior to skin incision',
        urgency: 'STAT',
        instructions: 'Reduces surgical site infections and post-partum endometritis.',
      },
      {
        category: 'PROCEDURE',
        name: 'Theatre Booking & Anaesthetic Review (Emergency Category 1)',
        urgency: 'STAT',
        instructions: 'Alert Consultant Obstetrician, Anesthetist, Scrub Nurse, and NICU Paediatric Resuscitation Team.',
      },
      {
        category: 'NURSING',
        name: 'WHO Surgical Safety Checklist Part 1 (Sign-In)',
        urgency: 'STAT',
        instructions: 'Confirm identity, surgical consent, site marking, allergy check, and aspiration prophylaxis (Ranitidine/Sodium Citrate).',
      },
    ],
  },
];

/**
 * GET /api/v1/cpoe/pathways
 */
router.get('/pathways', (req: Request, res: Response) => {
  res.json({
    success: true,
    total: IBOM_CLINICAL_PATHWAYS.length,
    data: IBOM_CLINICAL_PATHWAYS,
  });
});

/**
 * GET /api/v1/cpoe/pathways/:id
 */
router.get('/pathways/:id', (req: Request, res: Response) => {
  const pathway = IBOM_CLINICAL_PATHWAYS.find((p) => p.id === req.params.id);
  if (!pathway) {
    return res.status(404).json({ success: false, error: `Pathway ${req.params.id} not found` });
  }
  res.json({ success: true, data: pathway });
});

/**
 * POST /api/v1/cpoe/order-sets/apply
 * Applies a full clinical order set in 1 click
 */
router.post('/order-sets/apply', (req: Request, res: Response) => {
  const {
    pathwayId,
    patientId,
    patientName,
    encounterId,
    facilityId,
    orderedByDoctorId,
    orderedByDoctorName,
    customNotes,
  } = req.body;

  if (!pathwayId || !patientId) {
    return res.status(400).json({ success: false, error: 'pathwayId and patientId are required' });
  }

  const pathway = IBOM_CLINICAL_PATHWAYS.find((p) => p.id === pathwayId);
  if (!pathway) {
    return res.status(404).json({ success: false, error: `Pathway ${pathwayId} not found` });
  }

  const createdOrders: any[] = [];
  const prescribedDrugs: any[] = [];

  for (const item of pathway.items) {
    if (item.category === 'MEDICATION') {
      prescribedDrugs.push({
        id: `DRUG-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
        name: item.name,
        dosage: item.dosage || 'Standard clinical dose',
        frequency: item.frequency || 'STAT',
        duration: 'Course as indicated',
        route: (item.route as any) || 'IV',
        quantity: 1,
        instructions: item.instructions,
      });
    } else {
      const order = dataStore.createOrder({
        patientId,
        encounterId: encounterId || 'ENC-ACTIVE',
        facilityId: facilityId || 'FAC-001',
        orderedByDoctorId: orderedByDoctorId || 'DOC-DEFAULT',
        orderedByDoctorName: orderedByDoctorName || 'Attending Physician',
        type: item.category === 'LABORATORY' ? 'LABORATORY' : item.category === 'RADIOLOGY' ? 'RADIOLOGY' : 'PROCEDURE',
        title: item.name,
        details: `${item.instructions} [Protocol: ${pathway.title}]`,
        priority: item.urgency === 'STAT' ? 'STAT' : item.urgency === 'URGENT' ? 'URGENT' : 'ROUTINE',
        status: 'PENDING',
        billed: false,
        cost: item.category === 'LABORATORY' ? 2500 : 5000,
      });
      createdOrders.push(order);
    }
  }

  let prescription: any = null;
  if (prescribedDrugs.length > 0) {
    prescription = dataStore.createPrescription({
      patientId,
      patientName: patientName || 'Inpatient',
      doctorId: orderedByDoctorId || 'DOC-DEFAULT',
      doctorName: orderedByDoctorName || 'Attending Physician',
      facilityId: facilityId || 'FAC-001',
      diagnosis: pathway.title,
      drugs: prescribedDrugs,
      routedToPharmacyName: 'Main Hospital Inpatient Pharmacy',
      notes: `Generated from CPOE Pathway: ${pathway.title}. ${customNotes || ''}`,
    });
  }

  // Cryptographic audit
  auditLedger.logEvent({
    actorId: orderedByDoctorId || 'DOC-DEFAULT',
    actorName: orderedByDoctorName || 'Attending Physician',
    actorRole: 'DOCTOR',
    facilityId: facilityId || 'FAC-001',
    action: 'WRITE_PHI',
    resourceType: 'ENCOUNTER',
    resourceId: pathway.id,
    reason: `CPOE Protocol applied: ${pathway.title} for Patient ${patientId}`,
    metadata: {
      pathwayId: pathway.id,
      ordersCount: createdOrders.length,
      drugsCount: prescribedDrugs.length,
      rxId: prescription?.id,
    },
  });

  res.status(201).json({
    success: true,
    message: `Clinical pathway "${pathway.title}" successfully applied. Dispatched ${createdOrders.length} orders and ${prescribedDrugs.length} prescriptions to Pharmacy & Labs.`,
    data: {
      pathwayTitle: pathway.title,
      orders: createdOrders,
      prescription,
    },
  });
});

export default router;
