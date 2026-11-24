/**
 * Isomorphic Clinical Safety Guard + NEWS2 / qSOFA / Obstetric Deterioration Engine.
 * Runs in both browser clinical stations and Node API routes without DOM dependencies.
 * Assistive only: clinicians retain full authority and must review/override hard stops explicitly.
 */

export type AvpuLevel = 'Alert' | 'Voice' | 'Pain' | 'Unresponsive';

export interface VitalSnapshotInput {
  bpSystolic?: number;
  bpDiastolic?: number;
  pulse?: number;
  tempC?: number;
  spo2?: number;
  respRate?: number;
  avpu?: AvpuLevel;
  supplementalO2?: boolean;
  recordedAt?: string;
}

export interface News2Assessment {
  total: number;
  singleRedScore: boolean;
  riskLevel: 'low' | 'low_medium' | 'medium' | 'high';
  breakdown: Record<string, number>;
  escalationAction: string;
}

export interface QsofaAssessment {
  score: number;
  sepsisScreenPositive: boolean;
  criteria: string[];
}

export interface ObstetricRiskAssessment {
  isPregnant: boolean;
  shockIndex: number | null;
  haemorrhageAlert: boolean;
  severePreEclampsiaAlert: boolean;
}

export type DeteriorationBundleKey =
  | 'eclampsia_obstetric'
  | 'pph_emergency'
  | 'sepsis_1hr'
  | 'hypertensive_crisis';

export interface ClinicalDeteriorationAssessment {
  urgency: 'routine' | 'urgent' | 'critical';
  news2: News2Assessment;
  qsofa: QsofaAssessment;
  obstetric: ObstetricRiskAssessment;
  shockIndex: number | null;
  trajectoryAlerts: string[];
  alerts: string[];
  recommendedActions: string[];
  recommendedBundleKey: DeteriorationBundleKey | null;
}

export interface VitalPatientContext {
  ageYears?: number;
  dob?: string;
  sex?: string;
  isPregnant?: boolean;
  chronicConditions?: string[];
}

export type SafetyAlertLevel = 'hard_stop' | 'warning' | 'info';
export type SafetyAlertCategory =
  | 'allergy'
  | 'interaction'
  | 'renal'
  | 'pregnancy'
  | 'paediatric'
  | 'genotype'
  | 'duplicate'
  | 'dosing';

export interface SafetyGuardAlert {
  id: string;
  level: SafetyAlertLevel;
  category: SafetyAlertCategory;
  code: string;
  title: string;
  detail: string;
  requiresOverride: boolean;
}

export interface PrescriptionSafetyInput {
  drugName: string;
  notes?: string;
  allergies?: string[];
  otherDrugs?: string[];
  ageYears?: number;
  dob?: string;
  weightKg?: number;
  sex?: string;
  isPregnant?: boolean;
  chronicConditions?: string[];
  genotype?: string;
  egfr?: number;
  creatinineMgDl?: number;
}

export interface PrescriptionSafetyReport {
  drugName: string;
  safe: boolean;
  hardStopCount: number;
  warningCount: number;
  infoCount: number;
  highestLevel: SafetyAlertLevel | 'none';
  alerts: SafetyGuardAlert[];
}

export function inferAgeYears(dob?: string, explicitAgeYears?: number): number | undefined {
  if (typeof explicitAgeYears === 'number' && Number.isFinite(explicitAgeYears) && explicitAgeYears >= 0) {
    return explicitAgeYears;
  }
  if (!dob) return undefined;
  const parsed = Date.parse(dob);
  if (Number.isNaN(parsed)) return undefined;
  const age = (Date.now() - parsed) / (365.25 * 24 * 60 * 60 * 1000);
  if (!Number.isFinite(age) || age < 0 || age > 130) return undefined;
  return Math.floor(age * 10) / 10;
}

function isPatientPregnant(ctx?: { isPregnant?: boolean; sex?: string; chronicConditions?: string[] }): boolean {
  if (!ctx) return false;
  if (ctx.isPregnant === true) return true;
  if (ctx.sex && ctx.sex.toLowerCase() === 'male') return false;
  return (ctx.chronicConditions || []).some((c) =>
    /pregnan|antenatal|gravida|obstetric|trimester|postpartum|anc/i.test(c)
  );
}

/**
 * RCPL NEWS2 physiological score (0..20) + red-score trigger detection.
 */
export function computeNews2Score(v: VitalSnapshotInput): News2Assessment {
  const breakdown: Record<string, number> = {};

  if (typeof v.respRate === 'number' && v.respRate > 0) {
    if (v.respRate <= 8) breakdown.respRate = 3;
    else if (v.respRate <= 11) breakdown.respRate = 1;
    else if (v.respRate <= 20) breakdown.respRate = 0;
    else if (v.respRate <= 24) breakdown.respRate = 2;
    else breakdown.respRate = 3;
  } else {
    breakdown.respRate = 0;
  }

  if (typeof v.spo2 === 'number' && v.spo2 > 0) {
    if (v.spo2 <= 91) breakdown.spo2 = 3;
    else if (v.spo2 <= 93) breakdown.spo2 = 2;
    else if (v.spo2 <= 95) breakdown.spo2 = 1;
    else breakdown.spo2 = 0;
  } else {
    breakdown.spo2 = 0;
  }

  breakdown.supplementalO2 = v.supplementalO2 ? 2 : 0;

  if (typeof v.tempC === 'number' && v.tempC > 0) {
    if (v.tempC <= 35.0) breakdown.tempC = 3;
    else if (v.tempC <= 36.0) breakdown.tempC = 1;
    else if (v.tempC <= 38.0) breakdown.tempC = 0;
    else if (v.tempC <= 39.0) breakdown.tempC = 1;
    else breakdown.tempC = 2;
  } else {
    breakdown.tempC = 0;
  }

  if (typeof v.bpSystolic === 'number' && v.bpSystolic > 0) {
    if (v.bpSystolic <= 90) breakdown.bpSystolic = 3;
    else if (v.bpSystolic <= 100) breakdown.bpSystolic = 2;
    else if (v.bpSystolic <= 110) breakdown.bpSystolic = 1;
    else if (v.bpSystolic <= 219) breakdown.bpSystolic = 0;
    else breakdown.bpSystolic = 3;
  } else {
    breakdown.bpSystolic = 0;
  }

  if (typeof v.pulse === 'number' && v.pulse > 0) {
    if (v.pulse <= 40) breakdown.pulse = 3;
    else if (v.pulse <= 50) breakdown.pulse = 1;
    else if (v.pulse <= 90) breakdown.pulse = 0;
    else if (v.pulse <= 110) breakdown.pulse = 1;
    else if (v.pulse <= 130) breakdown.pulse = 2;
    else breakdown.pulse = 3;
  } else {
    breakdown.pulse = 0;
  }

  breakdown.avpu = v.avpu && v.avpu !== 'Alert' ? 3 : 0;

  const scores = Object.values(breakdown);
  const total = scores.reduce((sum, val) => sum + val, 0);
  const singleRedScore = scores.some((val) => val >= 3);

  let riskLevel: News2Assessment['riskLevel'] = 'low';
  let escalationAction = 'Routine ward/OPD observation (minimum q4-6h).';

  if (total >= 7) {
    riskLevel = 'high';
    escalationAction = 'STAT senior medical team review, continuous monitoring, consider ICU/HDU transfer.';
  } else if (total >= 5) {
    riskLevel = 'medium';
    escalationAction = 'Urgent clinician review within 30 minutes and hourly vital reassessment.';
  } else if (singleRedScore) {
    riskLevel = 'low_medium';
    escalationAction = 'Single red parameter (3 pts): nurse-in-charge & doctor review within 60 minutes.';
  }

  return {
    total,
    singleRedScore,
    riskLevel,
    breakdown,
    escalationAction,
  };
}

/**
 * Quick SOFA bedside sepsis screen (0..3; >= 2 positive).
 */
export function computeQsofaScore(v: VitalSnapshotInput): QsofaAssessment {
  const criteria: string[] = [];
  if (typeof v.respRate === 'number' && v.respRate >= 22) {
    criteria.push(`RR ${v.respRate}/min (>=22)`);
  }
  if (typeof v.bpSystolic === 'number' && v.bpSystolic > 0 && v.bpSystolic <= 100) {
    criteria.push(`SBP ${v.bpSystolic} mmHg (<=100)`);
  }
  if (v.avpu && v.avpu !== 'Alert') {
    criteria.push(`Altered mentation (${v.avpu})`);
  }
  const score = criteria.length;
  return {
    score,
    sepsisScreenPositive: score >= 2,
    criteria,
  };
}

/**
 * Obstetric Shock Index & Severe Pre-Eclampsia screen.
 */
export function computeObstetricRisk(
  v: VitalSnapshotInput,
  ctx?: { isPregnant?: boolean; sex?: string; chronicConditions?: string[] }
): ObstetricRiskAssessment {
  const pregnant = isPatientPregnant(ctx);
  const shockIndex =
    typeof v.pulse === 'number' &&
    v.pulse > 0 &&
    typeof v.bpSystolic === 'number' &&
    v.bpSystolic > 0
      ? Number((v.pulse / v.bpSystolic).toFixed(2))
      : null;

  const haemorrhageAlert =
    shockIndex !== null && (pregnant ? shockIndex >= 0.9 : shockIndex >= 1.0);
  const severePreEclampsiaAlert =
    pregnant &&
    ((typeof v.bpSystolic === 'number' && v.bpSystolic >= 160) ||
      (typeof v.bpDiastolic === 'number' && v.bpDiastolic >= 110));

  return {
    isPregnant: pregnant,
    shockIndex,
    haemorrhageAlert,
    severePreEclampsiaAlert,
  };
}

/**
 * Evaluates NEWS2 + qSOFA + Obstetric risk + longitudinal 24h trajectory slopes.
 */
export function evaluateVitalDeterioration(
  current: VitalSnapshotInput,
  priorVitals: VitalSnapshotInput[] = [],
  patientContext?: VitalPatientContext
): ClinicalDeteriorationAssessment {
  const news2 = computeNews2Score(current);
  const qsofa = computeQsofaScore(current);
  const obstetric = computeObstetricRisk(current, patientContext);
  const ageYears = inferAgeYears(patientContext?.dob, patientContext?.ageYears);

  const trajectoryAlerts: string[] = [];
  const alerts: string[] = [];
  const recommendedActions: string[] = [];

  const nowMs = current.recordedAt ? Date.parse(current.recordedAt) : Date.now();
  const recentPrior = priorVitals.find((p) => {
    if (!p.recordedAt) return true;
    const t = Date.parse(p.recordedAt);
    return !Number.isNaN(t) && nowMs - t <= 24 * 60 * 60 * 1000;
  });

  let hemodynamicCollapse = false;
  let hypoxicDrop = false;
  let paediatricFebrileAlert = false;

  if (recentPrior) {
    if (
      typeof current.bpSystolic === 'number' &&
      typeof recentPrior.bpSystolic === 'number' &&
      typeof current.pulse === 'number' &&
      typeof recentPrior.pulse === 'number'
    ) {
      const sbpDrop = recentPrior.bpSystolic - current.bpSystolic;
      const hrRise = current.pulse - recentPrior.pulse;
      if (sbpDrop >= 20 && hrRise >= 15) {
        hemodynamicCollapse = true;
        trajectoryAlerts.push(
          `Hemodynamic shock trajectory: SBP dropped ${sbpDrop} mmHg (${recentPrior.bpSystolic}→${current.bpSystolic}) while HR rose +${hrRise} bpm (${recentPrior.pulse}→${current.pulse}).`
        );
      }
    }

    if (
      typeof current.spo2 === 'number' &&
      typeof recentPrior.spo2 === 'number' &&
      recentPrior.spo2 - current.spo2 >= 4 &&
      current.spo2 < 94
    ) {
      hypoxicDrop = true;
      trajectoryAlerts.push(
        `Acute hypoxic trajectory: SpO2 fell from ${recentPrior.spo2}% to ${current.spo2}%.`
      );
    }
  }

  if (
    typeof ageYears === 'number' &&
    ageYears <= 5 &&
    typeof current.tempC === 'number' &&
    current.tempC >= 39.5
  ) {
    paediatricFebrileAlert = true;
    alerts.push(`Paediatric high fever red flag (${current.tempC}°C at age ${ageYears}y) — assess for febrile convulsion / severe malaria / sepsis.`);
  }

  if (news2.total >= 5 || news2.singleRedScore) {
    alerts.push(`NEWS2 ${news2.total} (${news2.riskLevel.replace('_', '-').toUpperCase()}) — ${news2.escalationAction}`);
  }
  if (qsofa.sepsisScreenPositive) {
    alerts.push(`qSOFA positive (${qsofa.score}/3: ${qsofa.criteria.join(', ')}) — initiate Sepsis 1-Hour Bundle.`);
  }
  if (obstetric.severePreEclampsiaAlert) {
    alerts.push(`Severe obstetric hypertension (${current.bpSystolic || '?'}/${current.bpDiastolic || '?'} mmHg) — evaluate for Pre-Eclampsia / MgSO4 protocol.`);
  }
  if (obstetric.haemorrhageAlert && obstetric.shockIndex !== null) {
    alerts.push(
      obstetric.isPregnant
        ? `Obstetric Shock Index elevated (${obstetric.shockIndex} >= 0.90) — rule out concealed/postpartum haemorrhage.`
        : `Shock Index elevated (${obstetric.shockIndex} >= 1.00) — evaluate for circulatory shock / acute blood loss.`
    );
  }
  alerts.push(...trajectoryAlerts);

  const sys = Number(current.bpSystolic) || 0;
  const dia = Number(current.bpDiastolic) || 0;
  const pulse = Number(current.pulse) || 0;
  const temp = Number(current.tempC) || 0;
  const spo2 = typeof current.spo2 === 'number' && current.spo2 > 0 ? current.spo2 : 100;

  let urgency: ClinicalDeteriorationAssessment['urgency'] = 'routine';
  if (
    news2.riskLevel === 'high' ||
    qsofa.sepsisScreenPositive ||
    obstetric.haemorrhageAlert ||
    obstetric.severePreEclampsiaAlert ||
    hemodynamicCollapse ||
    sys >= 180 ||
    dia >= 120 ||
    pulse >= 130 ||
    temp >= 40 ||
    spo2 < 90
  ) {
    urgency = 'critical';
  } else if (
    news2.riskLevel === 'medium' ||
    news2.riskLevel === 'low_medium' ||
    hypoxicDrop ||
    paediatricFebrileAlert ||
    sys >= 160 ||
    dia >= 100 ||
    pulse >= 110 ||
    temp >= 38.5 ||
    spo2 < 94
  ) {
    urgency = 'urgent';
  }

  let recommendedBundleKey: DeteriorationBundleKey | null = null;
  if (obstetric.severePreEclampsiaAlert) {
    recommendedBundleKey = 'eclampsia_obstetric';
    recommendedActions.push('Check urine protein, reflexes, and prepare IV MgSO4 + labetalol/hydralazine.');
  } else if (obstetric.haemorrhageAlert && obstetric.isPregnant) {
    recommendedBundleKey = 'pph_emergency';
    recommendedActions.push('Two wide-bore IV cannulae, crossmatch blood, oxytocin/tranexamic acid readiness.');
  } else if (qsofa.sepsisScreenPositive) {
    recommendedBundleKey = 'sepsis_1hr';
    recommendedActions.push('Blood cultures + FBC + lactate, broad-spectrum IV antibiotics, IV crystalloid bolus if hypotensive.');
  } else if (sys >= 180 || dia >= 120) {
    recommendedBundleKey = 'hypertensive_crisis';
    recommendedActions.push('Repeat BP on both arms in 15 min, assess end-organ symptoms, ECG & UEC.');
  }

  if (recommendedActions.length === 0 && urgency !== 'routine') {
    recommendedActions.push(news2.escalationAction);
  }

  return {
    urgency,
    news2,
    qsofa,
    obstetric,
    shockIndex: obstetric.shockIndex,
    trajectoryAlerts,
    alerts,
    recommendedActions,
    recommendedBundleKey,
  };
}

interface AllergyClassRule {
  id: string;
  allergyPattern: RegExp;
  label: string;
  hardStopDrugs: RegExp;
  crossWarningDrugs?: RegExp;
  crossDetail?: string;
}

const ALLERGY_CLASS_RULES: AllergyClassRule[] = [
  {
    id: 'penicillin',
    allergyPattern: /penicillin|amoxicillin|ampicillin|augmentin|cloxacillin|flucloxacillin|beta[\s-]?lactam/i,
    label: 'Penicillin / Beta-lactam',
    hardStopDrugs: /amoxicillin|ampicillin|augmentin|cloxacillin|flucloxacillin|piperacillin|penicillin/i,
    crossWarningDrugs: /ceftriaxone|cefuroxime|cefixime|cephalexin|ceftazidime|cefotaxime/i,
    crossDetail: 'Possible beta-lactam cross-reactivity with cephalosporin. Confirm reaction history before dispensing.',
  },
  {
    id: 'sulfa',
    allergyPattern: /sulfa|sulfon|cotrimoxazole|septrin|bactrim/i,
    label: 'Sulfonamide',
    hardStopDrugs: /cotrimoxazole|septrin|bactrim|sulfadiazine|sulfadoxine|fansidar|sulfamethoxazole/i,
  },
  {
    id: 'nsaid',
    allergyPattern: /nsaid|ibuprofen|diclofenac|aspirin|naproxen|salicylate/i,
    label: 'NSAID / Salicylate',
    hardStopDrugs: /ibuprofen|diclofenac|aspirin|naproxen|piroxicam|indomethacin|ketorolac|celecoxib|meloxicam/i,
  },
  {
    id: 'macrolide',
    allergyPattern: /macrolide|erythromycin|azithromycin|clarithromycin/i,
    label: 'Macrolide',
    hardStopDrugs: /azithromycin|erythromycin|clarithromycin/i,
  },
  {
    id: 'quinolone',
    allergyPattern: /quinolone|ciprofloxacin|levofloxacin|ofloxacin/i,
    label: 'Fluoroquinolone',
    hardStopDrugs: /ciprofloxacin|levofloxacin|ofloxacin|moxifloxacin/i,
  },
];

interface InteractionRule {
  id: string;
  a: RegExp;
  b: RegExp;
  level: SafetyAlertLevel;
  title: string;
  detail: string;
}

const INTERACTION_RULES: InteractionRule[] = [
  {
    id: 'warfarin-bleed',
    a: /\bwarfarin\b/i,
    b: /aspirin|ibuprofen|diclofenac|naproxen|ketorolac|metronidazole|ciprofloxacin|fluconazole/i,
    level: 'hard_stop',
    title: 'Major bleeding / INR surge interaction',
    detail: 'Concurrent Warfarin therapy markedly elevates haemorrhage risk. Check INR and use alternative analgesia/antibiotic.',
  },
  {
    id: 'act-qt-major',
    a: /artemether|lumefantrine|coartem|\bact\b/i,
    b: /fluconazole|erythromycin|haloperidol|amiodarone/i,
    level: 'hard_stop',
    title: 'Major QT prolongation interaction',
    detail: 'Lumefantrine + QT-prolonging agent raises Torsades de Pointes arrhythmia risk. Choose non-QT interacting therapy.',
  },
  {
    id: 'act-qt-mod',
    a: /artemether|lumefantrine|coartem/i,
    b: /ciprofloxacin|levofloxacin|azithromycin|ondansetron/i,
    level: 'warning',
    title: 'Moderate QT prolongation caution',
    detail: 'Monitor ECG/electrolytes when combining Artemether-Lumefantrine with fluoroquinolones, macrolides, or ondansetron.',
  },
  {
    id: 'ace-hyperk',
    a: /lisinopril|enalapril|ramipril|captopril|losartan|valsartan|telmisartan/i,
    b: /spironolactone|amiloride|potassium/i,
    level: 'warning',
    title: 'Hyperkalaemia interaction (ACEi/ARB + K+-sparing)',
    detail: 'Monitor serum K+ and UEC closely when combining RAAS blockade with Spironolactone or potassium supplements.',
  },
  {
    id: 'ace-nsaid',
    a: /lisinopril|enalapril|ramipril|captopril|losartan|valsartan|telmisartan/i,
    b: /ibuprofen|diclofenac|naproxen|indomethacin|piroxicam|meloxicam/i,
    level: 'warning',
    title: 'Renal haemodynamic / BP blunting caution',
    detail: 'NSAIDs blunt antihypertensive efficacy of ACEi/ARB and increase acute kidney injury risk.',
  },
  {
    id: 'metformin-contrast',
    a: /\bmetformin\b/i,
    b: /contrast|iohexol|iopamidol/i,
    level: 'hard_stop',
    title: 'Metformin + iodinated contrast interaction',
    detail: 'Hold Metformin for 48 hours around iodinated contrast administration and verify renal function first.',
  },
  {
    id: 'rifampicin-inducer',
    a: /\brifampicin\b/i,
    b: /dolutegravir|lopinavir|warfarin|nifedipine|levonorgestrel|contraceptive/i,
    level: 'warning',
    title: 'Potent CYP450 / UGT induction (Rifampicin)',
    detail: 'Rifampicin accelerates clearance of DTG (requires BD dosing), nifedipine, warfarin, and hormonal contraception.',
  },
  {
    id: 'aminoglycoside-nephro',
    a: /gentamicin|amikacin|streptomycin/i,
    b: /furosemide|lasix|vancomycin|ibuprofen|diclofenac/i,
    level: 'warning',
    title: 'Additive nephrotoxicity / ototoxicity',
    detail: 'Monitor creatinine, urine output, and hearing when combining aminoglycosides with loop diuretics or NSAIDs.',
  },
  {
    id: 'amlodipine-simvastatin',
    a: /\bamlodipine\b/i,
    b: /\bsimvastatin\b/i,
    level: 'warning',
    title: 'CYP3A4 myopathy interaction',
    detail: 'Limit Simvastatin to 20mg daily when co-prescribed with Amlodipine or switch to Atorvastatin/Rosuvastatin.',
  },
];

const THERAPEUTIC_CLASSES: Array<{ id: string; label: string; pattern: RegExp }> = [
  { id: 'nsaid', label: 'NSAID', pattern: /ibuprofen|diclofenac|naproxen|piroxicam|indomethacin|ketorolac|meloxicam/i },
  { id: 'penicillin', label: 'Penicillin', pattern: /amoxicillin|ampicillin|augmentin|cloxacillin|flucloxacillin/i },
  { id: 'cephalosporin', label: 'Cephalosporin', pattern: /ceftriaxone|cefuroxime|cefixime|cephalexin/i },
  { id: 'ace_arb', label: 'ACEi/ARB', pattern: /lisinopril|enalapril|ramipril|losartan|valsartan|telmisartan/i },
  { id: 'act', label: 'ACT Antimalarial', pattern: /artemether|lumefantrine|coartem|artesunate.*amodiaquine/i },
  { id: 'ppi', label: 'Proton Pump Inhibitor', pattern: /omeprazole|pantoprazole|rabeprazole|esomeprazole/i },
  { id: 'benzo', label: 'Benzodiazepine', pattern: /diazepam|lorazepam|midazolam/i },
];

/**
 * Comprehensive Pre-Prescribe & Pre-Dispense Pharmacy Safety Gate.
 */
export function evaluatePrescriptionSafetyGuard(
  input: PrescriptionSafetyInput
): PrescriptionSafetyReport {
  const drugName = String(input.drugName || '').trim();
  const drugLower = drugName.toLowerCase();
  const alerts: SafetyGuardAlert[] = [];
  const seenIds = new Set<string>();

  const pushAlert = (alert: SafetyGuardAlert) => {
    if (seenIds.has(alert.id)) return;
    seenIds.add(alert.id);
    alerts.push(alert);
  };

  // 1. Cross-class & direct allergies
  const allergies = (input.allergies || []).map((a) => String(a || '').trim()).filter(Boolean);
  for (const rule of ALLERGY_CLASS_RULES) {
    const hasClassAllergy = allergies.some((a) => rule.allergyPattern.test(a));
    if (!hasClassAllergy) continue;
    if (rule.hardStopDrugs.test(drugName)) {
      pushAlert({
        id: `allergy-${rule.id}`,
        level: 'hard_stop',
        category: 'allergy',
        code: 'ALLERGY_CONFLICT',
        title: `${rule.label} allergy conflict`,
        detail: `Patient has documented ${rule.label} allergy. ${drugName} is contraindicated.`,
        requiresOverride: true,
      });
    } else if (rule.crossWarningDrugs?.test(drugName)) {
      pushAlert({
        id: `allergy-cross-${rule.id}`,
        level: 'warning',
        category: 'allergy',
        code: 'ALLERGY_CROSS_REACTIVITY',
        title: `${rule.label} cross-reactivity caution`,
        detail: rule.crossDetail || `Review cross-sensitivity between documented ${rule.label} allergy and ${drugName}.`,
        requiresOverride: true,
      });
    }
  }
  for (const rawAllergy of allergies) {
    const clean = rawAllergy.toLowerCase();
    if (clean.length >= 4 && !/none|nil|no known|nkda/i.test(clean) && drugLower.includes(clean)) {
      pushAlert({
        id: `allergy-direct-${clean.replace(/[^a-z0-9]/g, '')}`,
        level: 'hard_stop',
        category: 'allergy',
        code: 'ALLERGY_DIRECT',
        title: `Direct allergy match (${rawAllergy})`,
        detail: `Patient allergy list explicitly includes "${rawAllergy}", matching ${drugName}.`,
        requiresOverride: true,
      });
    }
  }

  // 2. Drug-drug interactions & duplicate therapeutic class
  const otherDrugs = (input.otherDrugs || []).map((d) => String(d || '').trim()).filter(Boolean);
  for (const other of otherDrugs) {
    for (const rule of INTERACTION_RULES) {
      const forward = rule.a.test(drugName) && rule.b.test(other);
      const reverse = rule.b.test(drugName) && rule.a.test(other);
      if (forward || reverse) {
        pushAlert({
          id: `ddi-${rule.id}`,
          level: rule.level,
          category: 'interaction',
          code: 'DRUG_INTERACTION',
          title: `${rule.title} (with ${other})`,
          detail: rule.detail,
          requiresOverride: rule.level === 'hard_stop',
        });
      }
    }

    for (const tc of THERAPEUTIC_CLASSES) {
      if (tc.pattern.test(drugName) && tc.pattern.test(other)) {
        const sameName = drugLower === other.toLowerCase();
        pushAlert({
          id: `dup-class-${tc.id}`,
          level: 'warning',
          category: 'duplicate',
          code: 'DUPLICATE_CLASS',
          title: sameName ? `Duplicate agent (${other})` : `Duplicate ${tc.label} therapy`,
          detail: `Patient already has active "${other}" in the ${tc.label} class. Avoid therapeutic duplication.`,
          requiresOverride: true,
        });
      }
    }
  }

  // 3. Renal impairment guard
  const hasCkdHistory = (input.chronicConditions || []).some((c) => /ckd|renal|kidney|nephro/i.test(c));
  const severeRenal =
    (typeof input.egfr === 'number' && input.egfr < 30) ||
    (typeof input.creatinineMgDl === 'number' && input.creatinineMgDl >= 2.0);
  const moderateRenal =
    severeRenal || (typeof input.egfr === 'number' && input.egfr < 60) || hasCkdHistory;

  if (severeRenal && /\bmetformin\b/i.test(drugName)) {
    pushAlert({
      id: 'renal-metformin',
      level: 'hard_stop',
      category: 'renal',
      code: 'RENAL_CONTRA',
      title: 'Metformin contraindicated in severe renal impairment',
      detail: `Renal markers (${input.egfr ? `eGFR ${input.egfr}` : `Cr ${input.creatinineMgDl}`}) show severe impairment. High lactic acidosis risk.`,
      requiresOverride: true,
    });
  } else if (
    severeRenal &&
    /gentamicin|ibuprofen|diclofenac|naproxen|tenofovir|nitrofurantoin/i.test(drugName)
  ) {
    pushAlert({
      id: 'renal-nephrotoxin',
      level: 'hard_stop',
      category: 'renal',
      code: 'RENAL_NEPHROTOXIN',
      title: 'Nephrotoxin / accumulation hazard in renal failure',
      detail: `${drugName} carries acute nephrotoxicity or toxic accumulation risk with severe renal impairment.`,
      requiresOverride: true,
    });
  } else if (
    moderateRenal &&
    /ciprofloxacin|augmentin|amoxicillin|enalapril|lisinopril|vancomycin|gentamicin|ibuprofen|diclofenac|metformin/i.test(
      drugName
    )
  ) {
    pushAlert({
      id: 'renal-adjust',
      level: 'warning',
      category: 'renal',
      code: 'RENAL_DOSE_ADJUST',
      title: 'Renal impairment dose check',
      detail: `Patient has documented renal/CKD flag${input.egfr ? ` (eGFR ${input.egfr})` : ''}. Verify renal dosing or safer alternative for ${drugName}.`,
      requiresOverride: true,
    });
  }

  // 4. Pregnancy / teratogen guard
  if (isPatientPregnant({ isPregnant: input.isPregnant, sex: input.sex, chronicConditions: input.chronicConditions })) {
    if (
      /doxycycline|tetracycline|ciprofloxacin|levofloxacin|warfarin|lisinopril|enalapril|ramipril|losartan|valsartan|valproate|isotretinoin|methotrexate|misoprostol/i.test(
        drugName
      )
    ) {
      pushAlert({
        id: 'preg-teratogen',
        level: 'hard_stop',
        category: 'pregnancy',
        code: 'PREG_CONTRA',
        title: 'Pregnancy / teratogenic contraindication',
        detail: `${drugName} is contraindicated or high-risk in pregnancy. Confirm gestational status and switch to a pregnancy-safe alternative.`,
        requiresOverride: true,
      });
    } else if (/ibuprofen|diclofenac|naproxen|indomethacin|aspirin/i.test(drugName)) {
      pushAlert({
        id: 'preg-nsaid',
        level: 'warning',
        category: 'pregnancy',
        code: 'PREG_NSAID_CAUTION',
        title: 'NSAID caution in pregnancy',
        detail: `Avoid NSAIDs in late gestation (premature ductus arteriosus closure / oligohydramnios risk); Paracetamol is preferred unless specifically indicated (e.g. low-dose aspirin for pre-eclampsia prophylaxis).`,
        requiresOverride: true,
      });
    }
  }

  // 5. Paediatric guard
  const ageYears = inferAgeYears(input.dob, input.ageYears);
  if (typeof ageYears === 'number') {
    if (ageYears < 12 && /\baspirin\b/i.test(drugName)) {
      pushAlert({
        id: 'paed-aspirin',
        level: 'hard_stop',
        category: 'paediatric',
        code: 'PAED_REYE_RISK',
        title: 'Paediatric Aspirin contraindication (Reye syndrome)',
        detail: `Patient age ${ageYears}y (<12y). Aspirin is contraindicated in children unless for specialized Kawasaki/cardiac indication.`,
        requiresOverride: true,
      });
    }
    if (ageYears < 8 && /doxycycline|tetracycline/i.test(drugName)) {
      pushAlert({
        id: 'paed-tetra',
        level: 'hard_stop',
        category: 'paediatric',
        code: 'PAED_DENTAL_RISK',
        title: 'Paediatric Tetracycline/Doxycycline contraindication',
        detail: `Patient age ${ageYears}y (<8y). Risk of permanent tooth discolouration and enamel hypoplasia.`,
        requiresOverride: true,
      });
    }
    if (ageYears < 18 && /ciprofloxacin|levofloxacin|ofloxacin/i.test(drugName)) {
      pushAlert({
        id: 'paed-quinolone',
        level: 'warning',
        category: 'paediatric',
        code: 'PAED_QUINOLONE_CAUTION',
        title: 'Paediatric fluoroquinolone caution',
        detail: `Patient age ${ageYears}y (<18y). Fluoroquinolones carry musculoskeletal/tendon caution in children unless no safer alternative exists.`,
        requiresOverride: true,
      });
    }
    if (ageYears < 14 && !input.weightKg && !/mg\/kg/i.test(input.notes || '')) {
      pushAlert({
        id: 'paed-weight-check',
        level: 'info',
        category: 'paediatric',
        code: 'PAED_WEIGHT_DOSING',
        title: 'Verify weight-based paediatric dose',
        detail: `Child age ${ageYears}y — record weight (kg) and confirm mg/kg dose for ${drugName}.`,
        requiresOverride: false,
      });
    }
  }

  // 6. Genotype / G6PD haemolysis guard
  const geno = String(input.genotype || '').toUpperCase().trim();
  const hasG6pdFlag = (input.chronicConditions || []).some((c) => /g6pd/i.test(c));
  if (geno === 'AS' || geno === 'SS' || geno === 'SC' || hasG6pdFlag) {
    if (/\bprimaquine\b/i.test(drugName)) {
      pushAlert({
        id: 'g6pd-primaquine',
        level: hasG6pdFlag || geno === 'SS' || geno === 'SC' ? 'hard_stop' : 'warning',
        category: 'genotype',
        code: 'G6PD_HAEMOLYSIS',
        title: 'Primaquine haemolysis risk',
        detail: `Documented ${hasG6pdFlag ? 'G6PD deficiency' : `genotype ${geno}`}. Primaquine may trigger severe acute haemolysis.`,
        requiresOverride: true,
      });
    } else if (/cotrimoxazole|septrin|dapsone|nitrofurantoin|sulfadoxine|fansidar/i.test(drugName)) {
      pushAlert({
        id: 'g6pd-oxidant',
        level: 'warning',
        category: 'genotype',
        code: 'GENOTYPE_OXIDANT_CAUTION',
        title: 'Oxidant drug haemolysis caution',
        detail: `Patient ${hasG6pdFlag ? 'G6PD flag' : `genotype ${geno}`}. Monitor for haemolysis when using ${drugName}.`,
        requiresOverride: true,
      });
    }
  }

  // 7. Dosing completeness
  if (drugName && !/mg|mcg|ml|iu|\bg\b|tab|cap|drop/i.test(drugName) && !input.notes?.trim()) {
    pushAlert({
      id: 'dosing-sig',
      level: 'info',
      category: 'dosing',
      code: 'DOSING_INCOMPLETE',
      title: 'Confirm strength and frequency',
      detail: 'Document strength, route, and regimen frequency in prescription notes.',
      requiresOverride: false,
    });
  }

  const hardStopCount = alerts.filter((a) => a.level === 'hard_stop').length;
  const warningCount = alerts.filter((a) => a.level === 'warning').length;
  const infoCount = alerts.filter((a) => a.level === 'info').length;
  const highestLevel: PrescriptionSafetyReport['highestLevel'] =
    hardStopCount > 0 ? 'hard_stop' : warningCount > 0 ? 'warning' : infoCount > 0 ? 'info' : 'none';

  return {
    drugName,
    safe: hardStopCount === 0,
    hardStopCount,
    warningCount,
    infoCount,
    highestLevel,
    alerts,
  };
}
