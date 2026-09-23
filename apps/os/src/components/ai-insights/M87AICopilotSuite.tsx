'use client';

import React, { useState } from 'react';
import {
  Brain, Send, Sparkles, AlertTriangle, TrendingUp,
  ShieldCheck, Activity, DollarSign, Stethoscope, RefreshCw,
  Clock, CheckCircle2, User, ChevronRight, Zap
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'm87';
  text: string;
  timestamp: string;
  category?: 'clinical' | 'operational' | 'financial';
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    sender: 'm87',
    text: 'Greetings Doctor. I am the M87 Clinical & Hospital Operations Intelligence Core. I am continuously monitoring patient vitals, bed capacity, pharmacy formulary, and hospital revenue. How can I assist you with clinical decision support or hospital telemetry?',
    timestamp: '09:00',
    category: 'clinical',
  },
  {
    id: 'msg-2',
    sender: 'user',
    text: 'Provide risk assessment and antibiotic recommendation for patient in Bed 7 with rising lactate.',
    timestamp: '09:02',
  },
  {
    id: 'msg-3',
    sender: 'm87',
    text: 'Patient Bassey Okon Udoh (ICU Bed 1): Lactate has risen from 1.8 to 2.8 mmol/L in 4 hours, accompanied by HR 124 bpm and WBC 22.4k/�L. This satisfies Sepsis-3 criteria (SOFA score: 11). RECOMMENDATION: Initiate Sepsis Bundle immediately. Administer IV Piperacillin/Tazobactam 4.5g + IV Vancomycin 1g loading dose post blood cultures. Fluid resuscitate with 30 mL/kg balanced crystalloids.',
    timestamp: '09:02',
    category: 'clinical',
  },
];

export const M87AICopilotSuite: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputPrompt, setInputPrompt] = useState('');
  const [activeAITab, setActiveAITab] = useState<'copilot' | 'forecasting' | 'anomalies' | 'orchestrator'>('copilot');
  const [isThinking, setIsThinking] = useState(false);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim()) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: inputPrompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    const query = inputPrompt;
    setInputPrompt('');
    setIsThinking(true);

    setTimeout(() => {
      let reply = 'M87 Analysis: Telemetry verified across hospital EHR and central laboratory databases. No immediate contraindications identified. Parameters remain within regulatory and clinical safety tolerances.';
      let cat: ChatMessage['category'] = 'clinical';

      const lower = query.toLowerCase();
      if (lower.includes('bed') || lower.includes('surge') || lower.includes('capacity')) {
        reply = 'Operational Forecasting: Inpatient bed occupancy is at 92.6% (482/520 beds). Based on current emergency admission velocity (2.8 patients/hr), surgical wards will reach 100% capacity within 4.5 hours unless 6 anticipated discharges in Male Medical are expedited.';
        cat = 'operational';
      } else if (lower.includes('money') || lower.includes('revenue') || lower.includes('hmo') || lower.includes('billing')) {
        reply = 'Financial Intelligence: Hospital collections are tracking at ?842.6M MTD. HMO claim adjudication approval stands at 94.2%. One billing dispute detected on AXA Mansard claim (?256,000) due to missing MRI pre-authorization code.';
        cat = 'financial';
      } else if (lower.includes('drug') || lower.includes('antibiotic') || lower.includes('dosage')) {
        reply = 'Clinical Pharmacovigilance: Verify renal clearance (CrCl) before administering aminoglycosides. No CYP450 drug-drug interactions detected on current medication chart.';
        cat = 'clinical';
      }

      const m87Msg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'm87',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        category: cat,
      };

      setMessages(prev => [...prev, m87Msg]);
      setIsThinking(false);
    }, 900);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top AI Telemetry Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid #8B5CF6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>M87 Neural Engine Status</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#A78BFA' }}>M87-v4.2</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>Active</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Low-Latency Edge Inference (14ms)</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Bed Surge Predictive Forecast</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#60A5FA' }}>+12 Beds</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#F87171' }}>Surge Anticipated Tonight at 21:00</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Clinical Safety Guardrails</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34D399' }}>100% Guarded</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Medical Hallucination Filter Armed</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid var(--ak-orange)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Financial Anomaly Detection</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--ak-orange-light)' }}>Zero Leakage</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#34D399' }}>Double-Entry Verification Passed</span>
        </div>
      </div>

      {/* Navigation Pills */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { key: 'copilot', label: 'Generative AI Clinical Copilot', icon: Brain },
          { key: 'forecasting', label: 'Operational & Surge Forecasting', icon: TrendingUp },
          { key: 'anomalies', label: 'Financial & Billing Anomalies', icon: DollarSign },
          { key: 'orchestrator', label: 'AI Workflow Orchestration', icon: Zap },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeAITab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              className="os-ghost-btn"
              onClick={() => setActiveAITab(tab.key as any)}
              style={{
                background: isActive ? 'rgba(139,92,246,0.2)' : undefined,
                borderColor: isActive ? '#8B5CF6' : undefined,
                color: isActive ? '#FFF' : undefined,
                fontWeight: 700,
              }}
            >
              <Icon size={14} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main View Area */}
      {activeAITab === 'copilot' && (
        <div className="os-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 560 }}>
          {/* Chat Messages */}
          <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {messages.map(m => {
              const isAi = m.sender === 'm87';
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isAi ? 'flex-start' : 'flex-end',
                    maxWidth: '85%',
                    alignSelf: isAi ? 'flex-start' : 'flex-end',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: '0.72rem', color: 'var(--os-text-dim)' }}>
                    {isAi && <Sparkles size={12} style={{ color: '#A78BFA' }} />}
                    <span>{isAi ? 'M87 CLINICAL COPILOT' : 'YOU'}</span>
                    <span>�</span>
                    <span>{m.timestamp}</span>
                  </div>
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: isAi ? 'rgba(139,92,246,0.1)' : 'rgba(234,88,12,0.15)',
                    border: isAi ? '1px solid rgba(139,92,246,0.25)' : '1px solid rgba(234,88,12,0.3)',
                    color: '#0A2540',
                    fontSize: '0.88rem',
                    lineHeight: 1.6,
                  }}>
                    {m.text}
                  </div>
                </div>
              );
            })}
            {isThinking && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#A78BFA', fontSize: '0.8rem' }}>
                <RefreshCw size={14} className="os-spin" />
                <span>M87 is synthesizing clinical evidence and hospital telemetry...</span>
              </div>
            )}
          </div>

          {/* Prompt Input Form */}
          <form onSubmit={handleSend} style={{ display: 'flex', gap: 10, padding: 16, background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--os-border)' }}>
            <input
              type="text"
              className="os-search-input"
              style={{ flex: 1, background: '#FFFFFF', borderRadius: 8, padding: '10px 14px' }}
              placeholder="Ask M87 about differential diagnoses, drug dosages, bed forecasting, or financial reports..."
              value={inputPrompt}
              onChange={e => setInputPrompt(e.target.value)}
            />
            <button
              type="submit"
              className="os-action-btn-primary"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', padding: '0 20px' }}
            >
              <Send size={14} /> Inquire
            </button>
          </form>
        </div>
      )}

      {activeAITab === 'forecasting' && (
        <div className="os-card" style={{ padding: 22 }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: '#0A2540' }}>Operational Capacity & Surge Predictive Models</h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--os-text-muted)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
            Machine learning time-series regression trained on 3 years of Akwa Ibom State emergency admissions, rainfall patterns, malaria seasonal cycles, and market days.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: 14, borderRadius: 8, border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--ak-orange-light)', fontWeight: 700 }}>A&E ADMISSION PEAK FORECAST</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0A2540', marginTop: 4 }}>18:00 � 22:00 Tonight</div>
              <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem', color: 'var(--os-text-dim)' }}>
                Estimated 22 emergency arrivals. Recommend placing 2 on-call medical registrars on standby.
              </p>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: 14, borderRadius: 8, border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.72rem', color: '#60A5FA', fontWeight: 700 }}>ICU VENTILATOR RUNOUT TIME</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0A2540', marginTop: 4 }}>32 Hours</div>
              <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem', color: 'var(--os-text-dim)' }}>
                4 available ventilators. Expected demand: 3 surgical post-op cases tomorrow morning.
              </p>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: 14, borderRadius: 8, border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.72rem', color: '#34D399', fontWeight: 700 }}>DISCHARGE ACCELERATION OPPORTUNITY</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0A2540', marginTop: 4 }}>18 Patients</div>
              <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem', color: 'var(--os-text-dim)' }}>
                Clinically fit for step-down to outpatient follow-up. Can free 18 beds by 12:00.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeAITab === 'anomalies' && (
        <div className="os-card" style={{ padding: 22 }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: '#0A2540' }}>Financial Anomaly & Revenue Leakage Audit</h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--os-text-muted)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
            Continuous real-time comparison between clinical orders executed in Theatre/Pharmacy/Lab and cashier invoices generated.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8 }}>
              <div>
                <strong style={{ color: '#34D399' }}>Pharmacy Dispensation vs Invoice Reconciliation: 100% Match</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--os-text-muted)', marginTop: 2 }}>Zero unbilled pharmaceuticals dispensed in last 24 hours.</div>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#34D399', padding: '3px 10px', borderRadius: 4, background: 'rgba(5,150,105,0.12)' }}>CLEARED</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, background: 'rgba(234,88,12,0.08)', border: '1px solid rgba(234,88,12,0.25)', borderRadius: 8 }}>
              <div>
                <strong style={{ color: 'var(--ak-orange-light)' }}>Discharged Patient Co-Pay Variance Flag</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--os-text-muted)', marginTop: 2 }}>PAT-AK-7721 billed for ORIF implants pending HMO authorization letter.</div>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--ak-orange-light)', padding: '3px 10px', borderRadius: 4, background: 'rgba(234,88,12,0.2)' }}>RESOLVING</span>
            </div>
          </div>
        </div>
      )}

      {activeAITab === 'orchestrator' && (
        <div className="os-card" style={{ padding: 22 }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: '#0A2540' }}>Autonomous Clinical Workflow Orchestrator</h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--os-text-muted)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
            Event-driven agentic pipelines that automatically chain multi-departmental actions upon clinical triggers.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.8rem' }}>
              <strong style={{ color: '#0A2540' }}>Trigger: STAT ECG Flags Acute ST Elevation in A&E</strong>
              <div style={{ color: '#34D399', marginTop: 4 }}>
                ? Automatically reserves Cath Lab Suite � Puts Cardiology Fellow on Call � Reserves 2 Units PRBC in Blood Bank � Alerts CCU Bed 3.
              </div>
            </div>
            <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.8rem' }}>
              <strong style={{ color: '#0A2540' }}>Trigger: Surgical Case Marked Closed in Operating Theatre 1</strong>
              <div style={{ color: '#60A5FA', marginTop: 4 }}>
                ? Dispatches PACU Nurse Notification � Initiates Post-op Antibiotic e-MAR � Sends Discharge Summary Draft to Consultant.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
