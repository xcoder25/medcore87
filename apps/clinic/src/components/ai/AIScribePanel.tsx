import React, { useState, useRef, useCallback } from 'react';

const AI_BASE = 'http://localhost:4001/api/ai';

interface SOAPNote {
  subjective: { chiefComplaint: string; historyOfPresentingIllness: string; pastMedicalHistory: string; medications: string; allergies: string; socialHistory: string };
  objective: { vitals: string; generalAppearance: string; systemicExamination: string; investigations: string };
  assessment: { primaryDiagnosis: string; differentialDiagnoses: string; problemList: string };
  plan: { investigations: string; medications: string; procedures: string; referrals: string; followUp: string; patientEducation: string };
  confidence: number;
}

interface AIScribePanelProps {
  patientName?: string;
  onSOAPGenerated?: (soap: SOAPNote) => void;
}

export default function AIScribePanel({ patientName, onSOAPGenerated }: AIScribePanelProps) {
  const [rawText, setRawText]       = useState('');
  const [soap, setSoap]             = useState<SOAPNote | null>(null);
  const [loading, setLoading]       = useState(false);
  const [recording, setRecording]   = useState(false);
  const [error, setError]           = useState('');
  const [activeTab, setActiveTab]   = useState<'S'|'O'|'A'|'P'>('S');
  const recognitionRef = useRef<any>(null);

  // Web Speech API voice recording
  const startRecording = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setError('Voice input not supported in this browser. Use Chrome.'); return; }

    const rec = new SpeechRecognition();
    rec.continuous    = true;
    rec.interimResults = true;
    rec.lang           = 'en-NG';

    rec.onresult = (e: any) => {
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setRawText(transcript);
    };

    rec.onerror = () => { setRecording(false); setError('Voice recording error. Please type instead.'); };
    rec.onend   = () => setRecording(false);

    rec.start();
    recognitionRef.current = rec;
    setRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setRecording(false);
  }, []);

  const generateSOAP = async () => {
    if (!rawText.trim()) { setError('Please enter or dictate clinical notes first.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${AI_BASE}/soap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText, patientContext: patientName ? `Patient: ${patientName}` : '' }),
      });
      const data = await res.json();
      if (data.success) {
        setSoap(data.data);
        onSOAPGenerated?.(data.data);
      } else setError(data.error || 'Generation failed');
    } catch {
      setError('AI Engine offline. Ensure ai-engine is running on port 4001.');
    } finally { setLoading(false); }
  };

  const TAB_LABELS = { S: 'Subjective', O: 'Objective', A: 'Assessment', P: 'Plan' };
  const tabColor = '#5e5ce6';

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#1a1a2e', borderRadius: 14, border: '1px solid rgba(94,92,230,0.3)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #5e5ce6, #bf5af2)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>🤖</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>AI Scribe</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Dictate or type → Auto-SOAP{patientName ? ` · ${patientName}` : ''}</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
          ● OFFLINE AI
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Input area */}
        <div style={{ position: 'relative' }}>
          <textarea
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            placeholder={`Dictate or type clinical notes here...\n\nExample: "Patient presents with 3-day history of fever, chills and headache. She is currently on Amlodipine 5mg OD. Vital signs show temp 38.4°C, BP 145/90, HR 98, RR 18, SpO2 97%. Examination: alert, mildly ill-looking..."`}
            style={{
              width: '100%', minHeight: 120, padding: '10px 12px',
              background: '#0d0d1a', border: `1px solid ${recording ? '#ff3a30' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 10, color: '#e5e5ea', fontSize: 13, lineHeight: 1.6,
              resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
          />
          {recording && (
            <div style={{
              position: 'absolute', top: 10, right: 10,
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,58,48,0.15)', padding: '4px 10px', borderRadius: 20,
              border: '1px solid #ff3a30', animation: 'pulse 1s ease-in-out infinite',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff3a30' }} />
              <span style={{ fontSize: 11, color: '#ff3a30', fontWeight: 600 }}>RECORDING</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button
            id="ai-voice-btn"
            onClick={recording ? stopRecording : startRecording}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 10, border: 'none',
              background: recording ? 'rgba(255,58,48,0.15)' : 'rgba(94,92,230,0.15)',
              color: recording ? '#ff3a30' : '#5e5ce6',
              cursor: 'pointer', fontWeight: 600, fontSize: 13,
              border: `1px solid ${recording ? '#ff3a30' : 'rgba(94,92,230,0.4)'}`,
            }}
          >
            {recording ? '⏹ Stop' : '🎙 Dictate'}
          </button>
          <button
            id="ai-soap-btn"
            onClick={generateSOAP}
            disabled={loading || !rawText.trim()}
            style={{
              flex: 2, padding: '9px 0', borderRadius: 10, border: 'none',
              background: loading ? 'rgba(94,92,230,0.3)' : 'linear-gradient(135deg, #5e5ce6, #bf5af2)',
              color: '#fff', cursor: loading ? 'default' : 'pointer',
              fontWeight: 700, fontSize: 13, opacity: !rawText.trim() ? 0.5 : 1,
            }}
          >
            {loading ? '🤖 Generating...' : '✨ Generate SOAP Note'}
          </button>
          {rawText && <button onClick={() => { setRawText(''); setSoap(null); }} style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#636366', cursor: 'pointer', fontSize: 13 }}>Clear</button>}
        </div>

        {error && <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,58,48,0.1)', border: '1px solid rgba(255,58,48,0.3)', color: '#ff3a30', fontSize: 12 }}>{error}</div>}

        {/* SOAP Output */}
        {soap && (
          <div style={{ marginTop: 14 }}>
            {/* Confidence bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: '#636366', whiteSpace: 'nowrap' }}>AI Confidence</span>
              <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${soap.confidence}%`, background: soap.confidence > 70 ? '#30d158' : '#ff9500', borderRadius: 3, transition: 'width 1s ease' }} />
              </div>
              <span style={{ fontSize: 11, color: soap.confidence > 70 ? '#30d158' : '#ff9500', fontWeight: 700 }}>{soap.confidence}%</span>
            </div>

            {/* Tab navigation */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              {(Object.keys(TAB_LABELS) as Array<'S'|'O'|'A'|'P'>).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: activeTab === tab ? tabColor : 'rgba(255,255,255,0.05)',
                    color: activeTab === tab ? '#fff' : '#636366',
                    transition: 'all 0.2s',
                  }}
                >
                  {tab} · {TAB_LABELS[tab].slice(0, 3)}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ background: '#0d0d1a', borderRadius: 10, padding: 14, border: '1px solid rgba(255,255,255,0.06)', fontSize: 12, color: '#aeaeb2', lineHeight: 1.8 }}>
              {activeTab === 'S' && (
                <div>
                  <SOAPField label="Chief Complaint" value={soap.subjective.chiefComplaint} />
                  <SOAPField label="HPI" value={soap.subjective.historyOfPresentingIllness} />
                  <SOAPField label="PMH" value={soap.subjective.pastMedicalHistory} />
                  <SOAPField label="Medications" value={soap.subjective.medications} />
                  <SOAPField label="Allergies" value={soap.subjective.allergies} />
                  <SOAPField label="Social" value={soap.subjective.socialHistory} />
                </div>
              )}
              {activeTab === 'O' && (
                <div>
                  <SOAPField label="Vitals" value={soap.objective.vitals} />
                  <SOAPField label="General" value={soap.objective.generalAppearance} />
                  <SOAPField label="Examination" value={soap.objective.systemicExamination} />
                  <SOAPField label="Investigations" value={soap.objective.investigations} />
                </div>
              )}
              {activeTab === 'A' && (
                <div>
                  <SOAPField label="Primary Dx" value={soap.assessment.primaryDiagnosis} highlight />
                  <SOAPField label="Differentials" value={soap.assessment.differentialDiagnoses} />
                  <SOAPField label="Problem List" value={soap.assessment.problemList} />
                </div>
              )}
              {activeTab === 'P' && (
                <div>
                  <SOAPField label="Investigations" value={soap.plan.investigations} />
                  <SOAPField label="Medications" value={soap.plan.medications} />
                  <SOAPField label="Procedures" value={soap.plan.procedures} />
                  <SOAPField label="Referrals" value={soap.plan.referrals} />
                  <SOAPField label="Follow-Up" value={soap.plan.followUp} />
                  <SOAPField label="Education" value={soap.plan.patientEducation} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }`}</style>
    </div>
  );
}

function SOAPField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: '#636366', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</span>
      <div style={{ marginTop: 2, color: highlight ? '#fff' : '#aeaeb2', fontWeight: highlight ? 600 : 400 }}>{value || '—'}</div>
    </div>
  );
}
