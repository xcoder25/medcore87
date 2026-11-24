'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Copy,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  ClipboardPlus,
  Loader2,
  AudioLines,
} from 'lucide-react';
import {
  startAmbientListening,
  speechSupported,
  synthesizeSoapNote,
  formatSoap,
  persistAmbientDraft,
  type SoapNote,
  type ScribeSuggestedOrder,
} from '../../lib/ambientSoapEngine';
import { hasGeminiKey } from '../../lib/geminiClient';
import { useAccurateVoiceInput } from '../../lib/voiceTranscription';
import { getPatient } from '../../lib/patientRegistryStore';
import { placeOrder, listOrders } from '../../lib/clinicalEventBus';
import { appendAudit } from '../../lib/auditLogStore';

interface Props {
  facilityId: string;
  patientId?: string;
  patientName?: string;
  hospitalNumber?: string;
  patientVitals?: Record<string, string | number>;
  doctorName?: string;
  doctorBadge?: string;
  onSoapReady?: (soap: SoapNote, formatted: string) => void;
}

export const AmbientSoapPanel: React.FC<Props> = ({
  facilityId,
  patientId,
  patientName,
  hospitalNumber,
  patientVitals,
  doctorName,
  doctorBadge,
  onSoapReady,
}) => {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [busy, setBusy] = useState(false);
  const [soap, setSoap] = useState<SoapNote | null>(null);
  const [selectedOrderKeys, setSelectedOrderKeys] = useState<Record<string, boolean>>({});
  const [placedOrderKeys, setPlacedOrderKeys] = useState<Record<string, boolean>>({});
  const [summaryLang, setSummaryLang] = useState<'english' | 'pidgin' | 'ibibio'>('english');
  const [msg, setMsg] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  const voiceClip = useAccurateVoiceInput({
    roleHint: 'doctor consultation',
    onTranscript: (text) => {
      if (text.trim()) {
        setTranscriptText((prev) => [prev.trim(), text.trim()].filter(Boolean).join(' '));
        flash('Audio clip transcribed into SOAP console');
      }
    },
  });

  useEffect(() => {
    return () => {
      stopRef.current?.();
    };
  }, []);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 4000);
  };

  const toggleListen = () => {
    if (listening) {
      stopRef.current?.();
      stopRef.current = null;
      setListening(false);
      setPartial('');
      return;
    }
    if (!speechSupported()) {
      flash('Use Record Audio Clip for cross-browser transcription');
      return;
    }
    const handle = startAmbientListening({
      onPartial: setPartial,
      onFinal: (t) => {
        if (t) setTranscriptText((prev) => [prev.trim(), t.trim()].filter(Boolean).join(' '));
        setPartial('');
      },
      onError: (e) => flash(e),
      onEnd: () => setListening(false),
    });
    if (!handle) return;
    stopRef.current = handle.stop;
    setListening(true);
    flash('Live dictation active… speak naturally');
  };

  const formatVitalsSummary = () => {
    if (!patientVitals) return '';
    return Object.entries(patientVitals)
      .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
      .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
      .join(' · ');
  };

  const synthesize = async () => {
    const transcript = [transcriptText, partial].filter(Boolean).join(' ').trim();
    if (!transcript) {
      flash('Speak or enter consultation notes first');
      return;
    }
    setBusy(true);
    try {
      const pt = patientId ? getPatient(patientId) : undefined;
      const openOrders = patientId
        ? listOrders(facilityId, { patientId }).filter((o) => o.type === 'rx' && o.status !== 'cancelled').map((o) => o.name)
        : [];

      const res = await synthesizeSoapNote({
        transcript,
        facilityId,
        patientId: pt?.id || patientId,
        patientLabel: patientName
          ? `${patientName}${hospitalNumber ? ` (${hospitalNumber})` : ''}`
          : undefined,
        vitalsSummary: formatVitalsSummary() || undefined,
        patientContext: pt
          ? {
              allergies: pt.allergies,
              otherDrugs: Array.from(new Set([...(pt.currentMedications || []), ...openOrders])),
              dob: pt.dob,
              sex: pt.sex,
              chronicConditions: pt.chronicConditions,
              genotype: pt.genotype,
            }
          : undefined,
      });

      if (!res.ok || !res.soap) {
        flash(res.text || 'Failed to draft SOAP note');
        return;
      }

      setSoap(res.soap);
      const initialSelection: Record<string, boolean> = {};
      for (const o of res.soap.suggestedOrders || []) {
        const key = `${o.type}:${o.name}`;
        initialSelection[key] = (o.safetyReport?.hardStopCount || 0) === 0;
      }
      setSelectedOrderKeys(initialSelection);
      setPlacedOrderKeys({});

      persistAmbientDraft({
        id: `AMB-${Date.now().toString(36)}`,
        facilityId,
        patientId,
        patientName,
        transcript: transcript ? [transcript] : [],
        soap: res.soap,
        status: 'ready',
        updatedAt: new Date().toISOString(),
      });
      onSoapReady?.(res.soap, res.text);
      flash('Structured SOAP + ICD-11 + Order Safety draft ready');
    } finally {
      setBusy(false);
    }
  };

  const placeSelectedOrders = () => {
    if (!soap?.suggestedOrders?.length) return;
    const pid = patientId || hospitalNumber;
    if (!pid) {
      flash('Select an active patient in the consultation desk before placing orders');
      return;
    }

    const toPlace = soap.suggestedOrders.filter((o) => selectedOrderKeys[`${o.type}:${o.name}`]);
    if (toPlace.length === 0) {
      flash('Select at least one safe suggested order');
      return;
    }

    const blocked = toPlace.filter((o) => (o.safetyReport?.hardStopCount || 0) > 0);
    if (blocked.length > 0) {
      flash(`Blocked ${blocked.map((b) => b.name).join(', ')} due to Clinical Safety HARD STOP — review in Clinical Orders.`);
      return;
    }

    let placedCount = 0;
    const nextPlaced = { ...placedOrderKeys };
    for (const o of toPlace) {
      const key = `${o.type}:${o.name}`;
      if (nextPlaced[key]) continue;
      const created = placeOrder({
        facilityId,
        patientId: pid,
        patientName: patientName || 'Active Patient',
        hospitalNumber: hospitalNumber || pid,
        type: o.type,
        code: o.code,
        name: o.name,
        orderedBy: doctorName || 'Clinician',
        orderedByBadge: doctorBadge,
        priority: o.priority,
        notes: o.dosageNotes || 'Approved from Ambient Clinical Scribe draft',
      });
      appendAudit({
        facilityId,
        actor: doctorName || 'Clinician',
        actorBadge: doctorBadge,
        action: 'ambient_scribe_order_placed',
        entity: 'order',
        entityId: created.id,
        detail: `${o.type.toUpperCase()} ${o.name} (${o.priority}) approved from Ambient SOAP`,
      });
      nextPlaced[key] = true;
      placedCount += 1;
    }
    setPlacedOrderKeys(nextPlaced);
    flash(placedCount > 0 ? `Placed ${placedCount} approved order(s) onto clinical bus` : 'Selected orders already placed');
  };

  const formatted = soap ? formatSoap(soap) : '';

  const renderSafetyBadge = (order: ScribeSuggestedOrder) => {
    if (order.type !== 'rx' || !order.safetyReport) return null;
    if (order.safetyReport.hardStopCount > 0) {
      return (
        <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <ShieldAlert size={11} /> HARD STOP
        </span>
      );
    }
    if (order.safetyReport.warningCount > 0) {
      return (
        <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <AlertTriangle size={11} /> CAUTION
        </span>
      );
    }
    return (
      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0' }}>
        SAFE CHECKED
      </span>
    );
  };

  return (
    <div
      style={{
        borderRadius: 16,
        border: '1px solid #E9D5FF',
        background: 'linear-gradient(180deg,#FAF5FF,#FFFFFF)',
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'linear-gradient(135deg,#7C3AED,#0284C7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Sparkles size={16} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>Ambient Clinical Scribe</div>
          <div style={{ fontSize: 11, color: '#64748B' }}>
            Voice / transcript → {hasGeminiKey() ? 'Clinical AI' : 'local'} SOAP + ICD-11 + Rx Safety · clinician sign-off required
          </div>
        </div>
      </div>

      {msg && (
        <div style={{ marginBottom: 10, padding: '7px 10px', borderRadius: 8, background: '#F3E8FF', border: '1px solid #DDD6FE', fontSize: 11, fontWeight: 700, color: '#6D28D9' }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
        <button
          type="button"
          onClick={toggleListen}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 10,
            border: 'none',
            background: listening ? '#DC2626' : '#0F172A',
            color: '#fff',
            fontWeight: 800,
            fontSize: 11.5,
            cursor: 'pointer',
          }}
        >
          {listening ? <MicOff size={13} /> : <Mic size={13} />}
          {listening ? 'Stop Live Mic' : 'Live Dictation'}
        </button>

        {voiceClip.supported && (
          <button
            type="button"
            disabled={voiceClip.transcribing}
            onClick={voiceClip.toggleListening}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 10,
              border: voiceClip.listening ? '1px solid #DC2626' : '1px solid #CBD5E1',
              background: voiceClip.listening ? '#FEF2F2' : '#FFFFFF',
              color: voiceClip.listening ? '#B91C1C' : '#0F172A',
              fontWeight: 800,
              fontSize: 11.5,
              cursor: voiceClip.transcribing ? 'wait' : 'pointer',
            }}
          >
            {voiceClip.transcribing ? <Loader2 size={13} /> : <AudioLines size={13} />}
            {voiceClip.transcribing ? 'Transcribing…' : voiceClip.listening ? 'Finish Audio Clip' : 'Record Audio Clip'}
          </button>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => void synthesize()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(90deg,#7C3AED,#0284C7)',
            color: '#fff',
            fontWeight: 800,
            fontSize: 11.5,
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          <Sparkles size={13} /> {busy ? 'Synthesizing…' : 'Generate SOAP + Orders'}
        </button>

        <button
          type="button"
          onClick={() => {
            setTranscriptText('');
            setPartial('');
            setSoap(null);
            setSelectedOrderKeys({});
            setPlacedOrderKeys({});
          }}
          style={{
            padding: '8px 11px',
            borderRadius: 10,
            border: '1px solid #E2E8F0',
            background: '#fff',
            fontWeight: 700,
            fontSize: 11.5,
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
      </div>

      <textarea
        rows={4}
        value={[transcriptText, partial].filter(Boolean).join(' ')}
        onChange={(e) => {
          setTranscriptText(e.target.value);
          setPartial('');
        }}
        placeholder="Speak using Live Dictation / Audio Clip, or type/paste consultation notes (English, Pidgin, or Nigerian clinical terms)…"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: 11,
          borderRadius: 12,
          border: '1px solid #334155',
          background: '#0F172A',
          color: '#E2E8F0',
          fontSize: 12.5,
          lineHeight: 1.5,
          marginBottom: 12,
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />

      {soap && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {soap.redFlags && soap.redFlags.length > 0 && (
            <div style={{ padding: '9px 11px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 11.5, fontWeight: 700 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                <AlertTriangle size={13} /> Clinical Red Flags Detected
              </div>
              {soap.redFlags.map((rf, i) => (
                <div key={i} style={{ fontWeight: 500 }}>• {rf}</div>
              ))}
            </div>
          )}

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 800, fontSize: 12, color: '#0F172A' }}>
                <CheckCircle2 size={14} style={{ verticalAlign: -2, marginRight: 4, color: '#059669' }} />
                SOAP Draft ({soap.provider === 'clinical-ai' ? 'Clinical AI' : 'Local Safety Draft'})
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    onSoapReady?.(soap, formatted);
                    flash('SOAP applied to chart');
                  }}
                  style={{ border: 'none', background: 'transparent', color: '#0284C7', fontWeight: 800, fontSize: 11, cursor: 'pointer' }}
                >
                  Apply to Chart
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(formatted);
                    flash('SOAP copied');
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', color: '#7C3AED', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                >
                  <Copy size={12} /> Copy
                </button>
              </div>
            </div>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'ui-sans-serif, system-ui',
                fontSize: 12,
                lineHeight: 1.5,
                margin: 0,
                padding: 11,
                borderRadius: 10,
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                color: '#0F172A',
                maxHeight: 170,
                overflowY: 'auto',
              }}
            >
              {formatted}
            </pre>
          </div>

          {soap.icd11Suggestions && soap.icd11Suggestions.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 5, textTransform: 'uppercase' }}>
                ICD-11 Candidate Codes
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {soap.icd11Suggestions.map((icd) => (
                  <span
                    key={`${icd.code}-${icd.label}`}
                    style={{
                      fontSize: 11,
                      padding: '3px 8px',
                      borderRadius: 999,
                      background: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      color: '#1E40AF',
                      fontWeight: 700,
                    }}
                  >
                    {icd.code} · {icd.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {soap.suggestedOrders && soap.suggestedOrders.length > 0 && (
            <div style={{ padding: 10, borderRadius: 10, background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#0F172A', marginBottom: 6, textTransform: 'uppercase' }}>
                Suggested Orders (Safety Pre-Checked)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                {soap.suggestedOrders.map((o) => {
                  const key = `${o.type}:${o.name}`;
                  const checked = Boolean(selectedOrderKeys[key]);
                  const placed = Boolean(placedOrderKeys[key]);
                  const hardStop = (o.safetyReport?.hardStopCount || 0) > 0;
                  return (
                    <label
                      key={key}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                        padding: '7px 8px',
                        borderRadius: 8,
                        border: `1px solid ${hardStop ? '#FECACA' : placed ? '#A7F3D0' : '#E2E8F0'}`,
                        background: hardStop ? '#FEF2F2' : placed ? '#ECFDF5' : '#F8FAFC',
                        cursor: placed ? 'default' : 'pointer',
                        fontSize: 11.5,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#0F172A' }}>
                          <input
                            type="checkbox"
                            disabled={placed}
                            checked={checked || placed}
                            onChange={(e) => setSelectedOrderKeys((prev) => ({ ...prev, [key]: e.target.checked }))}
                          />
                          <span>[{o.type.toUpperCase()}] {o.name}</span>
                        </span>
                        {renderSafetyBadge(o)}
                      </div>
                      {o.dosageNotes && <div style={{ fontSize: 10.5, color: '#64748B', paddingLeft: 20 }}>{o.dosageNotes}</div>}
                      {o.safetyReport && o.safetyReport.alerts.filter((a) => a.level !== 'info').length > 0 && (
                        <div style={{ fontSize: 10.5, color: hardStop ? '#B91C1C' : '#B45309', paddingLeft: 20, fontWeight: 600 }}>
                          {o.safetyReport.alerts.filter((a) => a.level !== 'info')[0].title}:{' '}
                          {o.safetyReport.alerts.filter((a) => a.level !== 'info')[0].detail}
                        </div>
                      )}
                    </label>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={placeSelectedOrders}
                style={{
                  width: '100%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  borderRadius: 9,
                  border: 'none',
                  background: '#059669',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                <ClipboardPlus size={14} /> Approve & Place Selected Orders
              </button>
            </div>
          )}

          {soap.patientSummary && (soap.patientSummary.english || soap.patientSummary.pidgin || soap.patientSummary.ibibio) && (
            <div style={{ padding: 10, borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                  Patient Discharge Guide
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['english', 'pidgin', 'ibibio'] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setSummaryLang(lang)}
                      style={{
                        padding: '2px 7px',
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        background: summaryLang === lang ? '#0284C7' : '#fff',
                        color: summaryLang === lang ? '#fff' : '#475569',
                        fontSize: 10,
                        fontWeight: 800,
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: '#1E293B', lineHeight: 1.5 }}>
                {soap.patientSummary[summaryLang] || soap.patientSummary.english}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AmbientSoapPanel;
