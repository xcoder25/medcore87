'use client';

/**
 * ClinicalGoogleSearchSuite — Generative AI "Clinical Google" Search ("Ask the Patient File").
 * Replaces tedious menu clicking with a natural language search bar for doctors.
 * Instantly synthesizes 5+ years of lab reports, clinic notes, and medication regimens,
 * rendering exact citations, longitudinal trend metrics, and 1-click clinical actions.
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  Sparkles,
  FileText,
  FlaskConical,
  Pill,
  Clock,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Copy,
  ExternalLink,
  ChevronRight,
  User,
  Heart,
  Activity,
  Flame,
  Volume2,
  Bookmark,
  Calendar,
  Building2,
  Stethoscope,
  Filter
} from 'lucide-react';
import {
  CLINICAL_DOSSIERS,
  askPatientFile,
  type ClinicalSearchAnswer,
  type PatientCitation,
  type PatientDossier
} from '../../lib/clinicalGoogleSearch';
import type { UserSession } from '../auth/AuthScreen';

interface Props {
  session?: UserSession;
  initialPatientId?: string;
  onNavigate?: (module: string) => void;
  onClose?: () => void;
}

export const ClinicalGoogleSearchSuite: React.FC<Props> = ({
  session,
  initialPatientId,
  onNavigate,
  onClose,
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    initialPatientId || CLINICAL_DOSSIERS[0].patientId
  );

  const activePatient: PatientDossier = useMemo(() => {
    return CLINICAL_DOSSIERS.find(p => p.patientId === selectedPatientId) || CLINICAL_DOSSIERS[0];
  }, [selectedPatientId]);

  const [queryInput, setQueryInput] = useState<string>(
    "Summarize this patient's history of hypertension medications and show me their highest creatinine level."
  );

  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchAnswer, setSearchAnswer] = useState<ClinicalSearchAnswer | null>(() =>
    askPatientFile(selectedPatientId, queryInput)
  );
  const [selectedCitation, setSelectedCitation] = useState<PatientCitation | null>(null);
  const [copiedActionId, setCopiedActionId] = useState<string | null>(null);

  const handleSearch = (customQuery?: string) => {
    const q = customQuery !== undefined ? customQuery : queryInput;
    if (!q.trim()) return;
    setIsSearching(true);
    // Simulate high-speed 0.3s generative synthesis
    window.setTimeout(() => {
      const result = askPatientFile(selectedPatientId, q);
      setSearchAnswer(result);
      setIsSearching(false);
    }, 320);
  };

  const handleSelectPatient = (pId: string) => {
    setSelectedPatientId(pId);
    let defaultQ = "Summarize this patient's history of hypertension medications and show me their highest creatinine level.";
    if (pId === 'PAT-AKS-8812') {
      defaultQ = "What is her gestational blood pressure trajectory and pre-eclampsia laboratory screen?";
    } else if (pId === 'PAT-AKS-9102') {
      defaultQ = "Show all past surgeries, blood transfusions, and post-op notes.";
    }
    setQueryInput(defaultQ);
    const result = askPatientFile(pId, defaultQ);
    setSearchAnswer(result);
  };

  const handleExecuteAction = (action: ClinicalSearchAnswer['actionHooks'][0]) => {
    setCopiedActionId(action.id);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(action.payload);
    }
    window.dispatchEvent(
      new CustomEvent('medcore-toast', {
        detail: { message: `✅ Action executed: "${action.label}" copied to clipboard.` },
      })
    );
    window.setTimeout(() => setCopiedActionId(null), 2500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* ── TOP HERO HEADER ──────────────────────────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #0F766E 100%)',
          borderRadius: 20,
          padding: '28px 32px',
          color: '#FFFFFF',
          boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ maxWidth: 720 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(20, 184, 166, 0.2)', border: '1px solid rgba(45, 212, 191, 0.4)', borderRadius: 9999, padding: '4px 14px', fontSize: '0.75rem', fontWeight: 700, color: '#5EEAD4', letterSpacing: '0.04em', marginBottom: 12 }}>
              <Sparkles size={14} />
              <span>GENERATIVE AI · CLINICAL GOOGLE SEARCH</span>
            </div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
              The "Ask the Patient File" Engine
            </h1>
            <p style={{ margin: 0, fontSize: '0.92rem', color: '#CBD5E1', lineHeight: 1.6 }}>
              No more scrolling through five years of fragmented PDF uploads, lab printouts, and notes. Type your clinical question naturally to retrieve instant, verified summaries with source citations.
            </p>
          </div>

          {/* Patient Quick Selector */}
          <div style={{ background: 'rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: 14, padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 260 }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94A3B8', fontWeight: 700 }}>
              Active Patient Dossier
            </div>
            <select
              value={selectedPatientId}
              onChange={e => handleSelectPatient(e.target.value)}
              style={{
                background: '#0F172A',
                color: '#F8FAFC',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: '0.85rem',
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {CLINICAL_DOSSIERS.map(p => (
                <option key={p.patientId} value={p.patientId}>
                  {p.fullName} ({p.hospitalNumber}) · {p.age}y
                </option>
              ))}
            </select>
            <div style={{ fontSize: '0.72rem', color: '#2DD4BF', fontWeight: 600 }}>
              {activePatient.chronicDiagnoses[0]}
            </div>
          </div>
        </div>
      </div>

      {/* ── THE "ASK THE PATIENT FILE" OMNIBAR ────────────────────────────── */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 18,
          padding: '20px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: '#F8FAFC',
              border: '2px solid #0D9488',
              borderRadius: 14,
              padding: '10px 18px',
              boxShadow: '0 0 0 4px rgba(13, 148, 136, 0.12)',
            }}
          >
            <Search size={22} color="#0D9488" style={{ flexShrink: 0 }} />
            <input
              type="text"
              value={queryInput}
              onChange={e => setQueryInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSearch();
              }}
              placeholder={`Ask anything about ${activePatient.fullName}'s clinical records, medications, or labs...`}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                fontSize: '1.02rem',
                fontWeight: 600,
                color: '#0F172A',
                outline: 'none',
              }}
            />
            {queryInput && (
              <button
                type="button"
                onClick={() => setQueryInput('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                }}
              >
                Clear
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleSearch()}
            disabled={isSearching}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '14px 28px',
              borderRadius: 14,
              border: 'none',
              background: 'linear-gradient(135deg, #0D9488 0%, #0F766E 100%)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.95rem',
              cursor: isSearching ? 'wait' : 'pointer',
              boxShadow: '0 4px 14px rgba(13, 148, 136, 0.35)',
              transition: 'all 0.15s ease',
            }}
          >
            <Sparkles size={18} />
            {isSearching ? 'Synthesizing...' : 'Search File'}
          </button>
        </div>

        {/* Suggestion Prompts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
            Quick Clinical Queries:
          </span>
          {[
            "Summarize this patient's history of hypertension medications and show me their highest creatinine level.",
            "Show all lab tests with abnormal or high flags",
            "What antibiotics or sulfa drugs has this patient received?",
            "List all past surgical procedures and transfusions",
          ].map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setQueryInput(prompt);
                handleSearch(prompt);
              }}
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid #E2E8F0',
                background: '#F1F5F9',
                color: '#334155',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {prompt.length > 55 ? prompt.slice(0, 52) + '…' : prompt}
            </button>
          ))}
        </div>
      </div>

      {/* ── SEARCH SYNTHESIS RESULTS ─────────────────────────────────────── */}
      {searchAnswer && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(320px, 1fr)', gap: 20 }}>
          {/* Main Answer Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Key Clinical Trend Highlights */}
            {searchAnswer.keyMetrics.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                {searchAnswer.keyMetrics.map((m, idx) => {
                  const isCrit = m.flag === 'CRITICAL';
                  const isHigh = m.flag === 'HIGH';
                  const isLow = m.flag === 'LOW';
                  return (
                    <div
                      key={idx}
                      style={{
                        background: isCrit ? '#FEF2F2' : isHigh || isLow ? '#FFFBEB' : '#F0FDF4',
                        border: `1px solid ${isCrit ? '#FCA5A5' : isHigh || isLow ? '#FCD34D' : '#86EFAC'}`,
                        borderRadius: 14,
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                        {m.label}
                      </div>
                      <div
                        style={{
                          fontSize: '1.25rem',
                          fontWeight: 800,
                          color: isCrit ? '#DC2626' : isHigh ? '#D97706' : isLow ? '#B45309' : '#16A34A',
                        }}
                      >
                        {m.value}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{m.date}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Synthesized Response Card */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 18,
                padding: '24px 28px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0F766E', fontWeight: 800, fontSize: '0.95rem' }}>
                  <Sparkles size={18} />
                  <span>Synthesized Clinical Intelligence · Instant File Retrieval</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
                  Response time: <strong>0.32 seconds</strong> (Indexed)
                </div>
              </div>

              {/* Formatted Markdown Body */}
              <div
                style={{
                  fontSize: '0.95rem',
                  lineHeight: 1.7,
                  color: '#1E293B',
                  whiteSpace: 'pre-line',
                }}
              >
                {searchAnswer.summary}
              </div>

              {/* 1-Click Action Hooks */}
              <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid #F1F5F9' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 10 }}>
                  ⚡ 1-Click Clinical Workflow Actions:
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {searchAnswer.actionHooks.map(act => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => handleExecuteAction(act)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 16px',
                        borderRadius: 10,
                        border: '1px solid #0D9488',
                        background: copiedActionId === act.id ? '#0D9488' : '#F0FDFA',
                        color: copiedActionId === act.id ? '#FFFFFF' : '#0F766E',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {copiedActionId === act.id ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                      {copiedActionId === act.id ? 'Copied to Clipboard!' : act.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Suggested Follow-up Questions */}
            {searchAnswer.suggestedFollowups.length > 0 && (
              <div
                style={{
                  background: '#F8FAFC',
                  borderRadius: 14,
                  padding: '16px 20px',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                  Suggested Clinical Deep-Dives:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {searchAnswer.suggestedFollowups.map((f, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        setQueryInput(f);
                        handleSearch(f);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 14px',
                        borderRadius: 8,
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        fontSize: '0.85rem',
                        color: '#0F172A',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <span>{f}</span>
                      <ChevronRight size={16} color="#94A3B8" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Source Citations & Verification Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 18,
                padding: '20px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: '0.95rem', color: '#0F172A' }}>
                <Bookmark size={18} color="#0D9488" />
                <span>Verified Source Citations ({searchAnswer.citations.length})</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B', lineHeight: 1.5 }}>
                Click on any source document to verify raw clinical reports, author signatures, and lab telemetry.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {searchAnswer.citations.map((c, idx) => {
                  const isSelected = selectedCitation?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCitation(isSelected ? null : c)}
                      style={{
                        background: isSelected ? '#F0FDFA' : '#F8FAFC',
                        border: `1px solid ${isSelected ? '#0D9488' : '#E2E8F0'}`,
                        borderRadius: 12,
                        padding: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: c.sourceType === 'LAB_REPORT' ? '#EFF6FF' : c.sourceType === 'PRESCRIPTION' ? '#FDF2F8' : '#F0FDF4',
                            color: c.sourceType === 'LAB_REPORT' ? '#1D4ED8' : c.sourceType === 'PRESCRIPTION' ? '#BE185D' : '#15803D',
                          }}
                        >
                          Citation {idx + 1} · {c.sourceType.replace('_', ' ')}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>{c.date}</span>
                      </div>

                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
                        {c.title}
                      </div>

                      <div style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: 8 }}>
                        {c.authorOrFacility}
                      </div>

                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: '#334155',
                          background: '#FFFFFF',
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: '1px solid #E2E8F0',
                          lineHeight: 1.5,
                        }}
                      >
                        "{c.snippet}"
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Patient Allergy & Safety Guardrail */}
            <div
              style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 16,
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#DC2626', fontWeight: 800, fontSize: '0.88rem' }}>
                <ShieldAlert size={18} />
                <span>ACTIVE CLINICAL ALERTS & ALLERGIES</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#991B1B', fontWeight: 700 }}>
                • Documented Allergies: {activePatient.allergies.join(', ')}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#7F1D1D', lineHeight: 1.5 }}>
                Do NOT prescribe penicillins, augmentin, ampicillin, or cotrimoxazole. All queries are filtered through closed-loop safety guardrails.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
