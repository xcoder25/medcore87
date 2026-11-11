'use client';

/**
 * Staff Access & Enrolment Hub — Unified workforce IAM console:
 * 1. Staff Directory & Access Control (Roster, Clearance, Credentials, Suspend/Reactivate, Edit, Delete)
 * 2. Instant Staff Enrolment Studio (Live side-by-side vertical ID Card preview, Headshot upload, PIN & Cloud Auth)
 * 3. Staff ID Badges Gallery (Visual card gallery, duplicate card detection, print/export)
 */
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  getAccessRecords,
  setAccessRecords,
  approveAccess,
  suspendAccess,
  reactivateAccess,
  pushActivity,
  type AccessRecord,
} from '../../lib/adminRealtimeStore';
import {
  prepareStaffEnrolment,
  commitStaffEnrolment,
  listStaffCards,
  listActiveStaffCardsForFacility,
  countActiveStaffCards,
  wipeFacilityStaffExceptAdmin,
  isStaffFlushLocked,
  getStaffCard,
  deleteStaffMember,
  defaultPermissionsForRole,
  applyCloudStaffDirectory,
} from '../../lib/staffCardStore';
import { compressStaffPhotoFile, resolveStaffPhotoForEnrol } from '../../lib/staffPhoto';
import { uploadImageToS3 } from '../../lib/storageClient';
import { StaffDeleteSuccessScreen, type StaffDeleteSuccessInfo } from '../staffing/StaffDeleteSuccessScreen';
import {
  firestoreSubscribeStaffCollection,
  isEmailCredential,
  badgeAuthEmail,
  normalizeStaffPin,
  ensureStaffCloudIdentity,
  firestoreUpsertStaffMember,
  firestorePushStaffDirectory,
} from '../../lib/firebase';
import { apiCreateStaff, apiAtomicCreateStaff, apiListStaff, apiDbHealth } from '../../lib/db/clientApi';
import { emitLiveAction } from '../../lib/liveActions';
import { StaffIdCardView } from '../staffing/StaffIdCardView';
import { LogoProgressBar } from '../realtime/LogoProgressBar';
import type { StaffCardRecord } from '@medcore/types';
import type { UserSession } from '../auth/AuthScreen';
import { HOSPITALS } from '../auth/AuthScreen';
import { getCustomRoles } from '../../lib/rolePermissionsStore';
import { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';
import {
  Shield, Plus, Search, CheckCircle2, XCircle, Lock, UserPlus, IdCard, Trash2, Sliders,
  Layers, Pencil, Save, X as XIcon, Users, Printer, Copy, Check, Sparkles,
  Filter, ChevronRight, RefreshCw, Key, ShieldCheck, AlertTriangle, Eye,
} from 'lucide-react';
import { DuplicateCardModal } from '../staffing/DuplicateCardModal';
import { RoleMatrixManager } from './RoleMatrixManager';

export const ROLE_OPTIONS = [
  // Clinical specialties
  { roleKey: 'doctor', role: 'Medical Officer', title: 'Medical Officer (General / OPD)', shortRole: 'Doctor', clearanceLevel: 4, clearanceLabel: 'L4 Clinical', department: 'Internal Medicine', group: 'Clinical' },
  { roleKey: 'surgeon', role: 'Consultant Surgeon', title: 'Consultant Surgeon', shortRole: 'Surgeon', clearanceLevel: 5, clearanceLabel: 'L5 Surgery', department: 'Surgery & Theatre', group: 'Clinical' },
  { roleKey: 'radiologist', role: 'Radiologist', title: 'Consultant Radiologist', shortRole: 'Radiology', clearanceLevel: 5, clearanceLabel: 'L5 Radiology', department: 'Radiology', group: 'Clinical' },
  { roleKey: 'lab', role: 'Lab Scientist', title: 'Lab Scientist / Pathologist', shortRole: 'Lab', clearanceLevel: 3, clearanceLabel: 'L3 Lab', department: 'Pathology', group: 'Clinical' },
  { roleKey: 'pharmacist', role: 'Pharmacist', title: 'Pharmacist', shortRole: 'Pharmacist', clearanceLevel: 3, clearanceLabel: 'L3 Pharmacy', department: 'Pharmacy', group: 'Clinical' },
  { roleKey: 'medical_director', role: 'Medical Director', title: 'Medical Director', shortRole: 'Director', clearanceLevel: 5, clearanceLabel: 'L5 Director', department: 'Clinical Directorate', group: 'Clinical' },
  // Nursing
  { roleKey: 'nurse', role: 'Nursing Officer', title: 'Nursing Officer', shortRole: 'Nurse', clearanceLevel: 3, clearanceLabel: 'L3 Nursing', department: 'Inpatient Wards', group: 'Nursing' },
  { roleKey: 'midwife', role: 'Midwife', title: 'Midwife / Labour Ward', shortRole: 'Midwife', clearanceLevel: 3, clearanceLabel: 'L3 Midwifery', department: 'Maternity', group: 'Nursing' },
  // Front Desk & Records
  { roleKey: 'reception', role: 'Reception / Front Desk', title: 'Reception Officer', shortRole: 'Reception', clearanceLevel: 2, clearanceLabel: 'L2 Front Desk', department: 'Patient Reception', group: 'Front desk' },
  { roleKey: 'records', role: 'Records Officer', title: 'Health Records Officer', shortRole: 'Records', clearanceLevel: 2, clearanceLabel: 'L2 Records', department: 'Medical Records', group: 'Front desk' },
  // Support
  { roleKey: 'accountant', role: 'Finance Officer', title: 'Finance / Accounts Officer', shortRole: 'Accounts', clearanceLevel: 3, clearanceLabel: 'L3 Finance', department: 'Billing & Finance', group: 'Support' },
  { roleKey: 'biomedical', role: 'Biomedical Engineer', title: 'Biomedical Engineer', shortRole: 'Biomed', clearanceLevel: 3, clearanceLabel: 'L3 Biomed', department: 'Clinical Engineering', group: 'Support' },
  // Admin
  { roleKey: 'hospital_admin', role: 'Hospital Administrator', title: 'Hospital Administrator', shortRole: 'Admin', clearanceLevel: 5, clearanceLabel: 'L5 Executive', department: 'Administration', group: 'Admin' },
  { roleKey: 'sysadmin', role: 'ICT / System Admin', title: 'System Administrator', shortRole: 'SysAdmin', clearanceLevel: 6, clearanceLabel: 'L6 SysAdmin', department: 'ICT', group: 'Admin' },
];

const CLEARANCE_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  6: { label: 'L6 SysAdmin', color: '#0F172A', bg: '#F1F5F9' },
  5: { label: 'L5 Executive', color: '#EA580C', bg: '#FFF7ED' },
  4: { label: 'L4 Clinical', color: '#2563EB', bg: '#EFF6FF' },
  3: { label: 'L3 Practitioner', color: '#16A34A', bg: '#F0FDF4' },
  2: { label: 'L2 Support', color: '#0284C7', bg: '#F0F9FF' },
  1: { label: 'L1 Restricted', color: '#64748B', bg: '#F8FAFC' },
};

const STATUS_META = {
  active: { label: 'Active', color: '#16A34A', bg: '#DCFCE7' },
  suspended: { label: 'Suspended', color: '#EF4444', bg: '#FEE2E2' },
  pending: { label: 'Pending', color: '#EA580C', bg: '#FFEDD5' },
};

function getInitialStaffAccessRecords(facilityId: string): AccessRecord[] {
  if (typeof window === 'undefined') return [];
  const fid = (facilityId || '').trim().toUpperCase();
  const byId = new Map<string, AccessRecord>();

  try {
    const local = getAccessRecords();
    for (const r of local) {
      if (r && r.id) byId.set(String(r.id).toUpperCase(), r);
    }
  } catch { /* ignore */ }

  try {
    for (const c of listStaffCards()) {
      const cid = String(c.badgeId || '').toUpperCase();
      if (!cid) continue;
      if (c.facilityId && fid && String(c.facilityId).toUpperCase() !== fid) continue;
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
  } catch { /* ignore */ }

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

interface Props {
  session?: UserSession;
  initialTab?: 'directory' | 'enrol' | 'cards' | 'roles';
  onNavigate?: (moduleKey: string) => void;
}

export const AccessControl: React.FC<Props> = ({ session, initialTab = 'directory', onNavigate }) => {
  const facilityId = session?.hospitalId || HOSPITALS[0]?.id || 'IGH-EKT';
  const facilityName = session?.facility || HOSPITALS.find((h) => h.id === facilityId)?.name || 'Hospital';

  const [activeTab, setActiveTab] = useState<'directory' | 'enrol' | 'cards' | 'roles'>(initialTab);
  const [records, setRecords] = useState<AccessRecord[]>(() => getInitialStaffAccessRecords(facilityId));
  const [search, setSearch] = useState('');

  const staffSuggestions: SearchSuggestion[] = useMemo(() => {
    return records.slice(0, 30).map((s) => ({
      id: s.id,
      label: s.name,
      sub: s.id + ' · ' + s.role + ' · ' + s.department,
      category: s.department ? s.department.toUpperCase() : 'STAFF',
      icon: Users,
      onClick: () => setSearch(s.name),
    }));
  }, [records]);
  const [groupFilter, setGroupFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Enrol form state
  const [fullName, setFullName] = useState('');
  const [roleKey, setRoleKey] = useState(ROLE_OPTIONS[0]?.roleKey || 'doctor');
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [pin, setPin] = useState('123456');
  const [email, setEmail] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMeta, setPhotoMeta] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [createFail, setCreateFail] = useState<string | null>(null);
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
  } | null>(null);

  // Modals & Delete
  const [deleteTarget, setDeleteTarget] = useState<{ badgeId: string; name: string } | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<StaffDeleteSuccessInfo | null>(null);
  const [showDupModal, setShowDupModal] = useState(false);

  // Edit staff modal
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRoleKey, setEditRoleKey] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'suspended' | 'pending'>('active');
  const [editError, setEditError] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const availableRoles = useMemo(() => {
    try {
      const custom = getCustomRoles().map((c) => ({
        roleKey: c.roleKey,
        role: c.label,
        title: c.title || c.label,
        shortRole: c.shortRole || c.label,
        clearanceLevel: c.clearanceLevel || 3,
        clearanceLabel: c.clearanceLabel || `L${c.clearanceLevel || 3} Custom`,
        department: c.department || 'Clinical Operations',
        group: c.group || 'Custom',
      }));
      return [...ROLE_OPTIONS, ...custom];
    } catch {
      return ROLE_OPTIONS;
    }
  }, []);

  const roleMeta = useMemo(
    () => availableRoles.find((r) => r.roleKey === roleKey) || ROLE_OPTIONS[0],
    [availableRoles, roleKey]
  );

  // Live Card Preview for the Enrolment studio
  const livePreviewCard: StaffCardRecord = useMemo(() => {
    const short = roleMeta?.shortRole || 'Staff';
    const cl = roleMeta?.clearanceLevel || 4;
    const isAdmin = roleMeta?.roleKey === 'hospital_admin' || roleMeta?.roleKey === 'admin';
    const parts = (fullName.trim() || 'Staff Full Name').split(/\s+/);
    const initials = parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'ST';
    const tpl = (cl >= 5 ? 'TPL_EXEC' : cl >= 4 ? 'TPL_CLINICAL' : cl === 3 ? 'TPL_SUPPORT' : 'TPL_VISITOR') as any;
    const exp = new Date();
    exp.setFullYear(exp.getFullYear() + 2);
    const expiresAt = exp.toISOString().slice(0, 10);
    // Admin preview: show -ADM- infix; others: show standard preview
    const previewBadge = isAdmin ? 'IGH-ADM-YYYY-PREVIEW' : 'IGH-YYYY-PREVIEW';
    return {
      badgeId: previewBadge,
      fullName: fullName.trim() || 'Staff Full Name',
      role: roleMeta?.role || 'Medical Officer',
      roleKey: roleMeta?.roleKey || 'doctor',
      title: roleMeta?.title || roleMeta?.role || 'Medical Officer',
      department: roleMeta?.department || 'Internal Medicine',
      facilityId,
      facilityName,
      clearanceLevel: cl,
      clearanceLabel: roleMeta?.clearanceLabel || (cl >= 5 ? 'FULL ACCESS – EXECUTIVE' : cl >= 4 ? 'FULL ACCESS – CLINICAL' : 'ACCESS – SUPPORT'),
      templateKey: tpl,
      status: 'ACTIVE',
      issuedAt: new Date().toISOString(),
      expiresAt,
      photoUrl: photoUrl || undefined,
      initials,
      qrPayload: JSON.stringify({ v: 1, iss: 'medcore', badgeId: previewBadge, facilityId, clr: cl }),
    };
  }, [fullName, roleMeta, facilityId, facilityName, photoUrl]);

  // Read-only refresh
  const loadRecords = useCallback(() => {
    try {
      setRecords(getInitialStaffAccessRecords(facilityId));
    } catch { /* ignore */ }

    void apiListStaff(facilityId).then((res) => {
      if (!res.ok || !res.staff?.length) return;
      try {
        const mapped = res.staff.map((s: any) => ({
          id: String(s.badge_id || s.badgeId || ''),
          name: String(s.full_name || s.fullName || s.name || ''),
          role: String(s.role || ''),
          department: String(s.department || ''),
          clearance: Number(s.clearance_level || s.clearanceLevel || 2),
          status: (String(s.status || 'active') as 'active' | 'suspended' | 'pending'),
          lastLogin: '—',
          permissions: Array.isArray(s.permissions) ? (s.permissions as string[]) : [],
          email: s.email ? String(s.email) : undefined,
        }));
        if (mapped.length) {
          const byId = new Map<string, AccessRecord>();
          for (const r of getInitialStaffAccessRecords(facilityId)) {
            if (r?.id) byId.set(r.id.toUpperCase(), r);
          }
          for (const m of mapped) {
            if (m.id) {
              const prev = byId.get(m.id.toUpperCase());
              byId.set(m.id.toUpperCase(), prev ? { ...prev, ...m } : m);
            }
          }
          const merged = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
          setAccessRecords(merged);
          setRecords(merged);
        }
      } catch { /* ignore */ }
    });
  }, [facilityId]);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    try {
      (window as unknown as { __medcoreFlushStaff?: (fid?: string) => number }).__medcoreFlushStaff = (
        fid?: string
      ) => wipeFacilityStaffExceptAdmin(fid || facilityId);
    } catch { /* ignore */ }

    const applyCloudRows = (staffRows: Record<string, unknown>[]) => {
      if (!isMounted.current) return;
      const byId = new Map<string, AccessRecord>();

      try {
        const local = getAccessRecords();
        for (const r of local) {
          if (r && r.id) byId.set(String(r.id).toUpperCase(), r);
        }
      } catch { /* ignore */ }

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
      } catch { /* ignore */ }

      for (const s of staffRows) {
        const badgeId = String(s.badgeId || s.id || '').toUpperCase().replace(/\s+/g, '');
        if (!badgeId) continue;
        const st = String(s.status || 'active').toLowerCase();
        byId.set(badgeId, {
          id: badgeId,
          name: String(s.name || s.fullName || badgeId),
          role: String(s.role || s.shortRole || s.roleKey || 'Staff'),
          department: String(s.department || '—'),
          clearance: Number(s.clearanceLevel ?? s.clearance ?? 2),
          status: st === 'suspended' ? 'suspended' : st === 'pending' ? 'pending' : 'active',
          lastLogin: String(s.lastLoginAt || s.lastLogin || '—'),
          permissions: Array.isArray(s.permissions)
            ? (s.permissions as string[])
            : defaultPermissionsForRole(String(s.roleKey || s.role || 'staff')),
          email: s.email || s.workEmail ? String(s.email || s.workEmail) : undefined,
        });
      }

      const next = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
      setRecords(next);
      try {
        setAccessRecords(next);
      } catch { /* ignore */ }

      // Also mirror cloud staff to ID cards and local registry so other tabs (e.g. Cards gallery) reflect immediately
      if (staffRows.length > 0) {
        try {
          const cloudCards = staffRows.map((s) => {
            const bId = String(s.badgeId || s.id || '').toUpperCase().replace(/\s+/g, '');
            const fName = String(s.fullName || s.name || bId);
            const rk = String(s.roleKey || s.role || 'staff');
            return {
              badgeId: bId,
              fullName: fName,
              role: String(s.role || 'Staff'),
              roleKey: rk,
              title: String(s.title || ''),
              department: String(s.department || 'General'),
              facilityId: String(s.facilityId || s.hospitalId || facilityId),
              facilityName: String(s.facilityName || s.hospitalName || facilityName),
              clearanceLevel: Number(s.clearanceLevel ?? s.clearance ?? 1),
              clearanceLabel: String(s.clearanceLabel || 'Level 1'),
              templateKey: (s.templateKey as any) || 'TPL_CLINICAL',
              status: String(s.status || 'ACTIVE').toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED',
              issuedAt: String(s.issuedAt || s.createdAt || new Date().toISOString()),
              expiresAt: String(s.expiresAt || new Date(Date.now() + 2 * 365 * 864e5).toISOString()),
              photoUrl: s.photoUrl ? String(s.photoUrl) : undefined,
              initials: String(s.initials || fName.slice(0, 2).toUpperCase()),
              qrPayload: typeof s.qrPayload === 'string' ? s.qrPayload : undefined,
            };
          });
          applyCloudStaffDirectory({
            staffCards: cloudCards,
            staffRegistry: staffRows,
            facilityId,
          });
        } catch { /* ignore */ }
      }
    };

    applyCloudRows([]);

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let unsubCol: (() => void) | undefined;

    void (async () => {
      // Query server-side staff endpoint (Postgres + Firestore fallback)
      try {
        const res = await Promise.race([
          apiListStaff(facilityId),
          new Promise<any>((resolve) => setTimeout(() => resolve({ ok: false }), 3000)),
        ]);
        if (isMounted.current && res.ok && res.staff?.length) {
          applyCloudRows(res.staff);
        }
      } catch { /* ignore */ }

      unsubCol = firestoreSubscribeStaffCollection(facilityId, (staffRows) => {
        if (!isMounted.current || isStaffFlushLocked()) return;
        const rows = Array.isArray(staffRows) ? staffRows : [];
        if (rows.length === 0) return;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (!isMounted.current) return;
          applyCloudRows(rows as Record<string, unknown>[]);
        }, 120);
      });
    })();

    const onRosterUpdate = () => loadRecords();
    window.addEventListener('medcore-staff-cards-updated', onRosterUpdate);
    window.addEventListener('medcore-staff-registry-updated', onRosterUpdate);
    window.addEventListener('medcore-admin-sync', onRosterUpdate);

    return () => {
      isMounted.current = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      try { unsubCol?.(); } catch { /* ignore */ }
      window.removeEventListener('medcore-staff-cards-updated', onRosterUpdate);
      window.removeEventListener('medcore-staff-registry-updated', onRosterUpdate);
      window.removeEventListener('medcore-admin-sync', onRosterUpdate);
    };
  }, [facilityId, loadRecords]);

  // Filtered staff list
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        (r.department && r.department.toLowerCase().includes(q)) ||
        (r.email && r.email.toLowerCase().includes(q));

      if (!matchSearch) return false;

      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;

      if (groupFilter !== 'ALL') {
        const found = availableRoles.find((o) => (o.roleKey === (r as any).roleKey) || (o.role.toLowerCase() === r.role.toLowerCase()));
        if (found && (found as any).group !== groupFilter) return false;
      }

      return true;
    });
  }, [records, search, statusFilter, groupFilter, availableRoles]);

  const selected = useMemo(() => {
    if (!selectedId) return records[0] || null;
    return records.find((r) => r.id === selectedId) || records[0] || null;
  }, [records, selectedId]);

  const selectedCard = useMemo(() => {
    if (!selected) return undefined;
    return getStaffCard(selected.id);
  }, [selected]);

  // All facility cards for Gallery tab
  const allCards = useMemo(() => {
    try {
      return listActiveStaffCardsForFacility(facilityId);
    } catch {
      return [];
    }
  }, [facilityId, records]);

  const copyToClipboard = (text: string, keyName: string, customLabel?: string) => {
    try {
      void navigator.clipboard.writeText(text);
      setCopiedKey(keyName);
      setTimeout(() => setCopiedKey(null), 2500);
      const label =
        customLabel ||
        (keyName.includes('pin')
          ? 'Staff PIN'
          : keyName.includes('badge')
            ? 'Staff Badge ID'
            : 'Credentials');
      emitLiveAction(`Copied ${label} to clipboard`, { module: 'access' });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('medcore-toast', {
            detail: { message: `Copied ${label} to clipboard: ${text}` },
          })
        );
      }
    } catch {
      emitLiveAction('Copied to clipboard', { module: 'access' });
    }
  };

  const readPhotoFile = async (file: File | null) => {
    if (!file) {
      setPhotoUrl('');
      setPhotoMeta('');
      return;
    }
    setPhotoBusy(true);
    setError('');
    try {
      // Step 1: Compress client-side (canvas). Show preview immediately — never block UI on network.
      const result = await compressStaffPhotoFile(file);

      // Show the compressed dataUrl straight away so the form is never "frozen"
      setPhotoUrl(result.dataUrl);
      setPhotoMeta(`${result.width}×${result.height} · ~${Math.round(result.bytesApprox / 1024)} KB · uploading…`);
      setPhotoBusy(false); // unlock the form; upload continues in background

      // Step 2: Try S3 upload in the background with a hard 10-second timeout.
      // Build a Blob directly from the compressed dataUrl to avoid sending a huge JSON body.
      let uploadBlob: Blob | null = null;
      try {
        const { dataUrlToBlob } = await import('../../lib/staffPhoto');
        uploadBlob = dataUrlToBlob(result.dataUrl);
      } catch { /* ignore — fall back to dataUrl path */ }

      const uploadPromise = uploadBlob
        ? uploadImageToS3(uploadBlob, { folder: 'staff', filename: 'staff-headshot.jpg' })
        : uploadImageToS3(result.dataUrl, { folder: 'staff', filename: 'staff-headshot.jpg' });

      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000));

      const s3Res = await Promise.race([uploadPromise, timeoutPromise]);

      if (s3Res && s3Res.ok && s3Res.url && s3Res.isS3) {
        // Promote from local dataUrl to permanent S3 URL
        setPhotoUrl(s3Res.url);
        setPhotoMeta(`${result.width}×${result.height} · ~${Math.round(result.bytesApprox / 1024)} KB · AWS S3`);
      } else {
        // S3 unavailable / timed out — keep the compressed dataUrl (fully functional)
        setPhotoMeta(`${result.width}×${result.height} · ~${Math.round(result.bytesApprox / 1024)} KB · local`);
      }
    } catch (err) {
      setPhotoUrl('');
      setPhotoMeta('');
      setPhotoBusy(false);
      setError((err as Error)?.message || 'Could not process photo.');
    }
  };

  const handleGeneratePin = () => {
    const random = Math.floor(100000 + Math.random() * 900000).toString();
    setPin(random);
  };

  // Submit Enrolment
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreateFail(null);

    if (!fullName.trim()) {
      setError('Enter staff full name.');
      return;
    }
    if (!roleKey || !roleMeta) {
      setError('Select a specialty / role.');
      return;
    }
    if (!String(pin || '').trim() || String(pin || '').trim().length < 4) {
      setError('Enter a secure sign-in PIN (min 4-6 digits).');
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
    // Never pass undefined to Firestore — use null or omit the field
    const photoSnap = photoUrl || null;

    try {
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
        photoUrl: photoSnap || undefined,
        email: mail || undefined,
      });

      let card = prepared.card;
      const badgeId = card.badgeId;

      let finalPhoto = photoSnap;
      try {
        finalPhoto = (await resolveStaffPhotoForEnrol(facilityId, badgeId, photoSnap || undefined)) || photoSnap;
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
        roleKey: roleMeta.roleKey,
        department: roleMeta.department,
        clearance: roleMeta.clearanceLevel,
        status: 'active',
        lastLogin: 'Never',
        permissions: defaultPermissionsForRole(roleMeta.roleKey),
        email: mail || undefined,
      };

      // 1) Commit local first
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
          photoUrl: finalPhoto || undefined,
          email: mail || undefined,
        },
        card,
        { ...prepared.entry, pin: pinNorm, email: mail || undefined, photoUrl: finalPhoto || undefined }
      );

      const nextAccess = [accessRow, ...getAccessRecords().filter((r) => r.id !== accessRow.id)];
      setAccessRecords(nextAccess);
      setRecords(nextAccess);

      pushActivity(`Staff Enrolled · ${nameSnap} · ${badgeId} · Digital ID issued`);
      emitLiveAction(`Staff enrolled · ${badgeId}`, { module: 'access' });

      setIssued(card);
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
      });

      setFullName('');
      setEmail('');
      setPhotoUrl('');
      setPhotoMeta('');
      setBusy(false);

      // Background cloud sync
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
        photoUrl: finalPhoto || undefined,
      };

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
          photoUrl: finalPhoto || undefined,
          pin: pinNorm,
          authEmail: badgeAuthEmail(badgeId),
        });
      } catch { /* ignore */ }

      try {
        void apiAtomicCreateStaff({
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
          templateKey: card.templateKey || 'TPL_CLINICAL',
          photoUrl: finalPhoto || undefined,
          pin: pinNorm,
        });
      } catch { /* ignore */ }

      try {
        void ensureStaffCloudIdentity({
          facilityId,
          badgeId,
          pin: pinNorm,
          email: mail || undefined,
          profile: profilePayload,
        });
      } catch { /* ignore */ }
    } catch (err: unknown) {
      console.error('[access] create failed', err);
      setError((err as Error)?.message || 'Account creation failed.');
      setCreateFail((err as Error)?.message || 'Account creation failed.');
      setBusy(false);
    }
  };

  const handleDelete = (badgeId: string, name: string) => {
    const id = String(badgeId || '').toUpperCase();
    // Guard: cannot remove facility admin (any badge with -ADM- infix and sequence 1001)
    if (id === 'AKS-ADM-001' || id.includes('ADM-001') || /^[A-Z]+-ADM-\d{4}-1001$/.test(id)) {
      setError('The facility administrator account cannot be removed.');
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
      deleteStaffMember(id);
      const next = getAccessRecords().filter((r) => String(r.id).toUpperCase() !== id);
      setAccessRecords(next);
      setRecords(next);
      if (selectedId && String(selectedId).toUpperCase() === id) {
        setSelectedId(null);
        setIssued(null);
      }
      if (confirmInfo?.badgeId?.toUpperCase() === id) setConfirmInfo(null);

      setDeleteTarget(null);
      pushActivity(`Account deleted · ${name} · ${id}`);
      emitLiveAction(`Deleted staff ${id}`, { module: 'access' });
      setDeleteSuccess({
        name,
        badgeId: id,
        authDeleted: true,
      });

      void (async () => {
        try {
          const { firestoreDeleteStaffMember, firestoreRevokeStaff, deleteStaffFirebaseAuth } = await import('../../lib/firebase');
          await Promise.allSettled([
            firestoreRevokeStaff(facilityId, id, { name }),
            firestoreDeleteStaffMember(facilityId, id),
            deleteStaffFirebaseAuth({ badgeId: id, facilityId }),
          ]);
        } catch { /* ignore */ }
      })();
    } catch (err: any) {
      setError(err?.message || 'Delete failed.');
    }
  };

  const handlePrintCard = () => {
    try {
      window.print();
    } catch { /* ignore */ }
  };

  return (
    <div className="os-module-layout" style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 60 }}>
      {/* ── Top Executive Title Banner ── */}
      <div className="os-insight-banner" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: '20px 24px', boxShadow: '0 4px 16px rgba(15,23,42,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #0052D4, #0D9488)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, boxShadow: '0 8px 16px rgba(0,82,212,0.2)' }}>
              <Shield size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#0052D4', background: '#EFF6FF', padding: '3px 8px', borderRadius: 6 }}>
                  IAM & Security Governance
                </span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16A34A', background: '#DCFCE7', padding: '3px 8px', borderRadius: 6 }}>
                  {facilityName} · {facilityId}
                </span>
              </div>
              <h1 style={{ margin: '6px 0 2px', fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
                Staff Access & Enrolment Hub
              </h1>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748B', lineHeight: 1.45 }}>
                Unified administration for hospital staff credentials, clinical role permissions, account activation, and instant digital ID card issuance.
              </p>
            </div>
          </div>

          {/* Quick Header Navigation Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', padding: 5, borderRadius: 12, border: '1px solid #E2E8F0' }}>
            <button
              type="button"
              onClick={() => setActiveTab('directory')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 14px',
                borderRadius: 9,
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                background: activeTab === 'directory' ? '#0052D4' : 'transparent',
                color: activeTab === 'directory' ? '#FFFFFF' : '#475569',
                boxShadow: activeTab === 'directory' ? '0 4px 12px rgba(0,82,212,0.25)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Users size={16} />
              <span>Staff Directory</span>
              <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: 999, background: activeTab === 'directory' ? 'rgba(255,255,255,0.25)' : '#E2E8F0', color: activeTab === 'directory' ? '#fff' : '#64748B' }}>
                {records.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('enrol')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 14px',
                borderRadius: 9,
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                background: activeTab === 'enrol' ? '#0052D4' : 'transparent',
                color: activeTab === 'enrol' ? '#FFFFFF' : '#475569',
                boxShadow: activeTab === 'enrol' ? '0 4px 12px rgba(0,82,212,0.25)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <UserPlus size={16} />
              <span>Enrol New Staff</span>
              <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: 999, background: activeTab === 'enrol' ? 'rgba(255,255,255,0.25)' : '#E0F2FE', color: activeTab === 'enrol' ? '#fff' : '#0284C7' }}>
                + Issue Card
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('cards')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 14px',
                borderRadius: 9,
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                background: activeTab === 'cards' ? '#0052D4' : 'transparent',
                color: activeTab === 'cards' ? '#FFFFFF' : '#475569',
                boxShadow: activeTab === 'cards' ? '0 4px 12px rgba(0,82,212,0.25)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <IdCard size={16} />
              <span>ID Badges</span>
              <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: 999, background: activeTab === 'cards' ? 'rgba(255,255,255,0.25)' : '#E2E8F0', color: activeTab === 'cards' ? '#fff' : '#64748B' }}>
                {countActiveStaffCards(facilityId)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('roles')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 14px',
                borderRadius: 9,
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                background: activeTab === 'roles' ? '#0052D4' : 'transparent',
                color: activeTab === 'roles' ? '#FFFFFF' : '#475569',
                boxShadow: activeTab === 'roles' ? '0 4px 12px rgba(0,82,212,0.25)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Sliders size={16} />
              <span>Role Matrix & Tools</span>
              <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: 999, background: activeTab === 'roles' ? 'rgba(255,255,255,0.25)' : '#F1F5F9', color: activeTab === 'roles' ? '#fff' : '#64748B' }}>
                Studio
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Metric Highlights Ribbon ── */}
      <div className="os-metrics-ribbon" style={{ margin: '16px 0 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <div className="metric-box alert-green" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 18px' }}>
          <span className="metric-label" style={{ color: '#16A34A', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
            <CheckCircle2 size={14} /> Active Accounts
          </span>
          <span className="metric-val" style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', display: 'block', margin: '4px 0' }}>
            {records.filter((r) => r.status === 'active').length}
          </span>
          <span className="metric-sub" style={{ fontSize: '0.78rem', color: '#64748B' }}>Authorized to sign into OS</span>
        </div>

        <div className="metric-box" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 18px' }}>
          <span className="metric-label" style={{ color: '#0052D4', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
            <IdCard size={14} /> Verified ID Cards
          </span>
          <span className="metric-val" style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', display: 'block', margin: '4px 0' }}>
            {countActiveStaffCards(facilityId)}
          </span>
          <span className="metric-sub" style={{ fontSize: '0.78rem', color: '#64748B' }}>Active tamper-evident badges</span>
        </div>

        <div className="metric-box" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 18px' }}>
          <span className="metric-label" style={{ color: '#EF4444', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
            <XCircle size={14} /> Suspended / Blocked
          </span>
          <span className="metric-val" style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', display: 'block', margin: '4px 0' }}>
            {records.filter((r) => r.status === 'suspended').length}
          </span>
          <span className="metric-sub" style={{ fontSize: '0.78rem', color: '#64748B' }}>Login revoked immediately</span>
        </div>

        <div className="metric-box" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 18px' }}>
          <span className="metric-label" style={{ color: '#D97706', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
            <ShieldCheck size={14} /> Hospital Clearance
          </span>
          <span className="metric-val" style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', display: 'block', margin: '4px 0' }}>
            L1 – L6
          </span>
          <span className="metric-sub" style={{ fontSize: '0.78rem', color: '#64748B' }}>Role-enforced desk locking</span>
        </div>
      </div>

      {/* ── Global Confirm Success Banner ── */}
      {confirmInfo && (
        <div
          style={{
            background: 'linear-gradient(135deg, #F0FDF4 0%, #ECFEFF 100%)',
            border: '1.5px solid #86EFAC',
            borderRadius: 14,
            padding: '16px 20px',
            marginBottom: 20,
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#16A34A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
                  Staff Enrolled & ID Card Generated · {confirmInfo.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
                  {confirmInfo.role} · {confirmInfo.department} · Registered into hospital access roster
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setConfirmInfo(null)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20, color: '#64748B', padding: '4px 8px' }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: '#FFFFFF', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Staff ID:</span>
              <code style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0052D4', background: '#EFF6FF', padding: '2px 8px', borderRadius: 6 }}>
                {confirmInfo.badgeId}
              </code>
              <button
                type="button"
                className="os-ghost-btn"
                style={{ padding: '3px 8px', fontSize: '0.75rem', height: 26, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                onClick={() => copyToClipboard(confirmInfo.badgeId, 'badgeId-confirm')}
              >
                {copiedKey === 'badgeId-confirm' ? <Check size={12} color="#16A34A" /> : <Copy size={12} />}
                {copiedKey === 'badgeId-confirm' ? 'Copied' : 'Copy ID'}
              </button>
            </div>

            <div style={{ width: 1, height: 20, background: '#E2E8F0' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>PIN:</span>
              <code style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', background: '#F8FAFC', padding: '2px 8px', borderRadius: 6 }}>
                {confirmInfo.pin}
              </code>
              <button
                type="button"
                className="os-ghost-btn"
                style={{ padding: '3px 8px', fontSize: '0.75rem', height: 26, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                onClick={() => copyToClipboard(confirmInfo.pin, 'pin-confirm')}
              >
                {copiedKey === 'pin-confirm' ? <Check size={12} color="#16A34A" /> : <Copy size={12} />}
                {copiedKey === 'pin-confirm' ? 'Copied' : 'Copy PIN'}
              </button>
            </div>

            {confirmInfo.email && (
              <>
                <div style={{ width: 1, height: 20, background: '#E2E8F0' }} />
                <span style={{ fontSize: '0.8rem', color: '#64748B' }}>{confirmInfo.email}</span>
              </>
            )}

            <button
              type="button"
              className="os-ghost-btn"
              style={{
                padding: '3px 10px',
                fontSize: '0.75rem',
                height: 26,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: '#F1F5F9',
                fontWeight: 600,
              }}
              onClick={() =>
                copyToClipboard(
                  `Staff: ${confirmInfo.name} | ID: ${confirmInfo.badgeId} | PIN: ${confirmInfo.pin} | Role: ${confirmInfo.role}`,
                  'all-confirm',
                  'All Credentials'
                )
              }
            >
              {copiedKey === 'all-confirm' ? <Check size={12} color="#16A34A" /> : <Copy size={12} />}
              {copiedKey === 'all-confirm' ? 'Copied All' : 'Copy All'}
            </button>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className="os-ghost-btn"
                style={{ padding: '5px 12px', fontSize: '0.78rem', height: 28, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                onClick={() => {
                  setSelectedId(confirmInfo.badgeId);
                  setActiveTab('directory');
                }}
              >
                <Eye size={13} /> View in Directory
              </button>
              <button
                type="button"
                className="os-primary-btn"
                style={{ padding: '5px 12px', fontSize: '0.78rem', height: 28 }}
                onClick={() => setConfirmInfo(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 1: STAFF DIRECTORY & ACCESS CONTROL
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'directory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Filter and Action Strip */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: '#FFFFFF', padding: '12px 18px', borderRadius: 14, border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 280 }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <InteractiveSearchBar
                  value={search}
                  onChange={setSearch}
                  onClear={() => setSearch('')}
                  placeholder="Search staff by name, role, department or badge ID…"
                  suggestions={staffSuggestions}
                  resultsCount={filteredRecords.length}
                  totalCount={records.length}
                  size="sm"
                  aria-label="Search staff directory"
                />
              </div>

              {/* Group Filter */}
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}
              >
                <option value="ALL">All Departments</option>
                <option value="Clinical">Clinical Specialties</option>
                <option value="Nursing">Nursing & Maternity</option>
                <option value="Front desk">Front Desk & Records</option>
                <option value="Support">Support & Engineering</option>
                <option value="Admin">Executive & Admin</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}
              >
                <option value="ALL">All Status</option>
                <option value="active">Active Only</option>
                <option value="suspended">Suspended Only</option>
                <option value="pending">Pending Approval</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className="os-ghost-btn"
                onClick={() => setShowDupModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', height: 38 }}
                title="Scan for duplicate staff accounts or card conflicts"
              >
                <Layers size={15} /> Find Duplicates
              </button>
              <button
                type="button"
                className="os-primary-btn"
                onClick={() => setActiveTab('enrol')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', height: 38, background: '#0052D4', color: '#fff' }}
              >
                <UserPlus size={16} /> Enrol New Staff
              </button>
            </div>
          </div>

          {/* Directory Split View: Table + Inspector */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 380px)', gap: 16, alignItems: 'start' }}>
            {/* Staff Accounts Table */}
            <div className="os-card" style={{ padding: 0, overflow: 'hidden', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFAFA' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0F172A' }}>
                  Workforce Directory ({filteredRecords.length})
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  Click row to inspect credentials & print card
                </span>
              </div>

              <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
                <table className="os-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#F8FAFC', zIndex: 10 }}>
                    <tr>
                      <th style={{ padding: '10px 14px', fontSize: '0.74rem', textTransform: 'uppercase', color: '#64748B' }}>Staff Member</th>
                      <th style={{ padding: '10px 14px', fontSize: '0.74rem', textTransform: 'uppercase', color: '#64748B' }}>Badge ID</th>
                      <th style={{ padding: '10px 14px', fontSize: '0.74rem', textTransform: 'uppercase', color: '#64748B' }}>Specialty / Dept</th>
                      <th style={{ padding: '10px 14px', fontSize: '0.74rem', textTransform: 'uppercase', color: '#64748B' }}>Clearance</th>
                      <th style={{ padding: '10px 14px', fontSize: '0.74rem', textTransform: 'uppercase', color: '#64748B' }}>Status</th>
                      <th style={{ padding: '10px 14px', fontSize: '0.74rem', textTransform: 'uppercase', color: '#64748B', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>
                          <Users size={32} style={{ color: '#94A3B8', marginBottom: 8 }} />
                          <div style={{ fontWeight: 700, fontSize: '0.94rem', color: '#0F172A' }}>No staff accounts found</div>
                          <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                            {search ? 'Try clearing your search query' : 'Get started by enrolling staff members'}
                          </div>
                          <button
                            type="button"
                            className="os-primary-btn"
                            style={{ margin: '14px auto 0', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            onClick={() => setActiveTab('enrol')}
                          >
                            <UserPlus size={15} /> Enrol New Staff
                          </button>
                        </td>
                      </tr>
                    )}
                    {filteredRecords.map((r) => {
                      const st = STATUS_META[r.status] || STATUS_META.pending;
                      const cl = CLEARANCE_LABELS[r.clearance] || CLEARANCE_LABELS[2];
                      const isSelected = selected?.id === r.id;
                      const card = getStaffCard(r.id);

                      return (
                        <tr
                          key={r.id}
                          onClick={() => setSelectedId(r.id)}
                          style={{
                            cursor: 'pointer',
                            background: isSelected ? '#EFF6FF' : undefined,
                            borderLeft: isSelected ? '4px solid #0052D4' : '4px solid transparent',
                            transition: 'background 0.12s ease',
                          }}
                        >
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', background: '#E2E8F0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {card?.photoUrl ? (
                                  <img src={card.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#475569' }}>
                                    {r.name.slice(0, 2).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0F172A' }}>{r.name}</div>
                                {r.email && <div style={{ fontSize: '0.74rem', color: '#64748B' }}>{r.email}</div>}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <code style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.78rem', background: '#F1F5F9', padding: '3px 6px', borderRadius: 5, color: '#0052D4', fontWeight: 700 }}>
                              {r.id}
                            </code>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0F172A' }}>{r.role}</div>
                            <div style={{ fontSize: '0.74rem', color: '#64748B' }}>{r.department}</div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: cl.color, background: cl.bg, padding: '3px 8px', borderRadius: 6 }}>
                              {cl.label}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: st.color, background: st.bg, padding: '3px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.color }} />
                              {st.label}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                              {r.status === 'suspended' ? (
                                <button
                                  type="button"
                                  className="os-ghost-btn"
                                  style={{ padding: '4px 8px', fontSize: '0.74rem', color: '#16A34A', borderColor: '#BBF7D0' }}
                                  onClick={() => { reactivateAccess(r.id); loadRecords(); }}
                                  title="Reactivate staff access"
                                >
                                  Reactivate
                                </button>
                              ) : r.status === 'pending' ? (
                                <button
                                  type="button"
                                  className="os-ghost-btn"
                                  style={{ padding: '4px 8px', fontSize: '0.74rem', color: '#2563EB', borderColor: '#BFDBFE' }}
                                  onClick={() => { approveAccess(r.id); loadRecords(); }}
                                  title="Approve access"
                                >
                                  Approve
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="os-ghost-btn"
                                  style={{ padding: '4px 8px', fontSize: '0.74rem', color: '#DC2626', borderColor: '#FECACA' }}
                                  onClick={() => { suspendAccess(r.id); loadRecords(); }}
                                  title="Suspend access"
                                >
                                  Suspend
                                </button>
                              )}

                              <button
                                type="button"
                                className="os-ghost-btn"
                                style={{ padding: '4px 8px', fontSize: '0.74rem', color: '#0052D4', borderColor: '#BFDBFE' }}
                                onClick={() => {
                                  setSelectedId(r.id);
                                  setEditId(r.id);
                                  setEditName(r.name);
                                  setEditRoleKey((r as any).roleKey || '');
                                  setEditDept(r.department || '');
                                  setEditPhone((r as any).phone || '');
                                  setEditEmail(r.email || '');
                                  setEditStatus(r.status as any);
                                  setEditError('');
                                }}
                                title="Edit staff details"
                              >
                                <Pencil size={12} />
                              </button>

                              <button
                                type="button"
                                className="os-ghost-btn"
                                style={{ padding: '4px 8px', fontSize: '0.74rem', color: '#991B1B', borderColor: '#FECACA' }}
                                disabled={busy}
                                onClick={() => handleDelete(r.id, r.name)}
                                title="Delete account"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Pane: Staff Inspector & Live ID Card */}
            <div className="os-card" style={{ padding: 18, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, position: 'sticky', top: 20 }}>
              {!selected ? (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748B' }}>
                  <IdCard size={40} style={{ color: '#CBD5E1', marginBottom: 12 }} />
                  <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#0F172A' }}>No staff selected</div>
                  <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                    Select any staff member from the roster to view permissions and print their official ID card.
                  </div>
                </div>
              ) : editId === selected.id ? (
                /* Edit Staff Form */
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

                      try {
                        for (const key of ['medcore_os_staff_registry', 'medcore_staff_registry']) {
                          const raw = localStorage.getItem(key);
                          const arr = raw ? JSON.parse(raw) : [];
                          if (!Array.isArray(arr)) continue;
                          const next = arr.map((r: Record<string, unknown>) => {
                            const bid = String(r.badgeId || r.id || '').toUpperCase();
                            if (bid !== badge) return r;
                            return { ...r, name, fullName: name, email: mail || r.email, workEmail: mail || r.workEmail, department: editDept || r.department, status: editStatus || r.status };
                          });
                          localStorage.setItem(key, JSON.stringify(next));
                        }
                        for (const key of ['medcore_staff_id_cards', 'medcore_os_staff_cards']) {
                          const cardRaw = localStorage.getItem(key);
                          if (!cardRaw) continue;
                          const carr = JSON.parse(cardRaw);
                          if (!Array.isArray(carr)) continue;
                          const nextCards = carr.map((c: Record<string, unknown>) =>
                            String(c.badgeId || '').toUpperCase() === badge ? { ...c, fullName: name } : c
                          );
                          localStorage.setItem(key, JSON.stringify(nextCards));
                        }
                        window.dispatchEvent(new CustomEvent('medcore-staff-cards-updated'));
                        window.dispatchEvent(new CustomEvent('medcore-admin-sync'));
                      } catch { /* ignore */ }

                      try {
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
                      } catch { /* ignore */ }

                      setEditId(null);
                    } catch {
                      setEditError('Save failed. Please try again.');
                    } finally {
                      setEditBusy(false);
                    }
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Pencil size={16} color="#0052D4" />
                      <span style={{ fontWeight: 800, fontSize: '0.94rem', color: '#0F172A' }}>Edit Staff Account</span>
                    </div>
                    <button type="button" onClick={() => setEditId(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}>
                      <XIcon size={16} />
                    </button>
                  </div>

                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569' }}>
                    Full name
                    <input className="os-search-input" style={{ width: '100%', marginTop: 4, padding: '8px 10px' }} value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </label>

                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569' }}>
                    Department / Unit
                    <input className="os-search-input" style={{ width: '100%', marginTop: 4, padding: '8px 10px' }} value={editDept} onChange={(e) => setEditDept(e.target.value)} />
                  </label>

                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569' }}>
                    Work email
                    <input className="os-search-input" style={{ width: '100%', marginTop: 4, padding: '8px 10px' }} type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                  </label>

                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569' }}>
                    Access Status
                    <select className="os-form-select" style={{ width: '100%', marginTop: 4, padding: '8px 10px' }} value={editStatus} onChange={(e) => setEditStatus(e.target.value as any)}>
                      <option value="active">Active (Can Sign In)</option>
                      <option value="suspended">Suspended (Blocked)</option>
                      <option value="pending">Pending Approval</option>
                    </select>
                  </label>

                  {editError && <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>{editError}</div>}

                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <button type="button" onClick={() => setEditId(null)} className="os-ghost-btn" style={{ flex: 1, padding: 8 }}>Cancel</button>
                    <button type="submit" disabled={editBusy} className="os-primary-btn" style={{ flex: 1, padding: 8, justifyContent: 'center' }}>
                      <Save size={14} /> {editBusy ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </form>
              ) : (
                /* Staff Profile & Card Inspection */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>{selected.name}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 2 }}>
                        {selected.role} · {selected.department}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="os-ghost-btn"
                      style={{ padding: '4px 8px', fontSize: '0.74rem', color: '#0052D4' }}
                      onClick={() => {
                        setEditId(selected.id);
                        setEditName(selected.name);
                        setEditRoleKey((selected as any).roleKey || '');
                        setEditDept(selected.department || '');
                        setEditPhone((selected as any).phone || '');
                        setEditEmail(selected.email || '');
                        setEditStatus(selected.status as any);
                        setEditError('');
                      }}
                    >
                      <Pencil size={12} /> Edit
                    </button>
                  </div>

                  {/* Badge & Security Meta */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: '#F8FAFC', padding: 10, borderRadius: 10, border: '1px solid #E2E8F0', fontSize: '0.76rem' }}>
                    <div>
                      <span style={{ color: '#64748B', display: 'block', fontSize: '0.7rem' }}>BADGE ID</span>
                      <strong style={{ fontFamily: 'var(--os-font-mono)', color: '#0052D4' }}>{selected.id}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748B', display: 'block', fontSize: '0.7rem' }}>CLEARANCE</span>
                      <strong>{CLEARANCE_LABELS[selected.clearance]?.label || 'L2 Support'}</strong>
                    </div>
                  </div>

                  {/* Vertical ID Card Display */}
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0' }}>
                    {selectedCard ? (
                      <StaffIdCardView card={selectedCard} compact={true} />
                    ) : (
                      <div style={{ padding: 24, textAlign: 'center', background: '#F8FAFC', borderRadius: 12, border: '1px dashed #CBD5E1', color: '#64748B', fontSize: '0.8rem', width: '100%' }}>
                        <IdCard size={28} style={{ color: '#94A3B8', marginBottom: 6 }} />
                        <div>No physical card rendered yet</div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="os-primary-btn"
                      style={{ flex: 1, justifyContent: 'center', gap: 6, fontSize: '0.8rem', height: 34 }}
                      onClick={handlePrintCard}
                    >
                      <Printer size={14} /> Print ID Card
                    </button>
                    <button
                      type="button"
                      className="os-ghost-btn"
                      style={{ padding: '0 12px', fontSize: '0.8rem', height: 34, color: '#DC2626', borderColor: '#FECACA' }}
                      disabled={busy}
                      onClick={() => handleDelete(selected.id, selected.name)}
                      title="Delete account"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 2: ENROL NEW STAFF STUDIO (SIDE-BY-SIDE LIVE PREVIEW)
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'enrol' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(360px, 420px)', gap: 24, alignItems: 'start' }}>
          {/* Left Column: The Enrolment Form */}
          <form className="os-panel" onSubmit={handleCreate} style={{ padding: 24, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 16, borderBottom: '1px solid #F1F5F9', marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EFF6FF', color: '#0052D4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserPlus size={18} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
                  Enrol New Staff Member
                </h2>
                <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                  Issues hospital sign-in credentials and automatically prints/generates vertical staff ID card.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Name & Email Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>
                  Full Name *
                  <input
                    className="os-search-input"
                    style={{ width: '100%', marginTop: 6, padding: '10px 12px', fontSize: '0.88rem' }}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Ngozi Eze"
                    required
                  />
                </label>

                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>
                  Work Email (Optional)
                  <input
                    className="os-search-input"
                    style={{ width: '100%', marginTop: 6, padding: '10px 12px', fontSize: '0.88rem' }}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@hospital.gov.ng"
                  />
                </label>
              </div>

              {/* Specialty & Role */}
              <div style={{ position: 'relative' }}>
                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                  Hospital Specialty & Access Role *
                </label>
                <button
                  type="button"
                  onClick={() => setRoleMenuOpen((o) => !o)}
                  style={{
                    display: 'flex',
                    width: '100%',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    color: '#0F172A',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Shield size={16} color="#0052D4" />
                    <span>{roleMeta.title}</span>
                    <span style={{ fontSize: '0.72rem', background: '#F1F5F9', color: '#64748B', padding: '2px 7px', borderRadius: 4, fontWeight: 600 }}>
                      {roleMeta.department}
                    </span>
                  </div>
                  <span style={{ color: '#94A3B8', fontSize: 12 }}>{roleMenuOpen ? '▲' : '▼'}</span>
                </button>

                {roleMenuOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      zIndex: 50,
                      left: 0,
                      right: 0,
                      top: '100%',
                      marginTop: 4,
                      maxHeight: 280,
                      overflowY: 'auto',
                      background: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: 12,
                      boxShadow: '0 16px 36px rgba(15,23,42,0.16)',
                    }}
                  >
                    {['Clinical', 'Nursing', 'Front desk', 'Support', 'Admin', 'Custom'].map((g) => {
                      const matches = availableRoles.filter((r) => ((r as any).group || 'Custom') === g);
                      if (!matches.length) return null;
                      return (
                        <div key={g}>
                          <div style={{ padding: '6px 12px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', background: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #F1F5F9' }}>
                            {g} Specialties
                          </div>
                          {matches.map((r) => {
                            const isSelected = roleKey === r.roleKey;
                            return (
                              <button
                                key={r.roleKey}
                                type="button"
                                onClick={() => {
                                  setRoleKey(r.roleKey);
                                  setRoleMenuOpen(false);
                                }}
                                style={{
                                  display: 'flex',
                                  width: '100%',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  textAlign: 'left',
                                  border: 'none',
                                  borderBottom: '1px solid #F8FAFC',
                                  background: isSelected ? '#EFF6FF' : '#FFF',
                                  color: isSelected ? '#0052D4' : '#1E293B',
                                  padding: '9px 14px',
                                  cursor: 'pointer',
                                  fontSize: '0.84rem',
                                  fontWeight: isSelected ? 700 : 500,
                                }}
                              >
                                <div>
                                  <div>{r.title}</div>
                                  <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{r.department}</div>
                                </div>
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: isSelected ? '#DBEAFE' : '#F1F5F9', color: isSelected ? '#1E40AF' : '#475569' }}>
                                  {r.clearanceLabel}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Role Guidance Callout */}
                <div style={{ marginTop: 8, fontSize: '0.76rem', color: '#0369A1', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 8, padding: '8px 12px', lineHeight: 1.45 }}>
                  <strong>{roleMeta.title} ({roleMeta.clearanceLabel})</strong>: Access restricted to authorized department desks. Clinical orders and CPOE stay strictly confined to licensed prescribers.
                </div>
              </div>

              {/* Facility & Security PIN */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>
                  Hospital Facility
                  <div style={{ marginTop: 6, padding: '10px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: '0.84rem', color: '#334155', fontWeight: 600 }}>
                    {facilityName} · Locked
                  </div>
                </label>

                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Sign-in PIN (6 Digits) *</span>
                    <button type="button" onClick={handleGeneratePin} style={{ border: 'none', background: 'transparent', color: '#0052D4', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
                      Auto-Generate
                    </button>
                  </div>
                  <input
                    className="os-search-input"
                    style={{ width: '100%', marginTop: 6, padding: '10px 12px', fontSize: '0.88rem', fontFamily: 'var(--os-font-mono)' }}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    maxLength={12}
                    required
                  />
                </label>
              </div>

              {/* Headshot Photo Upload */}
              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                  Staff Headshot (For Physical ID Badge)
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: 14,
                    borderRadius: 12,
                    border: '1.5px dashed #CBD5E1',
                    background: '#F8FAFC',
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      padding: 3,
                      background: 'linear-gradient(145deg, #FDE68A 0%, #F59E0B 40%, #D97706 100%)',
                      boxShadow: '0 4px 12px rgba(217,119,6,0.25)',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {photoUrl ? (
                        <img src={photoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Headshot</span>
                      )}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 160 }}>
                    <input
                      type="file"
                      accept="image/*,.jpg,.jpeg,.png,.webp"
                      disabled={photoBusy || busy}
                      onChange={(e) => {
                        void readPhotoFile(e.target.files?.[0] || null);
                        e.target.value = '';
                      }}
                      style={{ fontSize: '0.8rem', width: '100%' }}
                    />
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 4 }}>
                      {photoBusy ? 'Optimizing photo headshot…' : photoMeta ? `Ready · ${photoMeta}` : 'Works with mobile camera or passport headshot'}
                    </div>
                    {photoUrl && (
                      <button
                        type="button"
                        onClick={() => { setPhotoUrl(''); setPhotoMeta(''); }}
                        style={{ border: 'none', background: 'transparent', color: '#DC2626', fontSize: '0.72rem', fontWeight: 600, padding: 0, marginTop: 4, cursor: 'pointer' }}
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {error && (
                <div style={{ color: '#DC2626', fontSize: '0.82rem', fontWeight: 700, background: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 14px', borderRadius: 8 }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="os-primary-btn"
                style={{ padding: '12px 18px', fontSize: '0.94rem', fontWeight: 800, justifyContent: 'center', marginTop: 4, background: '#0052D4' }}
              >
                <Plus size={18} /> {busy ? 'Enrolling & Issuing ID Card…' : 'Complete Enrolment & Issue Staff ID'}
              </button>

              <LogoProgressBar active={busy} label="Generating tamper-evident ID card & synchronizing access..." />
            </div>
          </form>

          {/* Right Column: Interactive Real-Time Card Preview */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={16} color="#0052D4" />
                <span style={{ fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase', color: '#0F172A', letterSpacing: '0.04em' }}>
                  Live Digital ID Preview
                </span>
              </div>
              <span style={{ fontSize: '0.7rem', color: '#16A34A', background: '#DCFCE7', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                Exact Print Format
              </span>
            </div>

            {/* Vertical MedCore ID Card Render */}
            <StaffIdCardView card={livePreviewCard} compact={false} />

            <div style={{ marginTop: 16, textAlign: 'center', fontSize: '0.75rem', color: '#64748B', maxWidth: 300 }}>
              The ID card updates dynamically as you type. Once enrolled, the badge is immediately available for sign-in and printing.
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 3: STAFF ID CARDS & BADGES GALLERY
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'cards' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', padding: '14px 20px', borderRadius: 14, border: '1px solid #E2E8F0' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A' }}>
                Issued Staff ID Badges ({allCards.length})
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                Active digital identification badges with encrypted QR and barcode credentials for {facilityName}.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="os-ghost-btn"
                onClick={() => setShowDupModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}
              >
                <Layers size={14} /> Audit Duplicates
              </button>
              <button
                type="button"
                className="os-primary-btn"
                onClick={() => setActiveTab('enrol')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}
              >
                <UserPlus size={14} /> Issue New Card
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {allCards.map((card) => (
              <div
                key={card.badgeId}
                className="os-card"
                style={{
                  padding: 16,
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                  transition: 'transform 0.15s ease',
                }}
              >
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <code style={{ fontSize: '0.76rem', fontWeight: 800, color: '#0052D4', background: '#EFF6FF', padding: '2px 6px', borderRadius: 4 }}>
                    {card.badgeId}
                  </code>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16A34A', background: '#DCFCE7', padding: '2px 6px', borderRadius: 4 }}>
                    Active
                  </span>
                </div>

                <StaffIdCardView card={card} compact={true} />

                <div style={{ width: '100%', display: 'flex', gap: 8, marginTop: 14 }}>
                  <button
                    type="button"
                    className="os-ghost-btn"
                    style={{ flex: 1, fontSize: '0.75rem', height: 30, justifyContent: 'center' }}
                    onClick={() => {
                      setSelectedId(card.badgeId);
                      setActiveTab('directory');
                    }}
                  >
                    View Access
                  </button>
                  <button
                    type="button"
                    className="os-primary-btn"
                    style={{ flex: 1, fontSize: '0.75rem', height: 30, justifyContent: 'center' }}
                    onClick={handlePrintCard}
                  >
                    <Printer size={13} /> Print Card
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 4: ROLE MATRIX & HOSPITAL TOOLS STUDIO
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'roles' && (
        <RoleMatrixManager
          facilityId={facilityId}
          facilityName={facilityName}
          onRoleCreated={(newKey) => {
            setRoleKey(newKey);
            setActiveTab('enrol');
          }}
        />
      )}

      {/* ── Modals: Delete Confirmation, Delete Success, Duplicates ── */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
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
              maxWidth: 440,
              background: '#FFFFFF',
              borderRadius: 18,
              padding: 24,
              boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={20} />
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A' }}>
                Revoke Staff Access Permanently?
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64748B', lineHeight: 1.55, margin: '0 0 16px' }}>
              You are removing <strong style={{ color: '#0F172A' }}>{deleteTarget.name}</strong> (Staff ID: <code style={{ color: '#0052D4' }}>{deleteTarget.badgeId}</code>).
              Their digital ID card, cloud authentication credentials, and clinical workstation access will be deactivated immediately.
            </p>
            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#B91C1C', marginBottom: 12 }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => setDeleteTarget(null)}
                className="os-ghost-btn"
                style={{ padding: '8px 16px', fontSize: '0.84rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmDeleteStaff()}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: busy ? '#FCA5A5' : '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: busy ? 'wait' : 'pointer',
                }}
              >
                {busy ? 'Revoking…' : 'Yes, Revoke Access'}
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
    </div>
  );
};

export default AccessControl;
