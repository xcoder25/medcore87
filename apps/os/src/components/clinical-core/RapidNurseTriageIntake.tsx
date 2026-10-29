'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Heart,
  Thermometer,
  Activity,
  Wind,
  Weight,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Mic,
  MicOff,
  Printer,
  QrCode,
  Scan,
  User,
  ShieldAlert,
  ArrowRight,
  Clock,
  Sparkles,
  Check,
  X,
  Stethoscope,
  Volume2,
  Sliders,
  ChevronDown,
  Layers,
  Baby,
  Flame,
  Radio,
  FileText
} from 'lucide-react';
import { autonomousTriageScore } from '../../lib/clinicalAiAutomations';
import { assignVisitTriageAndDepartment, listVisits, type ReceptionVisit } from '../../lib/receptionOpsStore';
import { saveVitals, type VitalsRecord } from '../../lib/nursingVitalsStore';
import { broadcastOpdStage } from '../../hooks/useOpdSync';
import { pushNotification } from '../../lib/notificationEngine';
import { listStaffCards } from '../../lib/staffCardStore';

/**
 * RapidNurseTriageIntake — 60-Second Nurse Triage Intake Interface.
 * Built for Akwa Ibom State General Hospitals & Primary Healthcare Centres (PHCs).
 * Features:
 * 1. Biometric/NIN/ID Quick-Find & Demographic Banner with Allergy/Chronic Alerts.
 * 2. Rapid Vitals Input Module with touch pads, smart error auto-correction, and Bluetooth telemetry sync.
 * 3. Chief Complaint & Ambient AI Voice Dictation + Localized Rapid-Click Symptom Grid.
 * 4. Real-time Embedded AI Risk Scoring (ESI 1-5, NEWS2, Sepsis & Pre-Eclampsia alerts).
 * 5. 1-Click Routing & Color-Coded Barcode Wristband Generation.
 */

export interface RapidTriageProps {
  initialPatientId?: string;
  facilityId?: string;
  nurseName?: string;
  session?: any;
  onComplete?: (vitalsRecord: VitalsRecord) => void;
  onCancel?: () => void;
  onClose?: () => void;
}

// Sample Akwa Ibom verified patients with chronic tags & allergies for instant demo
const DEMO_VERIFIED_PATIENTS = [
  {
    patientId: 'PAT-AKS-4401',
    hospitalNumber: 'HOSP-2026-4401',
    nin: 'NIN-91823746109',
    fullName: 'Aniefiok Ekpenyong',
    age: 34,
    dob: '1992-04-12',
    gender: 'Male',
    lga: 'Uyo',
    bloodGroup: 'O+',
    genotype: 'HbAS',
    allergies: ['PENICILLIN', 'SULFA DRUGS'],
    chronicConditions: ['HYPERTENSION (STAGE 2)'],
    isPregnant: false,
    weightKg: 74,
    heightCm: 175,
  },
  {
    patientId: 'PAT-AKS-8812',
    hospitalNumber: 'HOSP-2026-8812',
    nin: 'NIN-44910283711',
    fullName: 'Blessing Emmanuel Udoh',
    age: 26,
    dob: '2000-08-19',
    gender: 'Female',
    lga: 'Eket',
    bloodGroup: 'B+',
    genotype: 'HbAA',
    allergies: ['NONE DOCUMENTED'],
    chronicConditions: ['GESTATIONAL HYPERTENSION (32 WEEKS GA)'],
    isPregnant: true,
    weightKg: 68,
    heightCm: 162,
  },
  {
    patientId: 'PAT-AKS-1092',
    hospitalNumber: 'HOSP-2026-1092',
    nin: 'NIN-55019283741',
    fullName: 'Kufre-Abasi Sunday',
    age: 3,
    dob: '2023-05-10',
    gender: 'Male',
    lga: 'Ikot Ekpene',
    bloodGroup: 'A+',
    genotype: 'HbSS',
    allergies: ['CHLOROQUINE'],
    chronicConditions: ['SICKLE CELL DISEASE (HbSS)'],
    isPregnant: false,
    weightKg: 13.5,
    heightCm: 92,
  },
  {
    patientId: 'PAT-AKS-9934',
    hospitalNumber: 'HOSP-2026-9934',
    nin: 'NIN-11928374029',
    fullName: 'Edidiong Bassey Akpan',
    age: 62,
    dob: '1964-11-03',
    gender: 'Female',
    lga: 'Oron',
    bloodGroup: 'O-',
    genotype: 'HbAA',
    allergies: ['NSAIDs / ASPIRIN'],
    chronicConditions: ['TYPE 2 DIABETES', 'CHRONIC KIDNEY DISEASE (STAGE 3)'],
    isPregnant: false,
    weightKg: 82,
    heightCm: 160,
  },
];

// Akwa Ibom localized symptom checklist
const REGIONAL_SYMPTOMS = [
  { id: 'fever', label: '🔥 Fever / Rigors / Chills', category: 'General', urgencyWeight: 2 },
  { id: 'headache', label: '⚡ Severe Throbbing Headache', category: 'Neuro', urgencyWeight: 2 },
  { id: 'jaundice', label: '👁️ Jaundice (Yellow Eyes)', category: 'Hepatic', urgencyWeight: 3 },
  { id: 'convulsions', label: '🧠 Convulsions / Altered Consciousness', category: 'Neuro', urgencyWeight: 5 },
  { id: 'pregnancy_bleeding', label: '🤰 Pregnancy Bleeding / Reduced Fetal Move', category: 'Maternal', urgencyWeight: 5 },
  { id: 'breathlessness', label: '🫁 Breathlessness / Chest Tightness', category: 'Cardiorespiratory', urgencyWeight: 4 },
  { id: 'vomiting', label: '🤢 Persistent Vomiting / Inability to Feed', category: 'Pediatric/GI', urgencyWeight: 3 },
  { id: 'diarrhea', label: '💧 Acute Watery Diarrhea / Rice-Water Stools', category: 'GI/Infection', urgencyWeight: 3 },
  { id: 'pallor', label: '🩸 Severe Pallor / Dizziness', category: 'Hematology', urgencyWeight: 3 },
  { id: 'flank_pain', label: '🩹 Acute Abdominal / Flank Pain', category: 'Surgical', urgencyWeight: 2 },
];

// Presets for rapid-click speech dictation
const AMBIENT_SPEECH_PRESETS = [
  {
    title: 'Pediatric Febrile Convulsion Presentation',
    text: '3-year-old child presenting with hot body for 3 days, had two episodes of generalized tonic-clonic convulsions this morning, vomiting every time he tries to breastfeed, extremely weak.',
  },
  {
    title: 'Maternal Impending Eclampsia Alert',
    text: '26-year-old primigravida at 32 weeks gestational age presenting with severe unyielding frontal headache, blurred vision with flashing lights, facial and bilateral pitting ankle edema.',
  },
  {
    title: 'Adult Septic Shock / Acute Abdomen',
    text: '48-year-old male with severe right lower quadrant abdominal pain for 48 hours, high spiking fever, profuse sweating, shivering, rapid shallow breathing, unable to stand upright.',
  },
  {
    title: 'Routine Adult Malaria / Body Aches',
    text: '34-year-old presenting with low grade intermittent fever, chills, bitter taste in mouth, body weakness, and headache for the past 24 hours. Able to retain oral fluids.',
  },
];

export const RapidNurseTriageIntake: React.FC<RapidTriageProps> = ({
  initialPatientId,
  facilityId = 'Immanuel General Hospital, Eket',
  nurseName,
  session,
  onComplete,
  onCancel,
  onClose,
}) => {
  const activeNurseName = nurseName || session?.fullName || session?.name || 'Nurse E. Udoh (RN/RM)';
  const handleClose = onClose || onCancel;

  // ── 1. PATIENT IDENTIFICATION STATE ──────────────────────────────────────
  const [selectedPatientIndex, setSelectedPatientIndex] = useState<number>(0);
  const [isScanningBiometric, setIsScanningBiometric] = useState<boolean>(false);
  const [scanMessage, setScanMessage] = useState<string>('');

  const patient = DEMO_VERIFIED_PATIENTS[selectedPatientIndex];

  // ── 2. RAPID VITALS STATE ────────────────────────────────────────────────
  const [bpSystolic, setBpSystolic] = useState<string>('124');
  const [bpDiastolic, setBpDiastolic] = useState<string>('82');
  const [pulseRate, setPulseRate] = useState<string>('76');
  const [spo2, setSpo2] = useState<string>('98');
  const [tempC, setTempC] = useState<string>('37.1');
  const [respRate, setRespRate] = useState<string>('18');
  const [weightKg, setWeightKg] = useState<string>(String(patient.weightKg));
  const [heightCm, setHeightCm] = useState<string>(String(patient.heightCm));
  const [painScore, setPainScore] = useState<number>(2);
  const [isBluetoothSyncing, setIsBluetoothSyncing] = useState<boolean>(false);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);

  // Sync weight/height when patient switches
  useEffect(() => {
    setWeightKg(String(patient.weightKg));
    setHeightCm(String(patient.heightCm));
  }, [patient]);

  // ── 3. CHIEF COMPLAINT & SYMPTOMS STATE ──────────────────────────────────
  const [chiefComplaint, setChiefComplaint] = useState<string>('Patient reports general fatigue and low fever.');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(['fever']);
  const [isListeningSpeech, setIsListeningSpeech] = useState<boolean>(false);
  const [speechPresetIdx, setSpeechPresetIdx] = useState<number>(0);

  // ── 4. ROUTING & WRISTBAND STATE ─────────────────────────────────────────
  const [targetDestination, setTargetDestination] = useState<string>('General Outpatient Queue (OPD)');
  const [assignedRoom, setAssignedRoom] = useState<string>('Consulting Room 1 · Dr. Bassey');
  const [showWristbandModal, setShowWristbandModal] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  // ── SMART INPUT VALIDATION & AUTO-CORRECTION ─────────────────────────────
  const handleTempChange = (val: string) => {
    // Flag/auto-correct extreme typos: e.g. 370 -> 37.0
    const num = parseFloat(val);
    if (!isNaN(num) && num > 45 && num <= 450) {
      const corrected = (num / 10).toFixed(1);
      setTempC(corrected);
      setValidationWarning(`Smart auto-corrected temperature from ${val}°C to ${corrected}°C.`);
      setTimeout(() => setValidationWarning(null), 4000);
      return;
    }
    setTempC(val);
  };

  const handleSystolicChange = (val: string) => {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 300) {
      setValidationWarning(`⚠️ Warning: Systolic BP ${num} mmHg exceeds physiological maximum.`);
      setTimeout(() => setValidationWarning(null), 4000);
    }
    setBpSystolic(val);
  };

  const handleSpo2Change = (val: string) => {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 100) {
      setSpo2('100');
      setValidationWarning('SpO2 maximum is 100%. Auto-capped.');
      setTimeout(() => setValidationWarning(null), 3000);
      return;
    }
    setSpo2(val);
  };

  // ── BLUETOOTH TELEMETRY SYNC SIMULATOR ───────────────────────────────────
  const handleBluetoothSync = () => {
    setIsBluetoothSyncing(true);
    setScanMessage('Connecting to Omron / Contec Bluetooth Gateway…');
    setTimeout(() => {
      // Simulate reading live sensor values
      setBpSystolic('128');
      setBpDiastolic('84');
      setPulseRate('82');
      setSpo2('99');
      setTempC('36.9');
      setRespRate('16');
      setIsBluetoothSyncing(false);
      setScanMessage('✅ Vitals captured via Bluetooth telemetry');
      setTimeout(() => setScanMessage(''), 3000);
    }, 1100);
  };

  // ── BIOMETRIC / NIN SCANNER SIMULATOR ────────────────────────────────────
  const handleBiometricScan = () => {
    setIsScanningBiometric(true);
    setScanMessage('Biometric Fingerprint / NIN Optical Scanner Active…');
    setTimeout(() => {
      // Cycle to next demo patient to demonstrate instant patient lookup
      const nextIdx = (selectedPatientIndex + 1) % DEMO_VERIFIED_PATIENTS.length;
      setSelectedPatientIndex(nextIdx);
      setIsScanningBiometric(false);
      setScanMessage(`✅ Patient Verified: ${DEMO_VERIFIED_PATIENTS[nextIdx].fullName} (${DEMO_VERIFIED_PATIENTS[nextIdx].nin})`);
      setTimeout(() => setScanMessage(''), 3500);
    }, 1200);
  };

  // ── AMBIENT AI SPEECH DICTATION SIMULATOR ────────────────────────────────
  const handleToggleSpeech = () => {
    if (!isListeningSpeech) {
      setIsListeningSpeech(true);
      const preset = AMBIENT_SPEECH_PRESETS[speechPresetIdx % AMBIENT_SPEECH_PRESETS.length];
      setSpeechPresetIdx((prev) => prev + 1);

      // Simulate real-time streaming speech-to-text
      setTimeout(() => {
        setChiefComplaint(preset.text);
        setIsListeningSpeech(false);
        setScanMessage(`🎙️ Ambient Scribing Extracted: "${preset.title}"`);
        setTimeout(() => setScanMessage(''), 4000);
      }, 1500);
    } else {
      setIsListeningSpeech(false);
    }
  };

  const toggleSymptom = (id: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  // ── 4. REAL-TIME AI RISK SCORING (ESI / NEWS2 / DETERIORATION) ───────────
  const sysNum = parseInt(bpSystolic, 10) || 0;
  const diaNum = parseInt(bpDiastolic, 10) || 0;
  const hrNum = parseInt(pulseRate, 10) || 0;
  const spo2Num = parseInt(spo2, 10) || 0;
  const tempNum = parseFloat(tempC) || 0;
  const rrNum = parseInt(respRate, 10) || 0;
  const wtNum = parseFloat(weightKg) || 0;
  const htNum = parseFloat(heightCm) || 0;

  // Calculate BMI
  const bmi = wtNum > 0 && htNum > 0 ? (wtNum / Math.pow(htNum / 100, 2)).toFixed(1) : null;

  // Real-time AI Triage calculation using MedCore clinicalAiAutomations
  const aiTriage = useMemo(() => {
    return autonomousTriageScore({
      ageYears: patient.age,
      bpSystolic: sysNum,
      bpDiastolic: diaNum,
      pulseRate: hrNum,
      tempC: tempNum,
      spo2: spo2Num,
      respRate: rrNum,
      isPregnant: patient.isPregnant,
      chiefComplaint: `${chiefComplaint} Symptoms: ${selectedSymptoms.join(', ')}`,
    });
  }, [patient, sysNum, diaNum, hrNum, tempNum, spo2Num, rrNum, chiefComplaint, selectedSymptoms]);

  // Specific Akwa Ibom Clinical Deterioration Alerts
  const clinicalAlerts = useMemo(() => {
    const alerts: { title: string; desc: string; severity: 'CRITICAL' | 'WARNING'; upgradeEsi?: number }[] = [];

    // 1. Sepsis / SIRS criteria
    const sirsCount =
      (tempNum > 38.0 || tempNum < 36.0 ? 1 : 0) +
      (hrNum > 90 ? 1 : 0) +
      (rrNum > 20 ? 1 : 0);
    if (sirsCount >= 2 && (selectedSymptoms.includes('fever') || selectedSymptoms.includes('vomiting'))) {
      alerts.push({
        title: '⚠️ High Sepsis Risk (SIRS Criteria Met)',
        desc: `Temperature ${tempNum}°C, HR ${hrNum} bpm, RR ${rrNum} cpm indicate acute systemic inflammatory response.`,
        severity: 'CRITICAL',
        upgradeEsi: 2,
      });
    }

    // 2. Severe Pre-Eclampsia Alert
    if (patient.isPregnant && (sysNum >= 160 || diaNum >= 110 || (sysNum >= 140 && selectedSymptoms.includes('headache')))) {
      alerts.push({
        title: '🚨 Severe Pre-Eclampsia / Impending Eclampsia Alert',
        desc: `Gestational BP ${sysNum}/${diaNum} mmHg with neurologic symptoms. Immediate Magnesium Sulfate & Obstetric evaluation required.`,
        severity: 'CRITICAL',
        upgradeEsi: 1,
      });
    }

    // 3. Pediatric Convulsion / Hyperpyrexia Risk
    if (patient.age <= 5 && tempNum >= 39.5) {
      alerts.push({
        title: '⚠️ Pediatric Hyperpyrexia / Febrile Convulsion Risk',
        desc: `Temperature ${tempNum}°C in ${patient.age}-year-old child. Initiate rapid cooling and malaria RDT protocol.`,
        severity: 'CRITICAL',
        upgradeEsi: 1,
      });
    }

    // 4. Respiratory Distress / Hypoxemia
    if (spo2Num > 0 && spo2Num < 90) {
      alerts.push({
        title: '🚨 Critical Hypoxemic Respiratory Distress',
        desc: `SpO2 ${spo2Num}% (< 90%). Administer high-flow supplemental oxygen immediately.`,
        severity: 'CRITICAL',
        upgradeEsi: 1,
      });
    }

    return alerts;
  }, [patient, sysNum, diaNum, hrNum, tempNum, rrNum, spo2Num, selectedSymptoms]);

  // Compute final effective ESI (applying alert upgrades if triggered)
  const effectiveEsi = useMemo(() => {
    let finalEsi = aiTriage.esiScore;
    clinicalAlerts.forEach((a) => {
      if (a.upgradeEsi && a.upgradeEsi < finalEsi) {
        finalEsi = a.upgradeEsi as 1 | 2 | 3 | 4 | 5;
      }
    });
    return finalEsi;
  }, [aiTriage.esiScore, clinicalAlerts]);

  // Auto-route suggestions based on ESI & condition
  useEffect(() => {
    if (patient.isPregnant && (effectiveEsi <= 2 || selectedSymptoms.includes('pregnancy_bleeding'))) {
      setTargetDestination('Antenatal / Labor Ward');
    } else if (effectiveEsi === 1) {
      setTargetDestination('Accident & Emergency (A&E)');
    } else if (patient.age <= 12 && (effectiveEsi <= 2 || selectedSymptoms.includes('convulsions'))) {
      setTargetDestination('Pediatric Emergency Room');
    } else if (selectedSymptoms.includes('jaundice') && selectedSymptoms.includes('diarrhea')) {
      setTargetDestination('Isolation Unit (for suspected highly infectious diseases)');
    } else {
      setTargetDestination('General Outpatient Queue (OPD)');
    }
  }, [effectiveEsi, patient, selectedSymptoms]);

  // ── 5. SUBMIT TO QUEUE & PRINT WRISTBAND ACTION ──────────────────────────
  const handleSendToQueue = () => {
    const summaryStr = `BP ${sysNum}/${diaNum} · HR ${hrNum} · SpO2 ${spo2Num}% · T ${tempNum}°C · RR ${rrNum} · ESI ${effectiveEsi}`;

    // 1. Save Vitals to nursing store
    const vitalsRecord: VitalsRecord = {
      id: `vit-${Date.now()}`,
      patientId: patient.patientId,
      hospitalNumber: patient.hospitalNumber,
      patientName: patient.fullName,
      facilityId,
      recordedBy: activeNurseName,
      recordedAt: new Date().toISOString(),
      bpSystolic: sysNum || undefined,
      bpDiastolic: diaNum || undefined,
      pulse: hrNum || undefined,
      tempC: tempNum || undefined,
      spo2: spo2Num || undefined,
      weightKg: wtNum || undefined,
      notes: `${chiefComplaint} [Symptoms: ${selectedSymptoms.join(', ')}]`,
      urgency: effectiveEsi === 1 ? 'critical' : effectiveEsi <= 3 ? 'urgent' : 'routine',
    };

    saveVitals(vitalsRecord);

    // 2. Assign visit and push to doctor queue
    assignVisitTriageAndDepartment({
      visitId: `vis-${Date.now()}`,
      facilityId,
      department: targetDestination,
      doctor: assignedRoom.split('·')[1]?.trim() || assignedRoom,
      triageUrgency: vitalsRecord.urgency,
      vitalsSummary: summaryStr,
      vitalsBp: `${sysNum}/${diaNum}`,
      vitalsPulse: hrNum,
      vitalsTemp: tempNum,
      vitalsSpo2: spo2Num,
      vitalsWeight: wtNum,
      triagedBy: nurseName,
    });

    // 3. Broadcast real-time OPD bus sync
    broadcastOpdStage('medcore_doctor', {
      facilityId,
      patientId: patient.patientId,
      hospitalNumber: patient.hospitalNumber,
      patientName: patient.fullName,
      stage: 'vitals_done',
      department: targetDestination,
      doctor: assignedRoom,
      urgency: vitalsRecord.urgency,
      vitalsSummary: summaryStr,
    });

    // 4. Notify doctors
    pushNotification({
      facilityId,
      level: effectiveEsi <= 2 ? 'critical' : 'important',
      title: effectiveEsi <= 2 ? '🚨 STAT TRIAGE ALERT' : 'Triaged Patient Ready',
      body: `${patient.fullName} (${patient.hospitalNumber}) assigned to ${targetDestination} · ESI Level ${effectiveEsi}`,
      module: 'doctor-portal',
      roleHint: 'doctor',
    });

    setIsSubmitted(true);
    setShowWristbandModal(true);

    if (onComplete) {
      onComplete(vitalsRecord);
    }
  };

  const esiBadgeConfig: Record<number, { label: string; bg: string; color: string; border: string }> = {
    1: { label: 'ESI 1 · RESUSCITATION (IMMEDIATE)', bg: '#FEF2F2', color: '#DC2626', border: '#F87171' },
    2: { label: 'ESI 2 · EMERGENT (< 15 MINS)', bg: '#FFF7ED', color: '#EA580C', border: '#FB923C' },
    3: { label: 'ESI 3 · URGENT (ROUTINE PRIORITY)', bg: '#FEFCE8', color: '#CA8A04', border: '#FACC15' },
    4: { label: 'ESI 4 · LESS URGENT', bg: '#EFF6FF', color: '#2563EB', border: '#60A5FA' },
    5: { label: 'ESI 5 · NON-URGENT', bg: '#F0FDF4', color: '#16A34A', border: '#4ADE80' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* ─────────────────────────────────────────────────────────────────
          1. PATIENT VERIFICATION & QUICK-FIND BANNER
      ───────────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 16,
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Flashing Allergy & Chronic Warning Ribbon */}
        {patient.allergies.length > 0 && patient.allergies[0] !== 'NONE DOCUMENTED' && (
          <div
            style={{
              background: 'linear-gradient(90deg, #DC2626 0%, #B91C1C 100%)',
              color: '#FFFFFF',
              padding: '6px 18px',
              fontSize: '0.82rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              animation: 'pulse 2s infinite',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={16} />
              <span>CRITICAL PATIENT ALERTS:</span>
              <span style={{ textDecoration: 'underline' }}>ALLERGIC TO {patient.allergies.join(', ')}</span>
              <span>•</span>
              <span>CHRONIC: {patient.chronicConditions.join(' · ')}</span>
            </div>
            <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 4, fontSize: '0.72rem' }}>
              VERIFIED EHR
            </span>
          </div>
        )}

        {/* Patient Demographic Bar */}
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: patient.gender === 'Female' ? '#FCE7F3' : '#E0F2FE',
                color: patient.gender === 'Female' ? '#BE185D' : '#0369A1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.2rem',
              }}
            >
              {patient.fullName.charAt(0)}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>{patient.fullName}</span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: '#F1F5F9',
                    color: '#475569',
                  }}
                >
                  {patient.gender} · {patient.age} yrs ({patient.dob})
                </span>
                {patient.isPregnant && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: '#FCE7F3', color: '#BE185D' }}>
                    🤰 Pregnant (32w GA)
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.82rem', color: '#64748B', marginTop: 4 }}>
                <span>Hospital ID: <strong>{patient.hospitalNumber}</strong></span>
                <span>•</span>
                <span>NIN: <strong>{patient.nin}</strong></span>
                <span>•</span>
                <span>LGA: <strong>{patient.lga}</strong></span>
                <span>•</span>
                <span>Blood: <strong>{patient.bloodGroup} ({patient.genotype})</strong></span>
              </div>
            </div>
          </div>

          {/* Quick-Find Biometric Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={handleBiometricScan}
              disabled={isScanningBiometric}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 10,
                border: '1px solid #0D9488',
                background: isScanningBiometric ? '#F0FDFA' : '#0D9488',
                color: isScanningBiometric ? '#0D9488' : '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(13,148,136,0.2)',
                transition: 'all 0.15s ease',
              }}
            >
              <Scan size={18} className={isScanningBiometric ? 'animate-spin' : ''} />
              {isScanningBiometric ? 'Scanning...' : 'One-Touch Biometric / NIN Scan'}
            </button>
            {handleClose && (
              <button
                type="button"
                onClick={handleClose}
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid #CBD5E1',
                  background: '#F8FAFC',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                ✕ Close
              </button>
            )}
          </div>
        </div>

        {scanMessage && (
          <div style={{ padding: '8px 20px', background: '#F0FDFA', color: '#0F766E', fontSize: '0.85rem', fontWeight: 700, borderTop: '1px solid #CCFBF1' }}>
            {scanMessage}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          2. RAPID VITALS INPUT MODULE (<60 SECONDS TOUCH CONTROLS)
      ───────────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 16,
          border: '1px solid #E2E8F0',
          padding: '20px',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={18} />
            </div>
            <div>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>Rapid Vitals Input Module</span>
              <span style={{ fontSize: '0.78rem', color: '#64748B', marginLeft: 8 }}>Large touch-friendly inputs & smart auto-validation</span>
            </div>
          </div>

          {/* Bluetooth Sync Button */}
          <button
            type="button"
            onClick={handleBluetoothSync}
            disabled={isBluetoothSyncing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #3B82F6',
              background: '#EFF6FF',
              color: '#1D4ED8',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            <Radio size={16} className={isBluetoothSyncing ? 'animate-pulse' : ''} />
            {isBluetoothSyncing ? 'Syncing Sensors…' : '⚡ Bluetooth Device Telemetry Fetch'}
          </button>
        </div>

        {/* Validation Warning Alert */}
        {validationWarning && (
          <div style={{ padding: '8px 14px', background: '#FEF3C7', color: '#92400E', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, marginBottom: 14 }}>
            {validationWarning}
          </div>
        )}

        {/* Core Vitals Inputs Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          {/* Blood Pressure */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>Blood Pressure (mmHg)</span>
              <Heart size={16} color="#DC2626" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number"
                value={bpSystolic}
                onChange={(e) => handleSystolicChange(e.target.value)}
                placeholder="Sys"
                style={{
                  width: '50%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  textAlign: 'center',
                }}
              />
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#94A3B8' }}>/</span>
              <input
                type="number"
                value={bpDiastolic}
                onChange={(e) => setBpDiastolic(e.target.value)}
                placeholder="Dia"
                style={{
                  width: '50%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  textAlign: 'center',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {['120/80', '140/90', '90/60'].map((bp) => (
                <button
                  key={bp}
                  type="button"
                  onClick={() => {
                    const [s, d] = bp.split('/');
                    setBpSystolic(s);
                    setBpDiastolic(d);
                  }}
                  style={{
                    flex: 1,
                    padding: '3px 0',
                    fontSize: '0.72rem',
                    borderRadius: 4,
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    cursor: 'pointer',
                  }}
                >
                  {bp}
                </button>
              ))}
            </div>
          </div>

          {/* Pulse / Heart Rate */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>Pulse / HR (bpm)</span>
              <Activity size={16} color="#0D9488" />
            </div>
            <input
              type="number"
              value={pulseRate}
              onChange={(e) => setPulseRate(e.target.value)}
              placeholder="72"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: '1.15rem',
                fontWeight: 800,
                textAlign: 'center',
              }}
            />
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {['65', '80', '115'].map((hr) => (
                <button
                  key={hr}
                  type="button"
                  onClick={() => setPulseRate(hr)}
                  style={{
                    flex: 1,
                    padding: '3px 0',
                    fontSize: '0.72rem',
                    borderRadius: 4,
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    cursor: 'pointer',
                  }}
                >
                  {hr}
                </button>
              ))}
            </div>
          </div>

          {/* Oxygen Saturation SpO2 */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>SpO2 (%)</span>
              <Wind size={16} color="#0284C7" />
            </div>
            <input
              type="number"
              value={spo2}
              onChange={(e) => handleSpo2Change(e.target.value)}
              placeholder="98"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: '1.15rem',
                fontWeight: 800,
                textAlign: 'center',
              }}
            />
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {['99%', '95%', '89%'].map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => setSpo2(sp.replace('%', ''))}
                  style={{
                    flex: 1,
                    padding: '3px 0',
                    fontSize: '0.72rem',
                    borderRadius: 4,
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    cursor: 'pointer',
                  }}
                >
                  {sp}
                </button>
              ))}
            </div>
          </div>

          {/* Temperature */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>Temperature (°C)</span>
              <Thermometer size={16} color="#EA580C" />
            </div>
            <input
              type="text"
              value={tempC}
              onChange={(e) => handleTempChange(e.target.value)}
              placeholder="37.0"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: '1.15rem',
                fontWeight: 800,
                textAlign: 'center',
              }}
            />
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {['36.8', '38.5', '39.8'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTempC(t)}
                  style={{
                    flex: 1,
                    padding: '3px 0',
                    fontSize: '0.72rem',
                    borderRadius: 4,
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    cursor: 'pointer',
                  }}
                >
                  {t}°C
                </button>
              ))}
            </div>
          </div>

          {/* Respiratory Rate */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>Resp Rate (cpm)</span>
              <Radio size={16} color="#8B5CF6" />
            </div>
            <input
              type="number"
              value={respRate}
              onChange={(e) => setRespRate(e.target.value)}
              placeholder="18"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: '1.15rem',
                fontWeight: 800,
                textAlign: 'center',
              }}
            />
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {['16', '22', '28'].map((rr) => (
                <button
                  key={rr}
                  type="button"
                  onClick={() => setRespRate(rr)}
                  style={{
                    flex: 1,
                    padding: '3px 0',
                    fontSize: '0.72rem',
                    borderRadius: 4,
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    cursor: 'pointer',
                  }}
                >
                  {rr}
                </button>
              ))}
            </div>
          </div>

          {/* Weight & Height (Pediatric & Adult Dosing) */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>Weight & Height</span>
              <Weight size={16} color="#059669" />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="kg"
                style={{
                  width: '50%',
                  padding: '8px 8px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: '1rem',
                  fontWeight: 800,
                  textAlign: 'center',
                }}
              />
              <input
                type="text"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="cm"
                style={{
                  width: '50%',
                  padding: '8px 8px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: '1rem',
                  fontWeight: 800,
                  textAlign: 'center',
                }}
              />
            </div>
            <div style={{ marginTop: 8, fontSize: '0.72rem', color: '#64748B', textAlign: 'center' }}>
              BMI: <strong>{bmi || '--'} kg/m²</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          3. CHIEF COMPLAINT & AMBIENT AI VOICE-TO-TEXT
      ───────────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 16,
          border: '1px solid #E2E8F0',
          padding: '20px',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F5F3FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Mic size={18} />
            </div>
            <div>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>Chief Complaint & Subjective Assessment</span>
              <span style={{ fontSize: '0.78rem', color: '#64748B', marginLeft: 8 }}>Ambient speech scribing or touch-click checklist</span>
            </div>
          </div>

          {/* Microphone Dictate Button */}
          <button
            type="button"
            onClick={handleToggleSpeech}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              border: isListeningSpeech ? '1px solid #DC2626' : '1px solid #7C3AED',
              background: isListeningSpeech ? '#FEF2F2' : '#7C3AED',
              color: isListeningSpeech ? '#DC2626' : '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(124,58,237,0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            {isListeningSpeech ? <MicOff size={16} /> : <Mic size={16} />}
            {isListeningSpeech ? 'Recording Speech…' : 'Ambient AI Voice Scribe'}
          </button>
        </div>

        {/* Text Area */}
        <textarea
          rows={2}
          value={chiefComplaint}
          onChange={(e) => setChiefComplaint(e.target.value)}
          placeholder="Enter or dictate patient presentation..."
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #CBD5E1',
            fontSize: '0.92rem',
            lineHeight: 1.5,
            resize: 'vertical',
            fontFamily: 'inherit',
            marginBottom: 14,
          }}
        />

        {/* Rapid-Click Regional Symptom Checklist */}
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 8 }}>
          Rapid-Click Presentation Signs (Akwa Ibom Common Presentations):
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {REGIONAL_SYMPTOMS.map((sym) => {
            const isSelected = selectedSymptoms.includes(sym.id);
            return (
              <button
                key={sym.id}
                type="button"
                onClick={() => toggleSymptom(sym.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 20,
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  border: isSelected ? '1px solid #0D9488' : '1px solid #CBD5E1',
                  background: isSelected ? '#F0FDFA' : '#FFFFFF',
                  color: isSelected ? '#0D9488' : '#334155',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                {isSelected ? <Check size={14} /> : null}
                {sym.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          4. EMBEDDED AI RISK SCORING (AUTOMATED REAL-TIME CALCULATIONS)
      ───────────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 16,
          border: '1px solid #E2E8F0',
          padding: '20px',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={18} />
            </div>
            <div>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>Embedded AI Clinical Risk Scoring</span>
              <span style={{ fontSize: '0.78rem', color: '#64748B', marginLeft: 8 }}>Automated real-time ESI & clinical deterioration engine</span>
            </div>
          </div>

          {/* Calculated Triage Level Badge */}
          <div
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              background: esiBadgeConfig[effectiveEsi].bg,
              color: esiBadgeConfig[effectiveEsi].color,
              border: `1px solid ${esiBadgeConfig[effectiveEsi].border}`,
              fontSize: '0.88rem',
              fontWeight: 800,
            }}
          >
            {esiBadgeConfig[effectiveEsi].label}
          </div>
        </div>

        {/* Clinical Deterioration Alerts Pop-ups / Banners */}
        {clinicalAlerts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {clinicalAlerts.map((alt, idx) => (
              <div
                key={idx}
                style={{
                  background: alt.severity === 'CRITICAL' ? '#FEF2F2' : '#FFFBEB',
                  border: alt.severity === 'CRITICAL' ? '1px solid #F87171' : '1px solid #FCD34D',
                  color: alt.severity === 'CRITICAL' ? '#991B1B' : '#92400E',
                  borderRadius: 10,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <AlertTriangle size={20} color={alt.severity === 'CRITICAL' ? '#DC2626' : '#D97706'} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>{alt.title}</div>
                  <div style={{ fontSize: '0.8rem', marginTop: 2 }}>{alt.desc}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '8px 14px', background: '#F0FDF4', color: '#166534', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={16} />
            No acute critical deterioration patterns detected. Patient vital signs within expected clinical limits.
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          5. ROUTING & "SEND TO QUEUE" ACTIONS
      ───────────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 16,
          border: '1px solid #E2E8F0',
          padding: '20px',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)',
        }}
      >
        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: 14 }}>
          Routing & Clinic Assignment:
        </span>

        {/* Destination Selector Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 16 }}>
          {[
            { id: 'General Outpatient Queue (OPD)', icon: Stethoscope },
            { id: 'Pediatric Emergency Room', icon: Baby },
            { id: 'Antenatal / Labor Ward', icon: Heart },
            { id: 'Accident & Emergency (A&E)', icon: Flame },
            { id: 'Isolation Unit (for suspected highly infectious diseases)', icon: ShieldAlert },
          ].map((dest) => {
            const isSelected = targetDestination === dest.id;
            const Icon = dest.icon;
            return (
              <button
                key={dest.id}
                type="button"
                onClick={() => setTargetDestination(dest.id)}
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: isSelected ? '2px solid #2563EB' : '1px solid #E2E8F0',
                  background: isSelected ? '#EFF6FF' : '#F8FAFC',
                  color: isSelected ? '#1D4ED8' : '#334155',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={18} color={isSelected ? '#2563EB' : '#64748B'} />
                <span>{dest.id}</span>
              </button>
            );
          })}
        </div>

        {/* Doctor / Consulting Room Assignment */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>Assign Doctor / Consulting Room:</span>
          {['Consulting Room 1 · Dr. Bassey', 'Consulting Room 2 · Dr. Udoh', 'Consulting Room 3 · Dr. Okon', 'Any Available Doctor'].map((rm) => (
            <button
              key={rm}
              type="button"
              onClick={() => setAssignedRoom(rm)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: '0.8rem',
                fontWeight: 700,
                border: assignedRoom === rm ? '1px solid #0D9488' : '1px solid #CBD5E1',
                background: assignedRoom === rm ? '#F0FDFA' : '#FFFFFF',
                color: assignedRoom === rm ? '#0D9488' : '#475569',
                cursor: 'pointer',
              }}
            >
              {rm}
            </button>
          ))}
        </div>

        {/* Primary Call-To-Action Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '12px 20px',
                borderRadius: 10,
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#64748B',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            onClick={handleSendToQueue}
            style={{
              padding: '14px 28px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #0D9488 0%, #2563EB 100%)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '1rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(37,99,235,0.25)',
              transition: 'transform 0.1s ease',
            }}
          >
            <Printer size={20} />
            Send to Queue & Print Wristband
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          COLOR-CODED BARCODE WRISTBAND MODAL
      ───────────────────────────────────────────────────────────────── */}
      {showWristbandModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 20,
              maxWidth: 580,
              width: '100%',
              padding: 24,
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={24} color="#10B981" />
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>
                  Patient Successfully Sent to Queue!
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowWristbandModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#64748B', marginBottom: 18 }}>
              Patient <strong>{patient.fullName}</strong> is routed to <strong>{targetDestination}</strong> ({assignedRoom}).
              Below is the printable hospital barcode wristband generated automatically:
            </p>

            {/* Printable Wristband Container */}
            <div
              style={{
                border: '2px dashed #CBD5E1',
                borderRadius: 14,
                padding: 16,
                background: '#F8FAFC',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {/* Wristband Color Bar */}
              <div
                style={{
                  height: 12,
                  borderRadius: 6,
                  background:
                    effectiveEsi === 1
                      ? '#DC2626'
                      : effectiveEsi === 2
                      ? '#EA580C'
                      : effectiveEsi === 3
                      ? '#EAB308'
                      : effectiveEsi === 4
                      ? '#2563EB'
                      : '#16A34A',
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0F172A' }}>{patient.fullName}</div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 2 }}>
                    ID: <strong>{patient.hospitalNumber}</strong> · DOB: {patient.dob} ({patient.gender})
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 2 }}>
                    Destination: <strong>{targetDestination}</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#DC2626', marginTop: 4 }}>
                    {patient.allergies.length > 0 && patient.allergies[0] !== 'NONE DOCUMENTED'
                      ? `⚠️ ALLERGIES: ${patient.allergies.join(', ')}`
                      : 'ALLERGIES: NKDA'}
                  </div>
                </div>

                {/* Simulated Barcode / QR */}
                <div style={{ textAlign: 'center', padding: '6px 12px', background: '#FFFFFF', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                  <QrCode size={48} color="#0F172A" />
                  <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.05em', marginTop: 2 }}>
                    {patient.hospitalNumber}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.7rem', color: '#94A3B8', textAlign: 'right', borderTop: '1px solid #E2E8F0', paddingTop: 6 }}>
                Facility: {facilityId} · Triaged By: {nurseName} · {new Date().toLocaleTimeString()}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: '1px solid #0D9488',
                  background: '#F0FDFA',
                  color: '#0D9488',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                }}
              >
                <Printer size={16} />
                Print Physical Wristband
              </button>

              <button
                type="button"
                onClick={() => setShowWristbandModal(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: 10,
                  background: '#0F172A',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Done / Next Patient
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RapidNurseTriageIntake;
