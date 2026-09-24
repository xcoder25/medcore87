'use client';
import React, { useState } from 'react';
import { Stethoscope, AlertTriangle, CheckCircle2, FileText, Brain, TrendingUp, Clock, ChevronRight } from 'lucide-react';

const INSIGHTS = [
  {
    id: 'INS-001', urgency: 'high', ward: 'ICU – Bed 7', category: 'Sepsis Risk',
    summary: 'Patient shows early signs of sepsis: fever (38.9°C), WBC 18.2k/μL, lactate 2.8 mmol/L, HR 118 bpm.',
    recommendation: 'Consider initiating Sepsis Bundle — blood cultures × 2, IV broad-spectrum antibiotics within 1 hour, IV fluid resuscitation, and continuous monitoring.',
    indicators: ['Elevated WBC', 'High Lactate', 'Tachycardia', 'Fever'],
  },
  {
    id: 'INS-002', urgency: 'medium', ward: 'A&E – Triage Bay 3', category: 'Cardiac Assessment',
    summary: 'Patient aged 64 presenting with atypical chest pain, diaphoresis. ECG shows ST depression in V4–V6. Troponin pending.',
    recommendation: 'High suspicion for NSTEMI. Administer aspirin 300mg loading dose. Activate cardiology on-call. Avoid delay in troponin I result.',
    indicators: ['ST Depression', 'Diaphoresis', 'Age >60', 'Atypical Pain'],
  },
  {
    id: 'INS-003', urgency: 'medium', ward: 'Male Medical – Bed 14', category: 'Drug Interaction',
    summary: 'Patient on Ciprofloxacin 500mg BD was newly prescribed Theophylline. High risk of drug interaction elevating Theophylline plasma levels.',
    recommendation: 'Reduce Theophylline dose by 30–50% or substitute Ciprofloxacin with Amoxicillin. Monitor for signs of theophylline toxicity (nausea, seizures).',
    indicators: ['Ciprofloxacin', 'Theophylline', 'Potential Toxicity'],
  },
  {
    id: 'INS-004', urgency: 'low', ward: 'Paediatric Ward – Bed 8', category: 'Anaemia in Under-5',
    summary: 'Child (3 years, 13kg) with Hb 7.1 g/dL and confirmed Plasmodium falciparum malaria. Weight-based iron supplementation not yet prescribed.',
    recommendation: 'Initiate IV Artesunate (weight-based: 3 mg/kg × 3 doses). Add Ferrous Sulphate syrup post-acute treatment. Check G6PD status before Primaquine.',
    indicators: ['Hb < 8 g/dL', 'Malaria Positive', 'Under 5 Years'],
  },
  {
    id: 'INS-005', urgency: 'low', ward: 'O&G Ward – Labour Suite', category: 'Pre-Eclampsia Alert',
    summary: 'Primigravida at 38 weeks with BP 148/97 on 2 consecutive readings 4 hours apart. Urine protein 2+ on dipstick.',
    recommendation: 'Diagnose as pre-eclampsia. Commence Magnesium Sulphate for seizure prophylaxis. Antihypertensive if BP ≥ 160/110. Plan delivery by 37 weeks if not already done.',
    indicators: ['BP ≥ 140/90', 'Proteinuria 2+', 'Primigravida', '38 Weeks AOG'],
  },
];

const URGENCY_META: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: 'HIGH PRIORITY', color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
  medium: { label: 'MODERATE', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
  low: { label: 'ADVISORY', color: '#22C55E', bg: 'rgba(34,197,94,0.08)' },
};

export const AICommandInsights: React.FC = () => {
  const [selected, setSelected] = useState<typeof INSIGHTS[0] | null>(INSIGHTS[0]);

  return (
    <div className="os-module-layout">

      <div className="os-insight-banner">
        <Brain size={18} style={{ color: '#0066FF', flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.88rem', marginBottom: 4 }}>Clinical Decision Support · M87</div>
          <div style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: 1.55 }}>
            Computer-assisted suggestions from vitals, labs, and meds. Validate every recommendation before acting — HITL required.
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="os-metrics-ribbon">
        <div className="metric-box alert-red">
          <span className="metric-label"><AlertTriangle size={13} style={{ display: 'inline', marginRight: 4 }} />High Priority Alerts</span>
          <span className="metric-val">{INSIGHTS.filter(i => i.urgency === 'high').length}</span>
          <span className="metric-sub">Require immediate clinical review</span>
        </div>
        <div className="metric-box alert-yellow">
          <span className="metric-label">Moderate Alerts</span>
          <span className="metric-val">{INSIGHTS.filter(i => i.urgency === 'medium').length}</span>
          <span className="metric-sub">Review within the hour</span>
        </div>
        <div className="metric-box alert-green">
          <span className="metric-label">Advisory Notices</span>
          <span className="metric-val">{INSIGHTS.filter(i => i.urgency === 'low').length}</span>
          <span className="metric-sub">Routine review recommended</span>
        </div>
        <div className="metric-box">
          <span className="metric-label"><Clock size={13} style={{ display: 'inline', marginRight: 4 }} />Last Refreshed</span>
          <span className="metric-val" style={{ fontSize: '1.3rem' }}>09:14</span>
          <span className="metric-sub">Synced with ward monitoring systems</span>
        </div>
      </div>

      <div className="os-split-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {INSIGHTS.map(ins => {
            const meta = URGENCY_META[ins.urgency];
            const isSelected = selected?.id === ins.id;
            return (
              <div
                key={ins.id}
                className="os-card"
                onClick={() => setSelected(ins)}
                style={{
                  cursor: 'pointer',
                  padding: '14px 16px',
                  borderColor: isSelected ? meta.color : `${meta.color}35`,
                  background: isSelected ? meta.bg : undefined,
                  boxShadow: isSelected ? `0 0 0 1px ${meta.color}40` : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: meta.color, letterSpacing: '0.04em' }}>{meta.label}</span>
                  <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontFamily: 'var(--os-font-mono)' }}>{ins.id}</span>
                </div>
                <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.88rem', marginBottom: 4 }}>{ins.category}</div>
                <div style={{ fontSize: '0.76rem', color: '#64748B' }}>{ins.ward}</div>
              </div>
            );
          })}
        </div>

        {selected && (
          <div className="os-card" style={{ padding: 24, borderColor: `${URGENCY_META[selected.urgency].color}55` }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <span style={{ background: `${URGENCY_META[selected.urgency].color}18`, color: URGENCY_META[selected.urgency].color, fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: 9999 }}>
                  {URGENCY_META[selected.urgency].label}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontFamily: 'var(--os-font-mono)' }}>{selected.id}</span>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', fontFamily: 'var(--os-font-heading)' }}>{selected.category}</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748B' }}>{selected.ward}</p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.68rem', color: '#64748B', marginBottom: 6, fontWeight: 700, letterSpacing: '0.06em' }}>CLINICAL FINDINGS</div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: 1.65 }}>{selected.summary}</p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {selected.indicators.map(ind => (
                <span key={ind} style={{ background: `${URGENCY_META[selected.urgency].color}12`, color: URGENCY_META[selected.urgency].color, fontSize: '0.74rem', fontWeight: 600, padding: '4px 10px', borderRadius: 9999, border: `1px solid ${URGENCY_META[selected.urgency].color}28` }}>
                  {ind}
                </span>
              ))}
            </div>

            <div style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.22)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: '0.68rem', color: '#16A34A', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.05em' }}>
                <Stethoscope size={14} /> CLINICAL RECOMMENDATION
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#0F172A', lineHeight: 1.65 }}>{selected.recommendation}</p>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button type="button" className="os-action-btn-primary" style={{ flex: 1 }}><CheckCircle2 size={14} /> Mark Reviewed</button>
              <button type="button" className="os-ghost-btn" style={{ flex: 1 }}><FileText size={14} /> Add to Notes</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

