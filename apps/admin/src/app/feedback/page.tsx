'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, ShieldAlert, Star, Send } from 'lucide-react';
import { OFFICIAL_AKWA_IBOM_FACILITIES } from '../../data/akwaIbomFacilities';

export default function CitizenFeedbackPage() {
  const [facilityId, setFacilityId] = useState(OFFICIAL_AKWA_IBOM_FACILITIES[0]?.facilityId || 'IGH-EKT');
  const [channel, setChannel] = useState<'qr' | 'whistleblower'>('qr');
  const [category, setCategory] = useState<
    'service_quality' | 'extortion_billing' | 'unqualified_practice' | 'drug_stockout' | 'staff_conduct' | 'commendation'
  >('service_quality');
  const [rating, setRating] = useState<number>(4);
  const [anonymous, setAnonymous] = useState(true);
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const qs = new URLSearchParams(window.location.search);
    const paramFid = (qs.get('facilityId') || '').trim().toUpperCase();
    if (paramFid) {
      setFacilityId(paramFid);
    }
    const ch = (qs.get('channel') || '').trim().toLowerCase();
    if (ch === 'whistleblower') {
      setChannel('whistleblower');
    }
  }, []);

  const selectedFac = OFFICIAL_AKWA_IBOM_FACILITIES.find((f) => f.facilityId === facilityId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!facilityId || summary.trim().length < 8) {
      setError('Please select a health facility and describe your feedback or report (minimum 8 characters).');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/moh/grievances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilityId,
          facilityName: selectedFac?.facilityName || facilityId,
          lga: selectedFac?.lga || 'Akwa Ibom',
          channel,
          category,
          rating,
          anonymous,
          summary: summary.trim(),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        grievance?: { trackingCode?: string };
        error?: string;
      };
      if (!res.ok || !json.ok || !json.grievance) {
        setError(json.error || 'Could not submit report. Please retry.');
        return;
      }
      setSubmittedCode(json.grievance.trackingCode || 'AKS-LOGGED');
      setSummary('');
    } catch {
      setError('Network error while submitting report. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #ECFDF5 0%, #F8FAFC 45%, #F1F5F9 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '28px 16px',
        fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          background: '#FFFFFF',
          borderRadius: 20,
          border: '1px solid #E2E8F0',
          boxShadow: '0 20px 50px rgba(15, 23, 42, 0.08)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: '#065F46',
            color: '#FFFFFF',
            padding: '22px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <img
            src="/ibmlogo.png"
            alt="Akwa Ibom State Ministry of Health"
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: '#FFFFFF',
              padding: 4,
              objectFit: 'contain',
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#A7F3D0' }}>
              Akwa Ibom State Ministry of Health
            </div>
            <h1 style={{ margin: '2px 0 0', fontSize: '1.15rem', fontWeight: 800 }}>
              Public Health Feedback &amp; Whistleblower Desk
            </h1>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {submittedCode ? (
            <div style={{ textAlign: 'center', padding: '14px 4px' }}>
              <CheckCircle2 size={46} color="#065F46" style={{ margin: '0 auto 12px' }} />
              <h2 style={{ margin: '0 0 6px', fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
                Submission Received by MOH Inspectorate
              </h2>
              <p style={{ margin: '0 0 16px', fontSize: '0.86rem', color: '#475569', lineHeight: 1.5 }}>
                Your report for <strong>{selectedFac?.facilityName || facilityId}</strong> has been logged directly into the Commissioner&apos;s Grievance &amp; Accountability Desk.
              </p>
              <div
                style={{
                  display: 'inline-block',
                  padding: '10px 18px',
                  borderRadius: 12,
                  background: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  marginBottom: 18,
                }}
              >
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#047857', textTransform: 'uppercase' }}>
                  Tracking Reference Code
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, fontFamily: 'monospace', color: '#065F46' }}>
                  {submittedCode}
                </div>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setSubmittedCode(null)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#065F46',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Submit Another Report
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>
                Scan-to-report portal for patients, relatives, and whistleblowers. All sensitive identifiers are automatically redacted before review.
              </div>

              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1E293B' }}>
                Health Facility Visited *
                <select
                  value={facilityId}
                  onChange={(e) => setFacilityId(e.target.value)}
                  style={{
                    width: '100%',
                    marginTop: 5,
                    height: 40,
                    padding: '0 12px',
                    borderRadius: 10,
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    background: '#FFFFFF',
                  }}
                >
                  {!selectedFac && (
                    <option value={facilityId}>{facilityId} (Scanned QR Facility)</option>
                  )}
                  {OFFICIAL_AKWA_IBOM_FACILITIES.map((f) => (
                    <option key={f.facilityId} value={f.facilityId}>
                      {f.facilityName} ({f.lga})
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1E293B' }}>
                  Submission Type
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as 'qr' | 'whistleblower')}
                    style={{
                      width: '100%',
                      marginTop: 5,
                      height: 40,
                      padding: '0 10px',
                      borderRadius: 10,
                      border: '1px solid #CBD5E1',
                      fontSize: '0.84rem',
                      background: '#FFFFFF',
                    }}
                  >
                    <option value="qr">Facility QR Feedback</option>
                    <option value="whistleblower">Whistleblower Alert</option>
                  </select>
                </label>

                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1E293B' }}>
                  Report Category
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    style={{
                      width: '100%',
                      marginTop: 5,
                      height: 40,
                      padding: '0 10px',
                      borderRadius: 10,
                      border: '1px solid #CBD5E1',
                      fontSize: '0.84rem',
                      background: '#FFFFFF',
                    }}
                  >
                    <option value="service_quality">Service Quality / Wait Time</option>
                    <option value="extortion_billing">Illegal Billing / Extortion</option>
                    <option value="unqualified_practice">Unqualified Staff / Quackery</option>
                    <option value="drug_stockout">Drug or Vaccine Stock-Out</option>
                    <option value="staff_conduct">Staff Conduct</option>
                    <option value="commendation">Staff Commendation</option>
                  </select>
                </label>
              </div>

              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1E293B', marginBottom: 6 }}>
                  Service Experience Rating ({rating} / 5)
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      aria-label={`Rate ${star} stars`}
                      style={{
                        padding: '7px 12px',
                        borderRadius: 10,
                        border: `1px solid ${rating >= star ? '#D97706' : '#CBD5E1'}`,
                        background: rating >= star ? '#FFFBEB' : '#FFFFFF',
                        color: rating >= star ? '#D97706' : '#94A3B8',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                      }}
                    >
                      <Star size={14} fill={rating >= star ? '#D97706' : 'none'} />
                      <span>{star}</span>
                    </button>
                  ))}
                </div>
              </div>

              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1E293B' }}>
                Complaint, Observation, or Commendation *
                <textarea
                  rows={4}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Describe the incident, ward/clinic, or experience clearly. Do not include private phone numbers or NIN..."
                  style={{
                    width: '100%',
                    marginTop: 5,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                />
                <span>Submit strictly anonymously (no reporter identity recorded)</span>
              </label>

              {error && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#B91C1C',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                style={{
                  height: 44,
                  borderRadius: 11,
                  border: 'none',
                  background: '#065F46',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Send size={15} />
                <span>{busy ? 'Submitting to MOH Inspectorate…' : 'Submit Report to Akwa Ibom MOH'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
