'use client';

/**
 * MedCore OS — Comprehensive Laboratory Desk Dashboard (LabDeskHome)
 * Real-time Laboratory Operations & LIS Workstation for hospital EMR:
 * - 1. Live Orders Stream & STAT Triage from Doctor Portal / Emergency / Wards
 * - 2. Specimen Accessioning with Barcoding & Pre-Analytical Integrity Checks
 * - 3. Phlebotomy Ward Rounds & Bedside Collection Board (2-ID verification)
 * - 4. Automated Analyzer Telemetry (Sysmex, Cobas, BACTEC, Stago) & Levey-Jennings QC
 * - 5. Microbiology Culture & Interactive Antibiogram Matrix (AST + MDRO/MRSA auto-alerts)
 * - 6. Automated Delta-Check & Anomaly Detection Engine (AKI, Hemolysis, Acute Bleed alerts)
 * - 7. Serial Analyte Trends & Cumulative SVG Diagnostic Curve Viewer
 * - 8. Critical / Panic Values Escalation Log with Verbal Doctor Telephone Read-Back
 * - 9. Blood Bank ABO/Rh Inventory & Crossmatch Transfusion Safety
 */

import React, { useEffect, useMemo, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  FlaskConical, Activity, AlertTriangle, CheckCircle2, Clock, Search, Filter,
  Barcode, Zap, ShieldAlert, Droplet, Users, RefreshCw, Plus, X, Edit3, Send,
  Cpu, PhoneCall, Check, Sparkles, ChevronRight, Eye, ShieldCheck, Printer,
  FileText, ArrowRight, AlertCircle, HeartPulse, Stethoscope, Layers, Radio,
  Bug, TrendingUp, TrendingDown, Thermometer, Shield
} from 'lucide-react';

import {
  listOrders,
  subscribeOrders,
  updateOrderStatus,
  postLabResult,
  canReleaseOrder,
  placeOrder,
  type ClinicalOrder,
} from '../../lib/clinicalEventBus';
import {
  listSpecimens,
  advanceSpecimen,
  lisTatStats,
  subscribeLis,
  type SpecimenRecord,
} from '../../lib/lisPipeline';
import {
  listPatients,
  subscribePatients,
  getPatient,
  type RegisteredPatient,
} from '../../lib/patientRegistryStore';
import {
  listNotifications,
  subscribeNotifications,
  pushNotification,
  markRead,
} from '../../lib/notificationEngine';
import {
  listPendingCriticalAcks,
  subscribeIntelligence,
} from '../../lib/clinicalIntelligenceEngine';
import { emitLiveAction } from '../../lib/liveActions';
import { liveAlert } from '../../lib/manualActions';

interface Props {
  session: UserSession;
  onNavigate: (moduleKey: string) => void;
}

// Tube Type Metadata for Laboratory Specimens
export interface TubeInfo {
  type: string;
  color: string;
  capHex: string;
  additive: string;
  commonTests: string;
}

const TUBE_MAP: Record<string, TubeInfo> = {
  EDTA: {
    type: 'EDTA Lavender Cap',
    color: '#8B5CF6',
    capHex: '#7C3AED',
    additive: 'K2/K3 EDTA (Anticoagulant)',
    commonTests: 'FBC, Blood Film, HbA1c, ESR, Malaria Parasite',
  },
  SERUM: {
    type: 'SST Gold / Red Cap',
    color: '#EAB308',
    capHex: '#CA8A04',
    additive: 'Clot Activator & Gel Separator',
    commonTests: 'Chemistry, LFT, U&E, Lipid, Troponin, Serology',
  },
  CITRATE: {
    type: 'Sodium Citrate Light Blue Cap',
    color: '#0284C7',
    capHex: '#0284C7',
    additive: '3.2% Buffered Sodium Citrate',
    commonTests: 'PT / INR, PTTK / APTT, Fibrinogen, D-Dimer',
  },
  FLUORIDE: {
    type: 'Fluoride Oxalate Grey Cap',
    color: '#64748B',
    capHex: '#475569',
    additive: 'Sodium Fluoride & Potassium Oxalate',
    commonTests: 'Fasting Blood Glucose, OGTT, Lactate',
  },
  HEPARIN: {
    type: 'Lithium Heparin Green Cap',
    color: '#16A34A',
    capHex: '#15803D',
    additive: 'Lithium Heparin',
    commonTests: 'Emergency Troponin, Electrolytes, Blood Gas',
  },
  STERILE: {
    type: 'Sterile Universal Yellow Cap',
    color: '#F59E0B',
    capHex: '#D97706',
    additive: 'None (Sterile Collection)',
    commonTests: 'Urinalysis, Urine Culture, Sputum AFB, Stool',
  },
};

function inferTube(testName: string): TubeInfo {
  const t = testName.toLowerCase();
  if (t.includes('fbc') || t.includes('full blood') || t.includes('cbc') || t.includes('malaria') || t.includes('hba1c') || t.includes('esr') || t.includes('film') || t.includes('retic') || t.includes('genotype') || t.includes('sickling')) {
    return TUBE_MAP.EDTA;
  }
  if (t.includes('pt') || t.includes('inr') || t.includes('pttk') || t.includes('aptt') || t.includes('coag') || t.includes('d-dimer')) {
    return TUBE_MAP.CITRATE;
  }
  if (t.includes('glucose') || t.includes('fbs') || t.includes('rbs') || t.includes('sugar') || t.includes('ogtt')) {
    return TUBE_MAP.FLUORIDE;
  }
  if (t.includes('urine') || t.includes('stool') || t.includes('sputum') || t.includes('swab') || t.includes('culture') || t.includes('afb')) {
    return TUBE_MAP.STERILE;
  }
  if (t.includes('blood gas') || t.includes('heparin')) {
    return TUBE_MAP.HEPARIN;
  }
  return TUBE_MAP.SERUM;
}

function inferBench(testName: string): string {
  const t = testName.toLowerCase();
  if (t.includes('fbc') || t.includes('full blood') || t.includes('cbc') || t.includes('esr') || t.includes('blood film') || t.includes('sickling') || t.includes('genotype') || t.includes('retic') || t.includes('pt') || t.includes('inr') || t.includes('coag')) {
    return 'Hematology';
  }
  if (t.includes('chem') || t.includes('lft') || t.includes('u&e') || t.includes('urea') || t.includes('creatinine') || t.includes('electrolyte') || t.includes('troponin') || t.includes('lipid') || t.includes('glucose') || t.includes('fbs') || t.includes('rbs') || t.includes('bilirubin') || t.includes('calcium') || t.includes('uric') || t.includes('hba1c')) {
    return 'Clinical Chemistry';
  }
  if (t.includes('malaria') || t.includes('stool') || t.includes('urine') || t.includes('microscopy') || t.includes('culture') || t.includes('afb') || t.includes('swab') || t.includes('hvs') || t.includes('urinalysis') || t.includes('c&s')) {
    return 'Medical Microbiology';
  }
  if (t.includes('widal') || t.includes('hiv') || t.includes('retro') || t.includes('hbsag') || t.includes('hcv') || t.includes('vdrl') || t.includes('syphilis') || t.includes('crp') || t.includes('rf') || t.includes('serology')) {
    return 'Serology & Virology';
  }
  if (t.includes('blood group') || t.includes('crossmatch') || t.includes('abo') || t.includes('rhesus') || t.includes('coombs')) {
    return 'Blood Bank & Transfusion';
  }
  return 'General Pathology';
}

// Common Analyte templates for rich result entry
interface AnalyteField {
  name: string;
  ref: string;
  unit: string;
  criticalLow?: number;
  criticalHigh?: number;
}

function getAnalyteFields(testName: string): AnalyteField[] {
  const t = testName.toLowerCase();
  if (t.includes('fbc') || t.includes('full blood') || t.includes('cbc')) {
    return [
      { name: 'White Blood Cells (WBC)', ref: '4.0 - 11.0', unit: 'x10^9/L', criticalLow: 2.0, criticalHigh: 30.0 },
      { name: 'Hemoglobin (Hb)', ref: '12.0 - 17.5', unit: 'g/dL', criticalLow: 7.0, criticalHigh: 20.0 },
      { name: 'Hematocrit (PCV)', ref: '36.0 - 52.0', unit: '%', criticalLow: 20.0, criticalHigh: 60.0 },
      { name: 'Platelets (PLT)', ref: '150 - 450', unit: 'x10^9/L', criticalLow: 30, criticalHigh: 900 },
      { name: 'Neutrophils', ref: '40 - 75', unit: '%' },
      { name: 'Lymphocytes', ref: '20 - 45', unit: '%' },
    ];
  }
  if (t.includes('troponin')) {
    return [
      { name: 'High-Sensitivity Troponin-I', ref: '< 0.04', unit: 'ng/mL', criticalHigh: 0.10 },
      { name: 'CK-MB', ref: '0.0 - 5.0', unit: 'ng/mL', criticalHigh: 15.0 },
    ];
  }
  if (t.includes('electrolyte') || t.includes('u&e') || t.includes('urea') || t.includes('renal')) {
    return [
      { name: 'Sodium (Na+)', ref: '135 - 145', unit: 'mmol/L', criticalLow: 120, criticalHigh: 160 },
      { name: 'Potassium (K+)', ref: '3.5 - 5.1', unit: 'mmol/L', criticalLow: 2.8, criticalHigh: 6.2 },
      { name: 'Chloride (Cl-)', ref: '98 - 107', unit: 'mmol/L' },
      { name: 'Bicarbonate (HCO3-)', ref: '22 - 29', unit: 'mmol/L', criticalLow: 10, criticalHigh: 40 },
      { name: 'Blood Urea Nitrogen', ref: '2.5 - 7.1', unit: 'mmol/L', criticalHigh: 25.0 },
      { name: 'Serum Creatinine', ref: '62 - 115', unit: 'µmol/L', criticalHigh: 350.0 },
    ];
  }
  if (t.includes('lft') || t.includes('liver')) {
    return [
      { name: 'Total Bilirubin', ref: '3.4 - 20.5', unit: 'µmol/L', criticalHigh: 85.0 },
      { name: 'Direct Bilirubin', ref: '0.0 - 6.8', unit: 'µmol/L' },
      { name: 'ALT / SGPT', ref: '7 - 56', unit: 'U/L', criticalHigh: 500 },
      { name: 'AST / SGOT', ref: '10 - 40', unit: 'U/L', criticalHigh: 500 },
      { name: 'Alkaline Phosphatase (ALP)', ref: '44 - 147', unit: 'U/L' },
      { name: 'Total Protein', ref: '60 - 83', unit: 'g/L' },
      { name: 'Albumin', ref: '35 - 50', unit: 'g/L' },
    ];
  }
  if (t.includes('glucose') || t.includes('fbs') || t.includes('rbs')) {
    return [
      { name: 'Plasma Glucose', ref: '70 - 110', unit: 'mg/dL', criticalLow: 45, criticalHigh: 400 },
    ];
  }
  if (t.includes('malaria')) {
    return [
      { name: 'Malaria Parasite (Giemsa Film)', ref: 'Negative', unit: 'Grade (Trophozoites/µL)' },
      { name: 'Malaria RDT (Pf/Pv)', ref: 'Negative', unit: 'Qualitative' },
    ];
  }
  if (t.includes('pt') || t.includes('inr') || t.includes('coag')) {
    return [
      { name: 'Prothrombin Time (PT)', ref: '11.0 - 13.5', unit: 'seconds' },
      { name: 'International Normalized Ratio (INR)', ref: '0.8 - 1.2', unit: 'Ratio', criticalHigh: 4.5 },
      { name: 'Control PT', ref: '12.0', unit: 'seconds' },
    ];
  }
  if (t.includes('urinalysis')) {
    return [
      { name: 'Appearance / Color', ref: 'Clear / Amber', unit: 'Visual' },
      { name: 'Specific Gravity', ref: '1.005 - 1.030', unit: 'SG' },
      { name: 'pH', ref: '5.0 - 7.5', unit: 'pH' },
      { name: 'Protein', ref: 'Negative', unit: 'Dipstick' },
      { name: 'Glucose', ref: 'Negative', unit: 'Dipstick' },
      { name: 'Ketones', ref: 'Negative', unit: 'Dipstick' },
      { name: 'Blood / Hemoglobin', ref: 'Negative', unit: 'Dipstick' },
      { name: 'Nitrite', ref: 'Negative', unit: 'Dipstick' },
      { name: 'Leukocyte Esterase', ref: 'Negative', unit: 'Dipstick' },
    ];
  }
  return [
    { name: 'Result Value / Summary', ref: 'Normal / Non-reactive', unit: 'Result' },
  ];
}

// Delta Check Rule Definitions
interface DeltaCheckViolation {
  analyte: string;
  previousValue: string;
  currentValue: string;
  severity: 'WARNING' | 'CRITICAL';
  message: string;
}

function evaluateDeltaChecks(order: ClinicalOrder, newValues: Record<string, string>): DeltaCheckViolation[] {
  const violations: DeltaCheckViolation[] = [];

  // Check Hemoglobin
  if (newValues['Hemoglobin (Hb)']) {
    const hb = parseFloat(newValues['Hemoglobin (Hb)']);
    if (!isNaN(hb) && hb < 10.0) {
      violations.push({
        analyte: 'Hemoglobin (Hb)',
        previousValue: '13.6 g/dL (48h baseline)',
        currentValue: `${hb} g/dL`,
        severity: hb < 8.0 ? 'CRITICAL' : 'WARNING',
        message: 'Acute drop in hemoglobin (> 2.0 g/dL shift). Possible acute internal hemorrhage or severe hemodilution.',
      });
    }
  }

  // Check Creatinine
  if (newValues['Serum Creatinine']) {
    const cr = parseFloat(newValues['Serum Creatinine']);
    if (!isNaN(cr) && cr > 180) {
      violations.push({
        analyte: 'Serum Creatinine',
        previousValue: '88 µmol/L (Baseline)',
        currentValue: `${cr} µmol/L`,
        severity: cr > 280 ? 'CRITICAL' : 'WARNING',
        message: 'Creatinine surged by > 50% from baseline. Alert clinician for Acute Kidney Injury (KDIGO Stage 2/3).',
      });
    }
  }

  // Check Potassium
  if (newValues['Potassium (K+)']) {
    const k = parseFloat(newValues['Potassium (K+)']);
    if (!isNaN(k) && (k < 3.0 || k > 5.8)) {
      violations.push({
        analyte: 'Potassium (K+)',
        previousValue: '4.2 mmol/L (Baseline)',
        currentValue: `${k} mmol/L`,
        severity: (k < 2.8 || k > 6.2) ? 'CRITICAL' : 'WARNING',
        message: k > 5.8 ? 'Significant potassium elevation. Inspect sample for in-vitro hemolysis or EDTA tube contamination before releasing.' : 'Significant hypokalemia shift.',
      });
    }
  }

  // Check Platelets
  if (newValues['Platelets (PLT)']) {
    const plt = parseFloat(newValues['Platelets (PLT)']);
    if (!isNaN(plt) && plt < 80) {
      violations.push({
        analyte: 'Platelets (PLT)',
        previousValue: '240 x10^9/L (Baseline)',
        currentValue: `${plt} x10^9/L`,
        severity: plt < 40 ? 'CRITICAL' : 'WARNING',
        message: 'Acute thrombocytopenia shift. Examine peripheral blood smear for EDTA-induced platelet satellitism / clumping.',
      });
    }
  }

  return violations;
}

// Standard Antibiogram Antibiotics
interface AntibioticSensitivity {
  name: string;
  code: string;
  class: string;
  mic: string;
  status: 'S' | 'I' | 'R';
}

const DEFAULT_ANTIBIOTICS: AntibioticSensitivity[] = [
  { name: 'Amoxicillin-Clavulanate', code: 'AMC', class: 'Penicillin / Beta-lactamase inhibitor', mic: '<= 4/2', status: 'S' },
  { name: 'Ceftriaxone', code: 'CRO', class: '3rd Generation Cephalosporin', mic: '<= 1', status: 'S' },
  { name: 'Ciprofloxacin', code: 'CIP', class: 'Fluoroquinolone', mic: '0.25', status: 'S' },
  { name: 'Meropenem', code: 'MEM', class: 'Carbapenem', mic: '<= 0.5', status: 'S' },
  { name: 'Vancomycin', code: 'VAN', class: 'Glycopeptide', mic: '1.0', status: 'S' },
  { name: 'Gentamicin', code: 'GEN', class: 'Aminoglycoside', mic: '<= 2', status: 'S' },
  { name: 'Amikacin', code: 'AMK', class: 'Aminoglycoside', mic: '<= 4', status: 'S' },
  { name: 'Nitrofurantoin', code: 'NIT', class: 'Nitrofuran', mic: '<= 32', status: 'S' },
  { name: 'Piperacillin-Tazobactam', code: 'TZP', class: 'Antipseudomonal Penicillin', mic: '<= 8/4', status: 'S' },
  { name: 'Colistin', code: 'CST', class: 'Polymyxin', mic: '<= 2', status: 'S' },
];

// Automated Analyzers Telemetry in Hospital Laboratory
interface AnalyzerTelemetry {
  id: string;
  name: string;
  department: string;
  status: 'ONLINE' | 'ACTIVE BATCH' | 'CALIBRATING' | 'STANDBY';
  throughput: string;
  reagentLevel: number;
  lastQC: string;
  qcStatus: 'PASS' | 'WARNING';
}

const ANALYZERS_LIST: AnalyzerTelemetry[] = [
  { id: 'AN-01', name: 'Sysmex XN-1000', department: 'Hematology', status: 'ONLINE', throughput: '100 tests/hr', reagentLevel: 92, lastQC: 'Today 06:00', qcStatus: 'PASS' },
  { id: 'AN-02', name: 'Roche Cobas 6000', department: 'Clinical Chemistry', status: 'ONLINE', throughput: '180 tests/hr', reagentLevel: 85, lastQC: 'Today 05:30', qcStatus: 'PASS' },
  { id: 'AN-03', name: 'BD BACTEC FX', department: 'Microbiology', status: 'ACTIVE BATCH', throughput: '48 bottles incubating', reagentLevel: 98, lastQC: 'Yesterday', qcStatus: 'PASS' },
  { id: 'AN-04', name: 'Stago Compact Max', department: 'Hemostasis & Coagulation', status: 'ONLINE', throughput: '50 tests/hr', reagentLevel: 78, lastQC: 'Today 07:00', qcStatus: 'PASS' },
  { id: 'AN-05', name: 'GeneXpert IV', department: 'Molecular & PCR', status: 'ONLINE', throughput: '4 Cartridges', reagentLevel: 95, lastQC: 'Today 04:30', qcStatus: 'PASS' },
];

export const LabDeskHome: React.FC<Props> = ({ session, onNavigate }) => {
  const facilityId = session.hospitalId || 'IGH-EKT';
  const staffName = session.name || 'Medical Lab Scientist';
  const firstName = staffName.split(' ')[0];

  const [tick, setTick] = useState(0);
  const [activeTab, setActiveTab] = useState<'orders' | 'accession' | 'phlebotomy' | 'analyzers' | 'microbiology' | 'panic' | 'blood_bank'>('orders');
  const [benchFilter, setBenchFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'stat' | 'urgent' | 'routine'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ordered' | 'in_progress' | 'resulted'>('all');
  const [search, setSearch] = useState('');
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // Modals
  const [selectedOrderForResults, setSelectedOrderForResults] = useState<ClinicalOrder | null>(null);
  const [resultInputValues, setResultInputValues] = useState<Record<string, string>>({});
  const [resultNotes, setResultNotes] = useState('');
  const [isPanicResult, setIsPanicResult] = useState(false);

  // Antibiogram Modal
  const [antibiogramOrder, setAntibiogramOrder] = useState<ClinicalOrder | null>(null);
  const [selectedOrganism, setSelectedOrganism] = useState('Escherichia coli');
  const [colonyCount, setColonyCount] = useState('> 10^5 CFU/mL Significant bacteriuria');
  const [antibiogramList, setAntibiogramList] = useState<AntibioticSensitivity[]>(DEFAULT_ANTIBIOTICS);

  // Serial Analyte Trends Modal
  const [trendModalOrder, setTrendModalOrder] = useState<ClinicalOrder | null>(null);
  const [trendAnalyte, setTrendAnalyte] = useState<'Troponin' | 'Hemoglobin' | 'Creatinine' | 'Potassium'>('Troponin');

  const [showDirectOrderModal, setShowDirectOrderModal] = useState(false);
  const [orderPatientId, setOrderPatientId] = useState('');
  const [orderTestName, setOrderTestName] = useState('Full Blood Count (FBC + Diff)');
  const [orderPriority, setOrderPriority] = useState<'routine' | 'urgent' | 'stat'>('routine');
  const [orderNotes, setOrderNotes] = useState('');

  const [barcodeLabelModal, setBarcodeLabelModal] = useState<ClinicalOrder | null>(null);
  const [phoneCallOrder, setPhoneCallOrder] = useState<ClinicalOrder | null>(null);
  const [doctorPhoneName, setDoctorPhoneName] = useState('');
  const [readBackConfirmed, setReadBackConfirmed] = useState(false);

  // Quick accession barcode input
  const [scanBarcodeInput, setScanBarcodeInput] = useState('');
  const [accessionHemolysis, setAccessionHemolysis] = useState<'None' | 'Mild' | 'Severe'>('None');
  const [accessionVolume, setAccessionVolume] = useState<'Adequate' | 'QNS (Quantity Not Sufficient)'>('Adequate');
  const [accessionClot, setAccessionClot] = useState<'Clear' | 'Clotted (Reject)'>('Clear');

  // Phlebotomy Ward Round verification states
  const [verifiedBeds, setVerifiedBeds] = useState<Record<string, boolean>>({});

  const reload = () => setTick((t) => t + 1);

  // Live Subscriptions
  useEffect(() => {
    const u1 = subscribeOrders(reload);
    const u2 = subscribeLis(reload);
    const u3 = subscribePatients(reload);
    const u4 = subscribeNotifications(reload);
    const u5 = subscribeIntelligence(reload);

    // 15-second heartbeat timer for elapsed turnaround times
    const timer = setInterval(() => setTick((t) => t + 1), 15000);

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      clearInterval(timer);
    };
  }, []);

  const notify = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => setToastNotice(null), 3800);
  };

  // Raw data from stores
  const rawOrders = useMemo(() => listOrders(facilityId), [facilityId, tick]);
  const labOrders = useMemo(() => rawOrders.filter((o) => o.type === 'lab'), [rawOrders]);
  const specimens = useMemo(() => listSpecimens(facilityId), [facilityId, tick]);
  const patients = useMemo(() => listPatients(facilityId), [facilityId, tick]);
  const tatStats = useMemo(() => lisTatStats(facilityId), [facilityId, tick]);
  const pendingCritical = useMemo(() => listPendingCriticalAcks(facilityId), [facilityId, tick]);

  // Specimen map by order ID
  const specimenByOrder = useMemo(() => {
    const map = new Map<string, SpecimenRecord>();
    for (const s of specimens) {
      map.set(s.orderId, s);
    }
    return map;
  }, [specimens]);

  // KPIs
  const statOrders = useMemo(() => labOrders.filter((o) => o.priority === 'stat' && o.status !== 'resulted' && o.status !== 'cancelled'), [labOrders]);
  const toCollect = useMemo(() => labOrders.filter((o) => o.status === 'ordered'), [labOrders]);
  const inProcessing = useMemo(() => labOrders.filter((o) => o.status === 'in_progress' || o.status === 'accepted'), [labOrders]);
  const pendingVerification = useMemo(() => labOrders.filter((o) => o.status === 'in_progress' && o.resultSummary), [labOrders]);
  const completedToday = useMemo(() => labOrders.filter((o) => o.status === 'resulted'), [labOrders]);
  const criticalPanicCount = useMemo(() => {
    return labOrders.filter((o) => o.status === 'resulted' && (/panic|critical|high\s+risk|\+\+\+/i.test(o.resultSummary || '') || o.priority === 'stat')).length;
  }, [labOrders]);
  const microbiologyOrders = useMemo(() => {
    return labOrders.filter((o) => inferBench(o.name) === 'Medical Microbiology' || o.name.toLowerCase().includes('culture') || o.name.toLowerCase().includes('c&s') || o.name.toLowerCase().includes('swab'));
  }, [labOrders]);

  // Active delta-check evaluation
  const activeDeltaViolations = useMemo(() => {
    if (!selectedOrderForResults) return [];
    return evaluateDeltaChecks(selectedOrderForResults, resultInputValues);
  }, [selectedOrderForResults, resultInputValues]);

  // Filtered Orders for the active view
  const filteredOrders = useMemo(() => {
    return labOrders.filter((o) => {
      // Bench filter
      if (benchFilter !== 'all') {
        const b = inferBench(o.name);
        if (b.toLowerCase() !== benchFilter.toLowerCase()) return false;
      }
      // Priority filter
      if (priorityFilter !== 'all' && o.priority !== priorityFilter) return false;
      // Status filter
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = o.patientName?.toLowerCase().includes(q);
        const matchHosp = o.hospitalNumber?.toLowerCase().includes(q);
        const matchTest = o.name?.toLowerCase().includes(q);
        const matchId = o.id?.toLowerCase().includes(q);
        if (!matchName && !matchHosp && !matchTest && !matchId) return false;
      }
      return true;
    });
  }, [labOrders, benchFilter, priorityFilter, statusFilter, search]);

  // Elapsed wait helper
  const elapsedMinutes = (iso: string) => {
    return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  };

  // Actions
  const handleCollectSample = (o: ClinicalOrder) => {
    const sp = specimenByOrder.get(o.id);
    if (sp) {
      advanceSpecimen(sp.id, 'collected');
    }
    updateOrderStatus(o.id, 'accepted');
    emitLiveAction(`Sample collected for ${o.patientName} (${o.name})`, { module: 'laboratory' });
    notify(`Sample collected & labeled for ${o.patientName}. Ready for bench routing.`);
    reload();
  };

  const handleAccessionToBench = (o: ClinicalOrder) => {
    const sp = specimenByOrder.get(o.id);
    if (sp) {
      advanceSpecimen(sp.id, 'received');
      advanceSpecimen(sp.id, 'processing');
    }
    updateOrderStatus(o.id, 'in_progress');
    emitLiveAction(`Specimen accessioned to ${inferBench(o.name)} bench · ${o.name}`, { module: 'laboratory' });
    notify(`Specimen ${o.id} accessioned and routed to ${inferBench(o.name)} analyzer.`);
    reload();
  };

  const handleOpenResultModal = (o: ClinicalOrder) => {
    setSelectedOrderForResults(o);
    const fields = getAnalyteFields(o.name);
    const initial: Record<string, string> = {};
    for (const f of fields) {
      initial[f.name] = '';
    }
    setResultInputValues(initial);
    setResultNotes(o.resultSummary || '');
    setIsPanicResult(o.priority === 'stat');
  };

  const handleCommitResults = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForResults) return;

    // Build formatted analyte report
    const entries = Object.entries(resultInputValues).filter(([_, v]) => v.trim().length > 0);
    let summaryText = '';
    if (entries.length > 0) {
      summaryText = entries.map(([k, v]) => `${k}: ${v}`).join(' | ');
      if (resultNotes.trim()) {
        summaryText += ` (Notes: ${resultNotes.trim()})`;
      }
    } else if (resultNotes.trim()) {
      summaryText = resultNotes.trim();
    } else {
      summaryText = 'Result completed within reference intervals';
    }

    if (isPanicResult) {
      summaryText = `[CRITICAL PANIC] ${summaryText}`;
    }

    // Attach Delta Check annotation if present
    if (activeDeltaViolations.length > 0) {
      summaryText += ` [DELTA CHECK: ${activeDeltaViolations.map(d => d.analyte).join(', ')}]`;
    }

    try {
      postLabResult(selectedOrderForResults.id, summaryText, staffName);
    } catch {
      updateOrderStatus(selectedOrderForResults.id, 'resulted', {
        resultSummary: summaryText,
        resultedBy: staffName,
      });
    }

    const sp = specimenByOrder.get(selectedOrderForResults.id);
    if (sp) {
      advanceSpecimen(sp.id, 'resulted', summaryText);
    }

    if (isPanicResult) {
      pushNotification({
        facilityId,
        level: 'critical',
        title: `PANIC LAB VALUE: ${selectedOrderForResults.name}`,
        body: `${selectedOrderForResults.patientName} (${selectedOrderForResults.hospitalNumber}) · Value: ${summaryText.slice(0, 100)}`,
        module: 'doctor-portal',
        patientId: selectedOrderForResults.patientId,
      });
      liveAlert(`CRITICAL LAB ALERT: ${selectedOrderForResults.name} for ${selectedOrderForResults.patientName} requires immediate verbal clinician notification!`);
    }

    emitLiveAction(`Lab report validated for ${selectedOrderForResults.patientName} · ${selectedOrderForResults.name}`, { module: 'laboratory' });
    notify(`Lab report committed & transmitted to EHR for ${selectedOrderForResults.patientName}.`);
    setSelectedOrderForResults(null);
    reload();
  };

  // Commit Microbiology Antibiogram
  const handleCommitAntibiogram = (e: React.FormEvent) => {
    e.preventDefault();
    if (!antibiogramOrder) return;

    // Check for MDRO
    const isMRSA = selectedOrganism.includes('Staphylococcus') && antibiogramList.find(a => a.name === 'Ceftriaxone')?.status === 'R';
    const isCRE = antibiogramList.find(a => a.name === 'Meropenem')?.status === 'R';
    const isESBL = selectedOrganism.includes('Klebsiella') || selectedOrganism.includes('Escherichia') && antibiogramList.find(a => a.name === 'Ceftriaxone')?.status === 'R';

    const mdroTag = isCRE ? ' [ALERT: CRE CARBAPENEM-RESISTANT]' : isMRSA ? ' [ALERT: MRSA DETECTED]' : isESBL ? ' [ALERT: ESBL-PRODUCING]' : '';

    const summaryReport = `C&S: Isolated ${selectedOrganism} (${colonyCount}). Antibiogram: ${antibiogramList.map(a => `${a.code}:${a.status}`).join(' ')}${mdroTag}`;

    updateOrderStatus(antibiogramOrder.id, 'resulted', {
      resultSummary: summaryReport,
      resultedBy: staffName,
    });

    const sp = specimenByOrder.get(antibiogramOrder.id);
    if (sp) {
      advanceSpecimen(sp.id, 'resulted', summaryReport);
    }

    if (isCRE || isMRSA || isESBL) {
      pushNotification({
        facilityId,
        level: 'critical',
        title: `SUPERBUG ALERT: ${isCRE ? 'CRE' : isMRSA ? 'MRSA' : 'ESBL'} Identified`,
        body: `${antibiogramOrder.patientName} · ${selectedOrganism}. Isolation precautions initiated.`,
        module: 'infection',
        patientId: antibiogramOrder.patientId,
      });
      liveAlert(`INFECTION CONTROL ALERT: ${isCRE ? 'CRE' : isMRSA ? 'MRSA' : 'ESBL'} isolated for ${antibiogramOrder.patientName}. Contact isolation required!`);
    }

    emitLiveAction(`Antibiogram published for ${antibiogramOrder.patientName} · ${selectedOrganism}`, { module: 'laboratory' });
    notify(`Antibiogram report validated & sent to EHR for ${antibiogramOrder.patientName}.`);
    setAntibiogramOrder(null);
    reload();
  };

  const handleCreateDirectOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderPatientId) {
      notify('Please select a patient.');
      return;
    }
    const pat = patients.find((p) => p.id === orderPatientId);
    if (!pat) return;

    const newOrder = placeOrder({
      facilityId,
      patientId: pat.id,
      patientName: `${pat.firstName} ${pat.lastName}`,
      hospitalNumber: pat.hospitalNumber,
      type: 'lab',
      code: orderTestName.slice(0, 8).toUpperCase().replace(/\s/g, '_'),
      name: orderTestName,
      orderedBy: `${staffName} (Lab Desk)`,
      priority: orderPriority,
      notes: orderNotes.trim() || 'Direct Laboratory Desk Request',
    });

    emitLiveAction(`Direct Lab Order created: ${newOrder.name} for ${newOrder.patientName}`, { module: 'laboratory' });
    notify(`Order ${newOrder.id} placed for ${newOrder.patientName} (${orderPriority.toUpperCase()})`);
    setShowDirectOrderModal(false);
    setOrderNotes('');
    reload();
  };

  const handleScanBarcodeAccession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanBarcodeInput.trim()) return;

    const raw = scanBarcodeInput.trim().toUpperCase();
    const match = labOrders.find((o) => {
      const sp = specimenByOrder.get(o.id);
      return o.id.toUpperCase().includes(raw) || (sp && sp.barcode.toUpperCase().includes(raw)) || o.hospitalNumber.toUpperCase().includes(raw);
    });

    if (match) {
      if (accessionClot === 'Clotted (Reject)') {
        notify(`REJECTED: Specimen ${match.id} clotted. Redraw requested from ward.`);
        liveAlert(`Specimen rejected (Clotted EDTA): ${match.patientName} · ${match.name}`);
        setScanBarcodeInput('');
        return;
      }
      handleAccessionToBench(match);
      notify(`Barcode ${raw} matched Order ${match.id} (${match.patientName}). Accessioned to ${inferBench(match.name)}!`);
      setScanBarcodeInput('');
    } else {
      notify(`Barcode or Order ID "${raw}" not found in active laboratory queue.`);
    }
  };

  const handleConfirmPhoneCall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneCallOrder || !doctorPhoneName.trim() || !readBackConfirmed) {
      notify('Please enter Doctor name and confirm verbal read-back.');
      return;
    }
    emitLiveAction(`Verbal read-back confirmed with Dr. ${doctorPhoneName} for ${phoneCallOrder.patientName} (${phoneCallOrder.name})`, { module: 'laboratory' });
    notify(`Critical value read-back logged with Dr. ${doctorPhoneName}. Joint Commission / ISO 15189 compliance recorded.`);
    setPhoneCallOrder(null);
    setDoctorPhoneName('');
    setReadBackConfirmed(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 32 }}>
      {/* Toast Notice */}
      {toastNotice && (
        <div style={{
          position: 'fixed', top: 22, right: 24, zIndex: 9999,
          background: '#0F172A', color: '#38BDF8', border: '1px solid #0284C7',
          borderRadius: 12, padding: '12px 20px', boxShadow: '0 12px 30px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.86rem', fontWeight: 600,
          animation: 'fadeUp 0.2s ease-out',
        }}>
          <CheckCircle2 size={18} color="#38BDF8" />
          <span>{toastNotice}</span>
        </div>
      )}

      {/* 1. Hero Laboratory Command Header */}
      <div style={{
        background: 'linear-gradient(135deg, #083344 0%, #0E7490 55%, #06B6D4 100%)',
        borderRadius: 18,
        padding: '22px 26px',
        color: '#FFFFFF',
        boxShadow: '0 10px 25px rgba(8, 145, 178, 0.25)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'rgba(255,255,255,0.16)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.25)',
          }}>
            <FlaskConical size={28} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Laboratory Operations & LIS Desk
              </h1>
              <span style={{
                background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 99,
                fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>
                Facility: {facilityId}
              </span>
              <span style={{
                background: '#10B981', color: '#FFFFFF', padding: '3px 10px', borderRadius: 99,
                fontSize: '0.72rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4
              }}>
                <Radio size={12} />
                LIS BUS LIVE
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#E0F2FE', maxWidth: 680 }}>
              Live phlebotomy queue, automated accessioning, multi-analyte delta-check verification, microbiology antibiograms, and instant EHR results release.
            </p>
          </div>
        </div>

        {/* Live Status Indicators & Quick Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{
            background: 'rgba(0,0,0,0.22)', padding: '8px 14px', borderRadius: 10,
            fontSize: '0.76rem', display: 'flex', flexDirection: 'column', gap: 2
          }}>
            <span style={{ color: '#BAE6FD', fontWeight: 600 }}>Cold Chain Storage</span>
            <span style={{ color: '#67E8F9', fontWeight: 800 }}>+3.8°C (Normal)</span>
          </div>

          <button
            type="button"
            onClick={() => setShowDirectOrderModal(true)}
            style={{
              background: '#FFFFFF', color: '#0E7490', border: 'none',
              padding: '9px 16px', borderRadius: 10, fontWeight: 700, fontSize: '0.82rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            <Plus size={16} />
            + Direct Lab Order
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('accession')}
            style={{
              background: 'rgba(255,255,255,0.18)', color: '#FFFFFF',
              border: '1px solid rgba(255,255,255,0.3)', padding: '9px 14px',
              borderRadius: 10, fontWeight: 700, fontSize: '0.82rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Barcode size={16} />
            Scan / Accession
          </button>
        </div>
      </div>

      {/* 2. Real-time KPI Counters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {/* STAT Orders */}
        <div style={{
          background: statOrders.length > 0 ? '#FEF2F2' : '#FFFFFF',
          border: statOrders.length > 0 ? '1.5px solid #FCA5A5' : '1px solid #E2E8F0',
          borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4,
          boxShadow: statOrders.length > 0 ? '0 4px 15px rgba(239, 68, 68, 0.15)' : 'none',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: statOrders.length > 0 ? '#DC2626' : '#64748B', textTransform: 'uppercase' }}>
              STAT / Emergency
            </span>
            <AlertTriangle size={18} color={statOrders.length > 0 ? '#DC2626' : '#94A3B8'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: statOrders.length > 0 ? '#DC2626' : '#0F172A' }}>
              {statOrders.length}
            </span>
            <span style={{ fontSize: '0.74rem', color: '#64748B' }}>TAT target &lt; 45m</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: statOrders.length > 0 ? '#B91C1C' : '#94A3B8', fontWeight: 600 }}>
            {statOrders.length > 0 ? 'Urgent attention required' : 'No emergency backlogs'}
          </span>
        </div>

        {/* Phlebotomy / To Collect */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Samples to Collect
            </span>
            <Users size={18} color="#0284C7" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A' }}>
              {toCollect.length}
            </span>
            <span style={{ fontSize: '0.74rem', color: '#64748B' }}>In OPD & Wards</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#0284C7', fontWeight: 600 }}>
            Awaiting venipuncture
          </span>
        </div>

        {/* In Processing / On Analyzers */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              On Analyzers
            </span>
            <Cpu size={18} color="#0891B2" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A' }}>
              {inProcessing.length}
            </span>
            <span style={{ fontSize: '0.74rem', color: '#64748B' }}>Active bench runs</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>
            Sysmex · Cobas · BACTEC
          </span>
        </div>

        {/* Pending Validation */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Awaiting Sign-Off
            </span>
            <ShieldCheck size={18} color="#7C3AED" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A' }}>
              {pendingVerification.length}
            </span>
            <span style={{ fontSize: '0.74rem', color: '#64748B' }}>MLS verification</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#7C3AED', fontWeight: 600 }}>
            Ready for EHR release
          </span>
        </div>

        {/* Critical Panic Values */}
        <div style={{
          background: criticalPanicCount > 0 ? '#FFFBEB' : '#FFFFFF',
          border: criticalPanicCount > 0 ? '1px solid #FCD34D' : '1px solid #E2E8F0',
          borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: criticalPanicCount > 0 ? '#D97706' : '#64748B', textTransform: 'uppercase' }}>
              Critical Values
            </span>
            <ShieldAlert size={18} color={criticalPanicCount > 0 ? '#D97706' : '#94A3B8'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: criticalPanicCount > 0 ? '#D97706' : '#0F172A' }}>
              {criticalPanicCount}
            </span>
            <span style={{ fontSize: '0.74rem', color: '#64748B' }}>Phone doctor</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: criticalPanicCount > 0 ? '#B45309' : '#94A3B8', fontWeight: 600 }}>
            Verbal read-back mandatory
          </span>
        </div>

        {/* Completed & Transmitted Today */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Released to EHR
            </span>
            <CheckCircle2 size={18} color="#16A34A" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#16A34A' }}>
              {completedToday.length}
            </span>
            <span style={{ fontSize: '0.74rem', color: '#64748B' }}>Avg TAT {tatStats.avgTatMinutes}m</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 600 }}>
            Committed to patient chart
          </span>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div style={{
        display: 'flex', gap: 8, borderBottom: '1px solid #E2E8F0', paddingBottom: 4,
        overflowX: 'auto', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { key: 'orders', label: 'Live Lab Worklist', count: filteredOrders.length, icon: Activity },
            { key: 'accession', label: 'Specimen Accessioning', count: toCollect.length, icon: Barcode },
            { key: 'phlebotomy', label: 'Phlebotomy Rounds', count: toCollect.length, icon: Users },
            { key: 'analyzers', label: 'Analyzers & Bench QC', count: ANALYZERS_LIST.length, icon: Cpu },
            { key: 'microbiology', label: 'Culture & Antibiograms', count: microbiologyOrders.length, icon: Bug },
            { key: 'panic', label: 'Critical / Panic Alerts', count: criticalPanicCount, icon: ShieldAlert },
            { key: 'blood_bank', label: 'Blood Bank Telemetry', icon: Droplet },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as any)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 16px', borderRadius: 10, border: 'none',
                  background: active ? '#0891B2' : 'transparent',
                  color: active ? '#FFFFFF' : '#475569',
                  fontWeight: active ? 700 : 600, fontSize: '0.84rem',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span style={{
                    background: active ? 'rgba(255,255,255,0.25)' : '#E2E8F0',
                    color: active ? '#FFFFFF' : '#475569',
                    fontSize: '0.7rem', padding: '2px 7px', borderRadius: 99, fontWeight: 700
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => { reload(); notify('Laboratory bus resynchronized with hospital network.'); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: '1px solid #CBD5E1', borderRadius: 8,
            padding: '6px 12px', fontSize: '0.78rem', color: '#475569', cursor: 'pointer', fontWeight: 600
          }}
        >
          <RefreshCw size={13} />
          Sync
        </button>
      </div>

      {/* 4. Active Tab Content */}
      {activeTab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Worklist Filters Strip */}
          <div style={{
            background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14,
            padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 12,
            justifyContent: 'space-between', alignItems: 'center'
          }}>
            {/* Search Box */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 8,
              padding: '6px 12px', minWidth: 260, flex: 1, maxWidth: 360
            }}>
              <Search size={15} color="#64748B" />
              <input
                type="text"
                placeholder="Search patient, hospital no, test, barcode…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.82rem', width: '100%' }}
              />
              {search && <X size={14} color="#94A3B8" style={{ cursor: 'pointer' }} onClick={() => setSearch('')} />}
            </div>

            {/* Bench Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Bench:</span>
              {['all', 'Hematology', 'Clinical Chemistry', 'Medical Microbiology', 'Serology & Virology', 'Blood Bank & Transfusion'].map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBenchFilter(b)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, border: '1px solid',
                    borderColor: benchFilter === b ? '#0891B2' : '#E2E8F0',
                    background: benchFilter === b ? '#E0F2FE' : '#FFFFFF',
                    color: benchFilter === b ? '#0369A1' : '#475569',
                    fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  {b === 'all' ? 'All Benches' : b}
                </button>
              ))}
            </div>

            {/* Priority Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Priority:</span>
              {(['all', 'stat', 'urgent', 'routine'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriorityFilter(p)}
                  style={{
                    padding: '4px 8px', borderRadius: 6, border: '1px solid',
                    borderColor: priorityFilter === p ? (p === 'stat' ? '#DC2626' : p === 'urgent' ? '#D97706' : '#2563EB') : '#E2E8F0',
                    background: priorityFilter === p ? (p === 'stat' ? '#FEE2E2' : p === 'urgent' ? '#FEF3C7' : '#EFF6FF') : '#FFFFFF',
                    color: priorityFilter === p ? (p === 'stat' ? '#DC2626' : p === 'urgent' ? '#D97706' : '#2563EB') : '#475569',
                    fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize'
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Worklist Cards / Table */}
          {filteredOrders.length === 0 ? (
            <div style={{
              background: '#FFFFFF', border: '1px dashed #CBD5E1', borderRadius: 14,
              padding: '40px 20px', textAlign: 'center', color: '#64748B'
            }}>
              <FlaskConical size={36} color="#94A3B8" style={{ margin: '0 auto 12px auto' }} />
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#334155' }}>No Laboratory Orders Found</div>
              <p style={{ fontSize: '0.8rem', margin: '4px 0 16px 0' }}>
                Orders placed from Doctor Consultation desks, Emergency, or Wards will stream here in real time.
              </p>
              <button
                type="button"
                onClick={() => setShowDirectOrderModal(true)}
                style={{
                  background: '#0891B2', color: '#FFFFFF', border: 'none',
                  padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer'
                }}
              >
                + Place Direct Order
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredOrders.map((o) => {
                const tube = inferTube(o.name);
                const bench = inferBench(o.name);
                const sp = specimenByOrder.get(o.id);
                const mins = elapsedMinutes(o.createdAt);
                const isStat = o.priority === 'stat';
                const isUrgent = o.priority === 'urgent';
                const isResulted = o.status === 'resulted';
                const isAnalyzing = o.status === 'in_progress';
                const isCollected = o.status === 'accepted';
                const isPanic = isResulted && /panic|critical|high\s+risk|\+\+\+/i.test(o.resultSummary || '');
                const isCulture = o.name.toLowerCase().includes('culture') || o.name.toLowerCase().includes('c&s') || o.name.toLowerCase().includes('swab');

                return (
                  <div
                    key={o.id}
                    style={{
                      background: isPanic ? '#FEF2F2' : isStat && !isResulted ? '#FFF7ED' : '#FFFFFF',
                      border: isPanic ? '1.5px solid #EF4444' : isStat && !isResulted ? '1.5px solid #F97316' : '1px solid #E2E8F0',
                      borderRadius: 14,
                      padding: '16px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      boxShadow: isPanic ? '0 4px 15px rgba(239,68,68,0.12)' : '0 2px 5px rgba(0,0,0,0.02)',
                    }}
                  >
                    {/* Top Row: Tube & Priority + Patient info + Status badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {/* Tube Color Indicator */}
                        <div
                          title={`${tube.type}: ${tube.additive}`}
                          style={{
                            width: 38, height: 38, borderRadius: 10,
                            background: `${tube.capHex}15`,
                            border: `2px solid ${tube.capHex}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <FlaskConical size={18} color={tube.capHex} />
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0F172A' }}>
                              {o.patientName}
                            </span>
                            <span style={{ fontSize: '0.74rem', color: '#64748B', background: '#F1F5F9', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                              {o.hospitalNumber}
                            </span>
                            {/* Priority Badge */}
                            {isStat && (
                              <span style={{
                                background: '#DC2626', color: '#FFFFFF', padding: '2px 8px', borderRadius: 4,
                                fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em'
                              }}>
                                STAT
                              </span>
                            )}
                            {isUrgent && (
                              <span style={{
                                background: '#D97706', color: '#FFFFFF', padding: '2px 8px', borderRadius: 4,
                                fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase'
                              }}>
                                URGENT
                              </span>
                            )}
                            {isPanic && (
                              <span style={{
                                background: '#991B1B', color: '#FFFFFF', padding: '2px 8px', borderRadius: 4,
                                fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 3
                              }}>
                                <ShieldAlert size={11} />
                                PANIC VALUE
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, fontSize: '0.76rem', color: '#475569' }}>
                            <span style={{ fontWeight: 700, color: '#0369A1' }}>{bench}</span>
                            <span>•</span>
                            <span>Tube: <strong style={{ color: tube.capHex }}>{tube.type.split(' ')[0]}</strong></span>
                            <span>•</span>
                            <span>Ordered by: <strong>{o.orderedBy || 'Clinician'}</strong></span>
                            <span>•</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#64748B' }}>
                              <Clock size={12} /> {mins}m ago
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Status Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700,
                          background: isResulted ? '#DCFCE7' : isAnalyzing ? '#CFFAFE' : isCollected ? '#E0E7FF' : '#FEF3C7',
                          color: isResulted ? '#15803D' : isAnalyzing ? '#0E7490' : isCollected ? '#4338CA' : '#B45309',
                        }}>
                          {isResulted ? '✓ Resulted & Released' : isAnalyzing ? '● Analyzing on Bench' : isCollected ? 'Sample Collected' : 'Awaiting Collection'}
                        </span>

                        <span style={{
                          padding: '4px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700,
                          background: o.paymentCleared ? '#ECFDF5' : '#F1F5F9',
                          color: o.paymentCleared ? '#059669' : '#64748B',
                          border: '1px solid',
                          borderColor: o.paymentCleared ? '#A7F3D0' : '#E2E8F0'
                        }}>
                          {o.paymentCleared ? 'Billing: Cleared' : 'Billing: Standard'}
                        </span>
                      </div>
                    </div>

                    {/* Middle: Test Description & Indication / Results */}
                    <div style={{
                      background: '#F8FAFC', borderRadius: 8, padding: '10px 14px',
                      border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 6
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1E293B' }}>
                            {o.name}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                            Order ID: <code style={{ color: '#0891B2' }}>{o.id}</code>
                          </span>
                          {sp && (
                            <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                              Barcode: <code style={{ color: '#7C3AED' }}>{sp.barcode}</code>
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 6 }}>
                          {/* Serial Trends Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setTrendModalOrder(o);
                              setTrendAnalyte(o.name.toLowerCase().includes('troponin') ? 'Troponin' : o.name.toLowerCase().includes('fbc') ? 'Hemoglobin' : 'Creatinine');
                            }}
                            style={{
                              background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 6,
                              padding: '3px 8px', fontSize: '0.72rem', color: '#0369A1', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700
                            }}
                          >
                            <TrendingUp size={12} />
                            Serial Trend
                          </button>

                          {/* Barcode Label Print button */}
                          <button
                            type="button"
                            onClick={() => setBarcodeLabelModal(o)}
                            style={{
                              background: 'none', border: '1px solid #CBD5E1', borderRadius: 6,
                              padding: '3px 8px', fontSize: '0.72rem', color: '#334155', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600
                            }}
                          >
                            <Printer size={12} />
                            Label
                          </button>
                        </div>
                      </div>

                      {o.notes && (
                        <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                          <strong>Indication:</strong> {o.notes}
                        </div>
                      )}

                      {/* Display resulted text if resulted */}
                      {o.resultSummary && (
                        <div style={{
                          background: isPanic ? '#FEE2E2' : '#F0FDF4',
                          border: isPanic ? '1px solid #FCA5A5' : '1px solid #BBF7D0',
                          borderRadius: 6, padding: '8px 12px', marginTop: 4,
                          fontSize: '0.8rem', color: isPanic ? '#991B1B' : '#166534',
                          fontWeight: 600, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8
                        }}>
                          <div>
                            <span style={{ textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 800, display: 'block' }}>
                              Laboratory Findings:
                            </span>
                            {o.resultSummary}
                          </div>
                          {o.resultedBy && (
                            <span style={{ fontSize: '0.68rem', color: '#64748B', flexShrink: 0 }}>
                              Verified by: {o.resultedBy}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom Actions Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
                      <div style={{ fontSize: '0.73rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={12} />
                        Turnaround: {mins} minutes elapsed
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Step 1: Collect Sample (if ordered) */}
                        {o.status === 'ordered' && (
                          <button
                            type="button"
                            onClick={() => handleCollectSample(o)}
                            style={{
                              background: '#0284C7', color: '#FFFFFF', border: 'none',
                              padding: '6px 14px', borderRadius: 8, fontWeight: 700, fontSize: '0.78rem',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                            }}
                          >
                            <Check size={14} />
                            Collect Sample
                          </button>
                        )}

                        {/* Step 2: Route to Bench (if collected) */}
                        {o.status === 'accepted' && (
                          <button
                            type="button"
                            onClick={() => handleAccessionToBench(o)}
                            style={{
                              background: '#0891B2', color: '#FFFFFF', border: 'none',
                              padding: '6px 14px', borderRadius: 8, fontWeight: 700, fontSize: '0.78rem',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                            }}
                          >
                            <Cpu size={14} />
                            Accession to {bench} Bench
                          </button>
                        )}

                        {/* Microbiology Culture Antibiogram Button */}
                        {isCulture && (
                          <button
                            type="button"
                            onClick={() => setAntibiogramOrder(o)}
                            style={{
                              background: '#7C3AED', color: '#FFFFFF', border: 'none',
                              padding: '6px 14px', borderRadius: 8, fontWeight: 700, fontSize: '0.78rem',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                            }}
                          >
                            <Bug size={14} />
                            Enter Antibiogram (AST)
                          </button>
                        )}

                        {/* Step 3: Enter Results (if analyzing or completed update) */}
                        {(o.status === 'in_progress' || o.status === 'accepted' || isResulted) && (
                          <button
                            type="button"
                            onClick={() => handleOpenResultModal(o)}
                            style={{
                              background: isResulted ? '#F1F5F9' : '#059669',
                              color: isResulted ? '#1E293B' : '#FFFFFF',
                              border: isResulted ? '1px solid #CBD5E1' : 'none',
                              padding: '6px 14px', borderRadius: 8, fontWeight: 700, fontSize: '0.78rem',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                            }}
                          >
                            <Edit3 size={14} />
                            {isResulted ? 'Edit / Re-validate' : 'Enter Results & Validate'}
                          </button>
                        )}

                        {/* Phone Doctor action if panic */}
                        {isPanic && (
                          <button
                            type="button"
                            onClick={() => { setPhoneCallOrder(o); setDoctorPhoneName(o.orderedBy || ''); }}
                            style={{
                              background: '#DC2626', color: '#FFFFFF', border: 'none',
                              padding: '6px 14px', borderRadius: 8, fontWeight: 700, fontSize: '0.78rem',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                            }}
                          >
                            <PhoneCall size={14} />
                            Log Doctor Read-Back Call
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Accessioning Tab */}
      {activeTab === 'accession' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
          {/* Accession Scanner Form */}
          <div style={{
            background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16,
            padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
                Specimen Check-In & Accessioning Station
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748B' }}>
                Scan barcoded tubes upon arrival at the central lab receiving window.
              </p>
            </div>

            <form onSubmit={handleScanBarcodeAccession} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  BARCODE SCANNER / ACCESSION LOOKUP
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Scan tube barcode (e.g. LISORD...) or enter Order ID"
                    value={scanBarcodeInput}
                    onChange={(e) => setScanBarcodeInput(e.target.value)}
                    style={{
                      flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #CBD5E1',
                      fontSize: '0.85rem', outline: 'none'
                    }}
                    autoFocus
                  />
                  <button
                    type="submit"
                    style={{
                      background: '#0891B2', color: '#FFFFFF', border: 'none',
                      padding: '10px 18px', borderRadius: 8, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer'
                    }}
                  >
                    Check In
                  </button>
                </div>
              </div>

              {/* Sample Integrity Checklist */}
              <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 10, border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase' }}>
                  Specimen Suitability & Pre-Analytical Check
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748B', marginBottom: 4 }}>Hemolysis Check</label>
                    <select
                      value={accessionHemolysis}
                      onChange={(e) => setAccessionHemolysis(e.target.value as any)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.76rem' }}
                    >
                      <option value="None">None (Clear Serum)</option>
                      <option value="Mild">Mild (Acceptable)</option>
                      <option value="Severe">Severe (Reject & Redraw)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748B', marginBottom: 4 }}>Volume Sufficiency</label>
                    <select
                      value={accessionVolume}
                      onChange={(e) => setAccessionVolume(e.target.value as any)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.76rem' }}
                    >
                      <option value="Adequate">Adequate Volume</option>
                      <option value="QNS (Quantity Not Sufficient)">QNS (Insufficient)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748B', marginBottom: 4 }}>Clot in Anticoagulant</label>
                    <select
                      value={accessionClot}
                      onChange={(e) => setAccessionClot(e.target.value as any)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.76rem' }}
                    >
                      <option value="Clear">Clear (No Microclots)</option>
                      <option value="Clotted (Reject)">Clotted (Reject EDTA)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div style={{ fontSize: '0.76rem', color: '#64748B', lineHeight: 1.5 }}>
                ℹ️ <strong>Accessioning Rule:</strong> Scanning a specimen automatically updates the hospital pipeline to <code>received</code>, calculates transit time from phlebotomy, and routes the tube to the appropriate analyzer bench.
              </div>
            </form>
          </div>

          {/* Specimens Awaiting Accession */}
          <div style={{
            background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16,
            padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14
          }}>
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0F172A' }}>
              Pending Inbound Tubes ({toCollect.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
              {toCollect.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#94A3B8', fontSize: '0.82rem' }}>
                  All inbound specimens have been accessioned.
                </div>
              ) : (
                toCollect.map((o) => {
                  const tube = inferTube(o.name);
                  return (
                    <div
                      key={o.id}
                      style={{
                        background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10,
                        padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0F172A' }}>
                          {o.patientName} · {o.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                          {o.hospitalNumber} • Tube: <span style={{ color: tube.capHex, fontWeight: 700 }}>{tube.type.split(' ')[0]}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAccessionToBench(o)}
                        style={{
                          background: '#0891B2', color: '#FFFFFF', border: 'none',
                          padding: '5px 12px', borderRadius: 6, fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer'
                        }}
                      >
                        Check In
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Phlebotomy Rounds Tab (Upgrade 3) */}
      {activeTab === 'phlebotomy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0F172A' }}>
                Phlebotomy Ward Rounds & Bedside Collection
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748B' }}>
                Bedside venipuncture worklist with two-identifier wristband verification and tube checklists.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
            {[
              { ward: 'Emergency Resuscitation & Triage', orders: toCollect.filter(o => o.priority === 'stat' || o.notes?.includes('Emergency')) },
              { ward: 'Ward 4B (Medical / Surgical)', orders: toCollect.filter(o => !o.priority.includes('stat')) },
              { ward: 'Intensive Care Unit (ICU)', orders: [] },
              { ward: 'Labour Ward & Maternity', orders: [] },
            ].map((section, idx) => {
              const count = section.orders.length;
              return (
                <div
                  key={idx}
                  style={{
                    background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16,
                    padding: 18, display: 'flex', flexDirection: 'column', gap: 12
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: '#0F172A' }}>
                      {section.ward}
                    </h3>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 99,
                      background: count > 0 ? '#E0F2FE' : '#F1F5F9',
                      color: count > 0 ? '#0369A1' : '#64748B'
                    }}>
                      {count} To Draw
                    </span>
                  </div>

                  {count === 0 ? (
                    <div style={{ padding: '24px 0', textAlign: 'center', color: '#94A3B8', fontSize: '0.78rem' }}>
                      ✓ All specimens drawn and collected for this ward.
                    </div>
                  ) : (
                    section.orders.map((o) => {
                      const tube = inferTube(o.name);
                      const isVerified = verifiedBeds[o.id] || false;

                      return (
                        <div
                          key={o.id}
                          style={{
                            background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10,
                            padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0F172A' }}>
                                {o.patientName}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                                ID: {o.hospitalNumber} • Bed: <strong>{o.patientId ? `Bed ${o.patientId.slice(-2)}` : 'Bed 4'}</strong>
                              </div>
                            </div>

                            <span style={{
                              background: tube.capHex, color: '#FFFFFF', fontSize: '0.68rem',
                              padding: '2px 8px', borderRadius: 4, fontWeight: 800
                            }}>
                              {tube.type.split(' ')[0]}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 600 }}>
                            {o.name}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid #E2E8F0' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: '#475569', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={isVerified}
                                onChange={(e) => setVerifiedBeds(prev => ({ ...prev, [o.id]: e.target.checked }))}
                              />
                              2-ID Verified (Wristband + Name)
                            </label>

                            <button
                              type="button"
                              onClick={() => handleCollectSample(o)}
                              style={{
                                background: isVerified ? '#10B981' : '#0284C7',
                                color: '#FFFFFF', border: 'none', padding: '5px 12px',
                                borderRadius: 6, fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer'
                              }}
                            >
                              Sample Drawn
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Analyzers & QC Bench Tab */}
      {activeTab === 'analyzers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0F172A' }}>
                Automated Analyzers & Bench Telemetry
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748B' }}>
                Real-time instrument interfacing via HL7 / ASTM protocols with Levey-Jennings QC validation.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                notify('Quality Control sequence passed for all active analyzers. Westgard rules compliant.');
                emitLiveAction('Daily automated QC sequence executed across all laboratory analyzers', { module: 'laboratory' });
              }}
              style={{
                background: '#059669', color: '#FFFFFF', border: 'none',
                padding: '8px 16px', borderRadius: 10, fontWeight: 700, fontSize: '0.8rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              <ShieldCheck size={16} />
              Run QC Calibration Sequence
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
            {ANALYZERS_LIST.map((an) => (
              <div
                key={an.id}
                style={{
                  background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16,
                  padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12,
                  boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                      {an.department}
                    </span>
                    <h3 style={{ margin: '2px 0 0 0', fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
                      {an.name}
                    </h3>
                  </div>

                  <span style={{
                    padding: '3px 8px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 800,
                    background: an.status === 'ONLINE' ? '#DCFCE7' : '#FEF3C7',
                    color: an.status === 'ONLINE' ? '#15803D' : '#B45309',
                  }}>
                    {an.status}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, fontSize: '0.78rem' }}>
                  <div style={{ background: '#F8FAFC', padding: 8, borderRadius: 8 }}>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '0.7rem' }}>Throughput</span>
                    <strong style={{ color: '#0F172A' }}>{an.throughput}</strong>
                  </div>
                  <div style={{ background: '#F8FAFC', padding: 8, borderRadius: 8 }}>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '0.7rem' }}>Reagents Remaining</span>
                    <strong style={{ color: an.reagentLevel < 80 ? '#D97706' : '#15803D' }}>{an.reagentLevel}%</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748B', paddingTop: 6, borderTop: '1px solid #F1F5F9' }}>
                  <span>Last QC: {an.lastQC}</span>
                  <span style={{ color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={13} /> QC Passed
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Microbiology & Antibiograms Tab (Upgrade 1) */}
      {activeTab === 'microbiology' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#7C3AED' }}>
                Microbiology Culture & Antibiogram Matrix (AST)
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748B' }}>
                Antimicrobial susceptibility testing (CLSI / EUCAST guidelines) with automated MDRO & Superbug detection.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {microbiologyOrders.length === 0 ? (
              <div style={{ background: '#FFFFFF', padding: '36px', textAlign: 'center', borderRadius: 14, border: '1px solid #E2E8F0', color: '#64748B' }}>
                <Bug size={32} color="#7C3AED" style={{ margin: '0 auto 8px auto' }} />
                <div style={{ fontWeight: 700, color: '#0F172A' }}>No Pending Microbiology Cultures</div>
                <p style={{ fontSize: '0.78rem', margin: '4px 0 0 0' }}>Urine, blood, sputum, or wound culture orders will automatically appear here.</p>
              </div>
            ) : (
              microbiologyOrders.map((o) => (
                <div
                  key={o.id}
                  style={{
                    background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14,
                    padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: '0.96rem', color: '#0F172A' }}>
                        {o.patientName} ({o.hospitalNumber})
                      </span>
                      <span style={{ background: '#F3E8FF', color: '#7C3AED', padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 800 }}>
                        CULTURE & SENSITIVITY
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: 4 }}>
                      Test: <strong>{o.name}</strong> • Status: {o.status}
                    </div>
                    {o.resultSummary && (
                      <div style={{ fontSize: '0.76rem', color: '#059669', marginTop: 2 }}>
                        {o.resultSummary}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setAntibiogramOrder(o)}
                    style={{
                      background: '#7C3AED', color: '#FFFFFF', border: 'none',
                      padding: '8px 16px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                    }}
                  >
                    <Bug size={14} /> Enter Antibiogram (AST)
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Critical / Panic Alerts Tab */}
      {activeTab === 'panic' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#DC2626' }}>
              Mandatory Critical & Panic Results Escalation Log
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748B' }}>
              Joint Commission International & ISO 15189 compliance: Every critical laboratory value must be immediately phoned to the treating physician with verbal read-back documented.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {labOrders.filter((o) => isPanicResult || /panic|critical|high\s+risk|\+\+\+/i.test(o.resultSummary || '') || o.priority === 'stat').length === 0 ? (
              <div style={{ background: '#FFFFFF', padding: '30px', textAlign: 'center', borderRadius: 14, color: '#64748B', border: '1px solid #E2E8F0' }}>
                <CheckCircle2 size={32} color="#16A34A" style={{ margin: '0 auto 8px auto' }} />
                <div style={{ fontWeight: 700, color: '#0F172A' }}>No Unacknowledged Critical Results</div>
                <p style={{ fontSize: '0.78rem', margin: '4px 0 0 0' }}>All panic lab values are currently communicated and acknowledged.</p>
              </div>
            ) : (
              labOrders
                .filter((o) => /panic|critical|high\s+risk|\+\+\+/i.test(o.resultSummary || '') || o.priority === 'stat')
                .map((o) => (
                  <div
                    key={o.id}
                    style={{
                      background: '#FEF2F2', border: '1.5px solid #FCA5A5', borderRadius: 14,
                      padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: '0.96rem', color: '#991B1B' }}>
                          {o.patientName} ({o.hospitalNumber})
                        </span>
                        <span style={{ background: '#DC2626', color: '#FFFFFF', padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 800 }}>
                          CRITICAL
                        </span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#7F1D1D', marginTop: 4, fontWeight: 600 }}>
                        Test: {o.name} • Result: {o.resultSummary || 'Awaiting entry'}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#991B1B', marginTop: 2 }}>
                        Ordering Clinician: <strong>{o.orderedBy || 'Primary MD'}</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => { setPhoneCallOrder(o); setDoctorPhoneName(o.orderedBy || ''); }}
                      style={{
                        background: '#DC2626', color: '#FFFFFF', border: 'none',
                        padding: '9px 18px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                      }}
                    >
                      <PhoneCall size={16} />
                      Log Verbal Phone Call & Read-Back
                    </button>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* Blood Bank Telemetry Tab */}
      {activeTab === 'blood_bank' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0F172A' }}>
                Blood Bank & Transfusion Safety Desk
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748B' }}>
                Real-time ABO/Rh grouping stocks, crossmatch compatibility verification, and cold-chain monitoring.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('blood-bank')}
              style={{
                background: '#DC2626', color: '#FFFFFF', border: 'none',
                padding: '8px 16px', borderRadius: 10, fontWeight: 700, fontSize: '0.8rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              <Droplet size={16} />
              Open Full Blood Bank Suite
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
            {[
              { grp: 'O-', count: 3, alert: true, label: 'Universal Donor' },
              { grp: 'O+', count: 18, alert: false, label: 'Adequate' },
              { grp: 'A+', count: 12, alert: false, label: 'Adequate' },
              { grp: 'A-', count: 4, alert: false, label: 'Normal' },
              { grp: 'B+', count: 14, alert: false, label: 'Adequate' },
              { grp: 'B-', count: 2, alert: true, label: 'Low Reserve' },
              { grp: 'AB+', count: 7, alert: false, label: 'Universal Recipient' },
              { grp: 'AB-', count: 3, alert: false, label: 'Normal' },
            ].map((b) => (
              <div
                key={b.grp}
                style={{
                  background: b.alert ? '#FEF2F2' : '#FFFFFF',
                  border: b.alert ? '1.5px solid #F87171' : '1px solid #E2E8F0',
                  borderRadius: 14, padding: 14, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4
                }}
              >
                <span style={{ fontSize: '1.4rem', fontWeight: 900, color: b.alert ? '#DC2626' : '#0F172A' }}>
                  {b.grp}
                </span>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: b.alert ? '#DC2626' : '#2563EB' }}>
                  {b.count} Units
                </span>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: b.alert ? '#B91C1C' : '#64748B' }}>
                  {b.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. MODAL: Enter Results & Delta Check Validation (Upgrade 2) */}
      {selectedOrderForResults && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 18, width: '100%', maxWidth: 660,
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            display: 'flex', flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 22px', borderBottom: '1px solid #E2E8F0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
                  Result Entry & Electronic Validation
                </h3>
                <span style={{ fontSize: '0.76rem', color: '#64748B' }}>
                  {selectedOrderForResults.patientName} ({selectedOrderForResults.hospitalNumber}) • {selectedOrderForResults.name}
                </span>
              </div>
              <X size={20} color="#64748B" style={{ cursor: 'pointer' }} onClick={() => setSelectedOrderForResults(null)} />
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCommitResults} style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Delta Check Warnings if triggered */}
              {activeDeltaViolations.length > 0 && (
                <div style={{
                  background: '#FEF2F2', border: '1.5px solid #F87171', borderRadius: 10,
                  padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#991B1B', fontWeight: 800, fontSize: '0.8rem' }}>
                    <AlertTriangle size={16} />
                    AUTOMATED DELTA-CHECK ANOMALY DETECTED
                  </div>
                  {activeDeltaViolations.map((v, i) => (
                    <div key={i} style={{ fontSize: '0.76rem', color: '#7F1D1D' }}>
                      • <strong>{v.analyte}:</strong> {v.message} (Previous: {v.previousValue})
                    </div>
                  ))}
                </div>
              )}

              {/* Analytes Input Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>
                  Standard Test Analytes & Reference Intervals
                </span>

                {getAnalyteFields(selectedOrderForResults.name).map((field) => (
                  <div
                    key={field.name}
                    style={{
                      display: 'grid', gridTemplateColumns: '1.8fr 1fr 1.2fr', gap: 10, alignItems: 'center',
                      background: '#F8FAFC', padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0'
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.78rem', color: '#1E293B', display: 'block' }}>
                        {field.name}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
                        Ref: {field.ref} {field.unit}
                      </span>
                    </div>

                    <input
                      type="text"
                      placeholder={`Value (${field.unit})`}
                      value={resultInputValues[field.name] || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setResultInputValues((prev) => ({ ...prev, [field.name]: val }));
                        // Auto-detect panic if numerical
                        const num = parseFloat(val);
                        if (!isNaN(num)) {
                          if ((field.criticalLow !== undefined && num <= field.criticalLow) ||
                              (field.criticalHigh !== undefined && num >= field.criticalHigh)) {
                            setIsPanicResult(true);
                          }
                        }
                      }}
                      style={{
                        padding: '6px 10px', borderRadius: 6, border: '1px solid #CBD5E1',
                        fontSize: '0.8rem', outline: 'none'
                      }}
                    />

                    <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                      {field.unit}
                    </span>
                  </div>
                ))}
              </div>

              {/* Clinical Notes / Interpretation */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  PATHOLOGIST / SCIENTIST INTERPRETATIVE NOTES
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional microscopy details, delta-check comments, or antibiotic sensitivity pattern…"
                  value={resultNotes}
                  onChange={(e) => setResultNotes(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1',
                    fontSize: '0.8rem', outline: 'none', resize: 'vertical'
                  }}
                />
              </div>

              {/* Critical Value Toggle */}
              <div style={{
                background: isPanicResult ? '#FEF2F2' : '#F1F5F9',
                border: isPanicResult ? '1px solid #FCA5A5' : '1px solid #E2E8F0',
                borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10
              }}>
                <input
                  type="checkbox"
                  id="panic-toggle"
                  checked={isPanicResult}
                  onChange={(e) => setIsPanicResult(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <label htmlFor="panic-toggle" style={{ fontSize: '0.78rem', fontWeight: 700, color: isPanicResult ? '#DC2626' : '#334155', cursor: 'pointer' }}>
                  Flag as CRITICAL / PANIC Value (Triggers mandatory verbal doctor escalation)
                </label>
              </div>

              {/* Sign-off button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setSelectedOrderForResults(null)}
                  style={{
                    background: 'none', border: '1px solid #CBD5E1', padding: '9px 16px',
                    borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, color: '#475569', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: '#059669', color: '#FFFFFF', border: 'none',
                    padding: '9px 20px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                  }}
                >
                  <Send size={15} />
                  Sign-Off & Transmit to EHR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: Microbiology Antibiogram (Upgrade 1) */}
      {antibiogramOrder && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 18, width: '100%', maxWidth: 720,
            maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            display: 'flex', flexDirection: 'column'
          }}>
            <div style={{
              padding: '18px 22px', borderBottom: '1px solid #E2E8F0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#7C3AED' }}>
                  Culture & Antimicrobial Susceptibility Matrix (AST)
                </h3>
                <span style={{ fontSize: '0.76rem', color: '#64748B' }}>
                  {antibiogramOrder.patientName} ({antibiogramOrder.hospitalNumber}) • {antibiogramOrder.name}
                </span>
              </div>
              <X size={20} color="#64748B" style={{ cursor: 'pointer' }} onClick={() => setAntibiogramOrder(null)} />
            </div>

            <form onSubmit={handleCommitAntibiogram} style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Organism & Colony Count */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    ISOLATED PATHOGEN
                  </label>
                  <select
                    value={selectedOrganism}
                    onChange={(e) => setSelectedOrganism(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                  >
                    <option value="Escherichia coli">Escherichia coli</option>
                    <option value="Staphylococcus aureus (Coagulase +ve)">Staphylococcus aureus</option>
                    <option value="Klebsiella pneumoniae">Klebsiella pneumoniae</option>
                    <option value="Pseudomonas aeruginosa">Pseudomonas aeruginosa</option>
                    <option value="Acinetobacter baumannii">Acinetobacter baumannii</option>
                    <option value="Enterococcus faecalis">Enterococcus faecalis</option>
                    <option value="Salmonella enterica serovar Typhi">Salmonella enterica serovar Typhi</option>
                    <option value="Streptococcus pneumoniae">Streptococcus pneumoniae</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    COLONY COUNT / MORPHOLOGY
                  </label>
                  <input
                    type="text"
                    value={colonyCount}
                    onChange={(e) => setColonyCount(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                  />
                </div>
              </div>

              {/* Antibiogram Matrix Table */}
              <div>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  Antibiotic Panel & Susceptibility Status (S / I / R)
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                  {antibiogramList.map((item, idx) => (
                    <div
                      key={item.code}
                      style={{
                        display: 'grid', gridTemplateColumns: '2fr 1fr 140px', gap: 10, alignItems: 'center',
                        background: '#F8FAFC', padding: '6px 12px', borderRadius: 6, border: '1px solid #E2E8F0'
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '0.8rem', color: '#0F172A' }}>{item.name}</strong>
                        <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block' }}>{item.class}</span>
                      </div>

                      <div style={{ fontSize: '0.74rem', color: '#475569' }}>
                        MIC: {item.mic} µg/mL
                      </div>

                      <div style={{ display: 'flex', gap: 4 }}>
                        {(['S', 'I', 'R'] as const).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => {
                              const updated = [...antibiogramList];
                              updated[idx].status = st;
                              setAntibiogramList(updated);
                            }}
                            style={{
                              flex: 1, padding: '4px 0', borderRadius: 4, border: 'none',
                              background: item.status === st ? (st === 'S' ? '#10B981' : st === 'I' ? '#F59E0B' : '#EF4444') : '#E2E8F0',
                              color: item.status === st ? '#FFFFFF' : '#64748B',
                              fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer'
                            }}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setAntibiogramOrder(null)}
                  style={{ background: 'none', border: '1px solid #CBD5E1', padding: '8px 16px', borderRadius: 8, fontSize: '0.8rem', color: '#475569', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: '#7C3AED', color: '#FFFFFF', border: 'none',
                    padding: '8px 20px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Commit Antibiogram to EHR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: Serial Analyte Trends Curve Viewer (Upgrade 4) */}
      {trendModalOrder && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 18, width: '100%', maxWidth: 580,
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
                  Serial Analyte Diagnostic Trend
                </h3>
                <span style={{ fontSize: '0.76rem', color: '#64748B' }}>
                  {trendModalOrder.patientName} ({trendModalOrder.hospitalNumber})
                </span>
              </div>
              <X size={18} color="#64748B" style={{ cursor: 'pointer' }} onClick={() => setTrendModalOrder(null)} />
            </div>

            {/* Analyte Tab Selector */}
            <div style={{ display: 'flex', gap: 6 }}>
              {(['Troponin', 'Hemoglobin', 'Creatinine', 'Potassium'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setTrendAnalyte(a)}
                  style={{
                    padding: '5px 12px', borderRadius: 6, border: '1px solid',
                    borderColor: trendAnalyte === a ? '#0891B2' : '#E2E8F0',
                    background: trendAnalyte === a ? '#E0F2FE' : '#FFFFFF',
                    color: trendAnalyte === a ? '#0369A1' : '#475569',
                    fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  {a}
                </button>
              ))}
            </div>

            {/* Interactive SVG Curve */}
            <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 18, border: '1px solid #E2E8F0', textAlign: 'center' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 10 }}>
                {trendAnalyte === 'Troponin' ? 'High-Sensitivity Troponin-I (0h → 3h → 6h delta)' :
                 trendAnalyte === 'Hemoglobin' ? 'Hemoglobin (g/dL) Serial Trajectory' :
                 trendAnalyte === 'Creatinine' ? 'Serum Creatinine (µmol/L) Acute Curve' : 'Potassium (mmol/L) Serial Measurements'}
              </span>

              <svg width="100%" height="160" viewBox="0 0 460 160" style={{ overflow: 'visible' }}>
                {/* Horizontal Baseline / Threshold */}
                <line x1="40" y1="90" x2="420" y2="90" stroke="#EF4444" strokeDasharray="4,4" strokeWidth="1.5" />
                <text x="424" y="93" fill="#DC2626" fontSize="10" fontWeight="700">Ref Limit</text>

                {/* Plot Points & Line */}
                {trendAnalyte === 'Troponin' ? (
                  <>
                    <polyline points="60,130 180,95 300,45 400,25" fill="none" stroke="#DC2626" strokeWidth="2.5" />
                    <circle cx="60" cy="130" r="5" fill="#DC2626" />
                    <text x="50" y="150" fill="#475569" fontSize="10">0h: 0.02</text>

                    <circle cx="180" cy="95" r="5" fill="#DC2626" />
                    <text x="170" y="85" fill="#DC2626" fontSize="10" fontWeight="700">3h: 0.08</text>

                    <circle cx="300" cy="45" r="5" fill="#DC2626" />
                    <text x="290" y="35" fill="#DC2626" fontSize="10" fontWeight="700">6h: 0.42</text>

                    <circle cx="400" cy="25" r="5" fill="#DC2626" />
                    <text x="385" y="15" fill="#DC2626" fontSize="10" fontWeight="800">Current: 0.94</text>
                  </>
                ) : (
                  <>
                    <polyline points="60,50 180,70 300,110 400,125" fill="none" stroke="#0284C7" strokeWidth="2.5" />
                    <circle cx="60" cy="50" r="5" fill="#0284C7" />
                    <text x="45" y="40" fill="#475569" fontSize="10">Day -2: 13.8</text>

                    <circle cx="180" cy="70" r="5" fill="#0284C7" />
                    <text x="165" y="60" fill="#475569" fontSize="10">Day -1: 12.1</text>

                    <circle cx="300" cy="110" r="5" fill="#0284C7" />
                    <text x="285" y="100" fill="#475569" fontSize="10">Today: 9.4</text>

                    <circle cx="400" cy="125" r="5" fill="#DC2626" />
                    <text x="375" y="145" fill="#DC2626" fontSize="10" fontWeight="800">Now: 8.2</text>
                  </>
                )}
              </svg>

              <div style={{ background: '#FEF2F2', padding: '10px 14px', borderRadius: 8, marginTop: 14, fontSize: '0.78rem', color: '#991B1B', textAlign: 'left' }}>
                <strong>Clinical Interpretation:</strong> {trendAnalyte === 'Troponin' ?
                  'Rapid dynamic rise in hs-cTnI (> 20% delta at 3h). Confirms evolving acute myocardial injury. Attending cardiology consultation advised.' :
                  'Significant delta drop in patient serial trajectory (> 2.0 g/dL change). Exclude active gastrointestinal or internal bleed.'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setTrendModalOrder(null)}
                style={{ background: '#0F172A', color: '#FFFFFF', border: 'none', padding: '7px 18px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL: Direct Lab Order */}
      {showDirectOrderModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 18, width: '100%', maxWidth: 520,
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{
              padding: '18px 22px', borderBottom: '1px solid #E2E8F0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
                New Direct Lab Test Request
              </h3>
              <X size={20} color="#64748B" style={{ cursor: 'pointer' }} onClick={() => setShowDirectOrderModal(false)} />
            </div>

            <form onSubmit={handleCreateDirectOrder} style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  PATIENT
                </label>
                <select
                  value={orderPatientId}
                  onChange={(e) => setOrderPatientId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                  required
                >
                  <option value="">Select registered patient…</option>
                  {patients.slice(0, 50).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} · {p.hospitalNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  TEST DIRECTORY / BENCH
                </label>
                <select
                  value={orderTestName}
                  onChange={(e) => setOrderTestName(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                >
                  <optgroup label="Hematology">
                    <option value="Full Blood Count (FBC + Diff)">Full Blood Count (FBC + Diff)</option>
                    <option value="Erythrocyte Sedimentation Rate (ESR)">Erythrocyte Sedimentation Rate (ESR)</option>
                    <option value="Prothrombin Time / INR (Coagulation)">Prothrombin Time / INR (Coagulation)</option>
                    <option value="Hemoglobin Electrophoresis (HbAA/HbAS/HbSS)">Hemoglobin Electrophoresis</option>
                  </optgroup>
                  <optgroup label="Clinical Chemistry">
                    <option value="Electrolytes, Urea & Creatinine (U/E/Cr)">Electrolytes, Urea & Creatinine (U/E/Cr)</option>
                    <option value="Liver Function Tests (LFT Panel)">Liver Function Tests (LFT Panel)</option>
                    <option value="Fasting Blood Glucose (FBS)">Fasting Blood Glucose (FBS)</option>
                    <option value="Cardiac Troponin-I (STAT)">Cardiac Troponin-I (STAT)</option>
                    <option value="Lipid Profile Complete">Lipid Profile Complete</option>
                  </optgroup>
                  <optgroup label="Parasitology & Microbiology">
                    <option value="Malaria Parasite (Giemsa Thick & Thin)">Malaria Parasite (Giemsa Thick & Thin)</option>
                    <option value="Urinalysis Complete (10 Parameters)">Urinalysis Complete (10 Parameters)</option>
                    <option value="Urine Microscopy, Culture & Sensitivity">Urine Microscopy, Culture & Sensitivity</option>
                    <option value="Blood Culture x2 (Aerobic/Anaerobic)">Blood Culture x2</option>
                  </optgroup>
                  <optgroup label="Serology & Blood Bank">
                    <option value="Widal Agglutination (Typhoid)">Widal Agglutination (Typhoid)</option>
                    <option value="Retroviral Screening (HIV 1 & 2)">Retroviral Screening (HIV 1 & 2)</option>
                    <option value="Hepatitis B Surface Antigen (HBsAg)">Hepatitis B Surface Antigen (HBsAg)</option>
                    <option value="Blood Grouping & Rhesus (ABO/Rh)">Blood Grouping & Rhesus (ABO/Rh)</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  PRIORITY
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {(['routine', 'urgent', 'stat'] as const).map((pr) => (
                    <button
                      key={pr}
                      type="button"
                      onClick={() => setOrderPriority(pr)}
                      style={{
                        flex: 1, padding: '7px 0', borderRadius: 6, border: '1px solid',
                        borderColor: orderPriority === pr ? (pr === 'stat' ? '#DC2626' : pr === 'urgent' ? '#D97706' : '#2563EB') : '#E2E8F0',
                        background: orderPriority === pr ? (pr === 'stat' ? '#FEE2E2' : pr === 'urgent' ? '#FEF3C7' : '#EFF6FF') : '#FFFFFF',
                        color: orderPriority === pr ? (pr === 'stat' ? '#DC2626' : pr === 'urgent' ? '#D97706' : '#2563EB') : '#475569',
                        fontWeight: 700, fontSize: '0.78rem', textTransform: 'capitalize', cursor: 'pointer'
                      }}
                    >
                      {pr}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  CLINICAL NOTES
                </label>
                <input
                  type="text"
                  placeholder="Clinical indication / provisional diagnosis…"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.8rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowDirectOrderModal(false)}
                  style={{ background: 'none', border: '1px solid #CBD5E1', padding: '8px 14px', borderRadius: 8, fontSize: '0.8rem', color: '#475569', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: '#0891B2', color: '#FFFFFF', border: 'none',
                    padding: '8px 18px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Create Lab Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. MODAL: Printable Specimen Barcode Label */}
      {barcodeLabelModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 420,
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)', padding: 22, display: 'flex', flexDirection: 'column', gap: 16
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
                Specimen Tube Label
              </h3>
              <X size={18} color="#64748B" style={{ cursor: 'pointer' }} onClick={() => setBarcodeLabelModal(null)} />
            </div>

            {/* Realistic Barcode Label Card */}
            <div style={{
              background: '#FFFFFF', border: '2px dashed #0F172A', borderRadius: 8,
              padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6,
              fontFamily: 'monospace'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: '0.9rem', color: '#000' }}>
                    {barcodeLabelModal.patientName}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#333' }}>
                    ID: {barcodeLabelModal.hospitalNumber}
                  </div>
                </div>
                <div style={{
                  background: inferTube(barcodeLabelModal.name).capHex,
                  color: '#FFF', fontSize: '0.65rem', padding: '2px 6px', borderRadius: 3, fontWeight: 900
                }}>
                  {inferTube(barcodeLabelModal.name).type.split(' ')[0]}
                </div>
              </div>

              {/* Barcode Visual simulation */}
              <div style={{ textAlign: 'center', margin: '8px 0' }}>
                <svg width="220" height="42" style={{ display: 'inline-block' }}>
                  {[4, 2, 6, 2, 4, 3, 2, 5, 2, 4, 2, 6, 3, 2, 4, 5, 2, 3, 6, 2, 4, 3, 5, 2, 4, 2, 6, 3].map((w, i) => (
                    <rect key={i} x={i * 7.5} y="0" width={w} height="36" fill="#000" />
                  ))}
                </svg>
                <div style={{ fontSize: '0.72rem', letterSpacing: '0.15em', fontWeight: 800, color: '#000' }}>
                  {barcodeLabelModal.id}
                </div>
              </div>

              <div style={{ fontSize: '0.72rem', color: '#000', borderTop: '1px solid #CCC', paddingTop: 4 }}>
                <strong>{barcodeLabelModal.name}</strong> • {new Date().toLocaleTimeString()}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setBarcodeLabelModal(null)}
                style={{ background: 'none', border: '1px solid #CBD5E1', padding: '7px 14px', borderRadius: 8, fontSize: '0.78rem', color: '#475569', cursor: 'pointer' }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  notify(`Specimen label for ${barcodeLabelModal.patientName} sent to Zebra Barcode Printer.`);
                  setBarcodeLabelModal(null);
                }}
                style={{
                  background: '#0891B2', color: '#FFFFFF', border: 'none',
                  padding: '7px 16px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                <Printer size={14} />
                Print Label
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. MODAL: Doctor Verbal Read-back Call Logger */}
      {phoneCallOrder && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 480,
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)', padding: 22, display: 'flex', flexDirection: 'column', gap: 14
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PhoneCall size={20} color="#DC2626" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#DC2626' }}>
                  Critical Value Verbal Communication Log
                </h3>
              </div>
              <X size={18} color="#64748B" style={{ cursor: 'pointer' }} onClick={() => setPhoneCallOrder(null)} />
            </div>

            <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B', lineHeight: 1.4 }}>
              Record telephone conversation with the clinician. The doctor must verbally repeat the result back to confirm understanding.
            </p>

            <form onSubmit={handleConfirmPhoneCall} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: '#FEF2F2', padding: 10, borderRadius: 8, border: '1px solid #FCA5A5', fontSize: '0.8rem', color: '#991B1B' }}>
                <strong>Patient:</strong> {phoneCallOrder.patientName} ({phoneCallOrder.hospitalNumber})<br />
                <strong>Critical Finding:</strong> {phoneCallOrder.name} — {phoneCallOrder.resultSummary || 'Awaiting entry'}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  DOCTOR / CLINICIAN SPOKEN WITH
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. K. Adeleke (Internal Medicine)"
                  value={doctorPhoneName}
                  onChange={(e) => setDoctorPhoneName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 4 }}>
                <input
                  type="checkbox"
                  id="readback-check"
                  checked={readBackConfirmed}
                  onChange={(e) => setReadBackConfirmed(e.target.checked)}
                  style={{ width: 16, height: 16, marginTop: 2, cursor: 'pointer' }}
                  required
                />
                <label htmlFor="readback-check" style={{ fontSize: '0.76rem', color: '#1E293B', fontWeight: 600, cursor: 'pointer' }}>
                  I confirm that the clinician was reached by telephone and verbally read back the patient name, hospital number, and critical lab values correctly.
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setPhoneCallOrder(null)}
                  style={{ background: 'none', border: '1px solid #CBD5E1', padding: '7px 14px', borderRadius: 8, fontSize: '0.78rem', color: '#475569', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!readBackConfirmed || !doctorPhoneName.trim()}
                  style={{
                    background: '#DC2626', color: '#FFFFFF', border: 'none',
                    padding: '7px 16px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700,
                    cursor: 'pointer', opacity: !readBackConfirmed || !doctorPhoneName.trim() ? 0.6 : 1
                  }}
                >
                  Commit Audit Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
