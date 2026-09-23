import React, { useEffect, useState } from 'react';

const AI_BASE = 'http://localhost:4001/api/ai';

interface DifferentialResult {
  rank: number;
  name: string;
  icd11: string;
  probability: number;
  matchedSymptoms: string[];
  confirmatory: string[];
  epidemiology: string;
  urgency: 'EMERGENCY' | 'URGENT' | 'ROUTINE';
}

interface Props {
  symptoms?: string[];
  vitals?: { temperature?: number; systolicBP?: number; spO2?: number; heartRate?: number; respiratoryRate?: number };
  demographics?: { gender?: string; pregnant?: boolean };
  autoRun?: boolean;
}

const URGENCY_COLOR = { EMERGENCY: '#ff2d55', URGENT: '#ff9500', ROUTINE: '#30d158' };
const URGENCY_ICON  = { EMERGENCY: '🚨', URGENT: '🟠', ROUTINE: '🟢' };

export default function DifferentialDxPanel({ symptoms = [], vitals, demographics, autoRun = false }: Props) {
  const [results, setResults]  = useState<DifferentialResult[]>([]);
  const [loading, setLoading]  = useState(false);
  const [error, setError]      = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [customSymptoms, setCustomSymptoms] = useState('');

  async function run(syms: string[]) {
    if (syms.length === 0) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${AI_BASE}/differential-diagnosis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptoms: syms, vitals, demographics }),
      });
      const data = await res.json();
      if (data.success) setResults(data.differentials || []);
      else setError(data.error || 'Analysis failed');
    } catch { setError('AI Engine offline.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (autoRun && symptoms.length > 0) run(symptoms); }, []);

  const allSymptoms = [...symptoms, ...customSymptoms.split(',').map(s => s.trim()).filter(Boolean)];

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#1a1a2e', borderRadius: 14, border: '1px solid rgba(0,132,255,0.25)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0a84ff22, #5e5ce622)', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>🧠</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>AI Differential Diagnosis</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#0a84ff', fontWeight: 600 }}>Nigeria EPI Context</span>
      </div>

      <div style={{ padding: 12 }}>
        {/* Symptom input */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            value={customSymptoms}
            onChange={e => setCustomSymptoms(e.target.value)}
            placeholder="Add symptoms: fever, cough, headache..."
            onKeyDown={e => e.key === 'Enter' && run(allSymptoms)}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8,
              background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.1)',
              color: '#e5e5ea', fontSize: 12, outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button
            id="dx-analyse-btn"
            onClick={() => run(allSymptoms)}
            disabled={loading}
            style={{
              padding: '8px 14px', borderRadius: 8, border: 'none',
              background: '#0a84ff', color: '#fff', fontSize: 12,
              fontWeight: 700, cursor: 'pointer',
            }}
          >
            {loading ? '...' : 'Analyse'}
          </button>
        </div>

        {/* Symptom chips */}
        {allSymptoms.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {allSymptoms.map((s, i) => (
              <span key={i} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(10,132,255,0.15)', color: '#0a84ff', border: '1px solid rgba(10,132,255,0.25)' }}>
                {s}
              </span>
            ))}
          </div>
        )}

        {error && <div style={{ color: '#ff3a30', fontSize: 12, marginBottom: 8 }}>{error}</div>}

        {/* Results */}
        {results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {results.map((r, i) => (
              <div
                key={r.icd11 + i}
                onClick={() => setExpanded(expanded === i ? null : i)}
                style={{
                  borderRadius: 10, padding: '10px 12px',
                  background: i === 0 ? 'rgba(10,132,255,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${i === 0 ? 'rgba(10,132,255,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>{URGENCY_ICON[r.urgency]}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: i === 0 ? 700 : 500, color: '#fff' }}>
                        #{r.rank} {r.name}
                      </span>
                      <span style={{ fontSize: 10, color: '#636366' }}>{r.icd11}</span>
                    </div>
                    {/* Probability bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${r.probability}%`, background: URGENCY_COLOR[r.urgency], borderRadius: 2, transition: 'width 0.8s ease' }} />
                      </div>
                      <span style={{ fontSize: 10, color: URGENCY_COLOR[r.urgency], fontWeight: 700, minWidth: 32 }}>{r.probability}%</span>
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 6, background: `${URGENCY_COLOR[r.urgency]}22`, color: URGENCY_COLOR[r.urgency] }}>
                        {r.urgency}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded === i && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: '#aeaeb2' }}>
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ color: '#636366' }}>Matched: </span>
                      {r.matchedSymptoms.join(', ')}
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ color: '#636366' }}>Confirmatory: </span>
                      {r.confirmatory.join(' · ')}
                    </div>
                    <div style={{ color: '#636366', fontStyle: 'italic' }}>{r.epidemiology}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && results.length === 0 && symptoms.length === 0 && (
          <div style={{ textAlign: 'center', color: '#636366', padding: '20px 0', fontSize: 12 }}>
            Enter symptoms to get AI differential diagnoses
          </div>
        )}
      </div>
    </div>
  );
}
