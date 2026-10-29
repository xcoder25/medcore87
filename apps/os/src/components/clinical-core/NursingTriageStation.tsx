'use client';

/**
 * NursingTriageStation — OPD Triage & Vital Signs Clinical Console.
 * Ultra-premium, telemetry-grade UI with live cardiac waveforms,
 * automated NEWS2/MEWS calculation, WHO BMI classification,
 * tactile vitals presets, and instant multi-channel bus sync.
 *
 * OPD Stage 3: triage_vitals -> waiting (doctor queue)
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { RapidNurseTriageIntake } from './RapidNurseTriageIntake';
import type { UserSession } from '../auth/AuthScreen';
import { listVisits, subscribeReceptionOps, assignVisitTriageAndDepartment } from '../../lib/receptionOpsStore';
import {
  listVitals,
  saveVitals,
  subscribeVitals,
  type VitalsRecord,
} from '../../lib/nursingVitalsStore';
import { useOpdSync, broadcastOpdStage } from '../../hooks/useOpdSync';
import { listStaffCards } from '../../lib/staffCardStore';
import { RECEPTION_DEPTS } from '../../lib/receptionConstants';
import { pushNotification } from '../../lib/notificationEngine';
import {
  Heart,
  Thermometer,
  Activity,
  Weight,
  Wind,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Search,
  User,
  RefreshCw,
  Clock,
  Shield,
  AlertCircle,
  FileText,
  Sparkles,
  Zap,
  Gauge,
  ArrowUpRight,
  Sliders,
  Send,
  Eye,
  Check,
  Stethoscope,
  X,
  TrendingUp,
} from 'lucide-react';

/* ------------------------------------------------------------------
 * Color Palette & Tokens
 * ------------------------------------------------------------------ */
const C = {
  text: '#0F172A',
  textSecondary: '#334155',
  muted: '#64748B',
  subtle: '#94A3B8',
  border: '#E2E8F0',
  borderSubtle: '#F1F5F9',
  bg: '#F8FAFC',
  cardBg: '#FFFFFF',
  blue: '#2563EB',
  blueLight: '#EFF6FF',
  teal: '#0D9488',
  tealLight: '#F0FDFA',
  green: '#10B981',
  greenLight: '#ECFDF5',
  amber: '#F59E0B',
  amberLight: '#FFFBEB',
  red: '#EF4444',
  redLight: '#FEF2F2',
  purple: '#8B5CF6',
  purpleLight: '#F5F3FF',
};

export interface FormState {
  bpSystolic: string;
  bpDiastolic: string;
  pulse: string;
  tempC: string;
  weightKg: string;
  heightCm: string;
  spo2: string;
  respRate: string;
  painScore: number;
  avpu: 'Alert' | 'Voice' | 'Pain' | 'Unresponsive';
  notes: string;
}

const EMPTY_FORM: FormState = {
  bpSystolic: '',
  bpDiastolic: '',
  pulse: '',
  tempC: '',
  weightKg: '',
  heightCm: '',
  spo2: '',
  respRate: '',
  painScore: 0,
  avpu: 'Alert',
  notes: '',
};

/* ------------------------------------------------------------------
 * Clinical Scoring & Analytics Helpers
 * ------------------------------------------------------------------ */
function computeClinicalAnalytics(f: FormState) {
  const sys = Number(f.bpSystolic) || 0;
  const dia = Number(f.bpDiastolic) || 0;
  const hr = Number(f.pulse) || 0;
  const temp = Number(f.tempC) || 0;
  const spo2 = f.spo2 ? Number(f.spo2) : 0;
  const rr = Number(f.respRate) || 0;
  const weight = Number(f.weightKg) || 0;
  const height = Number(f.heightCm) || 0;

  // Mean Arterial Pressure (MAP)
  const map = sys && dia ? Math.round(dia + (sys - dia) / 3) : null;

  // BMI Calculation
  let bmi: number | null = null;
  let bmiCategory: { label: string; color: string } | null = null;
  if (weight > 0 && height > 0) {
    const hMeter = height / 100;
    bmi = Number((weight / (hMeter * hMeter)).toFixed(1));
    if (bmi < 18.5) bmiCategory = { label: 'Underweight', color: '#0284C7' };
    else if (bmi < 25) bmiCategory = { label: 'Normal Weight', color: '#10B981' };
    else if (bmi < 30) bmiCategory = { label: 'Overweight', color: '#F59E0B' };
    else bmiCategory = { label: 'Obese', color: '#EF4444' };
  }

  // Blood Pressure Category
  let bpCategory: { label: string; color: string; level: number } | null = null;
  if (sys > 0 || dia > 0) {
    if (sys >= 180 || dia >= 120) bpCategory = { label: 'Hypertensive Crisis', color: '#EF4444', level: 4 };
    else if (sys >= 140 || dia >= 90) bpCategory = { label: 'Stage 2 HTN', color: '#EA580C', level: 3 };
    else if (sys >= 130 || dia >= 80) bpCategory = { label: 'Stage 1 HTN', color: '#F59E0B', level: 2 };
    else if (sys >= 120 && dia < 80) bpCategory = { label: 'Elevated BP', color: '#EAB308', level: 1 };
    else bpCategory = { label: 'Normal BP', color: '#10B981', level: 0 };
  }

  // Heart Rate Category
  let hrCategory: { label: string; color: string } | null = null;
  if (hr > 0) {
    if (hr >= 130) hrCategory = { label: 'Severe Tachycardia', color: '#EF4444' };
    else if (hr >= 101) hrCategory = { label: 'Tachycardia', color: '#F59E0B' };
    else if (hr < 50) hrCategory = { label: 'Severe Bradycardia', color: '#EF4444' };
    else if (hr < 60) hrCategory = { label: 'Bradycardia', color: '#0284C7' };
    else hrCategory = { label: 'Normal Sinus', color: '#10B981' };
  }

  // Temperature Category
  let tempCategory: { label: string; color: string } | null = null;
  if (temp > 0) {
    if (temp >= 40.0) tempCategory = { label: 'Hyperpyrexia', color: '#EF4444' };
    else if (temp >= 38.5) tempCategory = { label: 'High Fever', color: '#EA580C' };
    else if (temp >= 37.5) tempCategory = { label: 'Mild Fever', color: '#F59E0B' };
    else if (temp < 35.0) tempCategory = { label: 'Hypothermia', color: '#0284C7' };
    else tempCategory = { label: 'Normothermic', color: '#10B981' };
  }

  // SpO2 Category
  let spo2Category: { label: string; color: string } | null = null;
  if (spo2 > 0) {
    if (spo2 < 90) spo2Category = { label: 'Severe Hypoxia', color: '#EF4444' };
    else if (spo2 < 95) spo2Category = { label: 'Low Saturation', color: '#F59E0B' };
    else spo2Category = { label: 'Optimal SpO₂', color: '#10B981' };
  }

  // NEWS2 / Early Warning Score
  let newsPoints = 0;
  const criticals: string[] = [];
  const urgents: string[] = [];

  // RR scoring
  if (rr > 0) {
    if (rr <= 8 || rr >= 25) { newsPoints += 3; criticals.push(`Abnormal RR (${rr} bpm)`); }
    else if (rr >= 21) { newsPoints += 2; urgents.push(`Tachypnea (${rr} bpm)`); }
    else if (rr <= 11) { newsPoints += 1; }
  }

  // SpO2 scoring
  if (spo2 > 0) {
    if (spo2 <= 91) { newsPoints += 3; criticals.push(`Severe Hypoxia (${spo2}%)`); }
    else if (spo2 <= 93) { newsPoints += 2; urgents.push(`Hypoxia (${spo2}%)`); }
    else if (spo2 <= 95) { newsPoints += 1; }
  }

  // Systolic BP scoring
  if (sys > 0) {
    if (sys <= 90 || sys >= 180) { newsPoints += 3; criticals.push(`Critical Systolic BP (${sys} mmHg)`); }
    else if (sys >= 160) { newsPoints += 2; urgents.push(`Elevated Systolic BP (${sys} mmHg)`); }
    else if (sys <= 100) { newsPoints += 2; urgents.push(`Hypotension (${sys} mmHg)`); }
    else if (sys <= 110) { newsPoints += 1; }
  }

  // Pulse scoring
  if (hr > 0) {
    if (hr <= 40 || hr >= 131) { newsPoints += 3; criticals.push(`Severe Heart Rate (${hr} bpm)`); }
    else if (hr >= 111) { newsPoints += 2; urgents.push(`Tachycardia (${hr} bpm)`); }
    else if (hr <= 50 || hr >= 91) { newsPoints += 1; }
  }

  // Temp scoring
  if (temp > 0) {
    if (temp <= 35.0 || temp >= 40.0) { newsPoints += 3; criticals.push(`Critical Temperature (${temp}°C)`); }
    else if (temp >= 38.5) { newsPoints += 2; urgents.push(`High Fever (${temp}°C)`); }
    else if (temp <= 36.0 || temp >= 38.1) { newsPoints += 1; }
  }

  // AVPU scoring
  if (f.avpu !== 'Alert') {
    newsPoints += 3;
    criticals.push(`Altered Consciousness (${f.avpu})`);
  }

  // Overall Urgency classification
  let urgency: 'routine' | 'urgent' | 'critical' = 'routine';
  if (criticals.length > 0 || newsPoints >= 7) {
    urgency = 'critical';
  } else if (urgents.length > 0 || newsPoints >= 4) {
    urgency = 'urgent';
  }

  return {
    map,
    bmi,
    bmiCategory,
    bpCategory,
    hrCategory,
    tempCategory,
    spo2Category,
    newsPoints,
    urgency,
    criticals,
    urgents,
  };
}

/* ------------------------------------------------------------------
 * Main Component Props
 * ------------------------------------------------------------------ */
interface Props {
  session: Partial<UserSession> & { hospitalId?: string; name?: string; badgeId?: string };
  onClose?: () => void;
}

export const NursingTriageStation: React.FC<Props> = ({ session, onClose }) => {
  const facilityId = session.hospitalId || 'IGH-EKT';
  const nurseName = session.name || session.badgeId || 'Duty Triage Nurse';

  const [queue, setQueue] = useState<ReturnType<typeof listVisits>>([]);
  const [vitalsLog, setVitalsLog] = useState<VitalsRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'triaged' | 'critical'>('all');
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [lastSaved, setLastSaved] = useState<VitalsRecord | null>(null);
  const [tab, setTab] = useState<'station' | 'log' | 'rapid-intake'>('station');
  const [lastSync, setLastSync] = useState<Date>(new Date());

  // Real-time OPD bus synchronization
  const { tick } = useOpdSync({ heartbeatMs: 15_000 });

  const reload = useCallback(() => {
    const all = listVisits(facilityId);
    setQueue(all.filter((v) => v.status === 'waiting' || v.status === 'called'));
    setVitalsLog(listVitals(facilityId));
    setLastSync(new Date());
  }, [facilityId]);

  useEffect(() => {
    reload();
  }, [tick, reload]);

  useEffect(() => {
    const u1 = subscribeVitals(reload);
    const u2 = subscribeReceptionOps(reload);
    return () => {
      u1();
      u2();
    };
  }, [reload]);

  const selectedVisit = useMemo(
    () => queue.find((v) => v.id === selectedId) || null,
    [queue, selectedId]
  );

  const [targetDept, setTargetDept] = useState<string>('General OPD');
  const [targetDoctor, setTargetDoctor] = useState<string>('Any available');

  useEffect(() => {
    if (selectedVisit) {
      if (selectedVisit.department && selectedVisit.department !== 'Triage' && selectedVisit.department !== 'OPD') {
        setTargetDept(selectedVisit.department);
      } else {
        setTargetDept('General OPD');
      }
      if (selectedVisit.doctor && selectedVisit.doctor !== 'Triage Nurse') {
        setTargetDoctor(selectedVisit.doctor);
      } else {
        setTargetDoctor('Any available');
      }
    }
  }, [selectedVisit]);

  const facilityDoctors = useMemo(() => {
    const CLINICAL = new Set(['doctor', 'surgeon', 'medical_director', 'consultant']);
    return listStaffCards()
      .filter(
        (c) =>
          (c.facilityId === facilityId || !c.facilityId) &&
          c.status === 'ACTIVE' &&
          (CLINICAL.has((c.roleKey || '').toLowerCase()) ||
            /doctor|surgeon|consultant|physician/i.test(c.role || c.title || ''))
      )
      .map((c) => c.fullName)
      .filter(Boolean);
  }, [facilityId]);

  const analytics = useMemo(() => computeClinicalAnalytics(form), [form]);

  // Quick Preset Handlers
  const applyPreset = (type: 'adult' | 'pediatric') => {
    if (type === 'adult') {
      setForm((prev) => ({
        ...prev,
        bpSystolic: '120',
        bpDiastolic: '80',
        pulse: '72',
        tempC: '36.6',
        spo2: '98',
        respRate: '16',
        avpu: 'Alert',
        painScore: 0,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        bpSystolic: '102',
        bpDiastolic: '66',
        pulse: '98',
        tempC: '36.8',
        spo2: '99',
        respRate: '22',
        avpu: 'Alert',
        painScore: 0,
      }));
    }
  };

  const clearForm = () => setForm({ ...EMPTY_FORM });

  // Handle Save & Dispatch
  const handleSaveVitals = async () => {
    if (!selectedVisit) return;
    setSaving(true);
    try {
      const summaryStr = [
        form.bpSystolic && form.bpDiastolic ? `BP ${form.bpSystolic}/${form.bpDiastolic} mmHg` : '',
        form.pulse ? `HR ${form.pulse} bpm` : '',
        form.tempC ? `Temp ${form.tempC}°C` : '',
        form.spo2 ? `SpO₂ ${form.spo2}%` : '',
        form.respRate ? `RR ${form.respRate} cpm` : '',
        analytics.newsPoints !== undefined ? `NEWS2: ${analytics.newsPoints}` : '',
      ]
        .filter(Boolean)
        .join(' · ');

      const record = saveVitals({
        facilityId,
        patientId: selectedVisit.patientId,
        hospitalNumber: selectedVisit.hospitalNumber,
        patientName: selectedVisit.patientName,
        bpSystolic: form.bpSystolic ? Number(form.bpSystolic) : undefined,
        bpDiastolic: form.bpDiastolic ? Number(form.bpDiastolic) : undefined,
        pulse: form.pulse ? Number(form.pulse) : undefined,
        tempC: form.tempC ? Number(form.tempC) : undefined,
        weightKg: form.weightKg ? Number(form.weightKg) : undefined,
        spo2: form.spo2 ? Number(form.spo2) : undefined,
        notes: [
          form.notes,
          form.heightCm ? `Height: ${form.heightCm}cm (BMI ${analytics.bmi})` : '',
          form.respRate ? `RR: ${form.respRate}bpm` : '',
          form.painScore > 0 ? `Pain: ${form.painScore}/10` : '',
          form.avpu !== 'Alert' ? `AVPU: ${form.avpu}` : '',
          `NEWS2: ${analytics.newsPoints} pts`,
        ]
          .filter(Boolean)
          .join(' · '),
        recordedBy: nurseName,
      });

      // Assign visit to target department & doctor, and move to doctor's consultation queue
      assignVisitTriageAndDepartment({
        visitId: selectedVisit.id,
        facilityId,
        department: targetDept,
        doctor: targetDoctor,
        triageUrgency: analytics.urgency,
        vitalsSummary: summaryStr,
        vitalsBp: form.bpSystolic && form.bpDiastolic ? `${form.bpSystolic}/${form.bpDiastolic}` : undefined,
        vitalsPulse: form.pulse ? Number(form.pulse) : undefined,
        vitalsTemp: form.tempC ? Number(form.tempC) : undefined,
        vitalsSpo2: form.spo2 ? Number(form.spo2) : undefined,
        vitalsWeight: form.weightKg ? Number(form.weightKg) : undefined,
        triagedBy: nurseName,
      });

      // Push notification to attending physicians in the assigned department
      try {
        pushNotification({
          facilityId,
          level: analytics.urgency === 'critical' ? 'critical' : 'important',
          title: analytics.urgency === 'critical' ? '🚨 STAT: Critical Triaged Patient' : 'Triaged Patient Ready',
          body: `${selectedVisit.patientName} (${selectedVisit.hospitalNumber}) assigned to ${targetDept}${targetDoctor !== 'Any available' ? ` (Dr. ${targetDoctor})` : ''} · ${summaryStr}`,
          module: 'doctor-portal',
          roleHint: 'doctor',
          targetStaff: targetDoctor !== 'Any available' ? targetDoctor : undefined,
        });
      } catch {
        /* ignore */
      }

      setLastSaved(record);
      setSavedSuccess(true);
      setForm({ ...EMPTY_FORM });
      setSelectedId(null);
      reload();

      // Dispatch real-time events to doctor consultation & reception boards
      broadcastOpdStage('medcore_doctor', {
        facilityId,
        patientId: selectedVisit.patientId,
        hospitalNumber: selectedVisit.hospitalNumber,
        patientName: selectedVisit.patientName,
        stage: 'vitals_done',
        department: targetDept,
        doctor: targetDoctor,
        urgency: record.urgency,
        vitalsSummary: summaryStr,
      });

      broadcastOpdStage('medcore_reception', {
        facilityId,
        patientId: selectedVisit.patientId,
        stage: 'vitals_done',
        department: targetDept,
        urgency: record.urgency,
      });

      setTimeout(() => setSavedSuccess(false), 5000);
    } finally {
      setSaving(false);
    }
  };

  // Filtered Queue
  const filteredQueue = useMemo(() => {
    const q = search.toLowerCase();
    return queue.filter((v) => {
      const matchSearch =
        !q ||
        v.patientName.toLowerCase().includes(q) ||
        v.hospitalNumber.toLowerCase().includes(q);
      if (!matchSearch) return false;

      const isTriaged = vitalsLog.some((r) => r.patientId === v.patientId);
      if (filterMode === 'pending') return !isTriaged;
      if (filterMode === 'triaged') return isTriaged;
      if (filterMode === 'critical') return v.triageUrgency === 'critical' || v.triageUrgency === 'urgent';
      return true;
    });
  }, [queue, vitalsLog, search, filterMode]);

  const triageCount = useMemo(() => {
    const triagedIds = new Set(vitalsLog.map((r) => r.patientId));
    const completed = queue.filter((v) => triagedIds.has(v.patientId)).length;
    return {
      total: queue.length,
      pending: queue.length - completed,
      completed,
    };
  }, [queue, vitalsLog]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '820px',
        background: '#F8FAFC',
        borderRadius: 20,
        border: `1px solid ${C.border}`,
        boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.07)',
        overflow: 'hidden',
        fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
      }}
    >
      {/* ------------------------------------------------------------------
       * Mission Control Top Header
       * ------------------------------------------------------------------ */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          background: '#FFFFFF',
          borderBottom: `1px solid ${C.border}`,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #0D9488 0%, #2563EB 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 6px 16px rgba(13, 148, 136, 0.3)',
            }}
          >
            <Stethoscope size={22} strokeWidth={2.4} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: C.text,
                  letterSpacing: '-0.02em',
                }}
              >
                Nursing Triage & Vitals Console
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: 'linear-gradient(135deg, #ECFDF5 0%, #E0F2FE 100%)',
                  color: '#0369A1',
                  border: '1px solid #BAE6FD',
                  letterSpacing: '0.04em',
                }}
              >
                Stage 3 Telemetry
              </span>
            </div>
            <div
              style={{
                fontSize: 12,
                color: C.muted,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 2,
              }}
            >
              <span>{facilityId}</span>
              <span>•</span>
              <span>Duty Nurse: <strong>{nurseName}</strong></span>
              <span>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#059669', fontWeight: 600 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#10B981',
                    boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.25)',
                  }}
                />
                Live Sync {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        {/* Header Right Stats & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#F1F5F9',
              padding: '4px',
              borderRadius: 12,
              gap: 4,
            }}
          >
            <button
              type="button"
              onClick={() => setTab('station')}
              style={{
                padding: '8px 16px',
                borderRadius: 9,
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: tab === 'station' ? '#FFFFFF' : 'transparent',
                color: tab === 'station' ? C.blue : C.muted,
                boxShadow: tab === 'station' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              Active Station ({triageCount.pending} pending)
            </button>
            <button
              type="button"
              onClick={() => setTab('log')}
              style={{
                padding: '8px 16px',
                borderRadius: 9,
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: tab === 'log' ? '#FFFFFF' : 'transparent',
                color: tab === 'log' ? C.blue : C.muted,
                boxShadow: tab === 'log' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              Vitals Log ({vitalsLog.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('rapid-intake')}
              style={{
                padding: '8px 16px',
                borderRadius: 9,
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: tab === 'rapid-intake' ? '#FFFFFF' : 'transparent',
                color: tab === 'rapid-intake' ? '#7C3AED' : C.muted,
                boxShadow: tab === 'rapid-intake' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              ⚡ 60-Sec Rapid Intake
            </button>
          </div>

          <button
            type="button"
            onClick={reload}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: '#FFFFFF',
              color: C.textSecondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
            }}
            title="Refresh OPD Bus"
          >
            <RefreshCw size={13} />
            <span>Sync</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: '#FFFFFF',
                color: C.muted,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Close console"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------
       * Success Flash Alert
       * ------------------------------------------------------------------ */}
      {savedSuccess && lastSaved && (
        <div
          style={{
            margin: '12px 24px 0',
            padding: '12px 18px',
            borderRadius: 14,
            background: 'linear-gradient(135deg, #ECFDF5 0%, #F0FDF4 100%)',
            border: '1.5px solid #A7F3D0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.12)',
            animation: 'fadeIn 0.25s ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <Check size={18} strokeWidth={2.8} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#065F46' }}>
                Vitals Successfully Committed & Synced
              </div>
              <div style={{ fontSize: 12, color: '#047857' }}>
                {lastSaved.patientName} ({lastSaved.hospitalNumber}) • Urgency: <strong>{lastSaved.urgency.toUpperCase()}</strong> • Forwarded to Doctor Worklist.
              </div>
            </div>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: 999,
              background: '#047857',
              color: '#FFFFFF',
            }}
          >
            DISPATCHED
          </span>
        </div>
      )}

      {/* ------------------------------------------------------------------
       * Main Body View
       * ------------------------------------------------------------------ */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {tab === 'rapid-intake' ? (
          <RapidNurseTriageIntake
            facilityId={facilityId}
            nurseName={nurseName}
            onComplete={(record) => {
              setTab('station');
              reload();
            }}
            onCancel={() => setTab('station')}
          />
        ) : tab === 'station' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '340px 1fr',
              gap: 20,
              height: '100%',
              alignItems: 'stretch',
            }}
          >
            {/* --------------------------------------------------------
             * Left Panel: OPD Arrival Queue
             * -------------------------------------------------------- */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 18,
                border: `1px solid ${C.border}`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(15,23,42,0.03)',
              }}
            >
              <div
                style={{
                  padding: '16px 18px',
                  borderBottom: `1px solid ${C.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  background: '#FAFAFA',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    OPD Queue ({filteredQueue.length})
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: C.muted,
                      background: '#F1F5F9',
                      padding: '2px 8px',
                      borderRadius: 999,
                    }}
                  >
                    FIFO Priority
                  </span>
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative' }}>
                  <Search
                    size={14}
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: C.muted,
                    }}
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search patient, hospital no..."
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 12px 8px 34px',
                      borderRadius: 10,
                      border: `1px solid ${C.border}`,
                      fontSize: 12,
                      outline: 'none',
                      background: '#FFFFFF',
                      color: C.text,
                    }}
                  />
                </div>

                {/* Filter Pills */}
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['all', 'pending', 'triaged', 'critical'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setFilterMode(mode)}
                      style={{
                        flex: 1,
                        padding: '4px 6px',
                        fontSize: 10,
                        fontWeight: 700,
                        borderRadius: 7,
                        border: 'none',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                        background: filterMode === mode ? C.blue : '#F1F5F9',
                        color: filterMode === mode ? '#FFFFFF' : C.muted,
                        transition: 'all 0.12s ease',
                      }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Patient Queue Cards List */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {filteredQueue.length === 0 ? (
                  <div
                    style={{
                      padding: '40px 16px',
                      textAlign: 'center',
                      color: C.muted,
                      fontSize: 13,
                    }}
                  >
                    No patients match queue criteria.
                  </div>
                ) : (
                  filteredQueue.map((v) => {
                    const isSelected = selectedId === v.id;
                    const isTriaged = vitalsLog.some((r) => r.patientId === v.patientId);
                    const isCrit = v.triageUrgency === 'critical';
                    const isUrg = v.triageUrgency === 'urgent';

                    return (
                      <div
                        key={v.id}
                        onClick={() => {
                          setSelectedId(v.id);
                          setSavedSuccess(false);
                        }}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 14,
                          cursor: 'pointer',
                          border: isSelected
                            ? `2px solid ${C.blue}`
                            : isCrit
                            ? '1.5px solid #FECACA'
                            : `1px solid ${C.border}`,
                          background: isSelected
                            ? '#EFF6FF'
                            : isCrit
                            ? '#FEF2F2'
                            : '#FFFFFF',
                          boxShadow: isSelected
                            ? '0 4px 12px rgba(37,99,235,0.1)'
                            : '0 1px 3px rgba(0,0,0,0.02)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {/* Avatar initials with status ring */}
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            background: isCrit
                              ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                              : isTriaged
                              ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                              : 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: 13,
                            flexShrink: 0,
                          }}
                        >
                          {(v.patientName || 'P')
                            .split(' ')
                            .map((x) => x[0])
                            .slice(0, 2)
                            .join('')}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 800,
                              color: C.text,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {v.patientName}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: C.muted,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              marginTop: 2,
                            }}
                          >
                            <span>{v.hospitalNumber}</span>
                            <span>•</span>
                            <span>{v.department || 'General OPD'}</span>
                          </div>
                        </div>

                        {/* Status Tag */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {isCrit ? (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 800,
                                background: '#FEE2E2',
                                color: '#DC2626',
                                padding: '2px 6px',
                                borderRadius: 6,
                                textTransform: 'uppercase',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                              }}
                            >
                              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#DC2626' }} />
                              CRITICAL
                            </span>
                          ) : isUrg ? (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 800,
                                background: '#FEF3C7',
                                color: '#D97706',
                                padding: '2px 6px',
                                borderRadius: 6,
                                textTransform: 'uppercase',
                              }}
                            >
                              URGENT
                            </span>
                          ) : isTriaged ? (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 800,
                                background: '#D1FAE5',
                                color: '#059669',
                                padding: '2px 6px',
                                borderRadius: 6,
                              }}
                            >
                              TRIAGED
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 800,
                                background: '#F1F5F9',
                                color: C.muted,
                                padding: '2px 6px',
                                borderRadius: 6,
                              }}
                            >
                              WAITING
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* --------------------------------------------------------
             * Right Panel: Interactive Clinical Telemetry Form
             * -------------------------------------------------------- */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 18,
                border: `1px solid ${C.border}`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(15,23,42,0.03)',
              }}
            >
              {!selectedVisit ? (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 40,
                    textAlign: 'center',
                    background: '#FAFAFA',
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 20,
                      background: '#EFF6FF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: C.blue,
                      marginBottom: 16,
                    }}
                  >
                    <Activity size={32} />
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>
                    Ready for Patient Assessment
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: C.muted,
                      maxWidth: 360,
                      marginTop: 6,
                      lineHeight: 1.5,
                    }}
                  >
                    Select an arriving patient from the OPD Queue on the left to capture comprehensive vital signs, calculate early warning scores, and auto-dispatch to doctors.
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                  {/* Active Patient Identifier Banner */}
                  <div
                    style={{
                      padding: '16px 22px',
                      background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)',
                      borderBottom: `1px solid ${C.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 14,
                          background: '#FFFFFF',
                          border: `1px solid ${C.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: C.blue,
                          fontWeight: 800,
                          fontSize: 16,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                        }}
                      >
                        <User size={24} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>
                            {selectedVisit.patientName}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              background: '#DBEAFE',
                              color: '#1E40AF',
                              padding: '2px 8px',
                              borderRadius: 6,
                            }}
                          >
                            {selectedVisit.hospitalNumber}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                          {selectedVisit.department || 'General Medicine'} • {selectedVisit.visitType === 'appointment' ? 'Scheduled Appointment' : 'Walk-in Consultation'}
                        </div>
                      </div>
                    </div>

                    {/* Presets & Tools Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>Quick Presets:</span>
                      <button
                        type="button"
                        onClick={() => applyPreset('adult')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: `1px solid ${C.border}`,
                          background: '#FFFFFF',
                          color: C.textSecondary,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Adult Normal
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('pediatric')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: `1px solid ${C.border}`,
                          background: '#FFFFFF',
                          color: C.textSecondary,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Pediatric
                      </button>
                      <button
                        type="button"
                        onClick={clearForm}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: `1px solid ${C.border}`,
                          background: '#FFFFFF',
                          color: C.muted,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Telemetry Input Grid */}
                  <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {/* Primary Vitals Row: BP, HR, Temp, SpO2 */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                        gap: 14,
                      }}
                    >
                      {/* 1. Blood Pressure Card */}
                      <div
                        style={{
                          background: '#FAFAFA',
                          borderRadius: 14,
                          border: `1px solid ${C.border}`,
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: C.text, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Heart size={14} color="#EF4444" /> Blood Pressure
                          </span>
                          {analytics.bpCategory && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                color: analytics.bpCategory.color,
                                background: '#FFFFFF',
                                padding: '1px 6px',
                                borderRadius: 4,
                                border: `1px solid ${analytics.bpCategory.color}30`,
                              }}
                            >
                              {analytics.bpCategory.label}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="number"
                            placeholder="Sys"
                            value={form.bpSystolic}
                            onChange={(e) => setForm((p) => ({ ...p, bpSystolic: e.target.value }))}
                            style={{
                              flex: 1,
                              padding: '8px 10px',
                              borderRadius: 8,
                              border: `1px solid ${C.border}`,
                              fontSize: 14,
                              fontWeight: 700,
                              outline: 'none',
                              textAlign: 'center',
                              background: '#FFFFFF',
                            }}
                          />
                          <span style={{ color: C.muted, fontWeight: 800, fontSize: 14 }}>/</span>
                          <input
                            type="number"
                            placeholder="Dia"
                            value={form.bpDiastolic}
                            onChange={(e) => setForm((p) => ({ ...p, bpDiastolic: e.target.value }))}
                            style={{
                              flex: 1,
                              padding: '8px 10px',
                              borderRadius: 8,
                              border: `1px solid ${C.border}`,
                              fontSize: 14,
                              fontWeight: 700,
                              outline: 'none',
                              textAlign: 'center',
                              background: '#FFFFFF',
                            }}
                          />
                          <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>mmHg</span>
                        </div>

                        {analytics.map && (
                          <div style={{ fontSize: 10, color: C.muted }}>
                            Mean Arterial Pressure: <strong>{analytics.map} mmHg</strong>
                          </div>
                        )}
                      </div>

                      {/* 2. Pulse Rate Card */}
                      <div
                        style={{
                          background: '#FAFAFA',
                          borderRadius: 14,
                          border: `1px solid ${C.border}`,
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: C.text, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Activity size={14} color="#0D9488" /> Heart Rate / Pulse
                          </span>
                          {analytics.hrCategory && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                color: analytics.hrCategory.color,
                                background: '#FFFFFF',
                                padding: '1px 6px',
                                borderRadius: 4,
                                border: `1px solid ${analytics.hrCategory.color}30`,
                              }}
                            >
                              {analytics.hrCategory.label}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="number"
                            placeholder="e.g. 74"
                            value={form.pulse}
                            onChange={(e) => setForm((p) => ({ ...p, pulse: e.target.value }))}
                            style={{
                              flex: 1,
                              padding: '8px 10px',
                              borderRadius: 8,
                              border: `1px solid ${C.border}`,
                              fontSize: 14,
                              fontWeight: 700,
                              outline: 'none',
                              textAlign: 'center',
                              background: '#FFFFFF',
                            }}
                          />
                          <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>bpm</span>
                        </div>

                        {/* Animated ECG preview line */}
                        <div style={{ height: 16, overflow: 'hidden', opacity: 0.6 }}>
                          <svg width="100%" height="16" viewBox="0 0 100 16" preserveAspectRatio="none">
                            <path
                              d="M 0 8 L 30 8 L 35 2 L 40 14 L 45 8 L 50 8 L 53 5 L 56 11 L 60 8 L 100 8"
                              fill="none"
                              stroke="#0D9488"
                              strokeWidth="1.6"
                            />
                          </svg>
                        </div>
                      </div>

                      {/* 3. Temperature Card */}
                      <div
                        style={{
                          background: '#FAFAFA',
                          borderRadius: 14,
                          border: `1px solid ${C.border}`,
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: C.text, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Thermometer size={14} color="#EA580C" /> Body Temp
                          </span>
                          {analytics.tempCategory && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                color: analytics.tempCategory.color,
                                background: '#FFFFFF',
                                padding: '1px 6px',
                                borderRadius: 4,
                                border: `1px solid ${analytics.tempCategory.color}30`,
                              }}
                            >
                              {analytics.tempCategory.label}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="36.5"
                            value={form.tempC}
                            onChange={(e) => setForm((p) => ({ ...p, tempC: e.target.value }))}
                            style={{
                              flex: 1,
                              padding: '8px 10px',
                              borderRadius: 8,
                              border: `1px solid ${C.border}`,
                              fontSize: 14,
                              fontWeight: 700,
                              outline: 'none',
                              textAlign: 'center',
                              background: '#FFFFFF',
                            }}
                          />
                          <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>°C</span>
                        </div>

                        {Number(form.tempC) > 0 && (
                          <div style={{ fontSize: 10, color: C.muted }}>
                            Fahrenheit: <strong>{((Number(form.tempC) * 9) / 5 + 32).toFixed(1)}°F</strong>
                          </div>
                        )}
                      </div>

                      {/* 4. Oxygen Saturation (SpO2) Card */}
                      <div
                        style={{
                          background: '#FAFAFA',
                          borderRadius: 14,
                          border: `1px solid ${C.border}`,
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: C.text, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Wind size={14} color="#2563EB" /> SpO₂ Pulse Ox
                          </span>
                          {analytics.spo2Category && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                color: analytics.spo2Category.color,
                                background: '#FFFFFF',
                                padding: '1px 6px',
                                borderRadius: 4,
                                border: `1px solid ${analytics.spo2Category.color}30`,
                              }}
                            >
                              {analytics.spo2Category.label}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="number"
                            placeholder="98"
                            value={form.spo2}
                            onChange={(e) => setForm((p) => ({ ...p, spo2: e.target.value }))}
                            style={{
                              flex: 1,
                              padding: '8px 10px',
                              borderRadius: 8,
                              border: `1px solid ${C.border}`,
                              fontSize: 14,
                              fontWeight: 700,
                              outline: 'none',
                              textAlign: 'center',
                              background: '#FFFFFF',
                            }}
                          />
                          <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>%</span>
                        </div>

                        <div style={{ fontSize: 10, color: C.muted }}>
                          Target: <strong>95% – 100% room air</strong>
                        </div>
                      </div>
                    </div>

                    {/* Secondary Row: RR, Weight/Height/BMI, Consciousness, Pain */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                        gap: 14,
                      }}
                    >
                      {/* Respiratory Rate */}
                      <div
                        style={{
                          background: '#FAFAFA',
                          borderRadius: 14,
                          border: `1px solid ${C.border}`,
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 800, color: C.text, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Wind size={14} color="#0D9488" /> Respiratory Rate
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="number"
                            placeholder="16"
                            value={form.respRate}
                            onChange={(e) => setForm((p) => ({ ...p, respRate: e.target.value }))}
                            style={{
                              flex: 1,
                              padding: '8px 10px',
                              borderRadius: 8,
                              border: `1px solid ${C.border}`,
                              fontSize: 14,
                              fontWeight: 700,
                              outline: 'none',
                              textAlign: 'center',
                              background: '#FFFFFF',
                            }}
                          />
                          <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>breaths/min</span>
                        </div>
                        <div style={{ fontSize: 10, color: C.muted }}>
                          Normal adult: <strong>12 – 20 bpm</strong>
                        </div>
                      </div>

                      {/* Anthropometrics & BMI */}
                      <div
                        style={{
                          background: '#FAFAFA',
                          borderRadius: 14,
                          border: `1px solid ${C.border}`,
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: C.text, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Weight size={14} color="#7C3AED" /> Anthropometrics
                          </span>
                          {analytics.bmiCategory && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                color: analytics.bmiCategory.color,
                                background: '#FFFFFF',
                                padding: '1px 6px',
                                borderRadius: 4,
                                border: `1px solid ${analytics.bmiCategory.color}30`,
                              }}
                            >
                              BMI {analytics.bmi} ({analytics.bmiCategory.label})
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="number"
                            step="0.5"
                            placeholder="kg"
                            value={form.weightKg}
                            onChange={(e) => setForm((p) => ({ ...p, weightKg: e.target.value }))}
                            style={{
                              flex: 1,
                              padding: '8px 8px',
                              borderRadius: 8,
                              border: `1px solid ${C.border}`,
                              fontSize: 13,
                              fontWeight: 700,
                              outline: 'none',
                              textAlign: 'center',
                              background: '#FFFFFF',
                            }}
                          />
                          <input
                            type="number"
                            placeholder="cm"
                            value={form.heightCm}
                            onChange={(e) => setForm((p) => ({ ...p, heightCm: e.target.value }))}
                            style={{
                              flex: 1,
                              padding: '8px 8px',
                              borderRadius: 8,
                              border: `1px solid ${C.border}`,
                              fontSize: 13,
                              fontWeight: 700,
                              outline: 'none',
                              textAlign: 'center',
                              background: '#FFFFFF',
                            }}
                          />
                        </div>
                        <div style={{ fontSize: 10, color: C.muted }}>Weight (kg) • Height (cm)</div>
                      </div>

                      {/* Consciousness (AVPU) */}
                      <div
                        style={{
                          background: '#FAFAFA',
                          borderRadius: 14,
                          border: `1px solid ${C.border}`,
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>
                          Consciousness (AVPU)
                        </span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(['Alert', 'Voice', 'Pain', 'Unresponsive'] as const).map((lvl) => (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => setForm((p) => ({ ...p, avpu: lvl }))}
                              style={{
                                flex: 1,
                                padding: '7px 4px',
                                borderRadius: 7,
                                border: 'none',
                                fontSize: 11,
                                fontWeight: 800,
                                cursor: 'pointer',
                                background: form.avpu === lvl ? (lvl === 'Alert' ? '#10B981' : '#EF4444') : '#FFFFFF',
                                color: form.avpu === lvl ? '#FFFFFF' : C.textSecondary,
                                boxShadow: form.avpu === lvl ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
                              }}
                            >
                              {lvl[0]}
                            </button>
                          ))}
                        </div>
                        <div style={{ fontSize: 10, color: C.muted }}>Current: <strong>{form.avpu}</strong></div>
                      </div>

                      {/* Pain Score */}
                      <div
                        style={{
                          background: '#FAFAFA',
                          borderRadius: 14,
                          border: `1px solid ${C.border}`,
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>Pain Score (0–10)</span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: form.painScore > 6 ? '#EF4444' : form.painScore > 3 ? '#F59E0B' : '#10B981',
                            }}
                          >
                            {form.painScore}/10
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 3 }}>
                          {[0, 2, 4, 6, 8, 10].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setForm((p) => ({ ...p, painScore: num }))}
                              style={{
                                flex: 1,
                                padding: '6px 0',
                                borderRadius: 6,
                                border: 'none',
                                fontSize: 11,
                                fontWeight: 800,
                                cursor: 'pointer',
                                background: form.painScore === num ? '#0F172A' : '#FFFFFF',
                                color: form.painScore === num ? '#FFFFFF' : C.muted,
                              }}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                        <div style={{ fontSize: 10, color: C.muted }}>0 = None • 10 = Severe</div>
                      </div>
                    </div>

                    {/* Nurse Triage Clinical Notes */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: C.text, display: 'block', marginBottom: 6 }}>
                        Nursing Observation & Chief Complaint
                      </label>
                      <textarea
                        rows={2}
                        value={form.notes}
                        onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                        placeholder="e.g. Patient presents with acute fever and chills x 2 days. Alert and oriented. Hydration fair..."
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '10px 14px',
                          borderRadius: 10,
                          border: `1px solid ${C.border}`,
                          fontSize: 13,
                          outline: 'none',
                          color: C.text,
                          fontFamily: 'inherit',
                          resize: 'none',
                        }}
                      />
                    </div>

                    {/* Clinical Department & Doctor Routing Card */}
                    <div
                      style={{
                        padding: 16,
                        borderRadius: 14,
                        background: 'linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%)',
                        border: '1.5px solid #7DD3FC',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#0369A1', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Stethoscope size={16} /> Clinical Department & Doctor Assignment
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#0284C7', background: '#FFFFFF', padding: '3px 8px', borderRadius: 6, border: '1px solid #BAE6FD' }}>
                          Automatic Routing to Doctor Queue
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 800, color: '#0369A1', display: 'block', marginBottom: 4 }}>
                            ASSIGN TO DEPARTMENT *
                          </label>
                          <select
                            value={targetDept}
                            onChange={(e) => setTargetDept(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: 10,
                              border: '1.5px solid #38BDF8',
                              background: '#FFFFFF',
                              fontSize: 13,
                              fontWeight: 700,
                              color: '#0F172A',
                              outline: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            {RECEPTION_DEPTS.map((dept) => (
                              <option key={dept} value={dept}>
                                {dept}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: 11, fontWeight: 800, color: '#0369A1', display: 'block', marginBottom: 4 }}>
                            ASSIGN SPECIFIC DOCTOR (OR POOL)
                          </label>
                          <select
                            value={targetDoctor}
                            onChange={(e) => setTargetDoctor(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: 10,
                              border: '1.5px solid #38BDF8',
                              background: '#FFFFFF',
                              fontSize: 13,
                              fontWeight: 600,
                              color: '#0F172A',
                              outline: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="Any available">Any Available Doctor ({targetDept} Pool)</option>
                            {facilityDoctors.map((doc) => (
                              <option key={doc} value={doc}>
                                Dr. {doc.replace(/^Dr\.?\s*/i, '')}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div style={{ fontSize: 11, color: '#0369A1', lineHeight: 1.45, fontWeight: 500 }}>
                        ✓ Once authorized, <strong>{selectedVisit.patientName}</strong> will immediately appear at the top of the live queue for doctors in <strong>{targetDept}</strong>, complete with collected vitals and clinical warning risk.
                      </div>
                    </div>

                    {/* Early Warning Score (NEWS2) & Urgency HUD */}
                    <div
                      style={{
                        padding: 16,
                        borderRadius: 14,
                        background:
                          analytics.urgency === 'critical'
                            ? '#FEF2F2'
                            : analytics.urgency === 'urgent'
                            ? '#FFFBEB'
                            : '#F0FDF4',
                        border:
                          analytics.urgency === 'critical'
                            ? '1.5px solid #FECACA'
                            : analytics.urgency === 'urgent'
                            ? '1.5px solid #FDE68A'
                            : '1.5px solid #BBF7D0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 14,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 12,
                            background:
                              analytics.urgency === 'critical'
                                ? '#EF4444'
                                : analytics.urgency === 'urgent'
                                ? '#F59E0B'
                                : '#10B981',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#FFFFFF',
                          }}
                        >
                          {analytics.urgency === 'critical' ? (
                            <AlertTriangle size={22} />
                          ) : analytics.urgency === 'urgent' ? (
                            <AlertCircle size={22} />
                          ) : (
                            <CheckCircle2 size={22} />
                          )}
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 800,
                              color:
                                analytics.urgency === 'critical'
                                  ? '#DC2626'
                                  : analytics.urgency === 'urgent'
                                  ? '#D97706'
                                  : '#059669',
                            }}
                          >
                            Triage Classification: {analytics.urgency.toUpperCase()}
                          </div>
                          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                            Calculated NEWS2 Risk: <strong>{analytics.newsPoints} Points</strong> •{' '}
                            {analytics.urgency === 'critical'
                              ? 'Immediate physician notification recommended'
                              : analytics.urgency === 'urgent'
                              ? 'Priority doctor worklist'
                              : 'Standard OPD consultation track'}
                          </div>
                        </div>
                      </div>

                      {/* Primary Save & Dispatch Button */}
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleSaveVitals}
                        style={{
                          padding: '12px 24px',
                          borderRadius: 12,
                          border: 'none',
                          cursor: saving ? 'wait' : 'pointer',
                          background: 'linear-gradient(135deg, #0D9488 0%, #2563EB 100%)',
                          color: '#FFFFFF',
                          fontSize: 13,
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          boxShadow: '0 4px 16px rgba(13,148,136,0.3)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Send size={15} />
                        <span>{saving ? 'Transmitting to EMR & Routing...' : `Authorize Vitals & Route to ${targetDept}`}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* --------------------------------------------------------
           * Triage Log & Historical Audit Tab
           * -------------------------------------------------------- */
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 18,
              border: `1px solid ${C.border}`,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: `1px solid ${C.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>
                  Facility Vitals Audit & Triage Register
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>
                  Total {vitalsLog.length} patient records logged in {facilityId}
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: `1px solid ${C.border}`, color: C.muted }}>
                    <th style={{ padding: '12px 18px', fontWeight: 700 }}>Recorded Time</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700 }}>Patient Name</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700 }}>Hospital No</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700 }}>Blood Pressure</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700 }}>Pulse / SpO₂</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700 }}>Temp</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700 }}>Urgency</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700 }}>Staff</th>
                  </tr>
                </thead>
                <tbody>
                  {vitalsLog.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: C.muted }}>
                        No triage vitals recorded yet today.
                      </td>
                    </tr>
                  ) : (
                    vitalsLog.map((r) => (
                      <tr key={r.id} style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
                        <td style={{ padding: '12px 18px', color: C.muted }}>
                          {r.recordedAt.slice(11, 16)}
                        </td>
                        <td style={{ padding: '12px 18px', fontWeight: 700, color: C.text }}>
                          {r.patientName}
                        </td>
                        <td style={{ padding: '12px 18px', color: C.muted }}>{r.hospitalNumber}</td>
                        <td style={{ padding: '12px 18px', fontWeight: 600 }}>
                          {r.bpSystolic && r.bpDiastolic ? `${r.bpSystolic}/${r.bpDiastolic} mmHg` : '—'}
                        </td>
                        <td style={{ padding: '12px 18px' }}>
                          {r.pulse ? `${r.pulse} bpm` : '—'} {r.spo2 ? `• ${r.spo2}%` : ''}
                        </td>
                        <td style={{ padding: '12px 18px' }}>{r.tempC ? `${r.tempC}°C` : '—'}</td>
                        <td style={{ padding: '12px 18px' }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              padding: '2px 8px',
                              borderRadius: 6,
                              background:
                                r.urgency === 'critical'
                                  ? '#FEF2F2'
                                  : r.urgency === 'urgent'
                                  ? '#FFFBEB'
                                  : '#ECFDF5',
                              color:
                                r.urgency === 'critical'
                                  ? '#DC2626'
                                  : r.urgency === 'urgent'
                                  ? '#D97706'
                                  : '#059669',
                            }}
                          >
                            {r.urgency}
                          </span>
                        </td>
                        <td style={{ padding: '12px 18px', color: C.muted }}>{r.recordedBy || 'Nurse'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
