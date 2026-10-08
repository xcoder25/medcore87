'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Sparkles, Copy, CheckCircle2 } from 'lucide-react';
import {
  startAmbientListening,
  speechSupported,
  synthesizeSoapNote,
  formatSoap,
  persistAmbientDraft,
  type SoapNote,
} from '../../lib/ambientSoapEngine';
import { hasGeminiKey } from '../../lib/geminiClient';

interface Props {
  facilityId: string;
  patientId?: string;
  patientName?: string;
  hospitalNumber?: string;
  onSoapReady?: (soap: SoapNote, formatted: string) => void;
}

export const AmbientSoapPanel: React.FC<Props> = ({
  facilityId,
  patientId,
  patientName,
  hospitalNumber,
  onSoapReady,
}) => {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [lines, setLines] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [soap, setSoap] = useState<SoapNote | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      stopRef.current?.();
    };
  }, []);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 3500);
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
      flash('Use Chrome or Edge for ambient mic');
      return;
    }
    const handle = startAmbientListening({
      onPartial: setPartial,
      onFinal: (t) => {
        if (t) setLines((prev) => [...prev, t]);
        setPartial('');
      },
      onError: (e) => flash(e),
      onEnd: () => setListening(false),
    });
    if (!handle) return;
    stopRef.current = handle.stop;
    setListening(true);
    flash('Listening… speak the consultation');
  };

  const synthesize = async () => {
    const transcript = [...lines, partial].filter(Boolean).join(' ').trim();
    if (!transcript) {
      flash('No speech captured yet');
      return;
    }
    setBusy(true);
    try {
      const res = await synthesizeSoapNote({
        transcript,
        patientLabel: patientName
          ? `${patientName}${hospitalNumber ? ` (${hospitalNumber})` : ''}`
          : undefined,
      });
      if (!res.ok || !res.soap) {
        flash(res.text || 'Failed');
        return;
      }
      setSoap(res.soap);
      persistAmbientDraft({
        id: `AMB-${Date.now().toString(36)}`,
        facilityId,
        patientId,
        patientName,
        transcript: lines,
        soap: res.soap,
        status: 'ready',
        updatedAt: new Date().toISOString(),
      });
      onSoapReady?.(res.soap, res.text);
      flash('SOAP draft ready — review before saving to chart');
    } finally {
      setBusy(false);
    }
  };

  const formatted = soap ? formatSoap(soap) : '';

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
          <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>Ambient SOAP</div>
          <div style={{ fontSize: 11, color: '#64748B' }}>
            Mic → transcript → {hasGeminiKey() ? 'Gemini' : 'local'} structured note · never auto-signs
          </div>
        </div>
        {msg && (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED' }}>{msg}</span>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          onClick={toggleListen}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            borderRadius: 12,
            border: 'none',
            background: listening ? '#DC2626' : '#0F172A',
            color: '#fff',
            fontWeight: 800,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {listening ? <MicOff size={14} /> : <Mic size={14} />}
          {listening ? 'Stop listening' : 'Start ambient mic'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void synthesize()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(90deg,#7C3AED,#0284C7)',
            color: '#fff',
            fontWeight: 800,
            fontSize: 12,
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          <Sparkles size={14} /> {busy ? 'Structuring…' : 'Make SOAP draft'}
        </button>
        <button
          type="button"
          onClick={() => {
            setLines([]);
            setPartial('');
            setSoap(null);
          }}
          style={{
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid #E2E8F0',
            background: '#fff',
            fontWeight: 700,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
      </div>

      <div
        style={{
          minHeight: 72,
          maxHeight: 140,
          overflow: 'auto',
          padding: 12,
          borderRadius: 12,
          background: '#0F172A',
          color: '#E2E8F0',
          fontSize: 13,
          lineHeight: 1.5,
          marginBottom: 12,
        }}
      >
        {lines.length === 0 && !partial ? (
          <span style={{ color: '#64748B' }}>Transcript will appear here…</span>
        ) : (
          <>
            {lines.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
            {partial && <div style={{ color: '#94A3B8', fontStyle: 'italic' }}>{partial}</div>}
          </>
        )}
      </div>

      {soap && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 12, color: '#0F172A' }}>
              <CheckCircle2 size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
              SOAP draft ({soap.provider})
            </span>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(formatted);
                flash('Copied');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                border: 'none',
                background: 'transparent',
                color: '#7C3AED',
                fontWeight: 700,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              <Copy size={12} /> Copy
            </button>
          </div>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'ui-sans-serif, system-ui',
              fontSize: 13,
              lineHeight: 1.5,
              margin: 0,
              padding: 12,
              borderRadius: 12,
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              color: '#0F172A',
            }}
          >
            {formatted}
          </pre>
        </div>
      )}
    </div>
  );
};

export default AmbientSoapPanel;
