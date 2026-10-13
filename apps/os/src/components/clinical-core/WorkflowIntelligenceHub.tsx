'use client';

/**
 * WorkflowIntelligenceHub — Master Clinical & Operational Intelligence Console.
 * Directly visualizes, triggers, and manages intelligent algorithms across
 * all seven primary EMR hospital workflows.
 */

import React, { useState, useMemo } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  checkMpiDuplicates,
  predictQueueWaitTime,
  evaluateSepsisRisk,
  checkCrossAllergies,
  suggestIcd10Diagnoses,
  EVIDENCE_BASED_PROTOCOLS,
  checkRenalDosing,
  evaluateLabDeltaCheck,
  generateAiDischargeSummary,
  scrubInsuranceClaim,
  type ClinicalProtocol,
} from '../../lib/workflowIntelligenceSuite';
import { listPatients, type FacilityPatient } from '../../lib/patientRegistryStore';
import { listOrders, placeOrder } from '../../lib/clinicalEventBus';
import { listVisits } from '../../lib/receptionOpsStore';
import { listVitals } from '../../lib/nursingVitalsStore';
import {
  Brain,
  ShieldAlert,
  Sparkles,
  Users,
  Activity,
  Stethoscope,
  FlaskConical,
  FileText,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Send,
  Zap,
  Search,
  Check,
  ArrowRight,
  TrendingDown,
  Layers,
  Clock,
  HeartPulse,
} from 'lucide-react';

interface Props {
  session: Partial<UserSession> & { hospitalId?: string; name?: string; badgeId?: string };
  onClose?: () => void;
}

export const WorkflowIntelligenceHub: React.FC<Props> = ({ session, onClose }) => {
  const facilityId = session.hospitalId || 'IGH-EKT';

  const [activeWorkflow, setActiveWorkflow] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1);

  // Data sources
  const patients = useMemo(() => listPatients(facilityId), [facilityId]);
  const visits = useMemo(() => listVisits(facilityId), [facilityId]);
  const orders = useMemo(() => listOrders(facilityId), [facilityId]);
  const vitals = useMemo(() => listVitals(facilityId), [facilityId]);

  // Selected patient for interactive modules
  const [selectedPatientId, setSelectedPatientId] = useState<string>(patients[0]?.id || '');
  const currentPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) || patients[0] || null,
    [patients, selectedPatientId]
  );

  // Workflow 1 States
  const [testName, setTestName] = useState('Emeka Okafor');
  const [testPhone, setTestPhone] = useState('08031234567');
  const mpiMatches = useMemo(() => {
    const parts = testName.split(' ');
    return checkMpiDuplicates(facilityId, {
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
      phone: testPhone,
    });
  }, [facilityId, testName, testPhone]);
  const waitPrediction = useMemo(() => predictQueueWaitTime(facilityId), [facilityId]);

  // Workflow 2 States (qSOFA & Sepsis)
  const [qBpSys, setQBpSys] = useState('95');
  const [qRr, setQRr] = useState('24');
  const [qAvpu, setQAvpu] = useState('Voice');
  const sepsisResult = useMemo(
    () =>
      evaluateSepsisRisk({
        bpSystolic: Number(qBpSys) || 120,
        respRate: Number(qRr) || 16,
        avpu: qAvpu,
      }),
    [qBpSys, qRr, qAvpu]
  );

  // Workflow 3 States (ICD-10 CDS)
  const [clinNote, setClinNote] = useState('Patient presents with high spiking fever x 3 days, chills, rigors, and severe headache. MP RDT is positive.');
  const icd10Suggestions = useMemo(
    () => suggestIcd10Diagnoses({ notes: clinNote }),
    [clinNote]
  );

  // Workflow 4 States (CPOE Protocols & Renal Dosing)
  const [selectedProtocol, setSelectedProtocol] = useState<ClinicalProtocol>(EVIDENCE_BASED_PROTOCOLS[0]);
  const [protocolCommitted, setProtocolCommitted] = useState(false);
  const [renalDrug, setRenalDrug] = useState('Metformin 500mg');
  const [renalCreat, setRenalCreat] = useState('2.4');
  const renalAlert = useMemo(
    () => checkRenalDosing(renalDrug, Number(renalCreat) || 1.0),
    [renalDrug, renalCreat]
  );

  const handleApplyProtocol = () => {
    if (!currentPatient) return;
    for (const item of selectedProtocol.orders) {
      placeOrder({
        facilityId,
        patientId: currentPatient.id,
        patientName: `${currentPatient.firstName} ${currentPatient.lastName}`,
        hospitalNumber: currentPatient.hospitalNumber,
        type: item.type,
        code: item.code,
        name: item.name,
        orderedBy: session.name || 'Clinical Intelligence Bus',
        orderedByBadge: session.badgeId,
        priority: item.priority,
      });
    }
    setProtocolCommitted(true);
    setTimeout(() => setProtocolCommitted(false), 4000);
  };

  // Workflow 5 States (LIS Delta Check)
  const [analyte, setAnalyte] = useState('Potassium (K+)');
  const [currVal, setCurrVal] = useState('6.2');
  const [prevVal, setPrevVal] = useState('4.1');
  const deltaAlert = useMemo(
    () => evaluateLabDeltaCheck(analyte, Number(currVal) || 0, Number(prevVal) || 0),
    [analyte, currVal, prevVal]
  );

  // Workflow 6 States (AI Discharge Summary)
  const dischargeSummary = useMemo(() => {
    if (!currentPatient) return null;
    const dummyVisit = visits[0] || {
      id: 'vis-demo',
      patientId: currentPatient.id,
      patientName: `${currentPatient.firstName} ${currentPatient.lastName}`,
      hospitalNumber: currentPatient.hospitalNumber,
      department: 'General OPD',
      visitType: 'walkin',
      checkedInAt: new Date().toISOString(),
      status: 'with_provider',
    };
    return generateAiDischargeSummary({
      patient: currentPatient,
      visit: dummyVisit,
      orders: orders.filter((o) => o.patientId === currentPatient.id),
      primaryDiagnosis: icd10Suggestions[0]?.description || 'Acute Febrile Illness',
    });
  }, [currentPatient, visits, orders, icd10Suggestions]);

  // Workflow 7 States (RCM Claim Scrubber)
  const [claimIcd, setClaimIcd] = useState('B50.9');
  const [preAuthToken, setPreAuthToken] = useState('');
  const claimResult = useMemo(() => {
    if (!currentPatient) return null;
    return scrubInsuranceClaim({
      patient: currentPatient,
      primaryIcd10: claimIcd,
      orders: orders.filter((o) => o.patientId === currentPatient.id),
      hmoProvider: currentPatient.insuranceProvider || 'Akwa Ibom State Health Scheme (AKSHS)',
      preAuthCode: preAuthToken,
    });
  }, [currentPatient, claimIcd, orders, preAuthToken]);

  const workflowsMeta = [
    { num: 1, title: 'Patient Access & Onboarding', icon: Users, desc: 'MPI Duplicate Radar & Queue Wait-Time Forecasting' },
    { num: 2, title: 'Clinical Triage & Intake', icon: Activity, desc: 'NEWS2 & qSOFA Sepsis Early Deterioration Detection' },
    { num: 3, title: 'Provider Consultation & CDS', icon: Stethoscope, desc: 'Intelligent ICD-10 Coding & Diagnostic Decision Support' },
    { num: 4, title: 'CPOE Order Entry & Protocols', icon: FlaskConical, desc: 'Evidence Bundles, Renal Safety & Drug Interactions' },
    { num: 5, title: 'Ancillary Integration (LIS / MAR)', icon: Layers, desc: 'Laboratory Delta-Check Engine & 5-Rights MAR' },
    { num: 6, title: 'Care Coordination & Discharge', icon: FileText, desc: 'AI Discharge Summary & LACE 30-Day Readmission Index' },
    { num: 7, title: 'Revenue Cycle Management (RCM)', icon: DollarSign, desc: 'Point-of-Care Charge Capture & Pre-Claim AI Scrubber' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '840px',
        background: '#F8FAFC',
        borderRadius: 20,
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.1)',
        fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
      }}
    >
      {/* ------------------------------------------------------------------
       * Top Header
       * ------------------------------------------------------------------ */}
      <div
        style={{
          padding: '16px 24px',
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
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
              background: 'linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
            }}
          >
            <Brain size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>
                Enterprise Clinical & Operational Intelligence Suite
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  background: '#EEF2FF',
                  color: '#4F46E5',
                  padding: '2px 8px',
                  borderRadius: 6,
                  border: '1px solid #C7D2FE',
                }}
              >
                7 Core Workflows Active
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
              Facility: <strong>{facilityId}</strong> • AI Assisted Decision Support Engine
            </div>
          </div>
        </div>

        {/* Patient Switcher for Testing Intelligence */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F1F5F9', padding: '6px 12px', borderRadius: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Context Patient:</span>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: 12,
                fontWeight: 700,
                color: '#0F172A',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName} ({p.hospitalNumber})
                </option>
              ))}
            </select>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                color: '#334155',
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------
       * Workflow Selector Bar
       * ------------------------------------------------------------------ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
        }}
      >
        {workflowsMeta.map((wf) => {
          const Icon = wf.icon;
          const isActive = activeWorkflow === wf.num;
          return (
            <button
              key={wf.num}
              type="button"
              onClick={() => setActiveWorkflow(wf.num as any)}
              style={{
                padding: '12px 10px',
                border: 'none',
                borderBottom: isActive ? '3px solid #4F46E5' : '3px solid transparent',
                background: isActive ? '#F8FAFC' : 'transparent',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: isActive ? '#4F46E5' : '#F1F5F9',
                  color: isActive ? '#FFFFFF' : '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={16} />
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: isActive ? '#4F46E5' : '#475569',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}
              >
                {wf.num}. {wf.title.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------------
       * Main Dynamic Workflow Intelligence Canvas
       * ------------------------------------------------------------------ */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {/* WORKFLOW 1: PATIENT ACCESS & ONBOARDING */}
        {activeWorkflow === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* MPI Duplicate Radar */}
            <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Users size={20} color="#4F46E5" />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                    MPI Identity Resolution & Duplicate Radar
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Fuzzy name distance & telephone cross-check against Master Patient Index
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <input
                  type="text"
                  placeholder="Test patient name..."
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }}
                />
                <input
                  type="text"
                  placeholder="Phone number..."
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  style={{ width: 140, padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }}
                />
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
                MPI Match Candidates ({mpiMatches.length} flagged)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {mpiMatches.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#10B981', background: '#ECFDF5', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
                    <CheckCircle2 size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    No duplicate identities detected. Clean Master Patient Index record.
                  </div>
                ) : (
                  mpiMatches.map((m) => (
                    <div
                      key={m.patient.id}
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        background: '#FFFBEB',
                        border: '1px solid #FDE68A',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 13, color: '#92400E' }}>
                          {m.patient.firstName} {m.patient.lastName} ({m.patient.hospitalNumber})
                        </div>
                        <div style={{ fontSize: 11, color: '#B45309', marginTop: 2 }}>
                          {m.matchReasons.join(' • ')}
                        </div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, background: '#FEF3C7', color: '#B45309', padding: '4px 10px', borderRadius: 8 }}>
                        {m.confidenceScore}% Match
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Smart Wait-Time Forecaster */}
            <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Clock size={20} color="#0D9488" />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                    Real-Time Queue Wait-Time Forecaster
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Machine-predicted throughput model based on current clinic depth
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 20 }}>
                <div style={{ background: '#F8FAFC', padding: 16, borderRadius: 12, border: '1px solid #E2E8F0', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>PREDICTED WAIT</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#0D9488', marginTop: 4 }}>
                    ~{waitPrediction.estimatedWaitMins}m
                  </div>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>To Doctor Consult</div>
                </div>
                <div style={{ background: '#F8FAFC', padding: 16, borderRadius: 12, border: '1px solid #E2E8F0', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>QUEUE DEPTH</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#2563EB', marginTop: 4 }}>
                    {waitPrediction.queueDepth}
                  </div>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>Patients Waiting</div>
                </div>
                <div style={{ background: '#F8FAFC', padding: 16, borderRadius: 12, border: '1px solid #E2E8F0', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>CLINIC CAPACITY</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#7C3AED', marginTop: 4 }}>
                    {waitPrediction.throughputPerHr}/hr
                  </div>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>Target Throughput</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* WORKFLOW 2: CLINICAL TRIAGE & INTAKE */}
        {activeWorkflow === 2 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* qSOFA Sepsis Deterioration Radar */}
            <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <ShieldAlert size={20} color={sepsisResult.hasSepsisAlert ? '#EF4444' : '#10B981'} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                    qSOFA Sepsis Early Deterioration Radar
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Surveillance criteria: RR ≥ 22, Altered Mentation, SBP ≤ 100 mmHg
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Systolic BP (mmHg)
                  </label>
                  <input
                    type="number"
                    value={qBpSys}
                    onChange={(e) => setQBpSys(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Resp Rate (bpm)
                  </label>
                  <input
                    type="number"
                    value={qRr}
                    onChange={(e) => setQRr(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Consciousness (AVPU)
                  </label>
                  <select
                    value={qAvpu}
                    onChange={(e) => setQAvpu(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, fontWeight: 700 }}
                  >
                    <option value="Alert">Alert</option>
                    <option value="Voice">Voice</option>
                    <option value="Pain">Pain</option>
                    <option value="Unresponsive">Unresponsive</option>
                  </select>
                </div>
              </div>

              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: sepsisResult.hasSepsisAlert ? '#FEF2F2' : '#F0FDF4',
                  border: sepsisResult.hasSepsisAlert ? '1.5px solid #FECACA' : '1.5px solid #BBF7D0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: sepsisResult.hasSepsisAlert ? '#DC2626' : '#15803D' }}>
                    qSOFA Score: {sepsisResult.qSofaScore} / 3
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: sepsisResult.hasSepsisAlert ? '#DC2626' : '#15803D' }}>
                    {sepsisResult.hasSepsisAlert ? 'SEPSIS PROTOCOL TRIGGERED' : 'LOW IMMEDIATE RISK'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#334155', marginTop: 8, lineHeight: 1.5 }}>
                  {sepsisResult.recommendation}
                </div>
              </div>
            </div>

            {/* Cross-Allergen Sensitivity Matrix */}
            <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <HeartPulse size={20} color="#7C3AED" />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                    Cross-Allergen Interaction Checker
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Evaluates beta-lactam and NSAID class cross-sensitivities
                  </div>
                </div>
              </div>

              <div style={{ padding: 14, borderRadius: 12, background: '#F8FAFC', border: '1px solid #E2E8F0', marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>CURRENT PATIENT ALLERGIES:</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginTop: 2 }}>
                  {currentPatient?.allergies?.join(', ') || 'Penicillin, Aspirin (Simulated)'}
                </div>
              </div>

              <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
                <strong>Active Cross-Allergen Guard:</strong>
                <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                  <li>Penicillin allergy automatically audits Ceftriaxone / Cefuroxime orders for 3-5% cross-reactivity risk.</li>
                  <li>Aspirin allergy triggers hard-stop flags on Diclofenac and Ketorolac prescriptions.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* WORKFLOW 3: PROVIDER CONSULTATION & CDS */}
        {activeWorkflow === 3 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Stethoscope size={20} color="#2563EB" />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                    AI Diagnostic & ICD-10 Coding Assistant
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Extracts standardized WHO ICD-10 diagnostic classifications from clinical notes
                  </div>
                </div>
              </div>

              <textarea
                rows={4}
                value={clinNote}
                onChange={(e) => setClinNote(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                  fontSize: 13,
                  outline: 'none',
                  fontFamily: 'inherit',
                  resize: 'none',
                  marginBottom: 14,
                }}
              />

              <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
                Suggested ICD-10 Codes:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {icd10Suggestions.map((s) => (
                  <div
                    key={s.code}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      background: '#F0F9FF',
                      border: '1px solid #BAE6FD',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, background: '#0284C7', color: '#fff', padding: '2px 8px', borderRadius: 6 }}>
                          {s.code}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                          {s.description}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                        {s.matchedRationale}
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#0369A1' }}>
                      {s.confidence}% Match
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Sparkles size={20} color="#F59E0B" />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                    Clinical Decision Support (CDS) Rule Engine
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Active guidance on glycemic control, cardiovascular risk & pediatric dosing
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: 12, borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A' }}>
                    Hypertension Care Cascade
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    For Stage 2 HTN (BP ≥140/90), guidelines recommend dual-agent therapy (CCB + Thiazide or ARB) rather than monotherapy.
                  </div>
                </div>
                <div style={{ padding: 12, borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A' }}>
                    Type 2 Diabetes Screening
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    Patients with BMI ≥ 25 + family history prompt automatic HbA1c ordering recommendations.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* WORKFLOW 4: CPOE PROTOCOL & RENAL DOSING */}
        {activeWorkflow === 4 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20 }}>
            {/* Clinical Evidence Protocols */}
            <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <FlaskConical size={20} color="#0D9488" />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                    Evidence-Based Clinical Protocol Bundles
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Pre-configured orders for emergency and acute admissions
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {EVIDENCE_BASED_PROTOCOLS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProtocol(p)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 10,
                      border: selectedProtocol.id === p.id ? '2px solid #0D9488' : '1px solid #E2E8F0',
                      background: selectedProtocol.id === p.id ? '#F0FDFA' : '#FFFFFF',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      color: selectedProtocol.id === p.id ? '#0F766E' : '#475569',
                    }}
                  >
                    {p.name.split(' ')[0]} {p.name.split(' ')[1]}
                  </button>
                ))}
              </div>

              <div style={{ padding: 14, borderRadius: 12, background: '#F8FAFC', border: '1px solid #E2E8F0', marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>{selectedProtocol.name}</div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{selectedProtocol.evidenceBase}</div>
                <div style={{ fontSize: 12, color: '#0D9488', fontWeight: 600, marginTop: 4 }}>Criteria: {selectedProtocol.criteria}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {selectedProtocol.orders.map((o, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 800, color: '#0F172A' }}>{o.name}</span>
                      {o.instructions && <div style={{ fontSize: 11, color: '#64748B' }}>{o.instructions}</div>}
                    </div>
                    <span style={{ fontWeight: 800, fontSize: 10, textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, background: o.priority === 'stat' ? '#FEE2E2' : '#EFF6FF', color: o.priority === 'stat' ? '#DC2626' : '#2563EB' }}>
                      {o.priority}
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleApplyProtocol}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #0D9488 0%, #2563EB 100%)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Send size={15} />
                <span>{protocolCommitted ? 'Protocol Orders Placed on Bus!' : 'Apply Protocol to Context Patient'}</span>
              </button>
            </div>

            {/* Renal Dosing Engine */}
            <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <ShieldAlert size={20} color="#F59E0B" />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                    Renal Clearance & GFR Alert
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Audits nephrotoxic drugs when Creatinine is elevated
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Prescribed Drug
                  </label>
                  <input
                    type="text"
                    value={renalDrug}
                    onChange={(e) => setRenalDrug(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Serum Creatinine (mg/dL)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={renalCreat}
                    onChange={(e) => setRenalCreat(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }}
                  />
                </div>
              </div>

              {renalAlert.hasRenalAlert ? (
                <div style={{ padding: 12, borderRadius: 10, background: '#FEF2F2', border: '1.5px solid #FECACA', color: '#DC2626', fontSize: 12, lineHeight: 1.5 }}>
                  <AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  <strong>RENAL CONTRAINDICATION:</strong> {renalAlert.alertMessage}
                </div>
              ) : (
                <div style={{ padding: 12, borderRadius: 10, background: '#ECFDF5', border: '1px solid #BBF7D0', color: '#16A34A', fontSize: 12 }}>
                  <CheckCircle2 size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  Renal parameters within acceptable clearance window.
                </div>
              )}
            </div>
          </div>
        )}

        {/* WORKFLOW 5: ANCILLARY INTEGRATION (LIS / MAR) */}
        {activeWorkflow === 5 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* LIS Delta-Check Monitor */}
            <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Layers size={20} color="#7C3AED" />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                    Laboratory Delta-Check Monitor
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Flags critical analytical spikes comparing previous vs current results
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Analyte</label>
                  <select
                    value={analyte}
                    onChange={(e) => setAnalyte(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 8px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
                  >
                    <option value="Potassium (K+)">Potassium</option>
                    <option value="Haemoglobin (Hb)">Haemoglobin</option>
                    <option value="Serum Creatinine">Creatinine</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Baseline</label>
                  <input
                    type="number"
                    step="0.1"
                    value={prevVal}
                    onChange={(e) => setPrevVal(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Current Result</label>
                  <input
                    type="number"
                    step="0.1"
                    value={currVal}
                    onChange={(e) => setCurrVal(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }}
                  />
                </div>
              </div>

              {deltaAlert ? (
                <div style={{ padding: 14, borderRadius: 12, background: '#FEF2F2', border: '1.5px solid #FECACA', color: '#B91C1C', fontSize: 12, lineHeight: 1.5 }}>
                  <AlertTriangle size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  {deltaAlert.message}
                </div>
              ) : (
                <div style={{ padding: 14, borderRadius: 12, background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D', fontSize: 12 }}>
                  <CheckCircle2 size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  Result delta within expected biological variation limits.
                </div>
              )}
            </div>

            {/* Smart MAR Schedule */}
            <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Clock size={20} color="#2563EB" />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                    Bedside MAR 5-Rights Enforcement
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Medication administration schedule with missed dose detection
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ padding: 12, borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A' }}>IV Ceftriaxone 1g</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>Scheduled: 08:00 • Route: IV Slow Bolus</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, background: '#D1FAE5', color: '#065F46', padding: '3px 8px', borderRadius: 6 }}>
                    ADMINISTERED
                  </span>
                </div>
                <div style={{ padding: 12, borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A' }}>IV Artesunate 120mg</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>Scheduled: 12:00 • Route: IV Infusion</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, background: '#EFF6FF', color: '#1D4ED8', padding: '3px 8px', borderRadius: 6 }}>
                    DUE NOW
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* WORKFLOW 6: CARE COORDINATION & DISCHARGE */}
        {activeWorkflow === 6 && (
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileText size={22} color="#0D9488" />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
                    Automated AI Discharge Summary & Readmission Predictor
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    LACE Index 30-Day Hospital Readmission Risk: <strong>{dischargeSummary?.laceIndex.score} Points ({dischargeSummary?.laceIndex.riskTier} Risk)</strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                style={{
                  padding: '8px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#0D9488',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Export PDF Summary
              </button>
            </div>

            {dischargeSummary && (
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ padding: 14, borderRadius: 12, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B' }}>PRIMARY DISCHARGE DIAGNOSIS</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginTop: 2 }}>{dischargeSummary.primaryDiagnosis}</div>
                  </div>
                  <div style={{ padding: 14, borderRadius: 12, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B' }}>HOSPITAL COURSE SUMMARY</div>
                    <div style={{ fontSize: 13, color: '#334155', marginTop: 4, lineHeight: 1.5 }}>{dischargeSummary.hospitalCourse}</div>
                  </div>
                  <div style={{ padding: 14, borderRadius: 12, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B' }}>RECONCILED DISCHARGE MEDICATIONS</div>
                    <div style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>
                      {dischargeSummary.dischargeMedications.map((m, i) => (
                        <div key={i}>• {m}</div>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ padding: 14, borderRadius: 12, background: '#FEF2F2', border: '1.5px solid #FECACA' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#DC2626' }}>RED-FLAG EMERGENCY RETURN WARNINGS</div>
                    <ul style={{ margin: '6px 0 0 16px', padding: 0, fontSize: 12, color: '#B91C1C', lineHeight: 1.6 }}>
                      {dischargeSummary.emergencyRedFlags.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                  <div style={{ padding: 14, borderRadius: 12, background: '#F0FDFA', border: '1px solid #CCFBF1' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#0F766E' }}>CARE TRANSITION & FOLLOW-UP</div>
                    <div style={{ fontSize: 12, color: '#115E59', marginTop: 4 }}>{dischargeSummary.followUpPlan}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* WORKFLOW 7: REVENUE CYCLE MANAGEMENT (RCM) */}
        {activeWorkflow === 7 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Pre-Submission AI Claim Scrubber */}
            <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <DollarSign size={20} color="#10B981" />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                    Pre-Submission AI Claim Scrubbing Engine
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Audits claims against payer rules before export to clearinghouse
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Billed Primary ICD-10
                  </label>
                  <input
                    type="text"
                    value={claimIcd}
                    onChange={(e) => setClaimIcd(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Pre-Auth Token (if required)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AUTH-9921"
                    value={preAuthToken}
                    onChange={(e) => setPreAuthToken(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }}
                  />
                </div>
              </div>

              {claimResult && (
                <div>
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      background: claimResult.isCleanClaim ? '#ECFDF5' : '#FEF2F2',
                      border: claimResult.isCleanClaim ? '1px solid #A7F3D0' : '1px solid #FECACA',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13, color: claimResult.isCleanClaim ? '#065F46' : '#DC2626' }}>
                        {claimResult.isCleanClaim ? 'CLEAN CLAIM — READY FOR ERA' : 'CLAIM REJECTED BY PRE-AUDIT'}
                      </div>
                      <div style={{ fontSize: 11, color: '#475569' }}>
                        Claim ID: {claimResult.claimId} • Total Billed: ₦{claimResult.totalCharges.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {claimResult.flags.map((f, i) => (
                      <div
                        key={i}
                        style={{
                          padding: 10,
                          borderRadius: 8,
                          background: f.severity === 'error' ? '#FFF1F2' : '#FFFBEB',
                          border: `1px solid ${f.severity === 'error' ? '#FDA4AF' : '#FDE68A'}`,
                          fontSize: 12,
                        }}
                      >
                        <div style={{ fontWeight: 800, color: f.severity === 'error' ? '#BE123C' : '#92400E' }}>
                          [{f.ruleId}] {f.description}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                          Remediation: {f.remediation}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Automated Charge Capture Ledger */}
            <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <CheckCircle2 size={20} color="#0D9488" />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                    Point-of-Care Automated Charge Capture
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Auto-posts billable line items directly as clinical actions occur
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ padding: 12, borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A' }}>Doctor Specialist Consultation</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>Auto-triggered upon check-in completion</div>
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 13, color: '#0D9488' }}>₦2,500.00</span>
                </div>
                <div style={{ padding: 12, borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A' }}>Rapid Malaria RDT + Giemsa Film</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>Auto-captured from CPOE Lab Requisition</div>
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 13, color: '#0D9488' }}>₦4,500.00</span>
                </div>
                <div style={{ padding: 12, borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A' }}>Artemether-Lumefantrine 20/120mg</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>Auto-captured from Pharmacy e-Prescription</div>
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 13, color: '#0D9488' }}>₦3,200.00</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
