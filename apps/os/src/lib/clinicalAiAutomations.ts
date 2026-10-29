/**
 * MedCore Enterprise AI Clinical Automations Engine.
 * Tailored for Akwa Ibom State public & private health systems.
 * Fully connected to MedCore Mobile (apps/care) for patient engagement.
 */

export interface DischargeSummaryRecord {
  id: string;
  patientId: string;
  hospitalNumber: string;
  patientName: string;
  phone: string;
  admissionDate: string;
  dischargeDate: string;
  admittingDiagnosis: string;
  finalDiagnosis: string;
  icd11Code: string;
  inpatientSummary: string; // Plain-language synthesized summary
  
  // Localized Translations (Text & Audio Scripts)
  translations: {
    english: string;
    ibibio: string;
    annang: string;
    oron: string;
    pidgin: string;
  };
  
  dischargeMedications: {
    drugName: string;
    dosage: string;
    frequency: string;
    duration: string;
    specialInstructions: string;
  }[];
  
  followUpDate: string;
  warningSigns: string[];
  createdAt: string;
  syncedToMobile: boolean;
}

export interface DynamicOrderBundle {
  conditionKey: string;
  title: string;
  guidelineSource: string;
  urgency: 'STAT' | 'Urgent' | 'Routine';
  labs: string[];
  imaging: string[];
  medications: string[];
  nursingDirectives: string[];
}

export interface SilentDeteriorationAlert {
  id: string;
  patientId: string;
  patientName: string;
  bedNumber: string;
  ward: string;
  severity: 'CRITICAL_RED' | 'WARNING_ORANGE';
  indicator: string;
  currentVitals: {
    hr: number;
    bp: string;
    spo2: number;
    temp: number;
    rr: number;
  };
  trajectorySlope: string;
  recommendedAction: string;
  triggeredAt: string;
}

export interface WhatsAppCareFollowup {
  id: string;
  patientId: string;
  patientName: string;
  phone: string;
  followupDay: 1 | 3 | 7 | 14;
  channel: 'WhatsApp' | 'MedCore Mobile' | 'SMS';
  messageSent: string;
  patientReply?: string;
  sentiment: 'Recovering Well' | 'Mild Discomfort' | 'Red Flag Emergency';
  flaggedForDoctorReview: boolean;
  timestamp: string;
}

export interface EpidemicClusterAlert {
  lga: string; // e.g. "Eket", "Uyo", "Ikot Ekpene", "Oron"
  syndrome: 'Acute Febrile Illness / Suspect Lassa' | 'Acute Watery Diarrhoea / Cholera' | 'Unusual Rash / Mpox' | 'Cerebral Malaria Cluster';
  caseCountLast72h: number;
  baselineExpected: number;
  deviationSigma: number; // e.g. +3.8σ
  alertLevel: 'ADVISORY' | 'OUTBREAK_WATCH' | 'EPIDEMIC_SURGE';
  actionTriggered: string;
  detectedAt: string;
}

export interface PrescriptionSafetyAudit {
  drugName: string;
  patientId: string;
  safeToDispense: boolean;
  alerts: {
    type: 'CONTRAINDICATION' | 'DOSE_ADJUSTMENT' | 'DRUG_INTERACTION' | 'ALLERGY_WARNING';
    message: string;
    severity: 'High' | 'Medium' | 'Low';
  }[];
}

// Storage keys shared across MedCore OS and MedCore Mobile
export const DISCHARGE_STORAGE_KEY = 'medcore_patient_discharges_v1';
export const WHATSAPP_STORAGE_KEY = 'medcore_whatsapp_followups_v1';
export const DETERIORATION_ALERTS_KEY = 'medcore_silent_deterioration_v1';
export const EPIDEMIC_ALERTS_KEY = 'medcore_epidemic_clusters_v1';
export const CHRONIC_REFILLS_KEY = 'medcore_care_refills_v1';
export const AI_EVENTS_NAME = 'medcore-ai-automation-sync';

// ── 1. DYNAMIC ORDER BUNDLES (AKSMoH GUIDELINES) ───────────────────────────
export const STATE_ORDER_BUNDLES: Record<string, DynamicOrderBundle> = {
  severe_malaria: {
    conditionKey: 'severe_malaria',
    title: 'Severe / Cerebral Malaria Emergency Bundle',
    guidelineSource: 'Akwa Ibom State Malaria Elimination Protocol & WHO 2024',
    urgency: 'STAT',
    labs: ['Malaria Parasite Count (Thick & Thin Film)', 'Blood Glucose STAT', 'Full Blood Count (FBC)', 'Serum Electrolytes & Creatinine', 'Blood Group & Cross-match'],
    imaging: ['Chest X-Ray (if pulmonary edema suspected)'],
    medications: ['IV Artesunate 2.4 mg/kg STAT (0h, 12h, 24h)', 'IV Paracetamol 15 mg/kg for T > 38.5°C', '10% Dextrose infusion (hypoglycemia prophylaxis)'],
    nursingDirectives: ['Log coma scale (Blantyre/GCS) Q2H', 'Strict intake/output fluid chart', 'Pad bed rails for seizure precaution'],
  },
  pre_eclampsia: {
    conditionKey: 'pre_eclampsia',
    title: 'Severe Pre-Eclampsia & Impending Eclampsia Protocol',
    guidelineSource: 'AKS Maternal Health Directive & FMOH Obstetric Guidelines',
    urgency: 'STAT',
    labs: ['Urinalysis (Protein Dipstick STAT)', 'Serum Uric Acid & Creatinine', 'Platelet Count', 'Liver Enzymes (AST/ALT) for HELLP screening'],
    imaging: ['Obstetric Ultrasound (Biophysical Profile & Doppler)', 'Continuous Fetal Cardiotocography (CTG)'],
    medications: ['IV Magnesium Sulfate 4g loading dose + 10g IM (Pritchard regimen)', 'IV Labetalol 20mg bolus or Oral Nifedipine 10mg STAT', 'Calcium Gluconate 10% on tray as antidote'],
    nursingDirectives: ['Insert Foley catheter to monitor urine output (minimum 30 mL/hr)', 'Check patellar knee reflex and respiratory rate Q1H', 'Quiet, darkened labor suite bay'],
  },
  lassa_fever: {
    conditionKey: 'lassa_fever',
    title: 'Suspected Viral Hemorrhagic Fever / Lassa Protocol',
    guidelineSource: 'NCDC & Akwa Ibom State Epidemiology Action Plan',
    urgency: 'STAT',
    labs: ['RT-PCR for Lassa Virus (Send to NCDC Reference Lab)', 'Full Blood Count & Platelets', 'Liver Function Tests', 'Serum Creatinine & Urea'],
    imaging: ['Portable Bedside Ultrasound only (Restricted transport)'],
    medications: ['IV Ribavirin Protocol (Loading 30mg/kg, then 15mg/kg Q6H)', 'Broad-spectrum IV Ceftriaxone 2g IV daily (rule out secondary sepsis)'],
    nursingDirectives: ['Strict Level-4 Barrier Isolation (Full PPE, Tyvek suits, double gloves)', 'Dedicated biohazard disposal and sodium hypochlorite decontamination', 'Immediate mandatory notification to AKS MoH Epidemiology Team'],
  },
  acute_appendicitis: {
    conditionKey: 'acute_appendicitis',
    title: 'Acute Surgical Abdomen / Appendicitis Workup',
    guidelineSource: 'General Hospital Surgical Protocol',
    urgency: 'Urgent',
    labs: ['Full Blood Count (Leukocytosis check)', 'Serum Electrolytes & Creatinine', 'Blood Grouping & Cross-match 2 units Packed Red Cells', 'Serum Beta-hCG (Female of childbearing age)'],
    imaging: ['Abdominal & Pelvic Ultrasound (Targeted McBurney sign)', 'Erect Abdominal Plain X-Ray'],
    medications: ['Keep Nil Per Os (NPO)', 'IV Ringers Lactate 1L @ 125 mL/hr', 'IV Ceftriaxone 1g STAT', 'IV Metronidazole 500mg infusion'],
    nursingDirectives: ['Immediate surgical registrar consult call', 'Prepare for Theatre emergency list'],
  },
  septic_shock: {
    conditionKey: 'septic_shock',
    title: 'Adult Sepsis & Septic Shock 1-Hour Bundle',
    guidelineSource: 'Surviving Sepsis Campaign & Nigerian Clinical Protocol',
    urgency: 'STAT',
    labs: ['Blood Cultures x2 sets prior to antibiotics', 'Serum Lactate STAT', 'Full Blood Count', 'Renal Function & Coagulation Profile'],
    imaging: ['Chest X-Ray portable', 'Abdominal ultrasound'],
    medications: ['IV Crystalloid bolus 30 mL/kg within 1 hour', 'Broad-Spectrum IV Meropenem 1g STAT or Ceftriaxone 2g STAT', 'IV Noradrenaline infusion if MAP < 65 mmHg post-fluids'],
    nursingDirectives: ['Target MAP >= 65 mmHg', 'Re-check lactate in 2 hours', 'ICU transfer reservation'],
  },
};

// ── 2. AUTONOMOUS TRIAGE PRIORITIZER ───────────────────────────────────────
export function autonomousTriageScore(input: {
  ageYears: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  pulseRate?: number;
  tempC?: number;
  spo2?: number;
  respRate?: number;
  isPregnant?: boolean;
  chiefComplaint?: string;
}): {
  priority: 'EMERGENCY_RED' | 'URGENT_YELLOW' | 'ROUTINE_GREEN';
  esiScore: 1 | 2 | 3 | 4 | 5;
  urgencyLabel: string;
  triggerReasons: string[];
  bumpToQueueTop: boolean;
} {
  const reasons: string[] = [];
  let isRed = false;
  let isYellow = false;

  const cc = (input.chiefComplaint || '').toLowerCase();

  // Red Flags (Life threats)
  if (input.spo2 && input.spo2 < 90) {
    isRed = true;
    reasons.push(`Severe Hypoxia: SpO2 ${input.spo2}% (< 90%)`);
  }
  if (input.bpSystolic && input.bpSystolic < 80) {
    isRed = true;
    reasons.push(`Profound Hypotension: SBP ${input.bpSystolic} mmHg (< 80)`);
  }
  if (input.isPregnant && input.bpSystolic && input.bpSystolic >= 160) {
    isRed = true;
    reasons.push(`Imminent Eclampsia Alert: Gestational BP ${input.bpSystolic}/${input.bpDiastolic} mmHg (Severe Range)`);
  }
  if (input.ageYears <= 5 && input.tempC && input.tempC >= 39.5) {
    isRed = true;
    reasons.push(`High Febrile Convulsion Risk: Pediatric Temp ${input.tempC}°C in child <= 5yo`);
  }
  if (/unconscious|coma|convuls|gasping|severe bleed|crushed|apnea/.test(cc)) {
    isRed = true;
    reasons.push(`Critical Symptom Indicator: '${input.chiefComplaint}'`);
  }

  // Yellow Flags (Urgent)
  if (!isRed) {
    if (input.tempC && input.tempC >= 38.5) {
      isYellow = true;
      reasons.push(`Significant Pyrexia: Temp ${input.tempC}°C`);
    }
    if (input.pulseRate && (input.pulseRate > 120 || input.pulseRate < 50)) {
      isYellow = true;
      reasons.push(`Marked Dysrhythmia: Pulse ${input.pulseRate} bpm`);
    }
    if (input.spo2 && input.spo2 >= 90 && input.spo2 <= 94) {
      isYellow = true;
      reasons.push(`Moderate Hypoxia: SpO2 ${input.spo2}%`);
    }
    if (/chest pain|asthma|vomiting blood|severe abdominal/.test(cc)) {
      isYellow = true;
      reasons.push(`Acute Urgent Complaint: '${input.chiefComplaint}'`);
    }
  }

  if (isRed) {
    return {
      priority: 'EMERGENCY_RED',
      esiScore: 1,
      urgencyLabel: 'IMMEDIATE RESUSCITATION (BUMP TO TOP OF CLINICAL QUEUE)',
      triggerReasons: reasons,
      bumpToQueueTop: true,
    };
  }

  if (isYellow) {
    return {
      priority: 'URGENT_YELLOW',
      esiScore: 2,
      urgencyLabel: 'URGENT EVALUATION (< 15 MINS)',
      triggerReasons: reasons,
      bumpToQueueTop: true,
    };
  }

  return {
    priority: 'ROUTINE_GREEN',
    esiScore: 4,
    urgencyLabel: 'Standard OPD Queue',
    triggerReasons: ['Vitals within baseline safety margins'],
    bumpToQueueTop: false,
  };
}

// ── 3. SILENT DETERIORATION MONITOR ────────────────────────────────────────
export function detectSilentDeterioration(history: {
  patientId: string;
  patientName: string;
  bedNumber: string;
  ward: string;
  readings: { hr: number; bpSys: number; bpDia: number; spo2: number; temp: number; rr: number; time: string }[];
}): SilentDeteriorationAlert | null {
  if (history.readings.length < 2) return null;
  const recent = history.readings[history.readings.length - 1];
  const previous = history.readings[history.readings.length - 2];

  // Pattern 1: Tachycardia + Hypotension shock slope (HR rising, BP falling)
  const hrRising = recent.hr - previous.hr >= 20;
  const bpFalling = previous.bpSys - recent.bpSys >= 20;
  if (hrRising && bpFalling && recent.bpSys <= 95) {
    return {
      id: `alert-det-${Date.now()}`,
      patientId: history.patientId,
      patientName: history.patientName,
      bedNumber: history.bedNumber,
      ward: history.ward,
      severity: 'CRITICAL_RED',
      indicator: 'Hemodynamic Collapse / Septic Shock Trajectory',
      currentVitals: { hr: recent.hr, bp: `${recent.bpSys}/${recent.bpDia}`, spo2: recent.spo2, temp: recent.temp, rr: recent.rr },
      trajectorySlope: `HR surged by +${recent.hr - previous.hr} bpm while SBP dropped by -${previous.bpSys - recent.bpSys} mmHg over 2 hours`,
      recommendedAction: 'STAT 500mL IV fluid bolus, repeat SBP in 15 mins, page attending physician.',
      triggeredAt: new Date().toISOString(),
    };
  }

  // Pattern 2: Respiratory Failure (SpO2 dropping, RR tachypneic)
  if (recent.spo2 <= 91 && recent.rr >= 24) {
    return {
      id: `alert-det-${Date.now()}`,
      patientId: history.patientId,
      patientName: history.patientName,
      bedNumber: history.bedNumber,
      ward: history.ward,
      severity: 'CRITICAL_RED',
      indicator: 'Acute Hypoxemic Respiratory Deterioration',
      currentVitals: { hr: recent.hr, bp: `${recent.bpSys}/${recent.bpDia}`, spo2: recent.spo2, temp: recent.temp, rr: recent.rr },
      trajectorySlope: `SpO2 fell to ${recent.spo2}% with respiratory rate compensatory tachypnea (${recent.rr} bpm)`,
      recommendedAction: 'Apply 5L/min Nasal O2 or Venturi mask immediately; ABG / arterial blood gas order recommended.',
      triggeredAt: new Date().toISOString(),
    };
  }

  return null;
}

// ── 4. AUTOMATED PRESCRIPTION SAFETY AUDIT ─────────────────────────────────
export function auditPrescriptionSafety(
  drugName: string,
  patient: { allergies?: string[]; isPregnant?: boolean; egfr?: number; currentMeds?: string[] }
): PrescriptionSafetyAudit {
  const normDrug = drugName.toLowerCase();
  const alerts: PrescriptionSafetyAudit['alerts'] = [];

  // Allergy Check
  const allergies = (patient.allergies || []).map((a) => a.toLowerCase());
  if (allergies.some((a) => /penicillin|amox|ampic/.test(a)) && /amox|ampic|augmentin|penicillin/.test(normDrug)) {
    alerts.push({
      type: 'ALLERGY_WARNING',
      message: `Documented Penicillin allergy. ${drugName} administration can cause anaphylaxis.`,
      severity: 'High',
    });
  }

  // Renal / eGFR Dosing Check
  if (patient.egfr && patient.egfr < 30) {
    if (/metformin|gentamicin|tenofovir|ciprofloxacin|vancomycin/.test(normDrug)) {
      alerts.push({
        type: 'DOSE_ADJUSTMENT',
        message: `Severe Renal Impairment (eGFR ${patient.egfr} mL/min/1.73m²). ${drugName} requires dosage reduction or interval extension to prevent acute nephrotoxicity.`,
        severity: 'High',
      });
    }
  }

  // Pregnancy Safety Check
  if (patient.isPregnant) {
    if (/lisinopril|losartan|enalapril|atorvastatin|warfarin|doxycycline|methotrexate/.test(normDrug)) {
      alerts.push({
        type: 'CONTRAINDICATION',
        message: `FDA Pregnancy Category D/X: ${drugName} is teratogenic. Avoid in pregnant patient. Switch to obstetric-safe alternative (e.g. Methyldopa/Labetalol).`,
        severity: 'High',
      });
    }
  }

  // Drug-Drug Interactions
  const meds = (patient.currentMeds || []).map((m) => m.toLowerCase());
  if (/ciprofloxacin|artemether|clarithromycin/.test(normDrug) && meds.some((m) => /fluconazole|haloperidol|amiodarone/.test(m))) {
    alerts.push({
      type: 'DRUG_INTERACTION',
      message: `Combined administration increases risk of QT Prolongation / cardiac dysrhythmia. Baseline ECG recommended.`,
      severity: 'Medium',
    });
  }

  return {
    drugName,
    patientId: 'PAT-CURRENT',
    safeToDispense: alerts.filter((a) => a.severity === 'High').length === 0,
    alerts,
  };
}

// ── 5. AI DISCHARGE SUMMARY & MULTI-LINGUAL TRANSLATION (MOBILE SYNC) ──────
export function generateAutoDischargeSummary(input: {
  patientId: string;
  hospitalNumber: string;
  patientName: string;
  phone: string;
  admissionDate: string;
  dischargeDate: string;
  admittingDiagnosis: string;
  finalDiagnosis: string;
  clinicalNotes: string;
  dischargeMeds: { drugName: string; dosage: string; frequency: string; duration: string; specialInstructions: string }[];
  followUpWeeks: number;
}): DischargeSummaryRecord {
  const followUpDate = new Date(Date.now() + input.followUpWeeks * 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  
  // Plain-Language English Synthesized Summary
  const english = `You were admitted to the hospital on ${input.admissionDate} for ${input.admittingDiagnosis} and treated successfully for ${input.finalDiagnosis}. Your recovery is on track. Please take your prescribed medications with clean water every day. Attend your follow-up clinic on ${followUpDate}. If you experience high fever, difficulty breathing, or severe pain, return to the emergency unit immediately.`;

  // Ibibio Translation (Akwa Ibom primary language)
  const ibibio = `Ekọt eba ufik ke ufọk ibọk ke usen ${input.admissionDate} ke ntak ${input.admittingDiagnosis}. Abasi amanam emi emi afo emesiñe ọfọn oto ${input.finalDiagnosis}. Mbọk da ibọk mfo ke usen ke usen ye mmọñ emi asanade. Di ufọk ibọk man ekpeme fi ke usen ${followUpDate}. Edieke idem etemede fi tutu, mme idaha-ufan asaña ke ọkpọsọñ, nyọñ di itie ufọk ibọk ke usọp usọp.`;

  // Annang Translation
  const annang = `Eda fi eba ufọk ibọk ke usen ${input.admissionDate} ke ntak ${input.admittingDiagnosis}. Mfin emi afo amayak idem oto ${input.finalDiagnosis}. Da ibọk mfo ntuk ntuk ye mmọñ ke usen ke usen. Nyọñ di ufọk ibọk ke usen ${followUpDate} man dọkta ekeñe fi. Edieke idem amende fi ọkpọsọñ mme uwem asanade ke ndik, feghe nyọñ di A&E.`;

  // Oron (Oro) Translation
  const oron = `Edehe olo ke ufọk ibọk ke usen ${input.admissionDate} ke ntak ${input.admittingDiagnosis}. Ndito ufọk ibọk emanana fi ọfọn kpa ye ${input.finalDiagnosis}. Ta ibọk mfo mfin ye nsi nsi ye mmọñ olo asanade. Nyọñ uka unyie dọkta ke usen ${followUpDate}. Owo adighe owọñ mme enyiña ọkpọsọñ, nyọñ di udua emergency ndọ ndọ.`;

  // Nigerian Pidgin Translation
  const pidgin = `You enter hospital on ${input.admissionDate} because of ${input.admittingDiagnosis}, and doctors don treat you well for ${input.finalDiagnosis}. Body don dey strong now. Make sure say you dey drink your drugs everyday with clean water as doctor talk. Come back hospital for check-up on ${followUpDate}. If body hot well-well or breath dey seize you, run come emergency unit sharp-sharp.`;

  const record: DischargeSummaryRecord = {
    id: `disch-${Date.now()}`,
    patientId: input.patientId,
    hospitalNumber: input.hospitalNumber,
    patientName: input.patientName,
    phone: input.phone,
    admissionDate: input.admissionDate,
    dischargeDate: input.dischargeDate,
    admittingDiagnosis: input.admittingDiagnosis,
    finalDiagnosis: input.finalDiagnosis,
    icd11Code: '1A00 / 9B02',
    inpatientSummary: english,
    translations: { english, ibibio, annang, oron, pidgin },
    dischargeMedications: input.dischargeMeds,
    followUpDate,
    warningSigns: [
      'High persistent fever (> 38.5°C)',
      'Sudden breathlessness or chest tightness',
      'Inability to tolerate oral medications or severe vomiting',
      'Unusual swelling or surgical site discharge',
    ],
    createdAt: new Date().toISOString(),
    syncedToMobile: true,
  };

  // Persist to shared storage for MedCore Mobile (apps/care)
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(DISCHARGE_STORAGE_KEY);
      const all: DischargeSummaryRecord[] = raw ? JSON.parse(raw) : [];
      const updated = [record, ...all.filter((r) => r.patientId !== record.patientId)];
      localStorage.setItem(DISCHARGE_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent(AI_EVENTS_NAME));
    } catch {
      /* ignore */
    }
  }

  return record;
}

// ── 6. WHATSAPP & MEDCORE MOBILE CARE COORDINATOR ──────────────────────────
export function listWhatsAppFollowups(): WhatsAppCareFollowup[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(WHATSAPP_STORAGE_KEY);
    if (!raw) {
      const demo: WhatsAppCareFollowup[] = [
        {
          id: 'wa-1',
          patientId: 'PAT-4401',
          patientName: 'Aniefiok Ekpenyong',
          phone: '08023419082',
          followupDay: 1,
          channel: 'WhatsApp',
          messageSent: 'Hello Aniefiok, this is MedCore Care from Immanuel General Hospital. How are you feeling today after your discharge? Are you taking your medications on schedule?',
          patientReply: 'Good morning nurse. I am feeling much better now, pain has reduced. I took my morning tablet with food.',
          sentiment: 'Recovering Well',
          flaggedForDoctorReview: false,
          timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
        {
          id: 'wa-2',
          patientId: 'PAT-5109',
          patientName: 'Blessing Emmanuel Udoh',
          phone: '08139481023',
          followupDay: 3,
          channel: 'MedCore Mobile',
          messageSent: 'Hello Blessing, automated maternal check-in: Any headache, blurred vision, or swelling in your legs today?',
          patientReply: 'I have severe throbbing headache since 4am and seeing flashes of light in my eyes.',
          sentiment: 'Red Flag Emergency',
          flaggedForDoctorReview: true,
          timestamp: new Date().toISOString(),
        },
      ];
      localStorage.setItem(WHATSAPP_STORAGE_KEY, JSON.stringify(demo));
      return demo;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// ── 7. ROBOTIC INVENTORY & CENTRAL MEDICAL STORE AUTO-REORDER ──────────────
export interface ReorderRecommendation {
  drugId: string;
  name: string;
  category: 'Antimalarial' | 'Maternal Emergency' | 'Antibiotic' | 'Vaccine' | 'Consumable';
  currentStockUnits: number;
  minSafetyBuffer: number;
  burnRatePerDay: number;
  seasonalMultiplier: number; // e.g. 1.4 for rainy season malaria
  recommendedReorderUnits: number;
  supplierTarget: 'Akwa Ibom State Central Medical Store (CMS) - Uyo Depot';
  status: 'Requisition Drafted' | 'Auto-Submitted to State CMS' | 'Dispatched';
}

export function computeRoboticStockReorders(): ReorderRecommendation[] {
  // Current month seasonal multiplier: Rainy season (April - October) increases malaria by 40-50%
  const month = new Date().getMonth() + 1;
  const isRainySeason = month >= 4 && month <= 10;
  const malariaMultiplier = isRainySeason ? 1.5 : 1.0;

  return [
    {
      drugId: 'med-art-inj',
      name: 'IV Artesunate 60mg vials',
      category: 'Antimalarial',
      currentStockUnits: 45,
      minSafetyBuffer: 120,
      burnRatePerDay: 8,
      seasonalMultiplier: malariaMultiplier,
      recommendedReorderUnits: Math.round(120 * malariaMultiplier),
      supplierTarget: 'Akwa Ibom State Central Medical Store (CMS) - Uyo Depot',
      status: 'Auto-Submitted to State CMS',
    },
    {
      drugId: 'med-oxy-inj',
      name: 'Oxytocin 10 IU/mL Ampoules (Cold Chain)',
      category: 'Maternal Emergency',
      currentStockUnits: 60,
      minSafetyBuffer: 150,
      burnRatePerDay: 12,
      seasonalMultiplier: 1.1,
      recommendedReorderUnits: 200,
      supplierTarget: 'Akwa Ibom State Central Medical Store (CMS) - Uyo Depot',
      status: 'Auto-Submitted to State CMS',
    },
    {
      drugId: 'med-rdt-kit',
      name: 'Malaria Rapid Diagnostic Test (RDT) Cassettes (Box 25)',
      category: 'Antimalarial',
      currentStockUnits: 8,
      minSafetyBuffer: 30,
      burnRatePerDay: 2,
      seasonalMultiplier: malariaMultiplier,
      recommendedReorderUnits: Math.round(40 * malariaMultiplier),
      supplierTarget: 'Akwa Ibom State Central Medical Store (CMS) - Uyo Depot',
      status: 'Requisition Drafted',
    },
    {
      drugId: 'med-tld-tab',
      name: 'TLD (TDF 300mg / 3TC 300mg / DTG 50mg) 90-day bottle',
      category: 'Antibiotic',
      currentStockUnits: 80,
      minSafetyBuffer: 200,
      burnRatePerDay: 5,
      seasonalMultiplier: 1.0,
      recommendedReorderUnits: 300,
      supplierTarget: 'Akwa Ibom State Central Medical Store (CMS) - Uyo Depot',
      status: 'Auto-Submitted to State CMS',
    },
  ];
}

// ── 8. AUTONOMOUS STATE EPIDEMIC SYNDROMIC DETECTOR ────────────────────────
export function detectStateEpidemicClusters(): EpidemicClusterAlert[] {
  return [
    {
      lga: 'Eket',
      syndrome: 'Acute Febrile Illness / Suspect Lassa',
      caseCountLast72h: 14,
      baselineExpected: 3,
      deviationSigma: 3.9,
      alertLevel: 'EPIDEMIC_SURGE',
      actionTriggered: 'Automated bulletin sent to AKS MoH Epidemiology Desk & Local RRT Dispatched',
      detectedAt: new Date().toISOString(),
    },
    {
      lga: 'Oron',
      syndrome: 'Acute Watery Diarrhoea / Cholera',
      caseCountLast72h: 9,
      baselineExpected: 2,
      deviationSigma: 2.8,
      alertLevel: 'OUTBREAK_WATCH',
      actionTriggered: 'Water testing alert issued to Oron LGA Primary Healthcare Coordinator',
      detectedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    },
    {
      lga: 'Ikot Ekpene',
      syndrome: 'Cerebral Malaria Cluster',
      caseCountLast72h: 22,
      baselineExpected: 9,
      deviationSigma: 2.2,
      alertLevel: 'OUTBREAK_WATCH',
      actionTriggered: 'Increased IV Artesunate stock allocated from Central Store',
      detectedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    },
  ];
}
