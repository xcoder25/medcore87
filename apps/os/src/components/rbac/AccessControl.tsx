'use client';

/**
 * Staff Access Control — create accounts (issues ID card + sign-in) and manage access.
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
  defaultPermissionsForRole,
} from '../../lib/staffCardStore';
import {
  isEmailCredential,
  badgeAuthEmail,
  normalizeStaffPin,
  ensureStaffCloudIdentity,
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
  // Clinical specialties — each maps to a scoped desk
  { roleKey: 'doctor', role: 'Medical Officer', title: 'Medical Officer (General / OPD)', shortRole: 'Doctor', clearanceLevel: 4, clearanceLabel: 'L4 Clinical', department: 'Internal Medicine', group: 'Clinical' },
  { roleKey: 'surgeon', role: 'Consultant Surgeon', title: 'Consultant Surgeon', shortRole: 'Surgeon', clearanceLevel: 5, clearanceLabel: 'L5 Surgery', department: 'Surgery & Theatre', group: 'Clinical' },
  { roleKey: 'radiologist', role: 'Radiologist', title: 'Consultant Radiologist', shortRole: 'Radiology', clearanceLevel: 5, clearanceLabel: 'L5 Radiology', department: 'Radiology', group: 'Clinical' },
  { roleKey: 'lab', role: 'Lab Scientist', title: 'Lab Scientist / Pathologist', shortRole: 'Lab', clearanceLevel: 3, clearanceLabel: 'L3 Lab', department: 'Pathology', group: 'Clinical' },
  { roleKey: 'pharmacist', role: 'Pharmacist', title: 'Pharmacist', shortRole: 'Pharmacist', clearanceLevel: 3, clearanceLabel: 'L3 Pharmacy', department: 'Pharmacy', group: 'Clinical' },
  { roleKey: 'medical_director', role: 'Medical Director', title: 'Medical Director', shortRole: 'Director', clearanceLevel: 5, clearanceLabel: 'L5 Director', department: 'Clinical Directorate', group: 'Clinical' },
  { roleKey: 'nurse', role: 'Nursing Officer', title: 'Nursing Officer', shortRole: 'Nurse', clearanceLevel: 3, clearanceLabel: 'L3 Nursing', department: 'Inpatient Wards', group: 'Nursing' },
  { roleKey: 'midwife', role: 'Midwife', title: 'Midwife / Labour Ward', shortRole: 'Midwife', clearanceLevel: 3, clearanceLabel: 'L3 Midwifery', department: 'Maternity', group: 'Nursing' },
  { roleKey: 'reception', role: 'Reception / Front Desk', title: 'Reception Officer', shortRole: 'Reception', clearanceLevel: 2, clearanceLabel: 'L2 Front Desk', department: 'Patient Reception', group: 'Front desk' },
  { roleKey: 'records', role: 'Records Officer', title: 'Health Records Officer', shortRole: 'Records', clearanceLevel: 2, clearanceLabel: 'L2 Records', department: 'Medical Records', group: 'Front desk' },
  { roleKey: 'accountant', role: 'Finance Officer', title: 'Finance / Accounts Officer', shortRole: 'Accounts', clearanceLevel: 3, clearanceLabel: 'L3 Finance', department: 'Billing & Finance', group: 'Support' },
  { roleKey: 'biomedical', role: 'Biomedical Engineer', title: 'Biomedical Engineer', shortRole: 'Biomed', clearanceLevel: 3, clearanceLabel: 'L3 Biomed', department: 'Clinical Engineering', group: 'Support' },
  { roleKey: 'hospital_admin', role: 'Hospital Administrator', title: 'Hospital Administrator', shortRole: 'Admin', clearanceLevel: 5, clearanceLabel: 'L5 Executive', department: 'Administration', group: 'Admin' },
  { roleKey: 'sysadmin', role: 'ICT / System Admin', title: 'System Administrator', shortRole: 'SysAdmin', clearanceLevel: 6, clearanceLabel: 'L6 SysAdmin', department: 'ICT', group: 'Admin' },
]

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
    accessRow: AccessRecord;
    listed: boolean;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ badgeId: string; name: string } | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [fullName, setFullName] = useState('');
  const [roleKey, setRoleKey] = useState('');
  const [pin, setPin] = useState('123456');
  const [email, setEmail] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string>('');

  const facilityId = session?.hospitalId || HOSPITALS[0]?.id || 'IGH-EKT';
  const facilityName = session?.facility || HOSPITALS.find((h) => h.id === facilityId)?.name || 'Hospital';

  const roleMeta = useMemo(
    () => ROLE_OPTIONS.find((r) => r.roleKey === roleKey),
    [roleKey]
  );

  const reload = useCallback(() => {
    // Never refresh list over a pending confirmation (keeps "confirm first" UX)
    setRecords(getAccessRecords());
  }, []);

  useEffect(() => {
    reload();
    return subscribeAdminSync(() => {
      // Skip live reload while creating or while confirmation awaits "add to list"
      // (prevents row appearing before confirmation)
    });
  }, [reload]);

  // Refresh list only when not in confirmation-pending state
  useEffect(() => {
    if (busy) return;
    if (confirmInfo && !confirmInfo.listed) return;
    reload();
  }, [busy, confirmInfo, reload]);

  const filtered = records.filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.role.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase())
  );

  const selected = records.find((r) => r.id === selectedId) || null;
  const selectedCard = selectedId ? getStaffCard(selectedId) : undefined;

  const readPhotoFile = (file: File | null) => {
    if (!file) {
      setPhotoUrl('');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Photo must be an image (JPG or PNG).');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('Photo must be under 4 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || '');
      // Compress via canvas for storage size
      const img = new Image();
      img.onload = () => {
        const max = 480;
        let w = img.width;
        let h = img.height;
        if (w > max || h > max) {
          const scale = max / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setPhotoUrl(data);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        setPhotoUrl(canvas.toDataURL('image/jpeg', 0.82));
        setError('');
      };
      img.onerror = () => setPhotoUrl(data);
      img.src = data;
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = async (e: React.FormEvent) => {
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

    const withTimeout = async <T,>(p: Promise<T>, ms: number, label: string): Promise<T> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          p,
          new Promise<T>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    };

    setBusy(true);
    setConfirmInfo(null);
    setError('');

    let firebaseAuth: 'ok' | 'fail' | 'skipped' = 'skipped';
    let firestoreStatus: 'ok' | 'fail' = 'fail';
    let emailAuth: 'ok' | 'fail' | 'skipped' = 'skipped';
    let card: StaffCardRecord | null = null;
    let accessRow: AccessRecord | null = null;
    const pinNorm = normalizeStaffPin(pin);
    const nameSnap = fullName.trim();
    const mail = email.trim();

    try {
      const issued = enrolStaffAndIssueCard({
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
        permissions: defaultPermissionsForRole(roleMeta.roleKey),
        photoUrl: photoUrl || undefined,
        email: mail || undefined,
      });
      card = issued.card;

      accessRow = {
        id: card.badgeId,
        name: nameSnap,
        role: roleMeta.role,
        department: roleMeta.department,
        clearance: roleMeta.clearanceLevel,
        status: 'active',
        lastLogin: 'Never',
        permissions: defaultPermissionsForRole(roleMeta.roleKey),
        email: mail || undefined,
      };

      // Cloud identity: badge Auth + optional email Auth + Firestore (retries)
      try {
        const cloud = await ensureStaffCloudIdentity({
          facilityId,
          badgeId: card.badgeId,
          pin: pinNorm,
          email: mail || undefined,
          profile: {
            badgeId: card.badgeId,
            name: nameSnap,
            role: roleMeta.role,
            roleKey: roleMeta.roleKey,
            title: roleMeta.title,
            department: roleMeta.department,
            hospitalId: facilityId,
            hospitalName: facilityName,
            clearanceLevel: roleMeta.clearanceLevel,
            clearanceLabel: roleMeta.clearanceLabel,
            permissions: accessRow.permissions,
            email: mail || undefined,
            authEmail: badgeAuthEmail(card.badgeId),
            status: 'active',
          },
        });
        firebaseAuth = cloud.badgeAuth ? 'ok' : 'fail';
        emailAuth = mail ? (cloud.emailAuth ? 'ok' : 'fail') : 'skipped';
        firestoreStatus = cloud.firestore ? 'ok' : 'fail';
        // Background retry if anything failed (network blip)
        if (!cloud.badgeAuth || (mail && !cloud.emailAuth) || !cloud.firestore) {
          window.setTimeout(() => {
            void ensureStaffCloudIdentity({
              facilityId,
              badgeId: card.badgeId,
              pin: pinNorm,
              email: mail || undefined,
              profile: {
                badgeId: card.badgeId,
                name: nameSnap,
                role: roleMeta.role,
                roleKey: roleMeta.roleKey,
                title: roleMeta.title,
                department: roleMeta.department,
                hospitalId: facilityId,
                hospitalName: facilityName,
                clearanceLevel: roleMeta.clearanceLevel,
                clearanceLabel: roleMeta.clearanceLabel,
                permissions: accessRow?.permissions || [],
                email: mail || undefined,
                authEmail: badgeAuthEmail(card.badgeId),
                status: 'active',
              },
            });
          }, 2500);
        }
      } catch (err) {
        console.warn('[access] cloud identity', err);
        firebaseAuth = 'fail';
        if (mail) emailAuth = 'fail';
        firestoreStatus = 'fail';
      }

            pushActivity(`Account created · ${nameSnap} · ${card.badgeId} · ID card issued`);
      emitLiveAction(`Account + ID card · ${card.badgeId}`, { module: 'access' });
    } catch (err: any) {
      console.error('[access] create failed', err);
      setError(err?.message || 'Account creation failed.');
    } finally {
      setBusy(false);
      // Always show confirmation when we have a card — before listing in table
      if (card && accessRow) {
        setIssued(card);
        setShowCreate(false);
        setConfirmInfo({
          badgeId: card.badgeId,
          name: nameSnap,
          role: roleMeta.role,
          pin: pinNorm,
          email: mail || undefined,
          firebaseAuth,
          firestore: firestoreStatus,
          emailAuth,
          accessRow,
          listed: false,
        });
        setFullName('');
        setEmail('');
        setPhotoUrl('');
        setSelectedId(null);
        // IMPORTANT: do not setRecords / setAccessRecords here — wait for Confirm button
        setTimeout(() => {
          document.getElementById('staff-create-confirm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
      }
    }
  };

  const handleDelete = async (badgeId: string, name: string) => {
    const id = String(badgeId || '').toUpperCase();
    if (id === 'AKS-ADM-001' || id.includes('ADM-001')) {
      setError('This main administrator account cannot be removed.');
      return;
    }
    setDeleteSuccess(null);
    setDeleteTarget({ badgeId: id, name });
  };

  const confirmDeleteStaff = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.badgeId;
    const name = deleteTarget.name;
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

      try {
        const { firestoreDeleteStaffMember, firestorePushStaffDirectory } = await import('../../lib/firebase');
        await firestoreDeleteStaffMember(facilityId, id);
        await firestorePushStaffDirectory(facilityId, {
          staffCards: listStaffCards(),
          staffRegistry: JSON.parse(localStorage.getItem('medcore_os_staff_registry') || '[]'),
        });
      } catch {
        /* cloud sync best-effort — local removal already done */
      }

      pushActivity(`Account deleted · ${name} · ${id}`);
      emitLiveAction(`Deleted staff ${id}`, { module: 'access' });
      setDeleteTarget(null);
      setDeleteSuccess(`${name} was removed. They can no longer sign in.`);
      setTimeout(() => setDeleteSuccess(null), 5000);
    } catch {
      setError('Could not remove this staff member. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <div className="os-module-layout" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="os-insight-banner">
        <Shield size={18} style={{ color: '#0066FF', flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.88rem', marginBottom: 4 }}>
            Staff Access Control · Accounts & ID cards
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: 1.55 }}>
            Create a staff account here to grant access and <strong>automatically issue</strong> their vertical staff ID card
            (badge + PIN for sign-in). Suspend or reactivate accounts without a separate enrolment screen.
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
                  <strong>{roleMeta.shortRole}</strong> desk only — modules outside this specialty stay locked.
                </div>
              )}
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

            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', gridColumn: '1 / -1' }}>
              Staff photo (for ID card)
              <div
                style={{
                  marginTop: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  flexWrap: 'wrap',
                  padding: 12,
                  borderRadius: 12,
                  border: '1px dashed #CBD5E1',
                  background: '#F8FAFC',
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 14,
                    overflow: 'hidden',
                    background: 'linear-gradient(145deg, #E0F2FE, #ECFDF5)',
                    border: '2px solid #0052D4',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {photoUrl ? (
                    <img src={photoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textAlign: 'center', padding: 4 }}>
                      No photo
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    onChange={(e) => readPhotoFile(e.target.files?.[0] || null)}
                    style={{ fontSize: 13, width: '100%' }}
                  />
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>
                    Clear headshot · JPG/PNG · used on the vertical staff ID card
                  </div>
                  {photoUrl && (
                    <button
                      type="button"
                      className="os-ghost-btn"
                      style={{ fontSize: 11, marginTop: 6 }}
                      onClick={() => setPhotoUrl('')}
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              </div>
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
          <LogoProgressBar active={busy} label="Creating account, sign-in & ID card…" />
        </form>
      )}

      {confirmInfo && (
        <div
          id="staff-create-confirm"
          className="os-card"
          style={{
            padding: 20,
            border: '2px solid #16A34A',
            background: 'linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 50%, #F0F9FF 100%)',
            boxShadow: '0 12px 40px rgba(22, 163, 74, 0.15)',
            order: -1,
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
                <div><strong>PIN:</strong> <code style={{ fontWeight: 800, fontSize: '0.95rem' }}>{confirmInfo.pin}</code> <span style={{ color: '#64748B', marginLeft: 4 }}>(give this to the staff member)</span></div>
                {confirmInfo.email && <div><strong>Email:</strong> {confirmInfo.email}</div>}
              </div>
              <div
                style={{
                  marginTop: 14,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: '#FFFFFF',
                  border: '1px solid #BBF7D0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  fontSize: '0.84rem',
                  color: '#0F172A',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <strong style={{ color: '#047857' }}>Ready to sign in</strong>
                    <div style={{ color: '#64748B', marginTop: 2, lineHeight: 1.45 }}>
                      Staff can log in with <strong>Staff ID No.</strong> using the badge and PIN above.
                      Share these details with them privately.
                    </div>
                  </div>
                </div>
                {confirmInfo.email ? (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: confirmInfo.emailAuth === 'ok' ? '#16A34A' : '#F59E0B',
                        marginTop: 5,
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <strong style={{ color: confirmInfo.emailAuth === 'ok' ? '#047857' : '#B45309' }}>
                        {confirmInfo.emailAuth === 'ok' ? 'Email sign-in ready' : 'Email sign-in optional'}
                      </strong>
                      <div style={{ color: '#64748B', marginTop: 2, lineHeight: 1.45 }}>
                        {confirmInfo.emailAuth === 'ok'
                          ? `They can also sign in with ${confirmInfo.email} and the same PIN.`
                          : 'Badge + PIN works now. Email login can be set up later from Staff Access if needed.'}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {!confirmInfo.listed ? (
                  <button
                    type="button"
                    className="os-primary-btn"
                    onClick={() => {
                      const row = confirmInfo.accessRow;
                      const nextAccess = [row, ...getAccessRecords().filter((r) => r.id !== row.id)];
                      setAccessRecords(nextAccess);
                      setRecords(nextAccess);
                      setSelectedId(row.id);
                      setConfirmInfo({ ...confirmInfo, listed: true });
                      pushActivity(`Listed in access control · ${row.name} · ${row.id}`);
                    }}
                  >
                    <CheckCircle2 size={16} /> Confirm — add to staff list
                  </button>
                ) : (
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#047857' }}>
                    ✓ Added to staff list below
                  </div>
                )}
                <button
                  type="button"
                  className="os-ghost-btn"
                  style={{ fontSize: 12 }}
                  onClick={() => {
                    // If never confirmed list, still persist access so badge login works from access store
                    if (confirmInfo && !confirmInfo.listed) {
                      const row = confirmInfo.accessRow;
                      const nextAccess = [row, ...getAccessRecords().filter((r) => r.id !== row.id)];
                      setAccessRecords(nextAccess);
                      setRecords(nextAccess);
                    }
                    setConfirmInfo(null);
                  }}
                >
                  {confirmInfo.listed ? 'Close' : 'Close (also add to list)'}
                </button>
              </div>
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 320px)',
          gap: 16,
          opacity: confirmInfo && !confirmInfo.listed ? 0.45 : 1,
          pointerEvents: confirmInfo && !confirmInfo.listed ? 'none' : undefined,
          transition: 'opacity 0.2s ease',
        }}
      >
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

      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => { if (!busy) setDeleteTarget(null); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 420,
              background: '#fff',
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 17, color: '#0F172A', marginBottom: 8 }}>
              Remove staff account?
            </div>
            <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.55, margin: '0 0 16px' }}>
              <strong style={{ color: '#0F172A' }}>{deleteTarget.name}</strong>
              <br />
              Staff ID: <span style={{ fontFamily: 'monospace' }}>{deleteTarget.badgeId}</span>
              <br />
              Access and ID card will be removed. They will not be able to sign in. This cannot be undone.
            </p>
            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#B91C1C', marginBottom: 12 }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => setDeleteTarget(null)}
                style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmDeleteStaff()}
                style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: busy ? '#FCA5A5' : '#DC2626', color: '#fff', fontWeight: 700, fontSize: 13, cursor: busy ? 'wait' : 'pointer' }}
              >
                {busy ? 'Removing…' : 'Yes, remove staff'}
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteSuccess && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 10001, background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: '14px 18px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', gap: 10, maxWidth: 360, fontSize: 13, fontWeight: 600, color: '#065F46' }}>
          {deleteSuccess}
          <button type="button" onClick={() => setDeleteSuccess(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', marginLeft: 8, color: '#047857', fontWeight: 800 }}>×</button>
        </div>
      )}
    </>
  );
};

export default AccessControl;
