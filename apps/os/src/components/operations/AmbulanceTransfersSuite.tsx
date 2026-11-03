'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity, ShieldAlert, CheckCircle2, Clock, MapPin,
  Heart, ArrowRight, Radio, FileText, Check, AlertTriangle,
  Zap, Copy, RefreshCw, Send, Stethoscope, ChevronRight,
  Flame, Sparkles
} from 'lucide-react';
import {
  listStagingQueue,
  matchAndImportAlert,
  markAtBay,
  simulateInboundAlert,
  subscribeStagingQueue,
  type EpcrPreArrivalAlert
} from '../../lib/epcrBridgeStore';

/**
 * AmbulanceTransfersSuite -> Modern HL7 v2 & FHIR R4 Pre-Hospital Ingestion Bridge.
 *
 * Replaces manual hospital ambulance dispatch with the real-world pre-hospital emergency transition:
 * 1. Pre-Alert Push (FHIR R4 / HL7 v2) from en route paramedics.
 * 2. Staging Dashboard (holds data in Pre-Arrival queue before committing to EMR).
 * 3. Triage Nurse Gatekeeper ("Ambulance data available for John Smith. Match and import?").
 * 4. 1-Click Ingestion (populates BP, HR, SpO2, trauma narrative, and EKG telemetry into EMR).
 */

export const AmbulanceTransfersSuite: React.FC = () => {
  const [alerts, setAlerts] = useState<EpcrPreArrivalAlert[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<string>('EPCR-2026-8812');
  const [showRawPayload, setShowRawPayload] = useState(false);
  const [ingestionToast, setIngestionToast] = useState<string | null>(null);

  useEffect(() => {
    setAlerts(listStagingQueue());
    const unsub = subscribeStagingQueue((updated) => setAlerts([...updated]));
    return unsub;
  }, []);

  const selectedAlert = alerts.find((a) => a.id === selectedAlertId) || alerts[0];

  const handle1ClickIngest = (alert: EpcrPreArrivalAlert) => {
    const imported = matchAndImportAlert(alert.id, 'Nurse Station (A&E)');
    if (imported) {
      setIngestionToast(
        `✅ 1-Click Ingestion Complete! Vitals (BP ${alert.vitals.bp}, HR ${alert.vitals.pulse}, SpO2 ${alert.vitals.spo2}%), trauma narrative, and EKG telemetry ingested into official EMR triage record for ${alert.patient.fullName} without manual typing.`
      );
      setTimeout(() => setIngestionToast(null), 7000);
    }
  };

  const handleSimulate = (scenario: 'mvc_polytrauma' | 'acute_stemi' | 'maternity_emergency') => {
    const pushed = simulateInboundAlert(scenario);
    setSelectedAlertId(pushed.id);
    setIngestionToast(`⚡ New Inbound Pre-Alert received via ${pushed.protocol}: ${pushed.patient.fullName} (${pushed.emsUnit}, ETA ${pushed.etaMinutes}m)`);
    setTimeout(() => setIngestionToast(null), 5000);
  };

  const inboundCount = alerts.filter((a) => a.status === 'inbound').length;
  const atBayCount = alerts.filter((a) => a.status === 'at_bay').length;
  const importedCount = alerts.filter((a) => a.status === 'imported').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toast Alert */}
      {ingestionToast && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 99999,
            background: '#0F172A',
            color: '#F8FAFC',
            border: '1px solid #10B981',
            borderRadius: 14,
            padding: '14px 20px',
            maxWidth: 520,
            boxShadow: '0 16px 36px rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            fontSize: '0.86rem',
            lineHeight: 1.45,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <Sparkles size={20} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{ingestionToast}</span>
        </div>
      )}

      {/* Top Banner Telemetry */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid #EF4444' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
            At Physical Ambulance Bay
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#EF4444' }}>{atBayCount} Arrived</span>
            <span style={{ fontSize: '0.75rem', color: '#F87171' }}>Awaiting Triage Verification</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-muted)' }}>Match & Import Gatekeeper Active</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #F97316' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
            Inbound En-Route Pre-Alerts
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#F97316' }}>{inboundCount} Inbound</span>
            <span style={{ fontSize: '0.75rem', color: '#FB923C' }}>Live ETA & Telemetry</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-muted)' }}>FHIR R4 / HL7 v2 Gateway</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
            1-Click Ingested Into EMR
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10B981' }}>{importedCount} Cases</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>0 Keystrokes Required</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-muted)' }}>Auto-populated Vitals & Trauma Notes</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
            Standard Interoperability
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#60A5FA' }}>FHIR R4 & HL7</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>RESTful /api/fhir/epcr-bridge Ready</span>
        </div>
      </div>

      {/* Simulator bar for demonstration */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
          border: '1px solid #334155',
          borderRadius: 12,
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#E2E8F0', fontSize: '0.84rem', fontWeight: 600 }}>
          <Radio size={16} color="#38BDF8" className="animate-pulse" />
          <span>Pre-Hospital Paramedic Push Simulator:</span>
          <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>(Simulate en-route ePCR package transmission)</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="os-ghost-btn"
            onClick={() => handleSimulate('mvc_polytrauma')}
            style={{ fontSize: '0.75rem', padding: '6px 12px', background: 'rgba(239,68,68,0.15)', borderColor: '#EF4444', color: '#FCA5A5' }}
          >
            + Push MVC Polytrauma (John Smith)
          </button>
          <button
            type="button"
            className="os-ghost-btn"
            onClick={() => handleSimulate('acute_stemi')}
            style={{ fontSize: '0.75rem', padding: '6px 12px', background: 'rgba(249,115,22,0.15)', borderColor: '#F97316', color: '#FDBA74' }}
          >
            + Push Acute STEMI Alert
          </button>
          <button
            type="button"
            className="os-ghost-btn"
            onClick={() => handleSimulate('maternity_emergency')}
            style={{ fontSize: '0.75rem', padding: '6px 12px', background: 'rgba(59,130,246,0.15)', borderColor: '#3B82F6', color: '#93C5FD' }}
          >
            + Push Maternity Emergency
          </button>
        </div>
      </div>

      {/* Main Grid: Staging Queue (Left) vs Ingestion Verification Gatekeeper (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20 }}>
        {/* Left: Staging Queue */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0A2540', letterSpacing: '0.04em' }}>
              PRE-ARRIVAL STAGING QUEUE
            </span>
            <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>
              {alerts.length} packages staged
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alerts.map((alert) => {
              const isSelected = alert.id === selectedAlertId;
              const isAtBay = alert.status === 'at_bay';
              const isImported = alert.status === 'imported';

              return (
                <div
                  key={alert.id}
                  onClick={() => setSelectedAlertId(alert.id)}
                  className="os-card"
                  style={{
                    cursor: 'pointer',
                    padding: '14px 16px',
                    borderColor: isSelected ? (isAtBay ? '#EF4444' : isImported ? '#10B981' : '#3B82F6') : undefined,
                    background: isSelected
                      ? isAtBay
                        ? 'rgba(239,68,68,0.06)'
                        : isImported
                        ? 'rgba(16,185,129,0.06)'
                        : 'rgba(59,130,246,0.06)'
                      : undefined,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            fontSize: '0.64rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: alert.protocol === 'FHIR_R4' ? '#3B82F6' : '#8B5CF6',
                            color: '#FFFFFF',
                          }}
                        >
                          {alert.protocol}
                        </span>
                        <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A' }}>
                          {alert.patient.fullName}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.74rem', color: '#64748B', marginTop: 2, display: 'block' }}>
                        DOB: {alert.patient.dob || `${alert.patient.age}y`} · {alert.patient.gender === 'M' ? 'Male' : 'Female'}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: isAtBay ? '#FEE2E2' : isImported ? '#D1FAE5' : '#FFEDD5',
                        color: isAtBay ? '#B91C1C' : isImported ? '#047857' : '#C2410C',
                      }}
                    >
                      {isAtBay ? 'AT BAY' : isImported ? 'IMPORTED' : `ETA ${alert.etaMinutes}m`}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.76rem', color: '#334155', fontWeight: 600, margin: '4px 0' }}>
                    {alert.incidentType}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748B', marginTop: 8, borderTop: '1px dashed #E2E8F0', paddingTop: 6 }}>
                    <span>{alert.emsUnit}</span>
                    <span style={{ fontWeight: 700, color: alert.vitals.spo2 < 93 ? '#EF4444' : '#047857' }}>
                      BP {alert.vitals.bp} · HR {alert.vitals.pulse}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Triage Nurse Gatekeeper Ingestion Desk */}
        {selectedAlert ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Gatekeeper Prompt Banner */}
            <div
              style={{
                borderRadius: 14,
                padding: '16px 20px',
                background: selectedAlert.status === 'imported'
                  ? 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)'
                  : 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
                border: `1.5px solid ${selectedAlert.status === 'imported' ? '#10B981' : '#F59E0B'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldAlert size={20} color={selectedAlert.status === 'imported' ? '#059669' : '#D97706'} />
                  <span style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A' }}>
                    {selectedAlert.status === 'imported'
                      ? `Ambulance data imported for ${selectedAlert.patient.fullName}`
                      : `Ambulance data available for ${selectedAlert.patient.fullName} (${selectedAlert.patient.dob ? `DOB: ${selectedAlert.patient.dob}` : `${selectedAlert.patient.age}y`}). Match and import?`}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0 28px', fontSize: '0.78rem', color: '#475569', lineHeight: 1.4 }}>
                  {selectedAlert.status === 'imported'
                    ? `Ingested into active EMR Triage Assessment by ${selectedAlert.importedBy || 'Triage Nurse'} at ${new Date(selectedAlert.importedAt || '').toLocaleTimeString()}.`
                    : 'Verify the physical patient at the ambulance bay against this staged ePCR package. Clicking Accept/Import will populate vitals, trauma notes, and EKG links instantly with 0 manual typing.'}
                </p>
              </div>

              {selectedAlert.status !== 'imported' ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  {selectedAlert.status === 'inbound' && (
                    <button
                      type="button"
                      className="os-ghost-btn"
                      onClick={() => markAtBay(selectedAlert.id)}
                      style={{ fontSize: '0.8rem', padding: '8px 14px' }}
                    >
                      Mark Arrived at Bay
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handle1ClickIngest(selectedAlert)}
                    style={{
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 10,
                      padding: '10px 18px',
                      fontSize: '0.86rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>Accept &amp; Import (1-Click)</span>
                  </button>
                </div>
              ) : (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#059669', fontWeight: 800, fontSize: '0.84rem' }}>
                  <CheckCircle2 size={18} />
                  <span>EMR Ingested &amp; Synchronized</span>
                </div>
              )}
            </div>

            {/* Ingestion Package Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
              {/* Field Vitals Sheet */}
              <div className="os-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <Activity size={16} color="#0284C7" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A' }}>
                    PARAMEDIC FIELD VITALS
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: '#F8FAFC', padding: 8, borderRadius: 8 }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block' }}>Blood Pressure</span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>{selectedAlert.vitals.bp}</span>
                    <span style={{ fontSize: '0.68rem', color: '#64748B' }}> mmHg</span>
                  </div>
                  <div style={{ background: '#F8FAFC', padding: 8, borderRadius: 8 }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block' }}>Heart Rate</span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: selectedAlert.vitals.pulse > 100 ? '#EF4444' : '#0F172A' }}>
                      {selectedAlert.vitals.pulse}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#64748B' }}> bpm</span>
                  </div>
                  <div style={{ background: '#F8FAFC', padding: 8, borderRadius: 8 }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block' }}>SpO2 Oxygen</span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: selectedAlert.vitals.spo2 < 93 ? '#EF4444' : '#10B981' }}>
                      {selectedAlert.vitals.spo2}%
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#64748B' }}> {selectedAlert.vitals.spo2 < 93 ? '(Hypoxic)' : '(Norm)'}</span>
                  </div>
                  <div style={{ background: '#F8FAFC', padding: 8, borderRadius: 8 }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block' }}>Respiratory Rate</span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>{selectedAlert.vitals.rr}</span>
                    <span style={{ fontSize: '0.68rem', color: '#64748B' }}> /min</span>
                  </div>
                  <div style={{ background: '#F8FAFC', padding: 8, borderRadius: 8 }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block' }}>Body Temp</span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>{selectedAlert.vitals.temp}°C</span>
                  </div>
                  <div style={{ background: '#F8FAFC', padding: 8, borderRadius: 8 }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block' }}>Pain &amp; GCS</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#EF4444' }}>
                      {selectedAlert.vitals.painScale}/10 · {selectedAlert.vitals.gcs || 'GCS 15'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 12-Lead EKG Telemetry Feed */}
              <div className="os-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Heart size={16} color="#EF4444" />
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A' }}>
                      12-LEAD EKG TELEMETRY
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: selectedAlert.ekgTelemetry.stElevation ? '#FEE2E2' : '#EFF6FF',
                      color: selectedAlert.ekgTelemetry.stElevation ? '#EF4444' : '#2563EB',
                    }}
                  >
                    {selectedAlert.ekgTelemetry.stElevation ? 'CRITICAL STEMI' : 'MONITORED'}
                  </span>
                </div>
                <div style={{ background: '#0F172A', color: '#38BDF8', borderRadius: 8, padding: 12, fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: 1.45 }}>
                  <div style={{ color: '#F8FAFC', fontWeight: 700, marginBottom: 4 }}>
                    Rhythm: {selectedAlert.ekgTelemetry.rhythm}
                  </div>
                  <div style={{ color: '#94A3B8', fontSize: '0.74rem' }}>
                    {selectedAlert.ekgTelemetry.notes}
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, color: '#10B981', fontSize: '0.72rem' }}>
                    <Zap size={12} />
                    <span>Transmitted live from mobile monitor</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Accident Narrative & En-Route Interventions */}
            <div className="os-card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <FileText size={16} color="#6366F1" />
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0F172A' }}>
                  PARAMEDIC ACCIDENT NARRATIVE &amp; TRAUMA MECHANISM
                </span>
              </div>
              <p style={{ fontSize: '0.84rem', color: '#334155', lineHeight: 1.5, background: '#F8FAFC', padding: 12, borderRadius: 8, margin: '0 0 14px' }}>
                {selectedAlert.accidentNarrative}
              </p>

              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                En-Route Pre-Hospital Interventions Administered:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedAlert.enRouteInterventions.map((item, idx) => (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '0.75rem',
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: '#EEF2FF',
                      border: '1px solid #C7D2FE',
                      color: '#4338CA',
                      fontWeight: 600,
                    }}
                  >
                    <Check size={12} color="#6366F1" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Protocol Standard Payload Viewer */}
            <div className="os-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                  Underlying Interoperability Payload ({selectedAlert.protocol})
                </span>
                <button
                  type="button"
                  className="os-ghost-btn"
                  onClick={() => setShowRawPayload(!showRawPayload)}
                  style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                >
                  {showRawPayload ? 'Hide Raw Bundle' : 'Inspect Raw FHIR / HL7 Bundle'}
                </button>
              </div>

              {showRawPayload && (
                <pre
                  style={{
                    marginTop: 10,
                    padding: 12,
                    background: '#0F172A',
                    color: '#A7F3D0',
                    borderRadius: 8,
                    fontSize: '0.72rem',
                    overflowX: 'auto',
                    maxHeight: 240,
                  }}
                >
                  {selectedAlert.rawPayloadPreview || '// Bundle content available'}
                </pre>
              )}
            </div>
          </div>
        ) : (
          <div className="os-card" style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>
            Select an inbound ePCR alert from the queue to verify and ingest.
          </div>
        )}
      </div>
    </div>
  );
};
