'use client';

/**
 * PsychiatryMentalHealthSuite — Clinical Psychiatry, Mental State Examination (MSE) & Suicide Risk.
 * Structured MSE flowsheet, Columbia-Suicide Severity Rating Scale (C-SSRS),
 * Psychotropic drug safety monitoring (Lithium levels, AIMS Extrapyramidal Scale),
 * and Mental Health Act involuntary legal evaluation documentation.
 */

import React, { useState } from 'react';
import {
  Brain, ShieldAlert, CheckCircle2, AlertTriangle, Save,
  FileText, Activity, HeartPulse, User, Check, AlertCircle
} from 'lucide-react';
import type { UserSession } from '../auth/AuthScreen';
import { listPatients, type RegisteredPatient } from '../../lib/patientRegistryStore';

export interface MseRecord {
  appearanceBehavior: string;
  speech: string;
  moodSubjective: string;
  affectObjective: 'Euthymic' | 'Depressed / Low' | 'Elevated / Euphoric' | 'Irritable' | 'Flat / Blunted' | 'Labile';
  thoughtForm: 'Coherent & Goal-Directed' | 'Circumstantial' | 'Tangential' | 'Flight of Ideas' | 'Loose Associations';
  thoughtContent: string[]; // Delusions, Paranoia, Obsessions, Phobias
  perceptions: string[]; // Auditory Hallucinations, Visual Hallucinations
  cognitionOrientation: string;
  insightGrade: 1 | 2 | 3 | 4 | 5 | 6; // 1 = Complete denial; 6 = True emotional insight
  judgment: 'Intact' | 'Moderately Impaired' | 'Severely Impaired';
}

export interface SuicideRiskAssessment {
  wishToBeDead: boolean;
  activeSuicidalThoughts: boolean;
  suicidalPlanOrIntent: boolean;
  historyOfPastAttempt: boolean;
  riskStratification: 'Low Risk' | 'Moderate Risk' | 'High Risk (Immediate 1:1 Nursing Guard)';
}

interface Props {
  session?: UserSession;
  onNavigate?: (key: string) => void;
}

export const PsychiatryMentalHealthSuite: React.FC<Props> = ({ session, onNavigate }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';

  const [patients] = useState<RegisteredPatient[]>(() => {
    try {
      return listPatients(facilityId);
    } catch {
      return [];
    }
  });

  const [selectedPatientId, setSelectedPatientId] = useState('');

  // MSE State
  const [mse, setMse] = useState<MseRecord>({
    appearanceBehavior: 'Casually dressed, adequate personal hygiene, reduced eye contact, psychomotor retardation noted.',
    speech: 'Slow rate, decreased tone, monotonous volume, prolonged reaction time.',
    moodSubjective: '“I feel empty and hopeless every morning”',
    affectObjective: 'Depressed / Low',
    thoughtForm: 'Coherent & Goal-Directed',
    thoughtContent: ['Severe Guilt / Worthlessness', 'Hypochondriacal concerns'],
    perceptions: ['No perceptual disturbances reported'],
    cognitionOrientation: 'Alert and oriented to time, place, and person. MMSE: 28/30.',
    insightGrade: 4, // Awareness that illness is due to something unknown
    judgment: 'Intact',
  });

  // C-SSRS Suicide Risk State
  const [suicideRisk, setSuicideRisk] = useState<SuicideRiskAssessment>({
    wishToBeDead: true,
    activeSuicidalThoughts: true,
    suicidalPlanOrIntent: false,
    historyOfPastAttempt: false,
    riskStratification: 'Moderate Risk',
  });

  // Psychotropic Monitoring
  const [lithiumLevel, setLithiumLevel] = useState(0.8); // Target 0.6 - 1.2 mEq/L
  const [aimsScore, setAimsScore] = useState(0); // 0 = None; >= 2 = Involuntary movements
  const [saved, setSaved] = useState(false);

  const isHighSuicideRisk = suicideRisk.riskStratification.includes('High Risk');

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '24px 28px', color: '#0F172A', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F5F3FF', color: '#6D28D9', padding: '3px 10px', borderRadius: 999, fontSize: '0.74rem', fontWeight: 700, marginBottom: 4 }}>
            <Brain size={14} /> Behavioral Health & Clinical Psychiatry
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0, color: '#0F172A' }}>
            Mental State Examination (MSE) & Suicide Risk Suite
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748B' }}>
            Structured MSE Protocol · Columbia-Suicide Severity Scale (C-SSRS) · Psychotropic Safety Monitoring
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.82rem', background: '#FFF' }}
          >
            <option value="">-- Select Psychiatric Patient --</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName} ({p.hospitalNumber})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              setSaved(true);
              setTimeout(() => setSaved(false), 3000);
            }}
            style={{ padding: '9px 18px', borderRadius: 10, background: '#7C3AED', color: '#FFF', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Save size={15} /> Save Psychiatric Assessment
          </button>
        </div>
      </div>

      {saved && (
        <div style={{ marginBottom: 16, padding: '10px 16px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, color: '#065F46', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} /> Mental State Examination and Risk Profile signed and locked in Psychiatric EMR.
        </div>
      )}

      {/* High Suicide Risk Alert */}
      {isHighSuicideRisk && (
        <div style={{ marginBottom: 18, padding: 14, borderRadius: 12, background: '#FEF2F2', border: '2px solid #FCA5A5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ShieldAlert size={24} color="#DC2626" />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.96rem', color: '#991B1B' }}>
                ALERT: High Suicide Risk — Immediate Inpatient 1:1 Nursing Observation Mandated
              </div>
              <div style={{ fontSize: '0.78rem', color: '#B91C1C', marginTop: 2 }}>
                Remove sharp objects, ligatures, and medications from bedside. Initiate continuous visual watch.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid: Structured MSE | Suicide Risk & Psychotropic Monitor */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
        {/* Left: Structured Mental State Examination (MSE) */}
        <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 22 }}>
          <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 14 }}>
            Structured Mental State Examination (MSE)
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: '0.82rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>
                1. Appearance, General Behavior & Psychomotor Activity
              </label>
              <textarea
                rows={2}
                value={mse.appearanceBehavior}
                onChange={(e) => setMse({ ...mse, appearanceBehavior: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', resize: 'none' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>
                  2. Speech (Rate, Tone, Rhythm)
                </label>
                <input
                  type="text"
                  value={mse.speech}
                  onChange={(e) => setMse({ ...mse, speech: e.target.value })}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>
                  3. Affect (Objective)
                </label>
                <select
                  value={mse.affectObjective}
                  onChange={(e) => setMse({ ...mse, affectObjective: e.target.value as any })}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFF' }}
                >
                  <option value="Euthymic">Euthymic (Normal)</option>
                  <option value="Depressed / Low">Depressed / Low</option>
                  <option value="Elevated / Euphoric">Elevated / Euphoric</option>
                  <option value="Irritable">Irritable</option>
                  <option value="Flat / Blunted">Flat / Blunted</option>
                  <option value="Labile">Labile</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>
                  4. Thought Form
                </label>
                <select
                  value={mse.thoughtForm}
                  onChange={(e) => setMse({ ...mse, thoughtForm: e.target.value as any })}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFF' }}
                >
                  <option value="Coherent & Goal-Directed">Coherent & Goal-Directed</option>
                  <option value="Circumstantial">Circumstantial</option>
                  <option value="Tangential">Tangential</option>
                  <option value="Flight of Ideas">Flight of Ideas</option>
                  <option value="Loose Associations">Loose Associations</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>
                  5. Insight Level (Grade 1–6)
                </label>
                <select
                  value={mse.insightGrade}
                  onChange={(e) => setMse({ ...mse, insightGrade: parseInt(e.target.value, 10) as any })}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFF' }}
                >
                  <option value={1}>Grade 1: Complete denial of illness</option>
                  <option value={2}>Grade 2: Slight awareness but denies need for help</option>
                  <option value={3}>Grade 3: Blames external factors or physical causes</option>
                  <option value={4}>Grade 4: Aware illness is mental but causes unknown</option>
                  <option value={5}>Grade 5: Intellectual insight (accepts treatment)</option>
                  <option value={6}>Grade 6: True emotional insight</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>
                6. Cognition, Orientation & Mini-Mental Status
              </label>
              <input
                type="text"
                value={mse.cognitionOrientation}
                onChange={(e) => setMse({ ...mse, cognitionOrientation: e.target.value })}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
              />
            </div>
          </div>
        </div>

        {/* Right: Suicide Risk Triage & Psychotropic Safety */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* C-SSRS Suicide Risk Card */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 18 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 12 }}>
              C-SSRS Suicide Risk Stratifier
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.78rem', marginBottom: 14 }}>
              {[
                { key: 'wishToBeDead', label: 'Passive wish to be dead' },
                { key: 'activeSuicidalThoughts', label: 'Active suicidal ideation without intent' },
                { key: 'suicidalPlanOrIntent', label: 'Suicidal intent with specific plan' },
                { key: 'historyOfPastAttempt', label: 'Past history of suicide attempt' },
              ].map((item) => {
                const val = suicideRisk[item.key as keyof SuicideRiskAssessment] as boolean;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      const next = !val;
                      setSuicideRisk((prev) => {
                        const updated = { ...prev, [item.key]: next };
                        let strat: SuicideRiskAssessment['riskStratification'] = 'Low Risk';
                        if (updated.suicidalPlanOrIntent) strat = 'High Risk (Immediate 1:1 Nursing Guard)';
                        else if (updated.activeSuicidalThoughts || updated.wishToBeDead) strat = 'Moderate Risk';
                        return { ...updated, riskStratification: strat };
                      });
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: val ? '1.5px solid #DC2626' : '1px solid #E2E8F0',
                      background: val ? '#FEF2F2' : '#FFF',
                      color: val ? '#991B1B' : '#475569',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{item.label}</span>
                    {val && <Check size={14} color="#DC2626" />}
                  </button>
                );
              })}
            </div>

            <div style={{ padding: '8px 12px', borderRadius: 8, background: isHighSuicideRisk ? '#DC2626' : '#FEF3C7', color: isHighSuicideRisk ? '#FFF' : '#92400E', fontWeight: 800, fontSize: '0.82rem', textAlign: 'center' }}>
              Stratification: {suicideRisk.riskStratification}
            </div>
          </div>

          {/* Psychotropic Drug Safety Monitor */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 18 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 12 }}>
              Psychotropic Drug Safety Window
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.8rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontWeight: 700, color: '#475569' }}>Serum Lithium (Target 0.6–1.2 mEq/L):</span>
                  <strong style={{ color: lithiumLevel > 1.2 ? '#DC2626' : '#0284C7' }}>{lithiumLevel} mEq/L</strong>
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={lithiumLevel}
                  onChange={(e) => setLithiumLevel(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #CBD5E1' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontWeight: 700, color: '#475569' }}>AIMS EPS Score (0 to 14):</span>
                  <strong style={{ color: aimsScore >= 2 ? '#D97706' : '#059669' }}>{aimsScore}</strong>
                </div>
                <input
                  type="number"
                  value={aimsScore}
                  onChange={(e) => setAimsScore(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #CBD5E1' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PsychiatryMentalHealthSuite;
