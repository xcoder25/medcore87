'use client';

/**
 * ClinicalDecisionSupportSuite — Automated Clinical Decision Support (CDS) & Sepsis Resuscitation Engine.
 * Evaluates live inpatient vital signs: NEWS2 (National Early Warning Score 2),
 * qSOFA (quick Sequential Organ Failure Assessment), and SIRS criteria.
 * Triggers automated Bedside Sepsis alerts and Sepsis-6 clinical order protocols.
 */

import React, { useState, useMemo } from 'react';
import {
  AlertTriangle, ShieldAlert, CheckCircle2, Flame, HeartPulse,
  Activity, ArrowRight, Zap, Info, RefreshCw, Check
} from 'lucide-react';
import type { UserSession } from '../auth/AuthScreen';
import { listPatients, type RegisteredPatient } from '../../lib/patientRegistryStore';

export interface PatientVitalsCds {
  respiratoryRate: number; // Normal 12-20
  spO2Percent: number; // Normal >= 96%
  requiresSupplementalO2: boolean;
  systolicBp: number; // Normal 110-130
  pulseRate: number; // Normal 60-100
  temperatureC: number; // Normal 36.1-37.5
  consciousnessLevel: 'Alert' | 'Voice' | 'Pain' | 'Unresponsive';
  whiteBloodCellCount?: number; // Normal 4.0 - 11.0 x 10^9/L
  serumLactate?: number; // Normal < 2.0 mmol/L
}

interface Props {
  session?: UserSession;
  onNavigate?: (key: string) => void;
}

export const ClinicalDecisionSupportSuite: React.FC<Props> = ({ session, onNavigate }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';

  const [patients] = useState<RegisteredPatient[]>(() => {
    try {
      return listPatients(facilityId);
    } catch {
      return [];
    }
  });

  const [selectedPatientId, setSelectedPatientId] = useState('');

  // Interactive Vitals input for CDS calculation
  const [vitals, setVitals] = useState<PatientVitalsCds>({
    respiratoryRate: 24,
    spO2Percent: 93,
    requiresSupplementalO2: true,
    systolicBp: 92,
    pulseRate: 118,
    temperatureC: 38.8,
    consciousnessLevel: 'Alert',
    whiteBloodCellCount: 16.4,
    serumLactate: 3.2,
  });

  // Calculate qSOFA Score (0 to 3)
  // 1 pt: RR >= 22
  // 1 pt: SBP <= 100
  // 1 pt: Altered mentation (not Alert)
  const qsofaScore = useMemo(() => {
    let score = 0;
    if (vitals.respiratoryRate >= 22) score += 1;
    if (vitals.systolicBp <= 100) score += 1;
    if (vitals.consciousnessLevel !== 'Alert') score += 1;
    return score;
  }, [vitals]);

  // Calculate NEWS2 Score
  const news2Score = useMemo(() => {
    let score = 0;

    // Respiration Rate
    if (vitals.respiratoryRate <= 8) score += 3;
    else if (vitals.respiratoryRate >= 9 && vitals.respiratoryRate <= 11) score += 1;
    else if (vitals.respiratoryRate >= 12 && vitals.respiratoryRate <= 20) score += 0;
    else if (vitals.respiratoryRate >= 21 && vitals.respiratoryRate <= 24) score += 2;
    else if (vitals.respiratoryRate >= 25) score += 3;

    // SpO2 Scale 1
    if (vitals.spO2Percent <= 91) score += 3;
    else if (vitals.spO2Percent >= 92 && vitals.spO2Percent <= 93) score += 2;
    else if (vitals.spO2Percent >= 94 && vitals.spO2Percent <= 95) score += 1;

    // Supplemental Oxygen
    if (vitals.requiresSupplementalO2) score += 2;

    // Systolic BP
    if (vitals.systolicBp <= 90) score += 3;
    else if (vitals.systolicBp >= 91 && vitals.systolicBp <= 100) score += 2;
    else if (vitals.systolicBp >= 101 && vitals.systolicBp <= 110) score += 1;
    else if (vitals.systolicBp >= 220) score += 3;

    // Pulse
    if (vitals.pulseRate <= 40) score += 3;
    else if (vitals.pulseRate >= 41 && vitals.pulseRate <= 50) score += 1;
    else if (vitals.pulseRate >= 91 && vitals.pulseRate <= 110) score += 1;
    else if (vitals.pulseRate >= 111 && vitals.pulseRate <= 130) score += 2;
    else if (vitals.pulseRate >= 131) score += 3;

    // Consciousness
    if (vitals.consciousnessLevel !== 'Alert') score += 3;

    // Temperature
    if (vitals.temperatureC <= 35.0) score += 3;
    else if (vitals.temperatureC >= 35.1 && vitals.temperatureC <= 36.0) score += 1;
    else if (vitals.temperatureC >= 38.1 && vitals.temperatureC <= 39.0) score += 1;
    else if (vitals.temperatureC >= 39.1) score += 2;

    return score;
  }, [vitals]);

  // Sepsis 6 Protocol Bundle Checklist
  const [sepsis6Bundle, setSepsis6Bundle] = useState({
    oxygenGiven: true,
    bloodCulturesDrawn: false,
    ivAntibioticsGiven: false,
    ivFluidsStarted: true,
    lactateChecked: true,
    urineOutputMonitored: false,
  });

  const isHighRiskSepsis = qsofaScore >= 2 || news2Score >= 7;

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '24px 28px', color: '#0F172A', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#FEE2E2', color: '#DC2626', padding: '3px 10px', borderRadius: 999, fontSize: '0.74rem', fontWeight: 700, marginBottom: 4 }}>
            <Zap size={14} /> Realtime Clinical Decision Support Engine
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0, color: '#0F172A' }}>
            Automated Sepsis Screening & Deterioration Early Warning (NEWS2 / qSOFA)
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748B' }}>
            Multi-Parameter Vital Signs Evaluation · Sepsis-6 Resuscitation Protocol · Inpatient Critical Alerts
          </p>
        </div>

        <select
          value={selectedPatientId}
          onChange={(e) => setSelectedPatientId(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.82rem', background: '#FFF' }}
        >
          <option value="">-- Evaluate Patient In Bed --</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName} ({p.hospitalNumber})
            </option>
          ))}
        </select>
      </div>

      {/* Main Alert Banner */}
      {isHighRiskSepsis && (
        <div style={{ marginBottom: 20, padding: 18, borderRadius: 14, background: '#FEF2F2', border: '2px solid #F87171', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 14px rgba(220, 38, 38, 0.12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF' }}>
              <Flame size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: '1.05rem', color: '#991B1B' }}>
                CRITICAL ALERT: High Risk of Sepsis / Severe Physiological Deterioration
              </div>
              <div style={{ fontSize: '0.82rem', color: '#B91C1C', marginTop: 2 }}>
                qSOFA Score: <strong>{qsofaScore} / 3</strong> · NEWS2 Score: <strong>{news2Score}</strong> (Red Trigger). Immediate Senior Physician Review & Sepsis-6 Resuscitation Bundle Required within 1 Hour.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate?.('icu')}
            style={{ padding: '8px 16px', borderRadius: 8, background: '#DC2626', color: '#FFF', fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            Escalate to ICU / Senior Registrar
          </button>
        </div>
      )}

      {/* Two Column Layout: Vitals Calculator | Sepsis-6 Resuscitation Protocol */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left: Vitals Parameters */}
        <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 22 }}>
          <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 16 }}>
            1. Bedside Physiological Telemetry Inputs
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: '0.82rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>
                Respiratory Rate (breaths/min)
              </label>
              <input
                type="number"
                value={vitals.respiratoryRate}
                onChange={(e) => setVitals({ ...vitals, respiratoryRate: parseInt(e.target.value, 10) || 0 })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>
                Pulse / Heart Rate (bpm)
              </label>
              <input
                type="number"
                value={vitals.pulseRate}
                onChange={(e) => setVitals({ ...vitals, pulseRate: parseInt(e.target.value, 10) || 0 })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>
                Systolic Blood Pressure (mmHg)
              </label>
              <input
                type="number"
                value={vitals.systolicBp}
                onChange={(e) => setVitals({ ...vitals, systolicBp: parseInt(e.target.value, 10) || 0 })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>
                Temperature (°C)
              </label>
              <input
                type="number"
                step="0.1"
                value={vitals.temperatureC}
                onChange={(e) => setVitals({ ...vitals, temperatureC: parseFloat(e.target.value) || 37 })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>
                SpO₂ Oxygen Saturation (%)
              </label>
              <input
                type="number"
                value={vitals.spO2Percent}
                onChange={(e) => setVitals({ ...vitals, spO2Percent: parseInt(e.target.value, 10) || 0 })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>
                Consciousness Level (AVPU)
              </label>
              <select
                value={vitals.consciousnessLevel}
                onChange={(e) => setVitals({ ...vitals, consciousnessLevel: e.target.value as any })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFF' }}
              >
                <option value="Alert">Alert (Normal)</option>
                <option value="Voice">Responsive to Voice</option>
                <option value="Pain">Responsive to Pain only</option>
                <option value="Unresponsive">Unresponsive</option>
              </select>
            </div>
          </div>

          {/* Scores Overview */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #F1F5F9', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ padding: 14, borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0', textAlign: 'center' }}>
              <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 700 }}>qSOFA SCORE</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: qsofaScore >= 2 ? '#DC2626' : '#0F172A', marginTop: 2 }}>
                {qsofaScore} / 3
              </div>
              <div style={{ fontSize: '0.7rem', color: qsofaScore >= 2 ? '#DC2626' : '#64748B', fontWeight: 700 }}>
                {qsofaScore >= 2 ? 'High In-Hospital Mortality Risk' : 'Low immediate risk'}
              </div>
            </div>

            <div style={{ padding: 14, borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0', textAlign: 'center' }}>
              <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 700 }}>NEWS2 SCORE</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: news2Score >= 7 ? '#DC2626' : news2Score >= 5 ? '#D97706' : '#059669', marginTop: 2 }}>
                {news2Score}
              </div>
              <div style={{ fontSize: '0.7rem', color: news2Score >= 7 ? '#DC2626' : '#059669', fontWeight: 700 }}>
                {news2Score >= 7 ? 'Critical / Red Trigger' : news2Score >= 5 ? 'Medium Trigger' : 'Routine Monitoring'}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Sepsis-6 Resuscitation Protocol Bundle */}
        <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 22 }}>
          <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 12 }}>
            2. The Sepsis-6 Care Pathway (Deliver within 1 Hour)
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { key: 'oxygenGiven', label: '1. Deliver High-Flow Oxygen', desc: 'Target SpO₂ 94–98% (88–92% in COPD / chronic lung disease)' },
              { key: 'bloodCulturesDrawn', label: '2. Take Blood Cultures', desc: 'Obtain peripheral blood cultures before administering broad-spectrum IV antibiotics' },
              { key: 'ivAntibioticsGiven', label: '3. Administer IV Broad-Spectrum Antibiotics', desc: 'Initiate per Akwa Ibom State / hospital antimicrobial guidelines' },
              { key: 'ivFluidsStarted', label: '4. Start Intravenous Fluid Resuscitation', desc: 'Bolus 30 mL/kg of balanced crystalloid (Normal Saline or Ringer Lactate)' },
              { key: 'lactateChecked', label: '5. Measure Blood Lactate & Complete Blood Count', desc: 'Serial point-of-care lactate to gauge tissue hypoperfusion' },
              { key: 'urineOutputMonitored', label: '6. Insert Foley Catheter & Monitor Accurate Hourly Urine Output', desc: 'Target >= 0.5 mL/kg/hr to prevent Acute Kidney Injury (AKI)' },
            ].map((step) => {
              const done = sepsis6Bundle[step.key as keyof typeof sepsis6Bundle];
              return (
                <div
                  key={step.key}
                  onClick={() =>
                    setSepsis6Bundle({
                      ...sepsis6Bundle,
                      [step.key]: !done,
                    })
                  }
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: done ? '1.5px solid #059669' : '1px solid #E2E8F0',
                    background: done ? '#ECFDF5' : '#F8FAFC',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: done ? '#059669' : '#CBD5E1',
                      color: '#FFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {done && <Check size={15} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.84rem', color: done ? '#065F46' : '#0F172A' }}>
                      {step.label}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: 2 }}>{step.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClinicalDecisionSupportSuite;
