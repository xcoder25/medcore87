'use client';
import { pushActivity, setOpenPositions, getOpenPositions } from '../../lib/adminRealtimeStore';

/**
 * Staff enrolment — creates auth identity + issues Staff ID card in one step.
 * Card is readable on Hospital OS and MedCore Clinic (same badgeId).
 */
import React, { useMemo, useState, useEffect } from 'react';
import { UserPlus, IdCard, CheckCircle2, Trash2 } from 'lucide-react';
import { LogoProgressBar } from '../realtime/LogoProgressBar';
import { HOSPITALS } from '../auth/AuthScreen';
import { enrolStaffAndIssueCard, listStaffCards, getStaffCard, deleteStaffMember, defaultPermissionsForRole } from '../../lib/staffCardStore';
import { firebaseSignUp, isEmailCredential, firestoreUpsertStaffMember, firestorePushStaffDirectory, firebaseEnsureBadgeAccount, badgeAuthEmail, normalizeStaffPin } from '../../lib/firebase';
import { emitLiveAction } from '../../lib/liveActions';
import { StaffIdCardView } from './StaffIdCardView';
import type { StaffCardRecord } from '@medcore/types';
import type { UserSession } from '../auth/AuthScreen';

const ROLE_OPTIONS = [
  // Clinical specialties — each maps to a scoped desk (not one shared unlimited doctor menu)
  { roleKey: 'doctor', role: 'Medical Officer', title: 'Medical Officer (General / OPD)', shortRole: 'Doctor', clearanceLevel: 4, clearanceLabel: 'L4 Clinical', department: 'Internal Medicine', group: 'Clinical' },
  { roleKey: 'surgeon', role: 'Consultant Surgeon', title: 'Consultant Surgeon', shortRole: 'Surgeon', clearanceLevel: 5, clearanceLabel: 'L5 Surgery', department: 'Surgery & Theatre', group: 'Clinical' },
  { roleKey: 'radiologist', role: 'Radiologist', title: 'Consultant Radiologist', shortRole: 'Radiology', clearanceLevel: 5, clearanceLabel: 'L5 Radiology', department: 'Radiology', group: 'Clinical' },
  { roleKey: 'lab', role: 'Lab Scientist', title: 'Lab Scientist / Pathologist', shortRole: 'Lab', clearanceLevel: 3, clearanceLabel: 'L3 Lab', department: 'Pathology', group: 'Clinical' },
  { roleKey: 'pharmacist', role: 'Pharmacist', title: 'Pharmacist', shortRole: 'Pharmacist', clearanceLevel: 3, clearanceLabel: 'L3 Pharmacy', department: 'Pharmacy', group: 'Clinical' },
  { roleKey: 'medical_director', role: 'Medical Director', title: 'Medical Director', shortRole: 'Director', clearanceLevel: 5, clearanceLabel: 'L5 Director', department: 'Clinical Directorate', group: 'Clinical' },
  // Nursing
  { roleKey: 'nurse', role: 'Nursing Officer', title: 'Nursing Officer', shortRole: 'Nurse', clearanceLevel: 3, clearanceLabel: 'L3 Nursing', department: 'Inpatient Wards', group: 'Nursing' },
  { roleKey: 'midwife', role: 'Midwife', title: 'Midwife / Labour Ward', shortRole: 'Midwife', clearanceLevel: 3, clearanceLabel: 'L3 Midwifery', department: 'Maternity', group: 'Nursing' },
  // Front desk & records
  { roleKey: 'reception', role: 'Reception / Front Desk', title: 'Reception Officer', shortRole: 'Reception', clearanceLevel: 2, clearanceLabel: 'L2 Front Desk', department: 'Patient Reception', group: 'Front desk' },
  { roleKey: 'records', role: 'Records Officer', title: 'Health Records Officer', shortRole: 'Records', clearanceLevel: 2, clearanceLabel: 'L2 Records', department: 'Medical Records', group: 'Front desk' },
  // Support
  { roleKey: 'accountant', role: 'Finance Officer', title: 'Finance / Accounts Officer', shortRole: 'Accounts', clearanceLevel: 3, clearanceLabel: 'L3 Finance', department: 'Billing & Finance', group: 'Support' },
  { roleKey: 'biomedical', role: 'Biomedical Engineer', title: 'Biomedical Engineer', shortRole: 'Biomed', clearanceLevel: 3, clearanceLabel: 'L3 Biomed', department: 'Clinical Engineering', group: 'Support' },
  // Admin
  { roleKey: 'hospital_admin', role: 'Hospital Administrator', title: 'Hospital Administrator', shortRole: 'Admin', clearanceLevel: 5, clearanceLabel: 'L5 Executive', department: 'Administration', group: 'Admin' },
  { roleKey: 'sysadmin', role: 'ICT / System Admin', title: 'System Administrator', shortRole: 'SysAdmin', clearanceLevel: 6, clearanceLabel: 'L6 SysAdmin', department: 'ICT', group: 'Admin' },
]

interface Props {
  session?: UserSession;
}

export const StaffEnrolment: React.FC<Props> = ({ session }) => {
  const [fullName, setFullName] = useState('');
  const [roleKey, setRoleKey] = useState('');
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
  const canDeleteStaff =
    !session || // enrolment module is admin-facing
    session.roleKey === 'hospital_admin' ||
    session.roleKey === 'sysadmin' ||
    (session.clearanceLevel ?? 0) >= 5 ||
    (session.permissions || []).some((p) =>
      ['admin', 'enrolment', 'rbac', 'staff'].includes(String(p).toLowerCase())
    );


  useEffect(() => {
    if (session?.hospitalId) setFacilityId(session.hospitalId);
  }, [session?.hospitalId]);

  const roleMeta = useMemo(
    () => ROLE_OPTIONS.find((r) => r.roleKey === roleKey),
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
    if (!roleKey || !roleMeta) {
      setError('Select a specialty / role — this locks which desk and modules they can open.');
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
        permissions: defaultPermissionsForRole(roleMeta.roleKey),
      });

      // Never hang the UI on slow/blocked Firebase — local card is already issued
      const withTimeout = <T,>(p: Promise<T>, ms = 8000): Promise<T> =>
        Promise.race([
          p,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
          ),
        ]);

      // Firebase Auth account for badge + PIN (same system as email/password)
      const pinNorm = normalizeStaffPin(pin);
      try {
        await withTimeout(firebaseEnsureBadgeAccount(card.badgeId, pinNorm), 8000);
      } catch (err: any) {
        console.warn('[enrol] badge Firebase Auth', err);
        setError(
          `Card issued locally. Cloud login setup pending: ${err?.message || err?.code || 'network/timeout'}. Staff can still use badge + PIN on this device.`
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
        await withTimeout(firestoreUpsertStaffMember(facility.id, enriched), 8000);
        await withTimeout(
          firestorePushStaffDirectory(facility.id, {
            staffCards: JSON.parse(localStorage.getItem('medcore_staff_id_cards') || '[]'),
            staffRegistry: Array.isArray(reg)
              ? reg.map((r: any) =>
                  String(r.badgeId || '').toUpperCase() === card.badgeId.toUpperCase() ? enriched : r
                )
              : [enriched],
          }),
          8000
        );
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
            await withTimeout(firebaseSignUp(mail, pin || '123456'), 8000);
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
    } catch (err: any) {
      console.error('[enrol] fatal', err);
      setError(err?.message || 'Enrolment failed. Please try again.');
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
                required
              >
                <option value="">Select specialty / role *</option>
                {['Clinical', 'Nursing', 'Front desk', 'Support', 'Admin'].map((g) => (
                  <optgroup key={g} label={g}>
                    {ROLE_OPTIONS.filter((r) => (r as { group?: string }).group === g).map((r) => (
                      <option key={r.roleKey} value={r.roleKey}>
                        {r.title} · {r.department}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {roleMeta && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#0369A1', background: '#E0F2FE', borderRadius: 8, padding: '8px 10px', lineHeight: 1.45 }}>
                  <strong>{roleMeta.shortRole}</strong> desk only — modules outside this specialty stay locked
                  (e.g. radiologists get imaging, surgeons get theatre, reception gets front desk).
                </div>
              )}
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
              <div key={c.badgeId} style={{ position: 'relative' }}>
                <div
                  onClick={() => setIssued(getStaffCard(c.badgeId) || c)}
                  style={{ cursor: 'pointer' }}
                >
                  <StaffIdCardView card={c} compact />
                </div>
                {canDeleteStaff && (
                  <button
                    type="button"
                    title="Delete staff user"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      const ok = window.confirm(
                        `Delete staff ${c.fullName || c.badgeId}?\n\nBadge: ${c.badgeId}\n\nThey will no longer be able to sign in. This cannot be undone.`
                      );
                      if (!ok) return;
                      const done = deleteStaffMember(c.badgeId);
                      if (done) {
                        setCards(listStaffCards());
                        if (issued?.badgeId === c.badgeId) setIssued(null);
                        if (pendingConfirm?.card.badgeId === c.badgeId) setPendingConfirm(null);
                        try {
                          pushActivity(`Deleted staff · ${c.badgeId} · ${c.fullName || ''}`);
                        } catch { /* ignore */ }
                      } else {
                        window.alert('Could not delete this staff member. Try again.');
                      }
                    }}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      zIndex: 2,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid #FECACA',
                      background: '#FEF2F2',
                      color: '#B91C1C',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffEnrolment;
