'use client';

/**
 * Upgraded Role Visibility & Module Authorization Matrix (Admin Sidebar).
 * Combines per-role detailed editor, Full Cross-Role Matrix Grid view, module search & group filters,
 * role clone templates, dynamic custom roles, live enrolled staff counts, and animated realtime Apply.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MODULE_CATALOG,
  listConfigurableRoles,
  createCustomRole,
  deleteCustomRole,
  CUSTOM_ROLES_EVT,
  ROLE_PERMISSIONS_KEY,
  getRolePermissionsMap,
  setRolePermissionsMap,
  type RolePermissionsMap,
} from '../../lib/rolePermissionsStore';
import { listStaffCards } from '../../lib/staffCardStore';
import { emitLiveAction } from '../../lib/liveActions';
import { pushActivity } from '../../lib/adminRealtimeStore';
import {
  Shield,
  CheckSquare,
  Square,
  Save,
  Loader2,
  CheckCircle2,
  RotateCcw,
  Plus,
  Trash2,
  X,
  Sparkles,
  Search,
  LayoutGrid,
  Columns3,
  Copy,
  Users,
} from 'lucide-react';

const ROLE_PRESETS: { id: string; label: string; modules: string[] }[] = [
  {
    id: 'doctor',
    label: 'Doctor / Physician Preset (Clinical & EMR)',
    modules: [
      'dashboard', 'doctor-portal', 'emr', 'triage', 'emergency', 'nursing', 'maternity',
      'paediatrics', 'icu', 'theatre', 'pharmacy', 'laboratory', 'radiology', 'ophthalmology',
      'fluid-balance', 'consent-legal', 'certificates', 'cds-sepsis', 'discharge-summary',
      'patient.identity', 'patient.vitals', 'patient.allergies', 'patient.problems',
      'patient.notes', 'patient.meds', 'patient.labs', 'patient.imaging',
      'patient.procedures', 'patient.full_chart', 'patient.consents', 'patient.eye_records',
      'patient.fluid_charts', 'appointments', 'patient-flow', 'ai', 'm87-ai', 'my-card',
    ],
  },
  {
    id: 'nurse',
    label: 'Nursing Officer Preset (Wards, Vitals & MAR)',
    modules: [
      'dashboard', 'triage', 'nursing', 'beds', 'icu', 'emergency', 'maternity', 'paediatrics',
      'fluid-balance', 'consent-legal', 'immunization', 'glucometer-insulin',
      'patient.identity', 'patient.vitals', 'patient.allergies', 'patient.notes', 'patient.meds',
      'patient.fluid_charts', 'patient.consents', 'patient-flow', 'appointments', 'my-card',
    ],
  },
  {
    id: 'allied',
    label: 'Allied Health & Diagnostics (Lab, Rad, Pharm)',
    modules: [
      'dashboard', 'emr', 'laboratory', 'radiology', 'pharmacy', 'blood-bank', 'ophthalmology',
      'pharmacovigilance', 'patient.identity', 'patient.vitals', 'patient.labs',
      'patient.imaging', 'patient.meds', 'patient.eye_records', 'patient-flow', 'my-card',
    ],
  },
  {
    id: 'finance',
    label: 'Finance, Cashier & AkwaRemit Preset',
    modules: [
      'dashboard', 'cashier', 'billing', 'akwaremit', 'claims', 'revenue-cycle',
      'patient.identity', 'patient.demographics', 'patient.billing', 'patient.insurance',
      'patient-flow', 'my-card',
    ],
  },
  {
    id: 'frontdesk',
    label: 'Front Desk, Reception & HIM Records Preset',
    modules: [
      'dashboard', 'patient-card', 'patient-flow', 'appointments', 'desk-settings',
      'certificates', 'patient.identity', 'patient.contact', 'patient.demographics',
      'patient.insurance', 'my-card',
    ],
  },
  {
    id: 'minimal',
    label: 'Minimal Baseline (Home & Staff ID)',
    modules: ['dashboard', 'my-card', 'patient.identity'],
  },
];

function computeStaffCountsByRole(facilityId?: string): Record<string, number> {
  const counts: Record<string, number> = {};
  if (typeof window === 'undefined') return counts;
  const fid = String(facilityId || '').trim().toUpperCase();
  const seenBadges = new Set<string>();

  const tally = (badge: string, roleKey: string, status?: string, itemFid?: string) => {
    const b = String(badge || '').trim().toUpperCase();
    if (!b || seenBadges.has(b)) return;
    const st = String(status || 'active').toUpperCase();
    if (st === 'REVOKED' || st === 'SUSPENDED' || st === 'DELETED' || st === 'EXPIRED') return;
    const rFid = String(itemFid || '').trim().toUpperCase();
    if (fid && rFid && rFid !== fid) return;
    seenBadges.add(b);
    const rk = String(roleKey || 'staff').trim().toLowerCase();
    counts[rk] = (counts[rk] || 0) + 1;
  };

  try {
    for (const c of listStaffCards()) {
      tally(c.badgeId, c.roleKey || 'staff', c.status, c.facilityId);
    }
  } catch {
    /* ignore */
  }
  try {
    const raw = localStorage.getItem('medcore_os_staff_registry');
    const reg = raw ? JSON.parse(raw) : [];
    if (Array.isArray(reg)) {
      for (const r of reg) {
        tally(r.badgeId || r.id, r.roleKey || 'staff', r.status, r.hospitalId || r.facilityId);
      }
    }
  } catch {
    /* ignore */
  }
  return counts;
}

export const RolePermissionsMatrix: React.FC<{ facilityId?: string }> = ({ facilityId }) => {
  const [savedMap, setSavedMap] = useState<RolePermissionsMap>({});
  const [draftMap, setDraftMap] = useState<RolePermissionsMap>({});
  const [roles, setRoles] = useState(() => listConfigurableRoles(facilityId));
  const [activeRole, setActiveRole] = useState(() => listConfigurableRoles(facilityId)[0]?.roleKey || 'doctor');
  const [viewMode, setViewMode] = useState<'editor' | 'matrix'>('editor');
  const [moduleSearch, setModuleSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [staffCounts, setStaffCounts] = useState<Record<string, number>>(() => computeStaffCountsByRole(facilityId));
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [presetToApply, setPresetToApply] = useState<string>('');

  // Dynamic Role Creation Modal State
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [newRoleKey, setNewRoleKey] = useState('');
  const [newRoleDept, setNewRoleDept] = useState('Clinical');
  const [newRoleClearance, setNewRoleClearance] = useState(3);
  const [newRolePreset, setNewRolePreset] = useState('doctor');
  const [newRoleError, setNewRoleError] = useState<string | null>(null);
  const [rolePendingDelete, setRolePendingDelete] = useState<string | null>(null);

  const reload = useCallback((resetDraft = false) => {
    const m = getRolePermissionsMap();
    setSavedMap(m);
    setRoles(listConfigurableRoles(facilityId));
    setStaffCounts(computeStaffCountsByRole(facilityId));
    if (resetDraft) {
      setDraftMap(JSON.parse(JSON.stringify(m)));
    } else {
      setDraftMap((prev) => {
        const next: RolePermissionsMap = { ...m };
        for (const [rk, mods] of Object.entries(prev)) {
          next[rk] = mods;
        }
        return next;
      });
    }
  }, [facilityId]);

  useEffect(() => {
    reload(true);
    const onPerms = () => reload(false);
    const onAdminSync = (e: Event) => {
      const customEvt = e as CustomEvent<{ key?: string }>;
      if (customEvt.detail?.key === ROLE_PERMISSIONS_KEY) {
        reload(false);
      }
    };
    const onRoles = () => setRoles(listConfigurableRoles(facilityId));
    const onStaff = () => setStaffCounts(computeStaffCountsByRole(facilityId));

    window.addEventListener('medcore-role-permissions', onPerms);
    window.addEventListener('medcore-admin-sync', onAdminSync);
    window.addEventListener(CUSTOM_ROLES_EVT, onRoles);
    window.addEventListener('medcore-staff-cards-updated', onStaff);
    window.addEventListener('medcore-staff-registry-updated', onStaff);
    return () => {
      window.removeEventListener('medcore-role-permissions', onPerms);
      window.removeEventListener('medcore-admin-sync', onAdminSync);
      window.removeEventListener(CUSTOM_ROLES_EVT, onRoles);
      window.removeEventListener('medcore-staff-cards-updated', onStaff);
      window.removeEventListener('medcore-staff-registry-updated', onStaff);
    };
  }, [facilityId, reload]);

  const enabled = useMemo(() => new Set(draftMap[activeRole] || []), [draftMap, activeRole]);
  const activeRoleMeta = useMemo(() => roles.find((r) => r.roleKey === activeRole), [roles, activeRole]);

  const dirty = useMemo(() => {
    const a = JSON.stringify([...(savedMap[activeRole] || [])].sort());
    const b = JSON.stringify([...(draftMap[activeRole] || [])].sort());
    return a !== b;
  }, [savedMap, draftMap, activeRole]);

  const anyDirty = useMemo(() => {
    const allRoles = new Set([...Object.keys(savedMap), ...Object.keys(draftMap)]);
    for (const r of allRoles) {
      const a = JSON.stringify([...(savedMap[r] || [])].sort());
      const b = JSON.stringify([...(draftMap[r] || [])].sort());
      if (a !== b) return true;
    }
    return false;
  }, [savedMap, draftMap]);

  const toggleForRole = (roleKey: string, moduleKey: string) => {
    setDraftMap((prev) => {
      const cur = new Set(prev[roleKey] || ['dashboard']);
      if (cur.has(moduleKey)) cur.delete(moduleKey);
      else cur.add(moduleKey);
      cur.add('dashboard'); // always keep home
      return { ...prev, [roleKey]: Array.from(cur) };
    });
  };

  const toggle = (moduleKey: string) => toggleForRole(activeRole, moduleKey);

  const selectAll = () => {
    setDraftMap((prev) => ({
      ...prev,
      [activeRole]: MODULE_CATALOG.map((m) => m.key),
    }));
  };

  const applyPresetToActiveRole = (presetId: string) => {
    const preset = ROLE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setDraftMap((prev) => ({
      ...prev,
      [activeRole]: [...preset.modules],
    }));
    setPresetToApply('');
  };

  const cloneFromRoleToActive = (sourceRoleKey: string) => {
    if (!sourceRoleKey || sourceRoleKey === activeRole) return;
    const mods = draftMap[sourceRoleKey] || savedMap[sourceRoleKey] || ['dashboard'];
    setDraftMap((prev) => ({
      ...prev,
      [activeRole]: [...mods],
    }));
  };

  const discardActive = () => {
    setDraftMap((prev) => ({
      ...prev,
      [activeRole]: [...(savedMap[activeRole] || [])],
    }));
  };

  const discardAll = () => {
    setDraftMap(JSON.parse(JSON.stringify(savedMap)));
  };

  const save = async () => {
    if (!anyDirty || saving) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 320));
    setRolePermissionsMap(draftMap, facilityId);
    setSavedMap(JSON.parse(JSON.stringify(draftMap)));
    emitLiveAction(`Role visibility saved · ${activeRole}`, { module: 'role-permissions' });
    pushActivity(`Role visibility matrix saved (${Object.keys(draftMap).length} roles synchronized)`);
    setSaving(false);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2200);
  };

  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault();
    setNewRoleError(null);
    if (!newRoleLabel.trim()) {
      setNewRoleError('Please provide a role name');
      return;
    }

    const key = (newRoleKey.trim() || newRoleLabel.trim())
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (!key) {
      setNewRoleError('Please provide a valid role system key');
      return;
    }

    const preset = ROLE_PRESETS.find((p) => p.id === newRolePreset);
    const seedModules = preset ? [...preset.modules] : ['dashboard', 'my-card', 'patient.identity'];

    const ok = createCustomRole(
      {
        roleKey: key,
        label: newRoleLabel.trim(),
        shortRole: newRoleLabel.trim().slice(0, 14),
        title: newRoleLabel.trim(),
        clearanceLevel: Number(newRoleClearance),
        clearanceLabel: `Level ${newRoleClearance} Access`,
        department: newRoleDept,
        group: 'Custom',
        isCustom: true,
        facilityId,
      },
      seedModules,
      facilityId
    );

    if (!ok) {
      setNewRoleError('A role with this key or identifier already exists');
      return;
    }

    emitLiveAction(`Custom role created: ${newRoleLabel}`, { module: 'role-permissions' });
    pushActivity(`Administrator created new role: ${newRoleLabel} (${key}) using ${newRolePreset} preset`);

    const m = getRolePermissionsMap();
    setSavedMap(m);
    setDraftMap((prev) => ({
      ...prev,
      [key]: m[key] || seedModules,
    }));
    setRoles(listConfigurableRoles(facilityId));
    setActiveRole(key);
    setViewMode('editor');
    setShowAddRoleModal(false);
    setNewRoleLabel('');
    setNewRoleKey('');
  };

  const handleDeleteRole = (roleKey: string) => {
    deleteCustomRole(roleKey, facilityId);
    emitLiveAction(`Deleted custom role: ${roleKey}`, { module: 'role-permissions' });
    pushActivity(`Administrator deleted custom role ${roleKey}`);
    reload(true);
    setRolePendingDelete(null);
    setActiveRole(listConfigurableRoles(facilityId)[0]?.roleKey || 'doctor');
  };

  const allGroups = useMemo(
    () => Array.from(new Set(MODULE_CATALOG.map((m) => m.group))),
    []
  );

  const filteredModules = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase();
    return MODULE_CATALOG.filter((m) => {
      const matchGroup = selectedGroup === 'All' || m.group === selectedGroup;
      if (!matchGroup) return false;
      if (!q) return true;
      return (
        m.label.toLowerCase().includes(q) ||
        m.key.toLowerCase().includes(q) ||
        m.group.toLowerCase().includes(q)
      );
    });
  }, [moduleSearch, selectedGroup]);

  const visibleGroups = useMemo(() => {
    const present = new Set(filteredModules.map((m) => m.group));
    return allGroups.filter((g) => present.has(g));
  }, [allGroups, filteredModules]);

  const roleLabel = activeRoleMeta?.label || activeRole;
  const selectedCount = enabled.size;
  const customCount = roles.filter((r) => r.isCustom).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 88 }}>
      <style>{`
        @keyframes rbacSavePulse {
          0%, 100% { box-shadow: 0 8px 28px rgba(0, 82, 212, 0.35); }
          50% { box-shadow: 0 12px 36px rgba(0, 191, 165, 0.45); }
        }
        @keyframes rbacSaveShine {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(120%); }
        }
        @keyframes rbacCheckPop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
        .rbac-save-btn {
          position: relative;
          overflow: hidden;
          border: none;
          cursor: pointer;
          font-weight: 800;
          font-size: 0.92rem;
          color: #fff;
          padding: 13px 26px;
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: linear-gradient(90deg, #0052D4 0%, #00BFA5 100%);
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.2s;
        }
        .rbac-save-btn:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.02);
          filter: brightness(1.05);
          animation: rbacSavePulse 1.6s ease-in-out infinite;
        }
        .rbac-save-btn:active:not(:disabled) { transform: scale(0.97); }
        .rbac-save-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          filter: grayscale(0.3);
        }
        .rbac-save-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%);
          transform: translateX(-120%);
        }
        .rbac-save-btn.is-saving::after {
          animation: rbacSaveShine 0.9s ease infinite;
        }
        .rbac-save-bar {
          position: sticky;
          bottom: 0;
          z-index: 30;
          margin: 0 -4px;
          padding: 14px 16px;
          border-radius: 16px;
          background: rgba(255,255,255,0.97);
          backdrop-filter: blur(4px);
          border: 1px solid #E2E8F0;
          box-shadow: 0 -8px 32px rgba(15,23,42,0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }
      `}</style>

      {/* Header with Title + View Mode Switcher + Create Role Button */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 16,
          border: '1px solid #E2E8F0',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #0052D4 0%, #0D9488 100%)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Shield size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
                Role Visibility &amp; Module Authorization Matrix
              </h2>
              <p style={{ margin: '2px 0 0', color: '#64748B', fontSize: '0.82rem' }}>
                {roles.length} roles ({customCount} custom) · {MODULE_CATALOG.length} clinical &amp; operational scopes · Live RBAC gate
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* View Mode Toggle: Role Editor vs Full Cross-Role Matrix Grid */}
          <div
            style={{
              display: 'inline-flex',
              background: '#F1F5F9',
              padding: 4,
              borderRadius: 11,
              border: '1px solid #E2E8F0',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('editor')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 8,
                border: 'none',
                background: viewMode === 'editor' ? '#0052D4' : 'transparent',
                color: viewMode === 'editor' ? '#FFFFFF' : '#475569',
                fontWeight: 700,
                fontSize: 12.5,
                cursor: 'pointer',
              }}
            >
              <LayoutGrid size={14} /> Role Editor
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 8,
                border: 'none',
                background: viewMode === 'matrix' ? '#0052D4' : 'transparent',
                color: viewMode === 'matrix' ? '#FFFFFF' : '#475569',
                fontWeight: 700,
                fontSize: 12.5,
                cursor: 'pointer',
              }}
            >
              <Columns3 size={14} /> Cross-Role Matrix Grid
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowAddRoleModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 11,
              border: 'none',
              background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.18)',
            }}
          >
            <Plus size={16} color="#38BDF8" />
            <span>Create New Role</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar (Shared across Editor & Matrix views) */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 14,
          border: '1px solid #E2E8F0',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 260px' }}>
            <Search
              size={15}
              color="#94A3B8"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              value={moduleSearch}
              onChange={(e) => setModuleSearch(e.target.value)}
              placeholder="Search modules or patient scopes by name, key (e.g. akwaremit, triage, patient.labs)…"
              style={{
                width: '100%',
                padding: '9px 32px 9px 36px',
                borderRadius: 10,
                border: '1px solid #CBD5E1',
                fontSize: 13,
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
            {moduleSearch && (
              <button
                type="button"
                onClick={() => setModuleSearch('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: '#E2E8F0',
                  border: 'none',
                  borderRadius: '50%',
                  width: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#475569',
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>
            Showing {filteredModules.length} of {MODULE_CATALOG.length} scopes
          </span>
        </div>

        {/* Category Filter Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['All', ...allGroups].map((grp) => {
            const on = selectedGroup === grp;
            return (
              <button
                key={grp}
                type="button"
                onClick={() => setSelectedGroup(grp)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 999,
                  border: on ? '1px solid #0052D4' : '1px solid #E2E8F0',
                  background: on ? '#EFF6FF' : '#F8FAFC',
                  color: on ? '#0052D4' : '#475569',
                  fontSize: 11.5,
                  fontWeight: on ? 800 : 600,
                  cursor: 'pointer',
                }}
              >
                {grp}
              </button>
            );
          })}
        </div>
      </div>

      {/* VIEW MODE 1: DETAILED ROLE EDITOR */}
      {viewMode === 'editor' && (
        <>
          {/* Role tabs bar with Live Enrolled Staff Counts */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {roles.map((r) => {
              const on = activeRole === r.roleKey;
              const roleDirty =
                JSON.stringify([...(savedMap[r.roleKey] || [])].sort()) !==
                JSON.stringify([...(draftMap[r.roleKey] || [])].sort());
              const staffCount = staffCounts[r.roleKey.toLowerCase()] || 0;
              return (
                <button
                  key={r.roleKey}
                  type="button"
                  className="os-ghost-btn"
                  onClick={() => setActiveRole(r.roleKey)}
                  style={{
                    borderColor: on ? '#0052D4' : r.isCustom ? '#BAE6FD' : undefined,
                    color: on ? '#0052D4' : r.isCustom ? '#0369A1' : undefined,
                    background: on ? 'rgba(0,82,212,0.08)' : r.isCustom ? '#F0F9FF' : undefined,
                    fontWeight: on ? 800 : 600,
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>{r.label}</span>
                  {staffCount > 0 && (
                    <span
                      style={{
                        fontSize: '0.66rem',
                        padding: '1px 6px',
                        borderRadius: 999,
                        background: on ? '#0052D4' : '#E2E8F0',
                        color: on ? '#FFFFFF' : '#475569',
                        fontWeight: 800,
                      }}
                      title={`${staffCount} active staff enrolled`}
                    >
                      {staffCount}
                    </span>
                  )}
                  {r.isCustom && (
                    <span
                      style={{
                        fontSize: '0.63rem',
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: '#0284C7',
                        color: '#fff',
                        fontWeight: 700,
                      }}
                    >
                      CUSTOM
                    </span>
                  )}
                  {roleDirty && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: '#F59E0B',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Module Configuration Card */}
          <div className="os-card" style={{ padding: 18 }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0A2540' }}>
                    Modules for <span style={{ color: '#0052D4' }}>{roleLabel}</span>
                  </h3>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: '#F1F5F9',
                      color: '#475569',
                    }}
                  >
                    <Users size={11} /> {staffCounts[activeRole.toLowerCase()] || 0} active staff
                  </span>
                  {activeRoleMeta?.isCustom &&
                    (rolePendingDelete === activeRole ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteRole(activeRole)}
                          style={{
                            background: '#DC2626',
                            border: 'none',
                            color: '#fff',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setRolePendingDelete(null)}
                          style={{
                            background: '#F1F5F9',
                            border: '1px solid #CBD5E1',
                            color: '#475569',
                            padding: '3px 6px',
                            borderRadius: 6,
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRolePendingDelete(activeRole)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          background: '#FEF2F2',
                          border: '1px solid #FECACA',
                          color: '#DC2626',
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        title="Delete this custom role"
                      >
                        <Trash2 size={12} />
                        <span>Delete Role</span>
                      </button>
                    ))}
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                  {selectedCount} enabled · {MODULE_CATALOG.length} scopes in catalog
                  {dirty ? ' · unsaved edits' : ' · synchronized'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  value={presetToApply}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.startsWith('preset:')) {
                      applyPresetToActiveRole(val.replace('preset:', ''));
                    } else if (val.startsWith('clone:')) {
                      cloneFromRoleToActive(val.replace('clone:', ''));
                    }
                    setPresetToApply('');
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    background: '#F8FAFC',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#0F172A',
                    cursor: 'pointer',
                  }}
                  title="Apply a template preset or clone permissions from another role"
                >
                  <option value="">Clone / Apply Preset…</option>
                  <optgroup label="Clinical &amp; Ops Presets">
                    {ROLE_PRESETS.map((p) => (
                      <option key={p.id} value={`preset:${p.id}`}>
                        {p.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Clone Existing Role">
                    {roles
                      .filter((r) => r.roleKey !== activeRole)
                      .map((r) => (
                        <option key={r.roleKey} value={`clone:${r.roleKey}`}>
                          Clone from {r.label}
                        </option>
                      ))}
                  </optgroup>
                </select>

                <button type="button" className="os-ghost-btn" style={{ fontSize: 12 }} onClick={selectAll}>
                  Select all
                </button>
                <button
                  type="button"
                  className="os-ghost-btn"
                  style={{ fontSize: 12 }}
                  onClick={() => applyPresetToActiveRole('minimal')}
                >
                  Reset minimal
                </button>
                <button
                  type="button"
                  className="os-ghost-btn"
                  style={{ fontSize: 12 }}
                  onClick={discardActive}
                  disabled={!dirty}
                >
                  <RotateCcw size={13} /> Revert
                </button>
              </div>
            </div>

            {filteredModules.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
                No modules match &ldquo;{moduleSearch}&rdquo; in the selected category.
              </div>
            ) : (
              visibleGroups.map((grp) => (
                <div key={grp} style={{ marginBottom: 20 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                      color: '#64748B',
                      marginBottom: 8,
                      paddingBottom: 4,
                      borderBottom: '1px solid #E2E8F0',
                    }}
                  >
                    {grp}
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                      gap: 8,
                    }}
                  >
                    {filteredModules
                      .filter((m) => m.group === grp)
                      .map((m) => {
                        const on = enabled.has(m.key);
                        return (
                          <button
                            key={m.key}
                            type="button"
                            onClick={() => toggle(m.key)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '10px 12px',
                              borderRadius: 10,
                              textAlign: 'left',
                              border: on ? '1.5px solid #0052D4' : '1px solid #E2E8F0',
                              background: on ? 'rgba(0,82,212,0.07)' : '#fff',
                              cursor: 'pointer',
                              fontSize: 13,
                              fontWeight: 600,
                              color: '#0A2540',
                              transition: 'border-color 0.15s, background 0.15s',
                            }}
                          >
                            {on ? <CheckSquare size={18} color="#0052D4" /> : <Square size={18} color="#94A3B8" />}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ lineHeight: 1.3 }}>{m.label}</div>
                              <div style={{ fontSize: 10.5, color: '#94A3B8', fontFamily: 'monospace' }}>{m.key}</div>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* VIEW MODE 2: CROSS-ROLE MATRIX GRID */}
      {viewMode === 'matrix' && (
        <div
          className="os-card"
          style={{
            padding: 0,
            overflow: 'hidden',
            border: '1px solid #E2E8F0',
          }}
        >
          <div style={{ overflowX: 'auto', maxHeight: '64vh' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC' }}>
                <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                  <th
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 12,
                      background: '#F8FAFC',
                      textAlign: 'left',
                      padding: '12px 16px',
                      minWidth: 230,
                      borderRight: '1px solid #E2E8F0',
                      fontWeight: 800,
                      color: '#0F172A',
                    }}
                  >
                    Module / Clinical Scope ({filteredModules.length})
                  </th>
                  {roles.map((r) => {
                    const count = staffCounts[r.roleKey.toLowerCase()] || 0;
                    const enabledTotal = (draftMap[r.roleKey] || []).length;
                    return (
                      <th
                        key={r.roleKey}
                        style={{
                          padding: '10px 10px',
                          minWidth: 96,
                          textAlign: 'center',
                          borderRight: '1px solid #F1F5F9',
                          verticalAlign: 'bottom',
                        }}
                      >
                        <div style={{ fontWeight: 800, color: '#0F172A', fontSize: 11.5, lineHeight: 1.2 }}>
                          {r.label}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748B', marginTop: 3 }}>
                          {enabledTotal} mods{count > 0 ? ` · ${count} staff` : ''}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredModules.length === 0 ? (
                  <tr>
                    <td colSpan={roles.length + 1} style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>
                      No modules match your search filter.
                    </td>
                  </tr>
                ) : (
                  filteredModules.map((mod, idx) => (
                    <tr
                      key={mod.key}
                      style={{
                        background: idx % 2 === 0 ? '#FFFFFF' : '#FAFBFD',
                        borderBottom: '1px solid #F1F5F9',
                      }}
                    >
                      <td
                        style={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 5,
                          background: idx % 2 === 0 ? '#FFFFFF' : '#FAFBFD',
                          padding: '9px 16px',
                          borderRight: '1px solid #E2E8F0',
                        }}
                      >
                        <div style={{ fontWeight: 700, color: '#0F172A' }}>{mod.label}</div>
                        <div style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace' }}>
                          {mod.group} · {mod.key}
                        </div>
                      </td>
                      {roles.map((r) => {
                        const on = (draftMap[r.roleKey] || []).includes(mod.key);
                        return (
                          <td
                            key={`${r.roleKey}:${mod.key}`}
                            style={{
                              textAlign: 'center',
                              padding: '6px',
                              borderRight: '1px solid #F1F5F9',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => toggleForRole(r.roleKey, mod.key)}
                              aria-label={`Toggle ${mod.label} for ${r.label}`}
                              style={{
                                border: 'none',
                                background: on ? 'rgba(0, 82, 212, 0.1)' : 'transparent',
                                borderRadius: 6,
                                padding: 4,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {on ? (
                                <CheckSquare size={17} color="#0052D4" />
                              ) : (
                                <Square size={17} color="#CBD5E1" />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sticky animated save bar */}
      <div className="rbac-save-bar">
        <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600 }}>
          {savedFlash ? (
            <span style={{ color: '#059669', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={18} style={{ animation: 'rbacCheckPop 0.4s ease' }} />
              Visibility saved · sidebars updated in real time across workstations
            </span>
          ) : anyDirty ? (
            <span style={{ color: '#B45309' }}>Unsaved role matrix edits — press Save to broadcast live</span>
          ) : (
            <span>All role visibility &amp; data scopes synchronized</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {anyDirty && (
            <button
              type="button"
              className="os-ghost-btn"
              onClick={discardAll}
              style={{ fontSize: 12.5 }}
            >
              <RotateCcw size={14} /> Discard All
            </button>
          )}
          <button
            type="button"
            className={`rbac-save-btn${saving ? ' is-saving' : ''}`}
            disabled={!anyDirty || saving}
            onClick={save}
          >
            {saving ? (
              <>
                <Loader2 size={18} style={{ animation: 'authSpin 0.7s linear infinite' }} />
                Saving…
              </>
            ) : savedFlash ? (
              <>
                <CheckCircle2 size={18} />
                Saved
              </>
            ) : (
              <>
                <Save size={18} />
                Save visibility
              </>
            )}
          </button>
        </div>
      </div>

      {/* Create New Role Modal with Preset Templates */}
      {showAddRoleModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.72)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddRoleModal(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 500,
              background: '#FFFFFF',
              borderRadius: 18,
              boxShadow: '0 25px 60px -15px rgba(0,0,0,0.3)',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                padding: '20px 24px',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Sparkles size={20} color="#38BDF8" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Create New Hospital Role</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddRoleModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRole} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {newRoleError && (
                <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: '0.8rem' }}>
                  {newRoleError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Role Title / Name *
                </label>
                <input
                  type="text"
                  value={newRoleLabel}
                  onChange={(e) => {
                    setNewRoleLabel(e.target.value);
                    setNewRoleKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                  }}
                  placeholder="e.g. Triage Officer, Dialysis Coordinator, Dietitian"
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Role System Key (identifier)
                </label>
                <input
                  type="text"
                  value={newRoleKey}
                  onChange={(e) => setNewRoleKey(e.target.value)}
                  placeholder="e.g. triage_officer"
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #CBD5E1', boxSizing: 'border-box', fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    Department / Unit
                  </label>
                  <select
                    value={newRoleDept}
                    onChange={(e) => setNewRoleDept(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #CBD5E1', boxSizing: 'border-box', background: '#fff' }}
                  >
                    <option value="Clinical">Clinical</option>
                    <option value="Nursing">Nursing</option>
                    <option value="Front desk">Front desk</option>
                    <option value="Diagnostics">Diagnostics</option>
                    <option value="Support">Support</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    Security Clearance
                  </label>
                  <select
                    value={newRoleClearance}
                    onChange={(e) => setNewRoleClearance(Number(e.target.value))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #CBD5E1', boxSizing: 'border-box', background: '#fff' }}
                  >
                    <option value={1}>L1 — Restricted</option>
                    <option value={2}>L2 — Support / Front Desk</option>
                    <option value={3}>L3 — Clinical &amp; Diagnostics</option>
                    <option value={4}>L4 — Senior Clinical</option>
                    <option value={5}>L5 — Executive / Directorate</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  <Copy size={13} color="#0052D4" /> Initial Permission Preset Template
                </label>
                <select
                  value={newRolePreset}
                  onChange={(e) => setNewRolePreset(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #CBD5E1', boxSizing: 'border-box', background: '#F8FAFC', fontWeight: 600 }}
                >
                  {ROLE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} ({p.modules.length} scopes)
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowAddRoleModal(false)}
                  style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #CBD5E1', background: '#fff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#0284C7', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RolePermissionsMatrix;
