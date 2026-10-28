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
  pushActivity,
  resetAllPilotData,
  clearFacilityAllData,
  type AccessRecord,
} from '../../lib/adminRealtimeStore';
import {
  prepareStaffEnrolment,
  commitStaffEnrolment,
  listStaffCards,
  countActiveStaffCards,
  purgeOrphanAndDuplicateIdCards,
  wipeFacilityStaffExceptAdmin,
  isStaffFlushLocked,
  getStaffCard,
  deleteStaffMember,
  defaultPermissionsForRole,
  applyCloudStaffDirectory,
} from '../../lib/staffCardStore';
import { compressStaffPhotoFile, resolveStaffPhotoForEnrol } from '../../lib/staffPhoto';
import { StaffDeleteSuccessScreen, type StaffDeleteSuccessInfo } from '../staffing/StaffDeleteSuccessScreen';
import {
  firestoreSubscribeStaffCollection,
} from '../../lib/firebase';
import { apiCreateStaff, apiListStaff, apiDbHealth } from '../../lib/db/clientApi';
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
import { getCustomRoles } from '../../lib/rolePermissionsStore';
import {
  Shield, Plus, Search, CheckCircle2, XCircle, Lock, UserPlus, IdCard, Trash2, Layers, Pencil, Save, X as XIcon,
} from 'lucide-react';
import { DuplicateCardModal } from '../staffing/DuplicateCardModal';

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
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [issued, setIssued] = useState<StaffCardRecord | null>(null);
  const [confirmInfo, setConfirmInfo] = useState<{
    badgeId: string;
    name: string;
    role: string;
    roleKey: string;
    department: string;
    clearanceLabel: string;
    facilityName: string;
    pin: string;
    email?: string;
    firebaseAuth: 'ok' | 'fail' | 'skipped';
    firestore: 'ok' | 'fail';
    emailAuth?: 'ok' | 'fail' | 'skipped';
    accessRow: AccessRecord;
    listed: boolean;
  } | null>(null);
  const [createFail, setCreateFail] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ badgeId: string; name: string } | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<StaffDeleteSuccessInfo | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [purgeMsg, setPurgeMsg] = useState<string | null>(null);
  const [showDupModal, setShowDupModal] = useState(false);

  // Edit staff state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRoleKey, setEditRoleKey] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'suspended' | 'pending'>('active');
  const [editError, setEditError] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  const [fullName, setFullName] = useState('');
  const [roleKey, setRoleKey] = useState(ROLE_OPTIONS[0]?.roleKey || 'doctor');
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [pin, setPin] = useState('123456');
  const [email, setEmail] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMeta, setPhotoMeta] = useState<string>('');

  const facilityId = session?.hospitalId || HOSPITALS[0]?.id || 'IGH-EKT';
  const facilityName = session?.facility || HOSPITALS.find((h) => h.id === facilityId)?.name || 'Hospital';

  // Static list — avoid getCustomRoles()/storage work when opening the form
  const roleMeta = useMemo(
    () => ROLE_OPTIONS.find((r) => r.roleKey === roleKey) || ROLE_OPTIONS[0],
    [roleKey]
  );

  // Read-only refresh — NEVER call syncAccessRoster here (that dispatches admin-sync → infinite loop)
  const loadRecords = useCallback(() => {
    try {
      setRecords(getAccessRecords());
    } catch {
      /* ignore */
    }
    // Prefer Aurora when available
    void apiListStaff(facilityId).then((res) => {
      if (!res.ok || !res.staff?.length) return;
      try {
        const mapped = res.staff.map((s) => ({
          id: String(s.badge_id || s.badgeId || ''),
          name: String(s.full_name || s.fullName || s.name || ''),
          role: String(s.role || ''),
          department: String(s.department || ''),
          clearance: Number(s.clearance_level || s.clearanceLevel || 1),
          status: (String(s.status || 'active') as 'active' | 'suspended' | 'pending'),
          lastLogin: '—',
          permissions: Array.isArray(s.permissions) ? (s.permissions as string[]) : [],
          email: s.email ? String(s.email) : undefined,
        }));
        if (mapped.length) {
          setAccessRecords(mapped);
          setRecords(mapped);
        }
      } catch { /* */ }
    });
  }, [facilityId]);

  const busyRef = React.useRef(busy);
  const confirmRef = React.useRef(confirmInfo);
  const showCreateRef = React.useRef(showCreate);
  const isMounted = React.useRef(true);
  busyRef.current = busy;
  confirmRef.current = confirmInfo;
  showCreateRef.current = showCreate;

  useEffect(() => {
    isMounted.current = true;

    try {
      (window as unknown as { __medcoreFlushStaff?: (fid?: string) => number }).__medcoreFlushStaff = (
        fid?: string
      ) => wipeFacilityStaffExceptAdmin(fid || facilityId);
    } catch {
      /* ignore */
    }

    /** Map Firestore staff doc → AccessRecord (cloud is source of truth). */
    const rowFromCloud = (s: Record<string, unknown>): AccessRecord | null => {
      const badgeId = String(s.badgeId || s.id || '')
        .toUpperCase()
        .replace(/\s+/g, '');
      if (!badgeId) return null;
      const st = String(s.status || 'active').toLowerCase();
      const status: AccessRecord['status'] =
        st === 'suspended' ? 'suspended' : st === 'pending' ? 'pending' : 'active';
      return {
        id: badgeId,
        name: String(s.name || s.fullName || badgeId),
        role: String(s.role || s.shortRole || s.roleKey || 'Staff'),
        department: String(s.department || '—'),
        clearance: Number(s.clearanceLevel ?? s.clearance ?? 2),
        status,
        lastLogin: String(s.lastLoginAt || s.lastLogin || '—'),
        permissions: Array.isArray(s.permissions)
          ? (s.permissions as string[])
          : defaultPermissionsForRole(String(s.roleKey || s.role || 'staff')),
        email: s.email || s.workEmail ? String(s.email || s.workEmail) : undefined,
      };
    };

    const applyCloudRows = (staffRows: Record<string, unknown>[]) => {
      if (!isMounted.current) return;
      const byId = new Map<string, AccessRecord>();

      // Ingest existing local records first so any locally-enrolled staff is never dropped
      try {
        const local = getAccessRecords();
        for (const r of local) {
          if (r && r.id) byId.set(String(r.id).toUpperCase(), r);
        }
      } catch {
        /* ignore */
      }

      // Also ingest local staff cards so all enrolled badges stay visible
      try {
        for (const c of listStaffCards()) {
          const cid = String(c.badgeId || '').toUpperCase();
          if (!cid) continue;
          if (c.facilityId && facilityId && c.facilityId.toUpperCase() !== facilityId.toUpperCase()) continue;
          if (!byId.has(cid)) {
            byId.set(cid, {
              id: cid,
              name: c.fullName || cid,
              role: c.role || (c as { shortRole?: string }).shortRole || 'Staff',
              department: c.department || '—',
              clearance: c.clearanceLevel || 2,
              status: c.status === 'ACTIVE' ? 'active' : 'suspended',
              lastLogin: 'Never',
              permissions: (c as { permissions?: string[] }).permissions || defaultPermissionsForRole(c.roleKey || 'staff'),
              email: (c as { email?: string }).email,
            });
          }
        }
      } catch {
        /* ignore */
      }

      // Merge cloud rows (cloud updates take precedence for overlapping ids)
      for (const s of staffRows) {
        const row = rowFromCloud(s);
        if (row) byId.set(row.id.toUpperCase(), row);
      }
      const next = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
      // Do not re-render the create form / role picker on every Firestore tick
      if (!showCreateRef.current && !busyRef.current) {
        setRecords(next);
      }
      setIsLoading(false);
      // Mirror into access store for other admin modules (memory only under edgeCloudOnly)
      try {
        setAccessRecords(next);
      } catch {
        /* ignore */
      }
    };

    // Prefer Aurora Postgres when healthy — skip heavy Firestore staff listener
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let lastSig = '';
    let unsubCol: (() => void) | undefined;

    void (async () => {
      const pgOk = await apiDbHealth();
      if (!isMounted.current) return;
      if (pgOk) {
        try {
          const res = await apiListStaff(facilityId);
          if (res.ok && res.staff?.length) {
            const rows = res.staff.map((s) => ({
              badgeId: s.badge_id || s.badgeId,
              fullName: s.full_name || s.fullName,
              name: s.full_name || s.name,
              role: s.role,
              roleKey: s.role_key || s.roleKey,
              department: s.department,
              clearanceLevel: s.clearance_level || s.clearanceLevel,
              status: s.status,
              email: s.email,
              permissions: s.permissions,
            }));
            applyCloudRows(rows as Record<string, unknown>[]);
          }
        } catch {
          /* fall through to Firestore */
        }
        setIsLoading(false);
        return; // Postgres is source of truth — no Firestore staff collection
      }

      unsubCol = firestoreSubscribeStaffCollection(facilityId, (staffRows) => {
        try {
          if (!isMounted.current || isStaffFlushLocked()) return;
          const rows = Array.isArray(staffRows) ? staffRows : [];
          // Never apply empty cloud list over local (prevents wipe after reload)
          if (rows.length === 0) {
            setIsLoading(false);
            return;
          }
          const sig =
            rows.length +
            ':' +
            rows
              .map((s: Record<string, unknown>) => String(s.badgeId || s.id || ''))
              .join('|');
          if (sig === lastSig) {
            setIsLoading(false);
            return;
          }
          lastSig = sig;
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            if (!isMounted.current) return;
            applyCloudRows(rows as Record<string, unknown>[]);
            if (!showCreateRef.current) {
              try {
                const registry = rows.slice(0, 200).map((s: Record<string, unknown>) => {
                  const badgeId = String(s.badgeId || s.id || '')
                    .toUpperCase()
                    .replace(/\s+/g, '');
                  return {
                    id: badgeId,
                    badgeId,
                    name: s.name || s.fullName || badgeId,
                    fullName: s.fullName || s.name,
                    role: s.role || s.shortRole || s.roleKey || 'Staff',
                    shortRole: s.shortRole,
                    roleKey: s.roleKey,
                    title: s.title,
                    department: s.department || '—',
                    clearanceLevel: Number(s.clearanceLevel ?? s.clearance ?? 2),
                    status: s.status || 'active',
                    email: s.email || s.workEmail,
                    hospitalId: facilityId,
                    facilityId,
                  };
                });
                applyCloudStaffDirectory({ staffRegistry: registry, facilityId });
              } catch {
                /* ignore */
              }
            }
          }, 100);
        } catch {
          setIsLoading(false);
        }
      });
    })();

    // Paint immediately; data fills in when ready
    setIsLoading(false);
    const safety = setTimeout(() => {
      if (isMounted.current) setIsLoading(false);
    }, 2500);

    return () => {
      isMounted.current = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      clearTimeout(safety);
      try {
        unsubCol?.();
      } catch {
        /* */
      }
    };
  }, [facilityId]);


  const filtered = records.filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.role.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase())
  );

  const selected = records.find((r) => r.id === selectedId) || null;
  const selectedCard = selectedId ? getStaffCard(selectedId) : undefined;

  const readPhotoFile = async (file: File | null) => {
    if (!file) {
      setPhotoUrl('');
      setPhotoMeta('');
      return;
    }
    setPhotoBusy(true);
    setError('');
    try {
      const result = await compressStaffPhotoFile(file);
      setPhotoUrl(result.dataUrl);
      setPhotoMeta(`${result.width}×${result.height} · ~${Math.round(result.bytesApprox / 1024)} KB`);
    } catch (err) {
      setPhotoUrl('');
      setPhotoMeta('');
      setError((err as Error)?.message || 'Could not process photo.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreateFail(null);
    if (!fullName.trim()) {
      setError('Enter staff full name.');
      return;
    }
    if (!roleKey || !roleMeta) {
      setError('Select a specialty / role — this locks which desk and modules they can open.');
      return;
    }
    if (!String(pin || '').trim()) {
      setError('Enter a PIN (min 6 characters recommended).');
      return;
    }
    if (roleMeta.roleKey === 'hospital_admin') {
      const existing = listStaffCards().filter(
        (c) =>
          c.facilityId === facilityId &&
          (c.roleKey === 'hospital_admin' || (c.role || '').toLowerCase().includes('administrator'))
      );
      if (existing.length > 0) {
        setError(
          `This hospital already has an administrator (${existing[0].fullName || existing[0].badgeId}).`
        );
        return;
      }
    }

    setBusy(true);
    setConfirmInfo(null);

    const pinNorm = normalizeStaffPin(pin);
    const nameSnap = fullName.trim();
    const mail = (email || '').trim().toLowerCase();
    const photoSnap = photoUrl || undefined;

    let firebaseAuth: 'ok' | 'fail' | 'skipped' = 'skipped';
    let firestoreStatus: 'ok' | 'fail' = 'fail';
    let emailAuth: 'ok' | 'fail' | 'skipped' = 'skipped';

    try {
      // 1) Build card + registry entry (includes photo data URL)
      const prepared = prepareStaffEnrolment({
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
        photoUrl: photoSnap,
        email: mail || undefined,
      });
      let card = prepared.card;
      const badgeId = card.badgeId;

      let finalPhoto = photoSnap;
      try {
        finalPhoto = (await resolveStaffPhotoForEnrol(facilityId, badgeId, photoSnap)) || photoSnap;
      } catch {
        finalPhoto = photoSnap;
      }

      if (finalPhoto) {
        card = { ...card, photoUrl: finalPhoto };
      }

      const accessRow: AccessRecord = {
        id: badgeId,
        name: nameSnap,
        role: roleMeta.role,
        department: roleMeta.department,
        clearance: roleMeta.clearanceLevel,
        status: 'active',
        lastLogin: 'Never',
        permissions: defaultPermissionsForRole(roleMeta.roleKey),
        email: mail || undefined,
      };

      // 2) Commit LOCAL first — ID card + registry always issued
      commitStaffEnrolment(
        {
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
          permissions: accessRow.permissions,
          photoUrl: finalPhoto,
          email: mail || undefined,
        },
        card,
        { ...prepared.entry, pin: pinNorm, email: mail || undefined, photoUrl: finalPhoto }
      );

      const nextAccess = [accessRow, ...getAccessRecords().filter((r) => r.id !== accessRow.id)];
      setAccessRecords(nextAccess);
      setRecords(nextAccess);

      // 2b) Aurora Postgres system of record (non-blocking if not configured)
      try {
        void apiCreateStaff({
          badgeId,
          facilityId,
          facilityName,
          fullName: nameSnap,
          role: roleMeta.role,
          roleKey: roleMeta.roleKey,
          title: roleMeta.title,
          department: roleMeta.department,
          email: mail || undefined,
          status: 'active',
          clearanceLevel: roleMeta.clearanceLevel,
          clearanceLabel: roleMeta.clearanceLabel,
          permissions: accessRow.permissions,
          photoUrl: photoSnap,
          pin: pinNorm,
          authEmail: badgeAuthEmail(badgeId),
        });
      } catch { /* */ }

      // 3) Cloud: Auth + Firestore in parallel (needed for login on other devices)
      try {
        const {
          firebaseEnsureBadgeAccount,
          firebaseEnsureEmailAccount,
          firestoreUpsertStaffMember,
          firestorePushStaffDirectory,
        } = await import('../../lib/firebase');

        const profilePayload: Record<string, unknown> = {
          badgeId,
          name: nameSnap,
          fullName: nameSnap,
          role: roleMeta.role,
          roleKey: roleMeta.roleKey,
          title: roleMeta.title,
          department: roleMeta.department,
          hospitalId: facilityId,
          facilityId,
          hospitalName: facilityName,
          facilityName,
          clearanceLevel: roleMeta.clearanceLevel,
          clearanceLabel: roleMeta.clearanceLabel,
          permissions: accessRow.permissions,
          email: mail || undefined,
          workEmail: mail || undefined,
          authEmail: badgeAuthEmail(badgeId),
          status: 'active',
          photoUrl: finalPhoto,
        };

        const race = <T,>(p: Promise<T>, ms: number) =>
          Promise.race([
            p,
            new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
          ]);

        const results = await Promise.allSettled([
          race(firebaseEnsureBadgeAccount(badgeId, pinNorm), 8000),
          race(firestoreUpsertStaffMember(facilityId, profilePayload as Record<string, unknown> & { badgeId: string }), 7000),
          mail
            ? race(firebaseEnsureEmailAccount(mail, pinNorm), 8000)
            : Promise.resolve(null),
        ]);

        firebaseAuth = results[0].status === 'fulfilled' ? 'ok' : 'fail';
        if (results[1].status === 'fulfilled') {
          const v = (results[1] as PromiseFulfilledResult<boolean | unknown>).value;
          firestoreStatus = v === false ? 'fail' : 'ok';
        } else {
          firestoreStatus = 'fail';
        }
        emailAuth = !mail ? 'skipped' : results[2].status === 'fulfilled' ? 'ok' : 'fail';

        // Push full directory (best effort)
        try {
          const cardsRaw =
            localStorage.getItem('medcore_staff_id_cards') ||
            localStorage.getItem('medcore_os_staff_cards') ||
            '[]';
          const regRaw = localStorage.getItem('medcore_os_staff_registry') || '[]';
          void firestorePushStaffDirectory(facilityId, {
            staffCards: JSON.parse(cardsRaw),
            staffRegistry: JSON.parse(regRaw),
          });
        } catch {
          /* */
        }

        if (firebaseAuth !== 'ok' || firestoreStatus !== 'ok') {
          window.setTimeout(() => {
            void ensureStaffCloudIdentity({
              facilityId,
              badgeId,
              pin: pinNorm,
              email: mail || undefined,
              profile: profilePayload as Record<string, unknown>,
            });
          }, 1200);
        }
      } catch (cloudErr) {
        console.warn('[access] cloud', cloudErr);
        firebaseAuth = 'fail';
        firestoreStatus = 'fail';
      }

      pushActivity(`Account created · ${nameSnap} · ${badgeId} · ID card issued`);
      emitLiveAction(`Account + ID card · ${badgeId}`, { module: 'access' });

      setIssued(card);
      setShowCreate(false);
      setSelectedId(badgeId);
      setConfirmInfo({
        badgeId,
        name: nameSnap,
        role: roleMeta.role,
        roleKey: roleMeta.roleKey,
        department: roleMeta.department,
        clearanceLabel: roleMeta.clearanceLabel,
        facilityName,
        pin: pinNorm,
        email: mail || undefined,
        firebaseAuth,
        firestore: firestoreStatus,
        emailAuth,
        accessRow,
        listed: true,
      });
      setFullName('');
      setEmail('');
      setPhotoUrl('');
      setPhotoMeta('');
    } catch (err: unknown) {
      console.error('[access] create failed', err);
      setError((err as Error)?.message || 'Account creation failed.');
      setCreateFail((err as Error)?.message || 'Account creation failed.');
    } finally {
      setBusy(false);
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
    setError('');
    try {
      // Capture email before local wipe (for Auth delete)
      let workEmail = '';
      try {
        const hit = records.find((r) => String(r.id || '').toUpperCase() === id);
        workEmail = String((hit as { email?: string })?.email || '');
      } catch {
        /* ignore */
      }

      // 1. Instant local wipe (card, registry, access control, presence, and session revocation)
      deleteStaffMember(id);
      const next = getAccessRecords().filter((r) => String(r.id).toUpperCase() !== id);
      setAccessRecords(next);
      setRecords(next);
      if (selectedId && String(selectedId).toUpperCase() === id) {
        setSelectedId(null);
        setIssued(null);
      }
      if (confirmInfo?.badgeId?.toUpperCase() === id) setConfirmInfo(null);

      // 2. Instantly dismiss modal and show success screen (0ms delay)
      setDeleteTarget(null);
      pushActivity(`Account deleted · ${name} · ${id}`);
      emitLiveAction(`Deleted staff ${id}`, { module: 'access' });
      setDeleteSuccess({
        name,
        badgeId: id,
        authDeleted: true,
      });

      // 3. Parallel background cloud & Firebase Auth cleanup (non-blocking)
      void (async () => {
        try {
          const {
            firestoreDeleteStaffMember,
            firestorePushStaffDirectory,
            firestoreRevokeStaff,
            deleteStaffFirebaseAuth,
          } = await import('../../lib/firebase');

          await Promise.allSettled([
            firestoreRevokeStaff(facilityId, id, { name, revokedBy: session?.badgeId }),
            deleteStaffFirebaseAuth({
              badgeId: id,
              email: workEmail || undefined,
            }),
            firestoreDeleteStaffMember(facilityId, id),
            firestorePushStaffDirectory(facilityId, {
              staffCards: listStaffCards(),
              staffRegistry: JSON.parse(localStorage.getItem('medcore_os_staff_registry') || '[]'),
            }),
          ]);
        } catch (cloudErr) {
          console.warn('[rbac] background cloud deletion', cloudErr);
        }
      })();
    } catch {
      setError('Could not remove this staff member. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="os-module-layout" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Instant skeleton — prevents main-thread block on first paint */}
        <div className="os-shimmer" style={{ height: 72, borderRadius: 14 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="os-shimmer" style={{ height: 60, flex: 1, borderRadius: 12 }} />
          <div className="os-shimmer" style={{ height: 60, flex: 1, borderRadius: 12 }} />
          <div className="os-shimmer" style={{ height: 60, flex: 1, borderRadius: 12 }} />
        </div>
        <div className="os-shimmer" style={{ height: 44, borderRadius: 10 }} />
        <div style={{ height: 240, borderRadius: 12, background: '#F8FAFC', border: '1px solid #E2E8F0', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 0.85, 0.7, 0.55, 0.4].map((opacity, i) => (
            <div key={i} className="os-shimmer" style={{ height: 40, borderRadius: 8, opacity }} />
          ))}
        </div>
      </div>
    );
  }

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
          <span className="metric-val">{countActiveStaffCards(facilityId)}</span>
          <span className="metric-sub">Active ID cards only</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {purgeMsg && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          {purgeMsg}
        </div>
      )}
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
          className="os-ghost-btn"
          onClick={() => setShowDupModal(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Layers size={15} /> Find Duplicate Cards
        </button>
        <button
          type="button"
          className="os-primary-btn"
          onClick={() => {
            setShowCreate((v) => !v);
            setError('');
            setIssued(null);
            setConfirmInfo(null);
            setEditId(null);
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
              Work email (optional)
              <input
                className="os-search-input"
                style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px' }}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@hospital.gov.ng"
                autoComplete="off"
              />
            </label>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', position: 'relative' }}>
              Role
              <button
                type="button"
                onClick={() => setRoleMenuOpen((o) => !o)}
                style={{
                  display: 'flex',
                  width: '100%',
                  marginTop: 6,
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                  background: '#FFF',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  color: '#0F172A',
                }}
              >
                <span>
                  {roleMeta?.title || 'Select role'} · {roleMeta?.department || ''}
                </span>
                <span style={{ color: '#94A3B8', fontSize: 12 }}>{roleMenuOpen ? '▲' : '▼'}</span>
              </button>
              {roleMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    zIndex: 40,
                    left: 0,
                    right: 0,
                    top: '100%',
                    marginTop: 4,
                    maxHeight: 260,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    background: '#FFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: 12,
                    boxShadow: '0 12px 28px rgba(15,23,42,0.12)',
                  }}
                >
                  {ROLE_OPTIONS.map((r) => {
                    const on = roleKey === r.roleKey;
                    return (
                      <button
                        key={r.roleKey}
                        type="button"
                        onClick={() => {
                          setRoleKey(r.roleKey);
                          setRoleMenuOpen(false);
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          border: 'none',
                          borderBottom: '1px solid #F1F5F9',
                          background: on ? '#EFF6FF' : '#FFF',
                          color: on ? '#0C4A6E' : '#334155',
                          padding: '10px 12px',
                          cursor: 'pointer',
                          fontSize: '0.84rem',
                          fontWeight: on ? 700 : 500,
                        }}
                      >
                        <div>{r.title}</div>
                        <div style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>
                          {r.shortRole} · {r.department} · {r.clearanceLabel}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {roleMeta && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#0369A1', background: '#E0F2FE', borderRadius: 8, padding: '8px 10px', lineHeight: 1.45 }}>
                  <strong>{roleMeta.title}</strong> — {roleMeta.clearanceLabel}. Desk modules outside this role stay locked.
                </div>
              )}
            </div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>
              Facility
              <div
                className="os-form-select"
                style={{ marginTop: 6, padding: '10px 12px', background: '#F8FAFC' }}
              >
                {facilityName} · locked
              </div>
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
                    accept="image/*,.jpg,.jpeg,.png,.webp,.gif"
                    disabled={photoBusy || busy}
                    onChange={(e) => {
                      void readPhotoFile(e.target.files?.[0] || null);
                      e.target.value = '';
                    }}
                    style={{ fontSize: 13, width: '100%' }}
                  />
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>
                    {photoBusy
                      ? 'Processing & compressing headshot…'
                      : photoMeta
                        ? `Ready · ${photoMeta} · ID card + cloud profile`
                        : 'Select headshot · works with any photo from device or camera'}
                  </div>
                  {photoUrl && (
                    <button
                      type="button"
                      className="os-ghost-btn"
                      style={{ fontSize: 11, marginTop: 6, color: '#DC2626' }}
                      disabled={photoBusy || busy}
                      onClick={() => {
                        setPhotoUrl('');
                        setPhotoMeta('');
                      }}
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


      {createFail && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setCreateFail(null)}
        >
          <div
            className="os-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 400,
              padding: 0,
              borderRadius: 16,
              overflow: 'hidden',
              border: '1px solid #FECACA',
              boxShadow: '0 24px 64px rgba(15, 23, 42, 0.28)',
              background: '#fff',
            }}
          >
            <div style={{ padding: '18px 20px', background: '#FEF2F2', borderBottom: '1px solid #FECACA', display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <XCircle size={20} color="#fff" />
              </div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#991B1B' }}>Creation failed</div>
            </div>
            <div style={{ padding: '16px 20px 20px' }}>
              <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.55 }}>{createFail}</p>
              <p style={{ margin: '10px 0 0', fontSize: 12, color: '#64748B' }}>
                No Staff ID was generated. You can try again when online.
              </p>
              <button
                type="button"
                className="os-primary-btn"
                style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
                onClick={() => setCreateFail(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmInfo && (
        <div
          id="staff-create-success-banner"
          style={{
            background: 'linear-gradient(135deg, #F0FDF4 0%, #ECFEFF 100%)',
            border: '1.5px solid #86EFAC',
            borderRadius: 14,
            padding: '16px 20px',
            boxShadow: '0 4px 20px rgba(16, 185, 129, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: '#16A34A',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <CheckCircle2 size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0F172A' }}>
                  Staff Enrolled Successfully · {confirmInfo.name}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                  {confirmInfo.role} · {confirmInfo.department} · Registered into active roster
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setConfirmInfo(null)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 20,
                lineHeight: 1,
                color: '#64748B',
                padding: '4px 8px',
                borderRadius: 6,
              }}
              title="Dismiss banner"
              aria-label="Dismiss banner"
            >
              ×
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              background: '#FFFFFF',
              border: '1px solid #BBF7D0',
              borderRadius: 10,
              padding: '10px 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                Staff ID:
              </span>
              <code style={{ fontSize: '1rem', fontWeight: 800, color: '#0052D4', background: '#EFF6FF', padding: '2px 8px', borderRadius: 6 }}>
                {confirmInfo.badgeId}
              </code>
              <button
                type="button"
                className="os-ghost-btn"
                style={{ padding: '3px 8px', fontSize: '0.74rem', height: 26 }}
                onClick={() => {
                  try {
                    void navigator.clipboard.writeText(confirmInfo.badgeId);
                  } catch {
                    /* ignore */
                  }
                }}
              >
                Copy ID
              </button>
            </div>

            <div style={{ width: 1, height: 20, background: '#E2E8F0' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                PIN:
              </span>
              <code style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', background: '#F8FAFC', padding: '2px 8px', borderRadius: 6 }}>
                {confirmInfo.pin}
              </code>
              <button
                type="button"
                className="os-ghost-btn"
                style={{ padding: '3px 8px', fontSize: '0.74rem', height: 26 }}
                onClick={() => {
                  try {
                    void navigator.clipboard.writeText(confirmInfo.pin);
                  } catch {
                    /* ignore */
                  }
                }}
              >
                Copy PIN
              </button>
            </div>

            {confirmInfo.email && (
              <>
                <div style={{ width: 1, height: 20, background: '#E2E8F0' }} />
                <span style={{ fontSize: '0.78rem', color: '#64748B' }}>{confirmInfo.email}</span>
              </>
            )}

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#047857', background: '#D1FAE5', padding: '3px 8px', borderRadius: 999 }}>
                ID Card Issued
              </span>
              <button
                type="button"
                className="os-primary-btn"
                style={{ padding: '5px 12px', fontSize: '0.76rem', height: 28 }}
                onClick={() => setConfirmInfo(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 320px)',
          gap: 16,
          /* success is modal overlay — table stays normal */
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
                          <button type="button" className="os-ghost-btn" style={{ fontSize: 12 }} onClick={() => { reactivateAccess(r.id); loadRecords(); }}>
                            <CheckCircle2 size={12} /> Reactivate
                          </button>
                        ) : r.status === 'pending' ? (
                          <button type="button" className="os-ghost-btn" style={{ fontSize: 12 }} onClick={() => { approveAccess(r.id); loadRecords(); }}>
                            Approve
                          </button>
                        ) : (
                          <button type="button" className="os-ghost-btn" style={{ fontSize: 12, color: '#B91C1C' }} onClick={() => { suspendAccess(r.id); loadRecords(); }}>
                            <XCircle size={12} /> Suspend
                          </button>
                        )}
                        <button
                          type="button"
                          className="os-ghost-btn"
                          style={{ fontSize: 12, color: '#0052D4', borderColor: 'rgba(0,82,212,0.3)' }}
                          onClick={() => {
                            setSelectedId(r.id);
                            setEditId(r.id);
                            setEditName(r.name);
                            setEditRoleKey((r as { roleKey?: string }).roleKey || '');
                            setEditDept(r.department || '');
                            setEditPhone((r as { phone?: string }).phone || '');
                            setEditEmail((r as { email?: string }).email || '');
                            setEditStatus(r.status as 'active' | 'suspended' | 'pending');
                            setEditError('');
                          }}
                        >
                          <Pencil size={12} /> Edit
                        </button>
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
          ) : editId === selected.id ? (
            /* ── Edit mode ── */
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editName.trim()) { setEditError('Name is required.'); return; }
                setEditBusy(true); setEditError('');
                try {
                  const badge = String(editId || '').toUpperCase();
                  const name = editName.trim();
                  const mail = (editEmail || '').trim().toLowerCase() || undefined;
                  const { setAccessRecords: saveRecords, getAccessRecords: getRecs } = await import('../../lib/adminRealtimeStore');
                  const all = getRecs();
                  const updated = all.map((row) =>
                    row.id === editId
                      ? { ...row, name, role: editRoleKey || row.role, department: editDept || row.department, status: editStatus, email: mail }
                      : row
                  );
                  saveRecords(updated);
                  setRecords(updated);

                  // Update ID card + registry (realtime local)
                  try {
                    for (const key of ['medcore_os_staff_registry', 'medcore_staff_registry']) {
                      const raw = localStorage.getItem(key);
                      const arr = raw ? JSON.parse(raw) : [];
                      if (!Array.isArray(arr)) continue;
                      const next = arr.map((r: Record<string, unknown>) => {
                        const bid = String(r.badgeId || r.id || '').toUpperCase();
                        if (bid !== badge) return r;
                        return {
                          ...r,
                          name,
                          fullName: name,
                          email: mail || r.email,
                          workEmail: mail || r.workEmail,
                          department: editDept || r.department,
                          status: editStatus || r.status,
                        };
                      });
                      localStorage.setItem(key, JSON.stringify(next));
                    }
                    for (const key of ['medcore_staff_id_cards', 'medcore_os_staff_cards']) {
                      const cardRaw = localStorage.getItem(key);
                      if (!cardRaw) continue;
                      const carr = JSON.parse(cardRaw);
                      if (!Array.isArray(carr)) continue;
                      const nextCards = carr.map((c: Record<string, unknown>) =>
                        String(c.badgeId || '').toUpperCase() === badge
                          ? { ...c, fullName: name }
                          : c
                      );
                      localStorage.setItem(key, JSON.stringify(nextCards));
                    }
                    window.dispatchEvent(new CustomEvent('medcore-staff-cards-updated'));
                    window.dispatchEvent(new CustomEvent('medcore-staff-registry-updated'));
                    window.dispatchEvent(new CustomEvent('medcore-admin-sync'));
                  } catch { /* */ }

                  // Cloud upsert (realtime for other workstations)
                  try {
                    const { firestoreUpsertStaffMember, firestorePushStaffDirectory } = await import('../../lib/firebase');
                    await firestoreUpsertStaffMember(facilityId, {
                      badgeId: badge,
                      fullName: name,
                      name,
                      email: mail,
                      workEmail: mail,
                      department: editDept || undefined,
                      status: editStatus,
                      facilityId,
                    });
                    // push directory snapshot
                    try {
                      const cardsRaw = localStorage.getItem('medcore_staff_id_cards') || '[]';
                      const regRaw = localStorage.getItem('medcore_os_staff_registry') || '[]';
                      await firestorePushStaffDirectory(facilityId, {
                        staffCards: JSON.parse(cardsRaw),
                        staffRegistry: JSON.parse(regRaw),
                      });
                    } catch { /* */ }
                  } catch { /* offline */ }

                  setEditId(null);
                } catch {
                  setEditError('Save failed — please try again.');
                } finally {
                  setEditBusy(false);
                }
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#6366F1,#0052D4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Pencil size={15} color="#fff" />
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#0F172A' }}>Edit staff account</div>
                </div>
                <button type="button" onClick={() => setEditId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 4, borderRadius: 8, display: 'flex', alignItems: 'center' }}>
                  <XIcon size={16} />
                </button>
              </div>

              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>
                Full name
                <input className="os-search-input" style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px' }}
                  value={editName} onChange={(e) => setEditName(e.target.value)} />
              </label>

              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>
                Department / Unit
                <input className="os-search-input" style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px' }}
                  value={editDept} onChange={(e) => setEditDept(e.target.value)} />
              </label>

              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>
                Work email (optional)
                <input className="os-search-input" style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px' }}
                  type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              </label>

              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>
                Status
                <select className="os-search-input" style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px' }}
                  value={editStatus} onChange={(e) => setEditStatus(e.target.value as 'active' | 'suspended' | 'pending')}>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="pending">Pending</option>
                </select>
              </label>

              {editError && <div style={{ fontSize: 12, color: '#B91C1C', fontWeight: 600 }}>{editError}</div>}

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="button" onClick={() => setEditId(null)} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', color: '#0F172A' }}>Cancel</button>
                <button type="submit" disabled={editBusy} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#0052D4,#0D9488)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: editBusy ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Save size={13} /> {editBusy ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          ) : (
            /* ── View mode ── */
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0F172A' }}>{selected.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 2 }}>
                    {selected.role} · {selected.department}
                  </div>
                </div>
                <button
                  type="button"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(0,82,212,0.3)', background: '#EFF6FF', color: '#0052D4', fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
                  onClick={() => {
                    setEditId(selected.id);
                    setEditName(selected.name);
                    setEditRoleKey((selected as { roleKey?: string }).roleKey || '');
                    setEditDept(selected.department || '');
                    setEditPhone((selected as { phone?: string }).phone || '');
                    setEditEmail((selected as { email?: string }).email || '');
                    setEditStatus(selected.status as 'active' | 'suspended' | 'pending');
                    setEditError('');
                  }}
                >
                  <Pencil size={12} /> Edit
                </button>
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
        <StaffDeleteSuccessScreen info={deleteSuccess} onClose={() => setDeleteSuccess(null)} />
      )}
      {showDupModal && (
        <DuplicateCardModal
          facilityId={facilityId}
          onClose={() => { setShowDupModal(false); loadRecords(); }}
          onDeleted={() => loadRecords()}
        />
      )}
    </>
  );
};

export default AccessControl;
