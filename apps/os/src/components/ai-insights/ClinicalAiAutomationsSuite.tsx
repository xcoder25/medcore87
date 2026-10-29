'use client';

/**
 * MedCore Enterprise AI Automations Command Suite.
 * Interactive dashboard for documentation, clinical triage, robotic supply chain,
 * and MedCore Mobile connected patient engagement.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Brain, Sparkles, MessageSquare, AlertTriangle, ShieldCheck, HeartPulse,
  Activity, ArrowUpRight, CheckCircle2, Pill, Package, Radio, Volume2, Globe,
  Send, RefreshCw, Zap, Bell, Check, UserCheck, Flame, Stethoscope
} from 'lucide-react';
import {
  STATE_ORDER_BUNDLES,
  autonomousTriageScore,
  detectSilentDeterioration,
  auditPrescriptionSafety,
  generateAutoDischargeSummary,
  listWhatsAppFollowups,
  computeRoboticStockReorders,
  detectStateEpidemicClusters,
  type DynamicOrderBundle,
  type SilentDeteriorationAlert,
  type WhatsAppCareFollowup,
  type DischargeSummaryRecord,
} from '../../lib/clinicalAiAutomations';

interface Props {
  session?: any;
}

type SubTab = 'triage-bundles' | 'discharge-ambient' | 'silent-alarms' | 'pharmacy-stock' | 'whatsapp-mobile' | 'epidemic';

export const ClinicalAiAutomationsSuite: React.FC<Props> = ({ session }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';
  const facilityName = session?.facility || 'Immanuel General Hospital, Eket';

  const [activeTab, setActiveTab] = useState<SubTab>('discharge-ambient');
  const [selectedBundleKey, setSelectedBundleKey] = useState<string>('severe_malaria');
  const [followups, setFollowups] = useState<WhatsAppCareFollowup[]>(() => listWhatsAppFollowups());
  const [activeLang, setActiveLang] = useState<'english' | 'ibibio' | 'annang' | 'oron' | 'pidgin'>('ibibio');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [discharges, setDischarges] = useState<DischargeSummaryRecord[]>([]);

  // Triage Simulator State
  const [triageAge, setTriageAge] = useState<number>(4);
  const [triageTemp, setTriageTemp] = useState<number>(39.8);
  const [triageBpSys, setTriageBpSys] = useState<number>(85);
  const [triageSpo2, setTriageSpo2] = useState<number>(93);
  const [triageIsPreg, setTriageIsPreg] = useState<boolean>(false);
  const [triageComplaint, setTriageComplaint] = useState<string>('High fever for 3 days, convulsion 1 hour ago');

  const triageResult = useMemo(() => {
    return autonomousTriageScore({
      ageYears: triageAge,
      tempC: triageTemp,
      bpSystolic: triageBpSys,
      spo2: triageSpo2,
      isPregnant: triageIsPreg,
      chiefComplaint: triageComplaint,
    });
  }, [triageAge, triageTemp, triageBpSys, triageSpo2, triageIsPreg, triageComplaint]);

  // Demo Discharge Generation
  const demoDischarge = useMemo(() => {
    return generateAutoDischargeSummary({
      patientId: 'PAT-8812',
      hospitalNumber: 'HOSP-4401',
      patientName: 'Aniefiok Ekpenyong',
      phone: '08023419082',
      admissionDate: '2026-10-22',
      dischargeDate: '2026-10-28',
      admittingDiagnosis: 'Severe Falciparum Malaria with Hyperpyrexia',
      finalDiagnosis: 'Resolved Severe Malaria · Mild Anemia',
      clinicalNotes: 'Patient completed 3 doses of IV Artesunate 120mg. Oral Artemether-Lumefantrine 80/480mg completed. Temperature normalized to 36.8°C. Oral intake well tolerated.',
      dischargeMeds: [
        { drugName: 'Artemether-Lumefantrine 80/480mg', dosage: '1 tab', frequency: 'BD (twice daily with meal)', duration: 'Complete remaining 1 day', specialInstructions: 'Take with fatty meal or milk for full absorption' },
        { drugName: 'Ferrous Sulfate 200mg', dosage: '1 tab', frequency: 'Daily', duration: '30 days', specialInstructions: 'Take with citrus or water, do not take with tea' },
        { drugName: 'Folic Acid 5mg', dosage: '1 tab', frequency: 'Daily', duration: '30 days', specialInstructions: 'Morning routine' }
      ],
      followUpWeeks: 2,
    });
  }, []);

  const bundles = STATE_ORDER_BUNDLES;
  const activeBundle = bundles[selectedBundleKey] || bundles.severe_malaria;
  const stockReorders = useMemo(() => computeRoboticStockReorders(), []);
  const epidemicAlerts = useMemo(() => detectStateEpidemicClusters(), []);

  // Drug Safety Demo
  const [safetyDrug, setSafetyDrug] = useState('Amoxicillin-Clavulanate (Augmentin) 625mg');
  const [hasPenicillinAllergy, setHasPenicillinAllergy] = useState(true);
  const [patientEgfr, setPatientEgfr] = useState(24);
  const [isPatientPregnant, setIsPatientPregnant] = useState(false);

  const safetyResult = useMemo(() => {
    return auditPrescriptionSafety(safetyDrug, {
      allergies: hasPenicillinAllergy ? ['Penicillin'] : [],
      egfr: patientEgfr,
      isPregnant: isPatientPregnant,
      currentMeds: ['Fluconazole 200mg', 'Lisinopril 10mg'],
    });
  }, [safetyDrug, hasPenicillinAllergy, patientEgfr, isPatientPregnant]);

  // Deterioration Simulation
  const deteriorationAlert = useMemo(() => {
    return detectSilentDeterioration({
      patientId: 'PAT-7012',
      patientName: 'Iniobong Edet Akpan',
      bedNumber: 'Ward 2, Bed 04',
      ward: 'Male Medical Inpatient Ward',
      readings: [
        { hr: 84, bpSys: 122, bpDia: 78, spo2: 97, temp: 37.1, rr: 16, time: '10:00' },
        { hr: 118, bpSys: 92, bpDia: 58, spo2: 93, temp: 38.9, rr: 24, time: '12:00' },
      ],
    });
  }, []);

  const tabBtn = (tab: SubTab, label: string, icon: any) => {
    const Icon = icon;
    const active = activeTab === tab;
    return (
      <button
        type="button"
        onClick={() => setActiveTab(tab)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10,
          border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.84rem',
          background: active ? '#0284C7' : '#FFF', color: active ? '#FFF' : '#475569',
          boxShadow: active ? '0 4px 12px rgba(2,132,199,0.25)' : 'none', transition: 'all 0.15s ease',
        }}
      >
        <Icon size={16} /> {label}
      </button>
    );
  };

  const handleSimulateAudio = () => {
    setIsPlayingAudio(true);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(demoDischarge.translations[activeLang]);
      utterance.rate = 0.95;
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setIsPlayingAudio(false), 3000);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto', fontFamily: 'inherit', color: '#0F172A' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ background: '#7C3AED', color: '#FFF', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 800 }}>
              AI AUTOMATIONS ENGINE
            </span>
            <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>Autonomous Clinical Assistant &amp; Workflow Driver</span>
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '4px 0', color: '#0F172A' }}>
            Clinical AI Automations &amp; MedCore Mobile Connect
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748B' }}>
            Hands-free documentation, autonomous emergency triage, robotic supply chain &amp; direct patient mobile synchronization.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '8px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', boxShadow: '0 0 8px #16A34A' }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#15803D' }}>Connected to MedCore Mobile (apps/care)</span>
          </div>
        </div>
      </div>

      {/* ── Sub Navigation Tabs ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', background: '#F1F5F9', padding: 6, borderRadius: 14 }}>
        {tabBtn('discharge-ambient', 'Discharge & Scribe (Multi-Lingual)', Volume2)}
        {tabBtn('triage-bundles', 'Autonomous Triage & Order Bundles', Zap)}
        {tabBtn('silent-alarms', 'Silent Deterioration Radar', HeartPulse)}
        {tabBtn('pharmacy-stock', 'Prescription Safety & Robotic Reorder', Pill)}
        {tabBtn('whatsapp-mobile', 'WhatsApp & Patient Mobile Follow-up', MessageSquare)}
        {tabBtn('epidemic', 'Autonomous Epidemic Flagging', Flame)}
      </div>

      {/* ═════════ 1. DISCHARGE & AMBIENT SCRIBE (MULTI-LINGUAL) ═════════ */}
      {activeTab === 'discharge-ambient' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20 }}>
          <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22, boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 800 }}>Auto-Generated Plain-Language Discharge Summary</h3>
                <span style={{ fontSize: '0.78rem', color: '#64748B' }}>Synthesized from inpatient chart · Auto-synced to patient's MedCore Mobile app</span>
              </div>
              <span style={{ background: '#DCFCE7', color: '#15803D', padding: '4px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 800 }}>
                Synced to Care App
              </span>
            </div>

            {/* Language Selector */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid #F1F5F9', paddingBottom: 12, flexWrap: 'wrap' }}>
              {(['english', 'ibibio', 'annang', 'oron', 'pidgin'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setActiveLang(lang)}
                  style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                    border: '1px solid #E2E8F0',
                    background: activeLang === lang ? '#0284C7' : '#FFF',
                    color: activeLang === lang ? '#FFF' : '#475569',
                    textTransform: 'capitalize',
                  }}
                >
                  {lang === 'ibibio' ? 'Ibibio (Native)' : lang === 'annang' ? 'Annang' : lang === 'oron' ? 'Oron (Oro)' : lang}
                </button>
              ))}
            </div>

            {/* Audio Synthesis Bar */}
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 14, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Text-to-Speech Voice Playback ({activeLang.toUpperCase()})</div>
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Assists non-literate patients before heading home</div>
              </div>
              <button
                type="button"
                onClick={handleSimulateAudio}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8,
                  background: isPlayingAudio ? '#DC2626' : '#7C3AED', color: '#FFF', fontWeight: 700, fontSize: '0.8rem', border: 'none', cursor: 'pointer'
                }}
              >
                <Volume2 size={16} /> {isPlayingAudio ? 'Speaking…' : 'Play Voice Instructions'}
              </button>
            </div>

            {/* Translated Summary Card */}
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#B45309', marginBottom: 6, textTransform: 'uppercase' }}>
                {activeLang} Patient Instructions
              </div>
              <div style={{ fontSize: '0.88rem', lineHeight: 1.6, color: '#78350F' }}>
                {demoDischarge.translations[activeLang]}
              </div>
            </div>

            {/* Discharge Medications Table */}
            <h4 style={{ margin: '14px 0 8px 0', fontSize: '0.9rem', fontWeight: 800 }}>Discharge Prescription List (Auto-Scheduled)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {demoDischarge.dischargeMedications.map((m, idx) => (
                <div key={idx} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 12, background: '#FFF' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#0284C7', fontSize: '0.88rem' }}>{m.drugName}</strong>
                    <span style={{ fontSize: '0.75rem', background: '#F1F5F9', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                      {m.dosage} · {m.frequency}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: 4 }}>
                    <strong>Duration:</strong> {m.duration} · <em>{m.specialInstructions}</em>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MedCore Mobile Patient View Mockup */}
          <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Radio size={18} style={{ color: '#16A34A' }} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>MedCore Mobile Real-Time Reflection</h3>
            </div>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.78rem', color: '#64748B' }}>
              What patient <strong>Aniefiok Ekpenyong</strong> (08023419082) sees on their phone right now via MedCore Care app:
            </p>

            {/* Phone Screen Card */}
            <div style={{ border: '2px solid #CBD5E1', borderRadius: 20, padding: 18, background: '#F8FAFC', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.05)' }}>
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0284C7', textTransform: 'uppercase' }}>MEDCORE CARE · MY HEALTH RECORD</span>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', marginTop: 2 }}>Hospital Discharge Card</div>
                <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Immanuel General Hospital, Eket</div>
              </div>

              <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Next Clinic Follow-Up</div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0F172A' }}>{demoDischarge.followUpDate}</div>
                <div style={{ fontSize: '0.7rem', color: '#16A34A' }}>Dr. Inyang · General Outpatient OPD</div>
              </div>

              <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Emergency Warning Signs</div>
                <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '0.72rem', color: '#DC2626' }}>
                  {demoDischarge.warningSigns.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>

              <div style={{ background: '#E0F2FE', border: '1px solid #BAE6FD', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369A1' }}>
                  Need help? WhatsApp Nurse Bot active on 08023419082
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════ 2. AUTONOMOUS TRIAGE & DYNAMIC ORDER BUNDLES ═════════ */}
      {activeTab === 'triage-bundles' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Triage Simulator */}
          <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Zap size={20} style={{ color: '#D97706' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Autonomous Waiting Room Triage Prioritizer</h3>
                <span style={{ fontSize: '0.78rem', color: '#64748B' }}>Instantly bumps high-acuity patients in crowded waiting queues</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Patient Age (Years)</label>
                <input
                  type="number"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', marginTop: 4 }}
                  value={triageAge}
                  onChange={(e) => setTriageAge(Number(e.target.value))}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Body Temp (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', marginTop: 4 }}
                  value={triageTemp}
                  onChange={(e) => setTriageTemp(Number(e.target.value))}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Systolic BP (mmHg)</label>
                <input
                  type="number"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', marginTop: 4 }}
                  value={triageBpSys}
                  onChange={(e) => setTriageBpSys(Number(e.target.value))}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>SpO2 Saturation (%)</label>
                <input
                  type="number"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', marginTop: 4 }}
                  value={triageSpo2}
                  onChange={(e) => setTriageSpo2(Number(e.target.value))}
                />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Chief Complaint</label>
              <input
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', marginTop: 4 }}
                value={triageComplaint}
                onChange={(e) => setTriageComplaint(e.target.value)}
              />
            </div>

            {/* AI Result Card */}
            <div
              style={{
                border: triageResult.bumpToQueueTop ? '2px solid #EF4444' : '1px solid #E2E8F0',
                borderRadius: 12,
                padding: 16,
                background: triageResult.bumpToQueueTop ? '#FEF2F2' : '#F0FDF4',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    background: triageResult.bumpToQueueTop ? '#DC2626' : '#16A34A',
                    color: '#FFF',
                  }}
                >
                  ESI LEVEL {triageResult.esiScore} · {triageResult.priority}
                </span>
                {triageResult.bumpToQueueTop && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#DC2626' }}>
                    ⚡ AUTO-BUMPED TO #1 IN QUEUE
                  </span>
                )}
              </div>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0F172A', marginBottom: 4 }}>
                {triageResult.urgencyLabel}
              </div>
              <ul style={{ margin: '6px 0 0 16px', padding: 0, fontSize: '0.75rem', color: '#475569' }}>
                {triageResult.triggerReasons.map((tr, idx) => (
                  <li key={idx}>{tr}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Dynamic Order Bundling */}
          <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Stethoscope size={20} style={{ color: '#0284C7' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Akwa Ibom State Dynamic Order Bundling</h3>
                <span style={{ fontSize: '0.78rem', color: '#64748B' }}>1-click pre-populated lab, imaging and medication sets</span>
              </div>
            </div>

            {/* Bundle Selector Chips */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {Object.keys(bundles).map((bKey) => (
                <button
                  key={bKey}
                  type="button"
                  onClick={() => setSelectedBundleKey(bKey)}
                  style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer',
                    border: '1px solid #E2E8F0',
                    background: selectedBundleKey === bKey ? '#0284C7' : '#F8FAFC',
                    color: selectedBundleKey === bKey ? '#FFF' : '#475569',
                  }}
                >
                  {bundles[bKey].title.split(' ')[0]} {bundles[bKey].title.split(' ')[1]}
                </button>
              ))}
            </div>

            {/* Active Bundle Detail */}
            <div style={{ border: '1px solid #BAE6FD', background: '#F0F9FF', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ fontSize: '0.95rem', color: '#0C4A6E' }}>{activeBundle.title}</strong>
                <span style={{ background: '#DC2626', color: '#FFF', padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 800 }}>
                  {activeBundle.urgency}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#0369A1', marginBottom: 12 }}>
                <strong>Standard:</strong> {activeBundle.guidelineSource}
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>Laboratories Pre-Bundled:</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {activeBundle.labs.map((l, idx) => (
                    <span key={idx} style={{ background: '#FFF', border: '1px solid #CBD5E1', padding: '3px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600 }}>
                      ✓ {l}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>Medications (STAT Administration):</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {activeBundle.medications.map((m, idx) => (
                    <div key={idx} style={{ fontSize: '0.75rem', color: '#166534', background: '#DCFCE7', padding: '4px 8px', borderRadius: 6, fontWeight: 700 }}>
                      ⚡ {m}
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                style={{
                  width: '100%', padding: '10px', borderRadius: 8, background: '#0284C7', color: '#FFF',
                  fontWeight: 800, fontSize: '0.82rem', border: 'none', cursor: 'pointer', marginTop: 10
                }}
              >
                Apply Full Order Bundle to Chart STAT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════ 3. SILENT DETERIORATION RADAR ═════════ */}
      {activeTab === 'silent-alarms' && (
        <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <HeartPulse size={22} style={{ color: '#DC2626' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Silent Inpatient Deterioration Radar</h3>
              <span style={{ fontSize: '0.78rem', color: '#64748B' }}>Continuous vital trend trajectory monitoring · Instant duty nurse push alerts</span>
            </div>
          </div>

          {deteriorationAlert && (
            <div style={{ border: '2px solid #EF4444', borderRadius: 14, padding: 18, background: '#FEF2F2', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#DC2626', animation: 'pulse 1s infinite' }} />
                  <strong style={{ color: '#DC2626', fontSize: '1rem' }}>{deteriorationAlert.indicator}</strong>
                </div>
                <span style={{ background: '#DC2626', color: '#FFF', padding: '4px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 800 }}>
                  CRITICAL ALARM PUSHED TO DUTY NURSE
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
                <div style={{ background: '#FFF', padding: 10, borderRadius: 8, border: '1px solid #FCA5A5' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748B' }}>Patient &amp; Location</span>
                  <div style={{ fontWeight: 800 }}>{deteriorationAlert.patientName}</div>
                  <div style={{ fontSize: '0.75rem', color: '#DC2626' }}>{deteriorationAlert.bedNumber} ({deteriorationAlert.ward})</div>
                </div>

                <div style={{ background: '#FFF', padding: 10, borderRadius: 8, border: '1px solid #FCA5A5' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748B' }}>Current Vitals</span>
                  <div style={{ fontWeight: 800 }}>HR {deteriorationAlert.currentVitals.hr} bpm · BP {deteriorationAlert.currentVitals.bp}</div>
                  <div style={{ fontSize: '0.75rem', color: '#475569' }}>SpO2 {deteriorationAlert.currentVitals.spo2}% · RR {deteriorationAlert.currentVitals.rr} bpm</div>
                </div>

                <div style={{ background: '#FFF', padding: 10, borderRadius: 8, border: '1px solid #FCA5A5' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748B' }}>AI Trajectory Warning</span>
                  <div style={{ fontSize: '0.78rem', color: '#7F1D1D', fontWeight: 600 }}>{deteriorationAlert.trajectorySlope}</div>
                </div>
              </div>

              <div style={{ background: '#FFF', padding: 12, borderRadius: 8, border: '1px solid #FCA5A5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '0.8rem', color: '#991B1B' }}>Automated Clinical Directive: </strong>
                  <span style={{ fontSize: '0.8rem', color: '#7F1D1D' }}>{deteriorationAlert.recommendedAction}</span>
                </div>
                <button
                  type="button"
                  style={{ padding: '8px 16px', borderRadius: 8, background: '#DC2626', color: '#FFF', fontWeight: 800, fontSize: '0.78rem', border: 'none', cursor: 'pointer' }}
                >
                  Acknowledge &amp; Dispatch STAT
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═════════ 4. PHARMACY SAFETY & ROBOTIC REORDERING ═════════ */}
      {activeTab === 'pharmacy-stock' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Prescription Safety Checker */}
          <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <ShieldCheck size={20} style={{ color: '#16A34A' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Automated Prescription Safety Audit</h3>
                <span style={{ fontSize: '0.78rem', color: '#64748B' }}>Instant checks for allergies, kidney clearance, interactions &amp; pregnancy</span>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Drug Being Prescribed</label>
              <select
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', marginTop: 4, background: '#FFF' }}
                value={safetyDrug}
                onChange={(e) => setSafetyDrug(e.target.value)}
              >
                <option value="Amoxicillin-Clavulanate (Augmentin) 625mg">Amoxicillin-Clavulanate (Augmentin) 625mg</option>
                <option value="Gentamicin 80mg IV">Gentamicin 80mg IV</option>
                <option value="Lisinopril 10mg tab">Lisinopril 10mg tab</option>
                <option value="Ciprofloxacin 500mg tab">Ciprofloxacin 500mg tab</option>
                <option value="Paracetamol 1g IV">Paracetamol 1g IV</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={hasPenicillinAllergy} onChange={(e) => setHasPenicillinAllergy(e.target.checked)} />
                Penicillin Allergy Listed
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={isPatientPregnant} onChange={(e) => setIsPatientPregnant(e.target.checked)} />
                Patient Is Pregnant
              </label>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Patient eGFR (mL/min/1.73m²): {patientEgfr}</label>
              <input
                type="range"
                min="10"
                max="120"
                value={patientEgfr}
                onChange={(e) => setPatientEgfr(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            {/* Safety Audit Result */}
            <div style={{ border: safetyResult.safeToDispense ? '1px solid #BBF7D0' : '2px solid #EF4444', borderRadius: 12, padding: 14, background: safetyResult.safeToDispense ? '#F0FDF4' : '#FEF2F2' }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: safetyResult.safeToDispense ? '#15803D' : '#B91C1C', marginBottom: 4 }}>
                {safetyResult.safeToDispense ? '✓ Prescribing Audit Passed: Safe to Dispense' : '⚠️ HIGH RISK CONTRAINDICATION DETECTED'}
              </div>
              {safetyResult.alerts.map((al, idx) => (
                <div key={idx} style={{ fontSize: '0.75rem', color: '#7F1D1D', marginTop: 4 }}>
                  • <strong>[{al.type}]</strong>: {al.message}
                </div>
              ))}
            </div>
          </div>

          {/* Robotic Stock Reordering */}
          <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Package size={20} style={{ color: '#0284C7' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Robotic Stock Reordering to Central Medical Store</h3>
                <span style={{ fontSize: '0.78rem', color: '#64748B' }}>Seasonal predictive reordering (Rainy Season Malaria Spike Multiplier +40%)</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stockReorders.map((sr) => (
                <div key={sr.drugId} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 12, background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.85rem' }}>{sr.name}</strong>
                    <span style={{ background: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 800 }}>
                      {sr.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: 4 }}>
                    Current Stock: <strong>{sr.currentStockUnits}</strong> units · Buffer: {sr.minSafetyBuffer} · Burn: {sr.burnRatePerDay}/day
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#0369A1', marginTop: 4, fontWeight: 700 }}>
                    Reorder: {sr.recommendedReorderUnits} units → {sr.supplierTarget}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═════════ 5. WHATSAPP & PATIENT MOBILE FOLLOW-UP ═════════ */}
      {activeTab === 'whatsapp-mobile' && (
        <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={20} style={{ color: '#16A34A' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Interactive WhatsApp &amp; MedCore Mobile Follow-up Bot</h3>
                <span style={{ fontSize: '0.78rem', color: '#64748B' }}>Post-discharge adherence monitoring &amp; automated triage escalation</span>
              </div>
            </div>
            <span style={{ background: '#DCFCE7', color: '#15803D', padding: '4px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 800 }}>
              WhatsApp API Gateway Live
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 16 }}>
            {followups.map((f) => (
              <div
                key={f.id}
                style={{
                  border: f.flaggedForDoctorReview ? '2px solid #EF4444' : '1px solid #E2E8F0',
                  borderRadius: 14,
                  padding: 16,
                  background: f.flaggedForDoctorReview ? '#FFF5F5' : '#FFF',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <strong style={{ fontSize: '0.92rem' }}>{f.patientName}</strong>
                    <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Day {f.followupDay} Post-Discharge · Tel: {f.phone}</div>
                  </div>
                  <span
                    style={{
                      background: f.flaggedForDoctorReview ? '#DC2626' : '#16A34A',
                      color: '#FFF',
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: '0.7rem',
                      fontWeight: 800,
                    }}
                  >
                    {f.sentiment}
                  </span>
                </div>

                <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8, fontSize: '0.78rem', color: '#334155', marginBottom: 8 }}>
                  <strong>Bot Outgoing:</strong> {f.messageSent}
                </div>

                <div style={{ background: '#EFF6FF', padding: 10, borderRadius: 8, fontSize: '0.78rem', color: '#1E40AF', marginBottom: 10 }}>
                  <strong>Patient Reply:</strong> "{f.patientReply}"
                </div>

                {f.flaggedForDoctorReview ? (
                  <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', padding: 8, borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: '#991B1B', fontWeight: 700 }}>
                      ⚠️ Urgent Obstetric / Pre-eclampsia Flag Triggered!
                    </span>
                    <button
                      type="button"
                      style={{ padding: '4px 10px', borderRadius: 6, background: '#DC2626', color: '#FFF', fontSize: '0.72rem', fontWeight: 800, border: 'none', cursor: 'pointer' }}
                    >
                      Call Patient STAT
                    </button>
                  </div>
                ) : (
                  <span style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 600 }}>
                    ✓ Adherence confirmed · Next automated check scheduled for Day 7
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═════════ 6. AUTONOMOUS STATE EPIDEMIC FLAGGING ═════════ */}
      {activeTab === 'epidemic' && (
        <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Flame size={22} style={{ color: '#EA580C' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Akwa Ibom State Autonomous Epidemic Surveillance</h3>
              <span style={{ fontSize: '0.78rem', color: '#64748B' }}>Aggregates diagnostic clusters across 31 LGAs · Alerts State MoH Epidemiology Team</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
            {epidemicAlerts.map((ep, idx) => (
              <div
                key={idx}
                style={{
                  border: ep.alertLevel === 'EPIDEMIC_SURGE' ? '2px solid #DC2626' : '1px solid #F59E0B',
                  borderRadius: 12,
                  padding: 16,
                  background: ep.alertLevel === 'EPIDEMIC_SURGE' ? '#FEF2F2' : '#FFFBEB',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ fontSize: '0.95rem' }}>{ep.lga} LGA Cluster</strong>
                  <span
                    style={{
                      background: ep.alertLevel === 'EPIDEMIC_SURGE' ? '#DC2626' : '#D97706',
                      color: '#FFF',
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: '0.7rem',
                      fontWeight: 800,
                    }}
                  >
                    {ep.alertLevel} (+{ep.deviationSigma}σ)
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0F172A', marginBottom: 4 }}>
                  {ep.syndrome}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: 8 }}>
                  Cases in last 72 hours: <strong>{ep.caseCountLast72h}</strong> (Expected baseline: {ep.baselineExpected})
                </div>
                <div style={{ fontSize: '0.75rem', color: '#0369A1', background: '#FFF', padding: 8, borderRadius: 6, border: '1px solid #CBD5E1', fontWeight: 600 }}>
                  🚨 Action: {ep.actionTriggered}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClinicalAiAutomationsSuite;
