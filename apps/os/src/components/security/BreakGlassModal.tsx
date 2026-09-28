'use client';

import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Lock, KeyRound, CheckCircle2, UserCheck, Flame } from 'lucide-react';

interface BreakGlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName?: string;
  patientMrn?: string;
  facilityId?: string;
  onAccessGranted: (justification: string) => void;
}

export const BreakGlassModal: React.FC<BreakGlassModalProps> = ({
  isOpen,
  onClose,
  patientName = 'Unidentified Trauma Patient #09',
  patientMrn = 'EMERG-9941',
  facilityId = 'FAC-001',
  onAccessGranted,
}) => {
  const [clinicianBadge, setClinicianBadge] = useState('DOC-EMERG-44');
  const [clinicianPin, setClinicianPin] = useState('');
  const [reasonCategory, setReasonCategory] = useState<'UNCONSCIOUS_TRAUMA' | 'CARDIAC_ARREST' | 'PSYCH_EMERGENCY' | 'MASS_CASUALTY' | 'OTHER'>('UNCONSCIOUS_TRAUMA');
  const [customJustification, setCustomJustification] = useState('Patient unconscious following motor vehicle collision on Airport Road. Unable to provide consent; accessing full statewide history & blood group.');
  const [bypassBilling, setBypassBilling] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicianPin) {
      alert('Security PIN is required to break glass.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onAccessGranted(customJustification);
      onClose();
    }, 600);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{
        background: '#0F172A', border: '2px solid #EF4444', borderRadius: 14,
        width: '100%', maxWidth: 580, padding: 26, boxShadow: '0 25px 60px -15px rgba(239,68,68,0.4)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{
            background: 'rgba(239,68,68,0.2)', padding: 10, borderRadius: 10, border: '1px solid #EF4444'
          }}>
            <Flame size={26} color="#EF4444" />
          </div>
          <div>
            <h3 style={{ margin: 0, color: '#F8FAFC', fontSize: '1.2rem', fontWeight: 800 }}>
              EMERGENCY BREAK-GLASS PROTOCOL
            </h3>
            <span style={{ fontSize: '0.74rem', color: '#FCA5A5', fontWeight: 600 }}>
              Life-Threatening Emergency PHI Override • NDPR Section 24 Exception
            </span>
          </div>
        </div>

        <div style={{
          background: 'rgba(239,68,68,0.12)', borderLeft: '4px solid #EF4444', padding: 12,
          borderRadius: 6, marginBottom: 18, fontSize: '0.8rem', color: '#FECACA'
        }}>
          <strong>LEGAL & AUDIT NOTICE:</strong> Invoking emergency break-glass temporarily overrides standard patient consent restrictions and facility tenancy boundaries. This event is cryptographically signed and broadcast immediately to the Chief Medical Director and State Health Data Protection Officer.
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Target Patient */}
          <div style={{ background: '#1E293B', padding: 12, borderRadius: 8, fontSize: '0.82rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94A3B8' }}>Emergency Target:</span>
              <strong style={{ color: '#F1F5F9' }}>{patientName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ color: '#94A3B8' }}>Identifier:</span>
              <span style={{ color: '#38BDF8', fontWeight: 700 }}>{patientMrn} ({facilityId})</span>
            </div>
          </div>

          {/* Reason Category */}
          <div>
            <label style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'block', marginBottom: 6 }}>
              Clinical Emergency Justification
            </label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value as any)}
              style={{
                width: '100%', padding: '9px 12px', background: '#1E293B', border: '1px solid #334155',
                color: '#FFF', borderRadius: 6, fontSize: '0.82rem'
              }}
            >
              <option value="UNCONSCIOUS_TRAUMA">Unconscious / Altered Mental State / Polytrauma</option>
              <option value="CARDIAC_ARREST">Acute Cardiac Arrest / Code Blue Resuscitation</option>
              <option value="MASS_CASUALTY">Mass Casualty Incident (MCI Surge Code)</option>
              <option value="PSYCH_EMERGENCY">Acute Psychiatric Crisis / Imminent Harm</option>
              <option value="OTHER">Other Life-Critical Clinical Exception</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'block', marginBottom: 6 }}>
              Detailed Clinical Justification Note (Required by DPA)
            </label>
            <textarea
              rows={3}
              value={customJustification}
              onChange={(e) => setCustomJustification(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', background: '#1E293B', border: '1px solid #334155',
                color: '#FFF', borderRadius: 6, fontSize: '0.8rem', resize: 'vertical'
              }}
            />
          </div>

          {/* Care First Toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, background: '#1E293B',
            padding: 12, borderRadius: 8
          }}>
            <input
              type="checkbox"
              id="bypassBilling"
              checked={bypassBilling}
              onChange={(e) => setBypassBilling(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: '#10B981', cursor: 'pointer' }}
            />
            <label htmlFor="bypassBilling" style={{ fontSize: '0.78rem', color: '#E2E8F0', cursor: 'pointer' }}>
              <strong>Care-First Emergency Bypass:</strong> Automatically unlock blood bank crossmatch, emergency laparotomy/theatre, and STAT labs without cashier co-pay blockage.
            </label>
          </div>

          {/* Clinician Authentication */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.72rem', color: '#94A3B8', display: 'block', marginBottom: 4 }}>
                Attending Badge ID
              </label>
              <input
                type="text"
                value={clinicianBadge}
                onChange={(e) => setClinicianBadge(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', background: '#1E293B', border: '1px solid #334155', color: '#FFF', borderRadius: 6 }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: '#94A3B8', display: 'block', marginBottom: 4 }}>
                Doctor Signature PIN
              </label>
              <input
                type="password"
                placeholder="••••"
                value={clinicianPin}
                onChange={(e) => setClinicianPin(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', background: '#1E293B', border: '1px solid #334155', color: '#FFF', borderRadius: 6 }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button
              type="button"
              onClick={onClose}
              className="os-btn"
              style={{ background: '#334155', color: '#FFF', padding: '8px 16px', borderRadius: 6 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !clinicianPin}
              className="os-btn"
              style={{
                background: clinicianPin ? '#EF4444' : '#475569',
                color: '#FFF', padding: '10px 22px', borderRadius: 6, fontWeight: 800,
                display: 'inline-flex', alignItems: 'center', gap: 8, cursor: clinicianPin ? 'pointer' : 'not-allowed'
              }}
            >
              <KeyRound size={16} /> Break Glass & Unlock Emergency Care
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
