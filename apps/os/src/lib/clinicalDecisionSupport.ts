import { CdsAlert, CdsCheckRequest, CdsCheckResponse } from '@medcore/types';

// Standardized Drug Class Map
const DRUG_CLASSES: Record<string, string[]> = {
  penicillin: ['penicillin', 'amoxicillin', 'ampicillin', 'augmentin', 'co-amoxiclav', 'piperacillin', 'tazobactam', 'cloxacillin'],
  cephalosporin: ['ceftriaxone', 'cefuroxime', 'cefixime', 'cefazolin', 'cefotaxime', 'cefepime'],
  sulfa: ['cotrimoxazole', 'septrin', 'bactrim', 'sulfamethoxazole', 'sulfadoxine', 'fansidar'],
  nsaid: ['ibuprofen', 'diclofenac', 'ketorolac', 'naproxen', 'piroxicam', 'aspirin', 'indomethacin', 'meloxicam'],
  opioid: ['tramadol', 'morphine', 'fentanyl', 'codeine', 'pethidine', 'oxycodone'],
  anticoagulant: ['warfarin', 'heparin', 'enoxaparin', 'rivaroxaban', 'apixaban', 'dabigatran'],
  ace_inhibitor: ['lisinopril', 'ramipril', 'enalapril', 'captopril', 'perindopril'],
  arb: ['losartan', 'valsartan', 'telmisartan', 'candesartan', 'olmesartan'],
  statin: ['atorvastatin', 'rosuvastatin', 'simvastatin', 'pravastatin'],
  macrolide: ['erythromycin', 'clarithromycin', 'azithromycin'],
  quinolone: ['ciprofloxacin', 'levofloxacin', 'moxifloxacin', 'ofloxacin'],
};

// Known Severe Drug-Drug Interactions
interface DdiRule {
  classA: string;
  classB: string;
  severity: 'HARD_STOP' | 'CRITICAL_WARNING' | 'MODERATE_WARNING';
  title: string;
  evidence: string;
  action: string;
}

const DDI_RULES: DdiRule[] = [
  {
    classA: 'ace_inhibitor',
    classB: 'arb',
    severity: 'HARD_STOP',
    title: 'Dual Renin-Angiotensin System (RAS) Blockade',
    evidence: 'Combining ACE inhibitors with ARBs significantly elevates risk of severe hyperkalemia, acute kidney injury, and hypotension without clinical mortality benefit.',
    action: 'Discontinue one agent immediately. Use calcium channel blocker or thiazide diuretic instead.',
  },
  {
    classA: 'anticoagulant',
    classB: 'nsaid',
    severity: 'CRITICAL_WARNING',
    title: 'Compounded Gastrointestinal & Systemic Bleeding Risk',
    evidence: 'Co-administration of therapeutic anticoagulation with NSAIDs impairs platelet aggregation and increases major GI hemorrhage risk by 3-5x.',
    action: 'Switch analgesic to IV Paracetamol. If anti-inflammatory essential, add high-dose PPI gastroprotection.',
  },
  {
    classA: 'macrolide',
    classB: 'statin',
    severity: 'CRITICAL_WARNING',
    title: 'CYP3A4 Inhibition — Statin Toxicity & Rhabdomyolysis',
    evidence: 'Macrolides potently inhibit statin metabolism, increasing serum statin levels and risking fatal rhabdomyolysis and acute renal failure.',
    action: 'Hold statin for the duration of the macrolide antimicrobial course, or switch to Azithromycin/Doxycycline.',
  },
  {
    classA: 'opioid',
    classB: 'opioid',
    severity: 'CRITICAL_WARNING',
    title: 'Compounded Opioid Stacking & Respiratory Depression',
    evidence: 'Concurrent prescription of multiple pure mu-opioid agonists heightens fatal central respiratory depression.',
    action: 'Consolidate onto a single titrated opioid regimen with naloxone available bedside.',
  },
];

export function runClinicalSafetyCheck(req: CdsCheckRequest): CdsCheckResponse {
  const alerts: CdsAlert[] = [];
  const normalizedAllergies = req.allergies.map(a => a.toLowerCase().trim());
  const existingMeds = req.currentMedications.map(m => m.toLowerCase().trim());

  // 1. DRUG-ALLERGY CHECK (High Priority)
  for (const newOrder of req.newOrders) {
    const medLower = newOrder.name.toLowerCase();

    // Check Penicillin Class
    if (normalizedAllergies.some(a => a.includes('penicillin') || a.includes('amox') || a.includes('ampicillin'))) {
      if (DRUG_CLASSES.penicillin.some(p => medLower.includes(p))) {
        alerts.push({
          id: `CDS-ALG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          type: 'DRUG_ALLERGY',
          severity: 'HARD_STOP',
          title: `Fatal Anaphylaxis Risk: Penicillin Allergy Conflict`,
          message: `Patient has documented allergy: "${req.allergies.join(', ')}". "${newOrder.name}" is a Beta-Lactam Penicillin derivative.`,
          triggerItem: newOrder.name,
          clinicalEvidence: 'Severe IgE-mediated anaphylactic shock or Stevens-Johnson syndrome reported with Beta-lactam re-exposure.',
          recommendedAction: 'Order Ceftriaxone cautiously (if non-anaphylactic) or switch to Azithromycin / Ciprofloxacin / Vancomycin.',
          requiresOverrideReason: true,
        });
      }
    }

    // Check Sulfa Class
    if (normalizedAllergies.some(a => a.includes('sulfa') || a.includes('septrin') || a.includes('bactrim'))) {
      if (DRUG_CLASSES.sulfa.some(s => medLower.includes(s))) {
        alerts.push({
          id: `CDS-ALG-SULFA-${Date.now()}`,
          type: 'DRUG_ALLERGY',
          severity: 'HARD_STOP',
          title: `Allergy Conflict: Sulfonamide Hypersensitivity`,
          message: `Patient has documented Sulfa allergy. "${newOrder.name}" contains sulfonamides.`,
          triggerItem: newOrder.name,
          clinicalEvidence: 'Risk of toxic epidermal necrolysis (TEN) and severe hypersensitivity.',
          recommendedAction: 'Choose non-sulfonamide antimicrobial.',
          requiresOverrideReason: true,
        });
      }
    }

    // Check NSAID Class
    if (normalizedAllergies.some(a => a.includes('nsaid') || a.includes('aspirin') || a.includes('ibuprofen'))) {
      if (DRUG_CLASSES.nsaid.some(n => medLower.includes(n))) {
        alerts.push({
          id: `CDS-ALG-NSAID-${Date.now()}`,
          type: 'DRUG_ALLERGY',
          severity: 'HARD_STOP',
          title: `Allergy Conflict: NSAID / Aspirin Exacerbated Respiratory/Skin Disease`,
          message: `Patient is allergic to NSAIDs. "${newOrder.name}" is a cyclooxygenase inhibitor.`,
          triggerItem: newOrder.name,
          clinicalEvidence: 'Risk of acute bronchospasm, urticaria, or anaphylactoid reaction.',
          recommendedAction: 'Use Paracetamol or Tramadol for analgesia.',
          requiresOverrideReason: true,
        });
      }
    }
  }

  // 2. DRUG-DRUG INTERACTIONS (DDI)
  const allMedsToEvaluate = [
    ...existingMeds,
    ...req.newOrders.map(o => o.name.toLowerCase()),
  ];

  for (const rule of DDI_RULES) {
    const itemsInA = DRUG_CLASSES[rule.classA] || [];
    const itemsInB = DRUG_CLASSES[rule.classB] || [];

    const foundA = allMedsToEvaluate.filter(m => itemsInA.some(a => m.includes(a)));
    const foundB = allMedsToEvaluate.filter(m => itemsInB.some(b => m.includes(b)));

    if (foundA.length > 0 && foundB.length > 0) {
      alerts.push({
        id: `CDS-DDI-${rule.classA}-${rule.classB}`,
        type: 'DRUG_DRUG_INTERACTION',
        severity: rule.severity,
        title: rule.title,
        message: `Interaction detected between "${foundA.join(', ')}" and "${foundB.join(', ')}".`,
        triggerItem: foundB[0],
        conflictingItem: foundA[0],
        clinicalEvidence: rule.evidence,
        recommendedAction: rule.action,
        requiresOverrideReason: rule.severity === 'HARD_STOP' || rule.severity === 'CRITICAL_WARNING',
      });
    }
  }

  // 3. RENAL SAFETY & eGFR CHECKS
  if (req.recentLabs?.eGfr && req.recentLabs.eGfr < 30) {
    for (const order of req.newOrders) {
      const name = order.name.toLowerCase();
      if (name.includes('metformin')) {
        alerts.push({
          id: `CDS-RENAL-METFORMIN`,
          type: 'RENAL_ADJUSTMENT',
          severity: 'HARD_STOP',
          title: 'Metformin Severe Lactic Acidosis Risk in Renal Impairment',
          message: `Patient eGFR is ${req.recentLabs.eGfr} mL/min/1.73m² (< 30). Metformin is strictly contraindicated.`,
          triggerItem: order.name,
          clinicalEvidence: 'High risk of fatal lactic acidosis due to impaired drug clearance.',
          recommendedAction: 'Discontinue Metformin. Switch to subcutaneous Insulin sliding scale.',
          requiresOverrideReason: true,
        });
      } else if (name.includes('gentamicin') || name.includes('amikacin')) {
        alerts.push({
          id: `CDS-RENAL-AMINO`,
          type: 'RENAL_ADJUSTMENT',
          severity: 'CRITICAL_WARNING',
          title: 'Aminoglycoside Nephrotoxicity Warning',
          message: `Patient eGFR is ${req.recentLabs.eGfr} mL/min. Aminoglycosides cause acute tubular necrosis.`,
          triggerItem: order.name,
          clinicalEvidence: 'Accumulation in renal cortex risks irreversible kidney injury and ototoxicity.',
          recommendedAction: 'Dose extend interval (e.g. Q48H) and monitor serum peak/trough levels.',
          requiresOverrideReason: true,
        });
      }
    }
  }

  // 4. DUPLICATE THERAPY CHECK
  const orderNames = req.newOrders.map(o => o.name.toLowerCase());
  for (const order of req.newOrders) {
    const nameLower = order.name.toLowerCase();
    const isAlreadyOn = existingMeds.some(m => m.includes(nameLower) || nameLower.includes(m));
    if (isAlreadyOn) {
      alerts.push({
        id: `CDS-DUP-${order.name}`,
        type: 'DUPLICATE_THERAPY',
        severity: 'MODERATE_WARNING',
        title: `Duplicate Active Prescription: ${order.name}`,
        message: `Patient already has an active order for "${order.name}". Submitting duplicate order.`,
        triggerItem: order.name,
        clinicalEvidence: 'Accidental double dosing can lead to toxicity.',
        recommendedAction: 'Verify if dose modification was intended or cancel duplicate.',
        requiresOverrideReason: false,
      });
    }
  }

  const hasHardStop = alerts.some(a => a.severity === 'HARD_STOP');
  const hasCriticalWarning = alerts.some(a => a.severity === 'CRITICAL_WARNING');

  return {
    patientId: req.patientId,
    hasHardStop,
    hasCriticalWarning,
    alerts,
    checkedAt: new Date().toISOString(),
  };
}
