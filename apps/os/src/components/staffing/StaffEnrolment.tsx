'use client';
import { pushActivity, setOpenPositions, getOpenPositions } from '../../lib/adminRealtimeStore';

/**
 * Staff enrolment — creates auth identity + issues Staff ID card in one step.
 * Card is readable on Hospital OS and MedCore Clinic (same badgeId).
 */
import React, { useMemo, useState, useEffect } from 'react';
import { UserPlus, IdCard, CheckCircle2 } from 'lucide-react';
import { LogoProgressBar } from '../realtime/LogoProgressBar';
import { HOSPITALS } from '../auth/AuthScreen';
import { enrolStaffAndIssueCard, listStaffCards, getStaffCard } from '../../lib/staffCardStore';
import { firebaseSignUp, isEmailCredential, firestoreUpsertStaffMember, firestorePushStaffDirectory, firebaseEnsureBadgeAccount, badgeAuthEmail, normalizeStaffPin } from '../../lib/firebase';
import { emitLiveAction } from '../../lib/liveActions';
import { StaffIdCardView } from './StaffIdCardView';
import type { StaffCardRecord } from '@medcore/types';
import type { UserSession } from '../auth/AuthScreen';

const ROLE_OPTIONS = [
  { roleKey: 'doctor', role: 'Medical Officer', title: 'Medical Officer', shortRole: 'Doctor', clearanceLevel: 4, clearanceLabel: 'L4 Clinical', department: 'Internal Medicine' },
  { roleKey: 'nurse', role: 'Nursing Officer', title: 'Senior Nursing Officer', shortRole: 'Nurse', clearanceLevel: 3, clearanceLabel: 'L3 Nursing', department: 'Inpatient Wards' },
  { roleKey: 'surgeon', role: 'Consultant Surgeon', title: 'Consultant Surgeon', shortRole: 'Surgeon', clearanceLevel: 5, clearanceLabel: 'L5 Consultant', department: 'Surgery & Theatre' },
  { roleKey: 'pharmacist', role: 'Pharmacist', title: 'Pharmacist', shortRole: 'Pharmacist', clearanceLevel: 3, clearanceLabel: 'L3 Pharmacy', department: 'Pharmacy' },
  { roleKey: 'lab', role: 'Lab Scientist', title: 'Lab Scientist', shortRole: 'Lab', clearanceLevel: 3, clearanceLabel: 'L3 Lab', department: 'Pathology' },
  { roleKey: 'radiologist', role: 'Radiologist', title: 'Consultant Radiologist', shortRole: 'Radiology', clearanceLevel: 5, clearanceLabel: 'L5 Radiology', department: 'Radiology' },
  { roleKey: 'records', role: 'Records Officer', title: 'Health Records Officer', shortRole: 'Records', clearanceLevel: 2, clearanceLabel: 'L2 Records', department: 'Medical Records' },
  { roleKey: 'accountant', role: 'Finance Officer', title: 'Finance Officer', shortRole: 'Accounts', clearanceLevel: 3, clearanceLabel: 'L3 Finance', department: 'Billing & Finance' },
  { roleKey: 'reception', role: 'Reception / Front Desk', title: 'Reception Officer', shortRole: 'Reception', clearanceLevel: 2, clearanceLabel: 'L2 Front Desk', department: 'Patient Reception' },
  { roleKey: 'hospital_admin', role: 'Hospital Administrator', title: 'Hospital Administrator', shortRole: 'Admin', clearanceLevel: 5, clearanceLabel: 'L5 Executive', department: 'Administration' },
  { roleKey: 'sysadmin', role: 'ICT / System Admin', title: 'System Administrator', shortRole: 'SysAdmin', clearanceLevel: 6, clearanceLabel: 'L6 SysAdmin', department: 'ICT' },
];

interface Props {
  session?: UserSession;
}

export const StaffEnrolment: React.FC<Props> = ({ session }) => {
  const [fullName, setFullName] = useState('');
  const [roleKey, setRoleKey] = useState('doctor');
  const lockedFacilityId = session?.hospitalId || HOSPITALS[0]?.id || 'IGH-EKT';
  const [facilityId, setFacilityId] = useState(lockedFacilityId);
  const [pin, setPin] = useState('1234');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<StaffCardRecord | null>(null);
  /** Card created but not yet confirmed into the roster list */
  const [pendingConfirm, setPendingConfirm] = useState<{
    card: StaffCardRecord;
    pin: string;
    hospitalName: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [cards, setCards] = useState<StaffCardRecord[]>(() =>
    typeof window !== 'undefined' ? listStaffCards() : []
  );

  useEffect(() => {
    if (session?.hospitalId) setFacilityId(session.hospitalId);
  }, [session?.hospitalId]);

  const roleMeta = useMemo(
    () => ROLE_OPTIONS.find((r) => r.roleKey === roleKey) || ROLE_OPTIONS[0],
    [roleKey]
  );
  const facility =
    HOSPITALS.find((h) => h.id === facilityId) ||
    (session?.hospitalId
      ? { id: session.hospitalId, name: session.facility || session.hospitalId }
      : HOSPITALS[0]);

  const handleEnrol = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim()) {
      setError('Enter staff full name.');
      return;
    }
    // One hospital admin per facility only
    if (roleMeta.roleKey === 'hospital_admin') {
      const existing = listStaffCards().filter(
        (c) =>
          c.facilityId === facility.id &&
          (c.roleKey === 'hospital_admin' || (c.role || '').toLowerCase().includes('administrator'))
      );
      if (existing.length > 0) {
        setError(
          `This hospital already has an administrator (${existing[0].fullName || existing[0].badgeId}). One admin per facility only.`
        );
        return;
      }
    }
    setBusy(true);
    try {
      const { card } = enrolStaffAndIssueCard({
        fullName: fullName.trim(),
        role: roleMeta.role,
        roleKey: roleMeta.roleKey,
        title: roleMeta.title,
        department: roleMeta.department,
        facilityId: facility.id,
        facilityName: facility.name,
        clearanceLevel: roleMeta.clearanceLevel,
        clearanceLabel: roleMeta.clearanceLabel,
        pin,
        shortRole: roleMeta.shortRole,
        permissions: ['dashboard'],
      });

      // Firebase Auth account for badge + PIN (same system as email/password)
      const pinNorm = normalizeStaffPin(pin);
      try {
        await firebaseEnsureBadgeAccount(card.badgeId, pinNorm);
      } catch (err: any) {
        console.warn('[enrol] badge Firebase Auth', err);
        setError(
          `Card issued, but Firebase login setup failed: ${err?.message || err?.code || 'check Email/Password provider'}. Try sign-in after enabling Auth.`
        );
      }

      // Ensure Firestore has this staff before they try to sign in on another device
      try {
        const regRaw = localStorage.getItem('medcore_os_staff_registry');
        const reg = regRaw ? JSON.parse(regRaw) : [];
        const entry = Array.isArray(reg)
          ? reg.find((r: any) => String(r.badgeId || '').toUpperCase() === card.badgeId.toUpperCase())
          : null;
        const enriched = entry
          ? {
              ...entry,
              badgeId: card.badgeId.toUpperCase(),
              pin: pinNorm,
              authEmail: badgeAuthEmail(card.badgeId),
            }
          : {
              badgeId: card.badgeId.toUpperCase(),
              name: fullName.trim(),
              pin: pinNorm,
              authEmail: badgeAuthEmail(card.badgeId),
              roleKey: roleMeta.roleKey,
              role: roleMeta.role,
              hospitalId: facility.id,
              hospitalName: facility.name,
            };
        await firestoreUpsertStaffMember(facility.id, enriched);
        await firestorePushStaffDirectory(facility.id, {
          staffCards: JSON.parse(localStorage.getItem('medcore_staff_id_cards') || '[]'),
          staffRegistry: Array.isArray(reg)
            ? reg.map((r: any) =>
                String(r.badgeId || '').toUpperCase() === card.badgeId.toUpperCase() ? enriched : r
              )
            : [enriched],
        });
      } catch (err) {
        console.warn('[enrol] firestore ensure', err);
      }

      // Optional Firebase Auth account (email + PIN as password) for cloud login
      const mail = email.trim();
      if (mail) {
        if (!isEmailCredential(mail)) {
          setError('Invalid email — card was issued; you can add a valid email later.');
        } else {
          try {
            await firebaseSignUp(mail, pin || '123456');
          } catch (err: any) {
            const code = err?.code || '';
            if (code !== 'auth/email-already-in-use') {
              console.warn('[enrol] firebaseSignUp', err);
              setError(
                `Card issued. Firebase account note: ${err?.message || code || 'could not create account'}`
              );
            }
          }
        }
      }

      try {
        pushActivity(`Enrolled ${fullName.trim()} · ${roleMeta.shortRole} · ${card.badgeId}`);
      } catch { /* ignore */ }
      emitLiveAction(`Staff enrolled · ${card.badgeId}`, { module: 'enrolment' });

      // Confirmation screen BEFORE roster list updates
      setPendingConfirm({
        card,
        pin: pin || '1234',
        hospitalName: facility.name,
      });
      setIssued(card);
      setFullName('');
      setEmail('');
    } finally {
      setBusy(false);
    }
  };

  const confirmEnrolment = () => {
    if (!pendingConfirm) return;
    setCards(listStaffCards());
    setPendingConfirm(null);
  };

  return (
    <div className="os-module-layout">
      <div className="os-insight-banner">
        <IdCard size={18} style={{ color: '#0066FF', flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.88rem', marginBottom: 4 }}>
            Staff enrolment · ID card + auth in one step
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: 1.55 }}>
            Issuing a card creates the login identity (<strong>badge ID</strong>). The same card appears on{' '}
            <strong>Hospital OS</strong> and <strong>MedCore Clinic</strong> staff app.
          </div>
        </div>
      </div>

      <div className="os-split-2">
        <form className="os-panel" onSubmit={handleEnrol}>
          <div className="os-panel-header">
            <div className="os-panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserPlus size={16} color="#0066FF" /> Enrol new staff
            </div>
          </div>
          <div className="os-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>
              Full name
              <input
                className="os-search-input"
                style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px' }}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Dr. Uduak Essien"
              />
            </label>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>
              Role
              <select
                className="os-form-select"
                style={{ display: 'block', width: '100%', marginTop: 6 }}
                value={roleKey}
                onChange={(e) => setRoleKey(e.target.value)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.roleKey} value={r.roleKey}>
                    {r.title} ({r.clearanceLabel})
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>
              Facility
              {session?.hospitalId ? (
                <div
                  className="os-form-select"
                  style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', background: '#F8FAFC', boxSizing: 'border-box' }}
                >
                  {facility?.name || session.facility} · your hospital only
                </div>
              ) : (
                <select
                  className="os-form-select"
                  style={{ display: 'block', width: '100%', marginTop: 6 }}
                  value={facilityId}
                  onChange={(e) => setFacilityId(e.target.value)}
                >
                  {HOSPITALS.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>
              Email
              <input
                className="os-search-input"
                style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px' }}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@hospital.gov.ng"
              />
            </label>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>
              Initial PIN (min 6 characters)
              <input
                className="os-search-input"
                style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px' }}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={8}
              />
            </label>
            {error && (
              <div style={{ color: '#EF4444', fontSize: '0.8rem', fontWeight: 600 }}>{error}</div>
            )}
            <button type="submit" disabled={busy} className="os-action-btn-primary" style={{ marginTop: 4 }}>
              <UserPlus size={16} /> {busy ? 'Processing…' : 'Enrol & issue staff ID card'}
            </button>
            <LogoProgressBar active={busy} label="Creating account & issuing staff ID…" />
          </div>
        </form>

        <div>
          {pendingConfirm ? (
            <div
              className="os-panel"
              style={{
                border: '2px solid #16A34A',
                boxShadow: '0 8px 28px rgba(22,163,74,0.15)',
                padding: 0,
                overflow: 'hidden',
              }}
            >
              <div style={{ background: 'linear-gradient(135deg,#16A34A,#0D9488)', padding: '16px 18px', color: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: '1rem' }}>
                  <CheckCircle2 size={20} /> Staff created successfully
                </div>
                <div style={{ fontSize: '0.82rem', opacity: 0.95, marginTop: 4 }}>
                  Confirm below before this person appears on the roster.
                </div>
              </div>
              <div style={{ padding: 18 }}>
                <StaffIdCardView card={pendingConfirm.card} />
                <div
                  style={{
                    marginTop: 16,
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: 12,
                    padding: 14,
                  }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', letterSpacing: '0.04em' }}>
                    SIGN-IN DETAILS (share with staff)
                  </div>
                  <div style={{ marginTop: 10, fontSize: '0.9rem', color: '#0F172A', lineHeight: 1.7 }}>
                    <div>
                      <strong>Staff ID / Badge:</strong>{' '}
                      <code style={{ fontSize: '1rem', fontWeight: 800, color: '#0052D4' }}>
                        {pendingConfirm.card.badgeId}
                      </code>
                    </div>
                    <div>
                      <strong>PIN:</strong>{' '}
                      <code style={{ fontWeight: 800 }}>{pendingConfirm.pin}</code>
                    </div>
                    <div>
                      <strong>Hospital:</strong> {pendingConfirm.hospitalName}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 6 }}>
                      On the login screen choose <strong>Staff ID No.</strong>, enter this badge and PIN.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="os-action-btn-primary"
                  style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}
                  onClick={confirmEnrolment}
                >
                  <CheckCircle2 size={16} /> Confirm — add to staff list
                </button>
              </div>
            </div>
          ) : issued ? (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 12,
                  color: '#16A34A',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                }}
              >
                <CheckCircle2 size={18} /> Card on file — ready for Staff ID login
              </div>
              <StaffIdCardView card={issued} />
              <p style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 12, lineHeight: 1.5 }}>
                Login: badge <strong style={{ fontFamily: 'monospace' }}>{issued.badgeId}</strong> · PIN from
                enrolment. Use <strong>Staff ID No.</strong> mode on the sign-in screen.
              </p>
            </div>
          ) : (
            <div className="os-card" style={{ padding: 24, color: '#64748B', fontSize: '0.88rem' }}>
              Complete enrolment to preview the staff ID card here. Existing cards are listed below.
            </div>
          )}
        </div>
      </div>

      {cards.length > 0 && (
        <div className="os-panel">
          <div className="os-panel-header">
            <div className="os-panel-title">Issued cards ({cards.length})</div>
          </div>
          <div className="os-panel-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {cards.map((c) => (
              <div key={c.badgeId} onClick={() => setIssued(getStaffCard(c.badgeId) || c)} style={{ cursor: 'pointer' }}>
                <StaffIdCardView card={c} compact />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffEnrolment;
