'use client';

/**
 * Staff Access Control — create accounts (issues ID card + Firebase auth) and manage access.
 * Enrolment is merged here: creating an account auto-generates the staff ID card.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getAccessRecords,
  setAccessRecords,
  approveAccess,
  suspendAccess,
  reactivateAccess,
  subscribeAdminSync,
  pushActivity,
  resetAllPilotData,
  type AccessRecord,
} from '../../lib/adminRealtimeStore';
import {
  enrolStaffAndIssueCard,
  listStaffCards,
  getStaffCard,
  deleteStaffMember,
} from '../../lib/staffCardStore';
import {
  firebaseEnsureEmailAccount,
  isEmailCredential,
  firestoreUpsertStaffMember,
  firestorePushStaffDirectory,
  firebaseEnsureBadgeAccount,
  badgeAuthEmail,
  normalizeStaffPin,
} from '../../lib/firebase';
import { emitLiveAction } from '../../lib/liveActions';
import { StaffIdCardView } from '../staffing/StaffIdCardView';
import { LogoProgressBar } from '../realtime/LogoProgressBar';
import type { StaffCardRecord } from '@medcore/types';
import type { UserSession } from '../auth/AuthScreen';
import { HOSPITALS } from '../auth/AuthScreen';
import {
  Shield, Plus, Search, CheckCircle2, XCircle, Lock, UserPlus, IdCard, Trash2,
} from 'lucide-react';

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

const CLEARANCE_LABELS: Record<number, { label: string; color: string }> = {
  6: { label: 'L6 — SysAdmin', color: '#0F172A' },
  5: { label: 'L5 — Executive', color: '#EA580C' },
  4: { label: 'L4 — Senior Clinical', color: '#F59E0B' },
  3: { label: 'L3 — Clinical', color: '#16A34A' },
  2: { label: 'L2 — Support', color: '#0066FF' },
  1: { label: 'L1 — Restricted', color: '#64748B' },
};

const STATUS_META = {
  active: { label: 'Active', color: '#16A34A' },
  suspended: { label: 'Suspended', color: '#EF4444' },
  pending: { label: 'Pending', color: '#EA580C' },
};

interface Props {
  session?: UserSession;
}

export const AccessControl: React.FC<Props> = ({ session }) => {
  const [records, setRecords] = useState<AccessRecord[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [issued, setIssued] = useState<StaffCardRecord | null>(null);
  const [confirmInfo, setConfirmInfo] = useState<{
    badgeId: string;
    name: string;
    role: string;
    pin: string;
    email?: string;
    firebaseAuth: 'ok' | 'fail' | 'skipped';
    firestore: 'ok' | 'fail';
    emailAuth?: 'ok' | 'fail' | 'skipped';
  } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [fullName, setFullName] = useState('');
  const [roleKey, setRoleKey] = useState('doctor');
  const [pin, setPin] = useState('123456');
  const [email, setEmail] = useState('');

  const facilityId = session?.hospitalId || HOSPITALS[0]?.id || 'IGH-EKT';
  const facilityName = session?.facility || HOSPITALS.find((h) => h.id === facilityId)?.name || 'Hospital';

  const roleMeta = useMemo(
    () => ROLE_OPTIONS.find((r) => r.roleKey === roleKey) || ROLE_OPTIONS[0],
    [roleKey]
  );

  const reload = useCallback(() => {
    setRecords(getAccessRecords());
  }, []);

  useEffect(() => {
    reload();
    return subscribeAdminSync(reload);
  }, [reload]);

  const filtered = records.filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.role.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase())
  );

  const selected = records.find((r) => r.id === selectedId) || null;
  const selectedCard = selectedId ? getStaffCard(selectedId) : undefined;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim()) {
      setError('Enter staff full name.');
      return;
    }
    if (roleMeta.roleKey === 'hospital_admin') {
      const existing = listStaffCards().filter(
        (c) =>
          c.facilityId === facilityId &&
          (c.roleKey === 'hospital_admin' || (c.role || '').toLowerCase().includes('administrator'))
      );
      if (existing.length > 0) {
        setError(`This hospital already has an administrator (${existing[0].fullName || existing[0].badgeId}).`);
        return;
      }
    }

    setBusy(true);
    setConfirmInfo(null);
    let firebaseAuth: 'ok' | 'fail' | 'skipped' = 'skipped';
    let firestoreStatus: 'ok' | 'fail' = 'fail';
    let emailAuth: 'ok' | 'fail' | 'skipped' = 'skipped';
    try {
      const pinNorm = normalizeStaffPin(pin);
      const nameSnap = fullName.trim();
      const mail = email.trim();
      const { card } = enrolStaffAndIssueCard({
        fullName: nameSnap,
        role: roleMeta.role,
        roleKey: roleMeta.roleKey,
        title: roleMeta.title,
        department: roleMeta.department,
        facilityId,
        facilityName,
        clearanceLevel: roleMeta.clearanceLevel,
        clearanceLabel: roleMeta.clearanceLabel,
        pin: pinNorm,
        shortRole: roleMeta.shortRole,
        permissions: ['dashboard'],
      });

      try {
        const authRes = await firebaseEnsureBadgeAccount(card.badgeId, pinNorm);
        firebaseAuth = authRes?.email ? 'ok' : 'fail';
      } catch (err: any) {
        console.warn('[access] badge auth', err);
        firebaseAuth = 'fail';
        // Still keep local + Firestore so badge PIN login can migrate on first sign-in
      }

      if (mail && isEmailCredential(mail)) {
        try {
          await firebaseEnsureEmailAccount(mail, pinNorm);
          emailAuth = 'ok';
        } catch (err: any) {
          console.warn('[access] email auth', err);
          emailAuth = 'fail';
        }
      }

      const accessRow: AccessRecord = {
        id: card.badgeId,
        name: nameSnap,
        role: roleMeta.role,
        department: roleMeta.department,
        clearance: roleMeta.clearanceLevel,
        status: 'active',
        lastLogin: 'Never',
        permissions: ['dashboard', roleMeta.roleKey],
      };
      const nextAccess = [accessRow, ...getAccessRecords().filter((r) => r.id !== card.badgeId)];
      setAccessRecords(nextAccess);
      setRecords(nextAccess);

      try {
        const fsOk = await firestoreUpsertStaffMember(facilityId, {
          badgeId: card.badgeId,
          name: nameSnap,
          role: roleMeta.role,
          roleKey: roleMeta.roleKey,
          title: roleMeta.title,
          department: roleMeta.department,
          pin: pinNorm,
          authEmail: badgeAuthEmail(card.badgeId),
          hospitalId: facilityId,
          hospitalName: facilityName,
          clearanceLevel: roleMeta.clearanceLevel,
          clearanceLabel: roleMeta.clearanceLabel,
          permissions: accessRow.permissions,
          status: 'active',
        });
        const dirOk = await firestorePushStaffDirectory(facilityId, {
          staffCards: listStaffCards(),
          staffRegistry: JSON.parse(localStorage.getItem('medcore_os_staff_registry') || '[]'),
        });
        firestoreStatus = fsOk && dirOk !== false ? 'ok' : fsOk ? 'ok' : 'fail';
        // Verify read-back from Firestore
        try {
          const { firestoreGetStaffByBadge } = await import('../../lib/firebase');
          const remote = await firestoreGetStaffByBadge(facilityId, card.badgeId);
          firestoreStatus = remote && remote.badgeId ? 'ok' : 'fail';
        } catch {
          firestoreStatus = fsOk ? 'ok' : 'fail';
        }
      } catch (err) {
        console.warn('[access] firestore', err);
        firestoreStatus = 'fail';
      }

      pushActivity(`Account created · ${nameSnap} · ${card.badgeId} · ID card issued`);
      emitLiveAction(`Account + ID card · ${card.badgeId}`, { module: 'access' });
      setIssued(card);
      setSelectedId(card.badgeId);
      setConfirmInfo({
        badgeId: card.badgeId,
        name: nameSnap,
        role: roleMeta.role,
        pin: pinNorm,
        email: mail || undefined,
        firebaseAuth,
        firestore: firestoreStatus,
        emailAuth,
      });
      setFullName('');
      setEmail('');
      setShowCreate(false);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (badgeId: string, name: string) => {
    const id = String(badgeId || '').toUpperCase();
    if (id === 'AKS-ADM-001' || id.includes('ADM-001')) {
      setError('Cannot delete the platform administrator bootstrap account.');
      return;
    }
    const ok = window.confirm(
      `Delete staff account permanently?\n\n${name}\nBadge: ${id}\n\nThis removes access, ID card, and Firestore profile. They will not be able to sign in.`
    );
    if (!ok) return;

    setBusy(true);
    setError('');
    try {
      deleteStaffMember(id);
      const next = getAccessRecords().filter((r) => String(r.id).toUpperCase() !== id);
      setAccessRecords(next);
      setRecords(next);
      if (selectedId && String(selectedId).toUpperCase() === id) {
        setSelectedId(null);
        setIssued(null);
      }
      if (confirmInfo?.badgeId?.toUpperCase() === id) setConfirmInfo(null);

      // Extra firestore delete with session facility
      try {
        const { firestoreDeleteStaffMember, firestorePushStaffDirectory } = await import('../../lib/firebase');
        await firestoreDeleteStaffMember(facilityId, id);
        await firestorePushStaffDirectory(facilityId, {
          staffCards: listStaffCards(),
          staffRegistry: JSON.parse(localStorage.getItem('medcore_os_staff_registry') || '[]'),
        });
      } catch (e) {
        console.warn('[access] delete cloud', e);
      }

      pushActivity(`Account deleted · ${name} · ${id}`);
      emitLiveAction(`Deleted staff ${id}`, { module: 'access' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="os-module-layout" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="os-insight-banner">
        <Shield size={18} style={{ color: '#0066FF', flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.88rem', marginBottom: 4 }}>
            Staff Access Control · Accounts & ID cards
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: 1.55 }}>
            Create a staff account here to grant access and <strong>automatically issue</strong> their vertical staff ID card
            (badge + PIN for Firebase login). Suspend or reactivate accounts without a separate enrolment screen.
          </div>
        </div>
      </div>

      <div className="os-metrics-ribbon">
        <div className="metric-box alert-green">
          <span className="metric-label">Active</span>
          <span className="metric-val">{records.filter((r) => r.status === 'active').length}</span>
          <span className="metric-sub">Can sign in</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Suspended</span>
          <span className="metric-val">{records.filter((r) => r.status === 'suspended').length}</span>
          <span className="metric-sub">Blocked</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">ID cards</span>
          <span className="metric-val">{listStaffCards().length}</span>
          <span className="metric-sub">Issued with accounts</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div
          style={{
            flex: 1,
            minWidth: 180,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: 999,
            padding: '8px 14px',
          }}
        >
          <Search size={15} color="#94A3B8" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, role, or badge ID…"
            style={{ border: 'none', outline: 'none', flex: 1, fontSize: '0.88rem' }}
          />
        </div>
        <button
          type="button"
          className="os-primary-btn"
          onClick={() => {
            setShowCreate((v) => !v);
            setError('');
            setIssued(null);
            setConfirmInfo(null);
          }}
        >
          <UserPlus size={16} /> {showCreate ? 'Close form' : 'Create staff account'}
        </button>
        <button
          type="button"
          className="os-ghost-btn"
          style={{ color: '#B91C1C', borderColor: 'rgba(185,28,28,0.35)', fontSize: 13 }}
          onClick={async () => {
            const ok = window.confirm(
              `Reset all staff / access / cards for this hospital (${facilityName})?\n\nClears local data and cloud staff directory for ${facilityId}. Admin must sign in again if session keys are wiped.`
            );
            if (!ok) return;
            try {
              // Clear facility cloud store
              const { firestoreWriteFacility } = await import('../../lib/firebase');
              await firestoreWriteFacility(facilityId, {
                staffCards: [],
                staffRegistry: [],
                transferInbox: {},
                resetAt: new Date().toISOString(),
              });
            } catch (e) {
              console.warn('[access] cloud reset', e);
            }
            resetAllPilotData();
            setRecords([]);
            setIssued(null);
            setConfirmInfo(null);
            setSelectedId(null);
            setError('');
            pushActivity(`Facility data reset · ${facilityId}`);
            window.alert('Reset complete. Page will reload.');
            window.location.reload();
          }}
        >
          Reset facility data
        </button>
      </div>

      {showCreate && (
        <form className="os-panel" onSubmit={handleCreate} style={{ padding: 18 }}>
          <div style={{ fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IdCard size={18} color="#0052D4" /> New account · ID card auto-generated
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
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
              <div
                className="os-form-select"
                style={{ marginTop: 6, padding: '10px 12px', background: '#F8FAFC' }}
              >
                {facilityName} · locked
              </div>
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
              PIN (min 6 characters)
              <input
                className="os-search-input"
                style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px' }}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={12}
              />
            </label>
          </div>
          {error && (
            <div style={{ marginTop: 12, color: '#B91C1C', fontSize: '0.84rem', fontWeight: 600 }}>{error}</div>
          )}
          <button type="submit" disabled={busy} className="os-action-btn-primary" style={{ marginTop: 14 }}>
            <Plus size={16} /> {busy ? 'Creating…' : 'Create account & issue ID card'}
          </button>
          <LogoProgressBar active={busy} label="Creating account, Firebase login & ID card…" />
        </form>
      )}

      {confirmInfo && (
        <div
          className="os-card"
          style={{
            padding: 20,
            border: '1px solid #86EFAC',
            background: 'linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 50%, #F0F9FF 100%)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#047857', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={20} /> Account created successfully
              </div>
              <div style={{ marginTop: 10, fontSize: '0.88rem', color: '#0F172A', lineHeight: 1.6 }}>
                <div><strong>Name:</strong> {confirmInfo.name}</div>
                <div><strong>Role:</strong> {confirmInfo.role}</div>
                <div>
                  <strong>Badge ID:</strong>{' '}
                  <span style={{ fontFamily: 'var(--os-font-mono)', fontWeight: 800, color: '#0052D4' }}>
                    {confirmInfo.badgeId}
                  </span>
                </div>
                <div><strong>PIN:</strong> {confirmInfo.pin} <span style={{ color: '#64748B' }}>(give this to the staff member)</span></div>
                {confirmInfo.email && <div><strong>Email:</strong> {confirmInfo.email}</div>}
              </div>
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: confirmInfo.firebaseAuth === 'ok' ? '#16A34A' : confirmInfo.firebaseAuth === 'fail' ? '#EF4444' : '#94A3B8',
                  }} />
                  <strong>Firebase Auth (badge login):</strong>{' '}
                  {confirmInfo.firebaseAuth === 'ok' ? 'Stored — can Sign in with ID No.' :
                    confirmInfo.firebaseAuth === 'fail' ? 'Failed — check Email/Password provider in Firebase Console' : 'Skipped'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: confirmInfo.firestore === 'ok' ? '#16A34A' : '#EF4444',
                  }} />
                  <strong>Firestore profile:</strong>{' '}
                  {confirmInfo.firestore === 'ok' ? 'Saved & verified on cloud' : 'Not verified — local card exists; cloud sync failed (check rules/network)'}
                </div>
                {confirmInfo.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: confirmInfo.emailAuth === 'ok' ? '#16A34A' : confirmInfo.emailAuth === 'fail' ? '#EF4444' : '#94A3B8',
                    }} />
                    <strong>Email login:</strong>{' '}
                    {confirmInfo.emailAuth === 'ok' ? 'Firebase email account ready' :
                      confirmInfo.emailAuth === 'fail' ? 'Email Auth failed' : 'Not used'}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="os-ghost-btn"
                style={{ marginTop: 14, fontSize: 12 }}
                onClick={() => setConfirmInfo(null)}
              >
                Dismiss
              </button>
            </div>
            {issued && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 8 }}>Staff ID card</div>
                <StaffIdCardView card={issued} compact />
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 320px)', gap: 16 }}>
        <div className="os-table-wrap">
          <table className="os-table">
            <thead>
              <tr>
                <th>Badge ID</th>
                <th>Name</th>
                <th>Role</th>
                <th>Clearance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 28, color: '#64748B' }}>
                    No staff accounts yet. Use <strong>Create staff account</strong> — ID card is issued automatically.
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const st = STATUS_META[r.status] || STATUS_META.pending;
                const cl = CLEARANCE_LABELS[r.clearance] || CLEARANCE_LABELS[2];
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    style={{ cursor: 'pointer', background: selectedId === r.id ? 'rgba(0,82,212,0.06)' : undefined }}
                  >
                    <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.78rem' }}>{r.id}</td>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td>{r.role}</td>
                    <td>
                      <span style={{ color: cl.color, fontWeight: 700, fontSize: '0.78rem' }}>{cl.label}</span>
                    </td>
                    <td>
                      <span style={{ color: st.color, fontWeight: 700, fontSize: '0.78rem' }}>{st.label}</span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {r.status === 'suspended' ? (
                          <button type="button" className="os-ghost-btn" style={{ fontSize: 12 }} onClick={() => { reactivateAccess(r.id); reload(); }}>
                            <CheckCircle2 size={12} /> Reactivate
                          </button>
                        ) : r.status === 'pending' ? (
                          <button type="button" className="os-ghost-btn" style={{ fontSize: 12 }} onClick={() => { approveAccess(r.id); reload(); }}>
                            Approve
                          </button>
                        ) : (
                          <button type="button" className="os-ghost-btn" style={{ fontSize: 12, color: '#B91C1C' }} onClick={() => { suspendAccess(r.id); reload(); }}>
                            <XCircle size={12} /> Suspend
                          </button>
                        )}
                        <button
                          type="button"
                          className="os-ghost-btn"
                          style={{ fontSize: 12, color: '#991B1B', borderColor: 'rgba(185,28,28,0.35)' }}
                          disabled={busy}
                          onClick={() => handleDelete(r.id, r.name)}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="os-card" style={{ padding: 16 }}>
          {!selected ? (
            <div style={{ color: '#64748B', fontSize: '0.88rem', textAlign: 'center', padding: 24 }}>
              Select a staff row to view access details and ID card.
            </div>
          ) : (
            <>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>{selected.name}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: 12 }}>
                {selected.role} · {selected.department}
              </div>
              <div style={{ fontSize: '0.78rem', marginBottom: 8 }}>
                <strong>Badge:</strong>{' '}
                <span style={{ fontFamily: 'var(--os-font-mono)' }}>{selected.id}</span>
              </div>
              <div style={{ fontSize: '0.78rem', marginBottom: 12 }}>
                <strong>Last login:</strong> {selected.lastLogin}
              </div>
              {selectedCard ? (
                <StaffIdCardView card={selectedCard} compact />
              ) : (
                <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>No ID card on file for this account.</div>
              )}
              <button
                type="button"
                className="os-ghost-btn"
                style={{ marginTop: 14, width: '100%', color: '#991B1B', borderColor: 'rgba(185,28,28,0.4)', fontSize: 13 }}
                disabled={busy}
                onClick={() => handleDelete(selected.id, selected.name)}
              >
                <Trash2 size={14} /> Delete account permanently
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccessControl;
