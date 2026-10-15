'use client';

/**
 * Admin configures which modules each role can see.
 * Full MODULE_CATALOG (every sidebar page) + dynamic role creation + animated Save for realtime apply.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  MODULE_CATALOG,
  listConfigurableRoles,
  createCustomRole,
  deleteCustomRole,
  CUSTOM_ROLES_EVT,
  getRolePermissionsMap,
  setRolePermissionsMap,
  type RolePermissionsMap,
  type CustomRoleDefinition,
} from '../../lib/rolePermissionsStore';
import { emitLiveAction } from '../../lib/liveActions';
import { pushActivity } from '../../lib/adminRealtimeStore';
import {
  Shield, CheckSquare, Square, Save, Loader2, CheckCircle2, RotateCcw,
  Plus, Trash2, X, Briefcase, Lock, Sparkles
} from 'lucide-react';

export const RolePermissionsMatrix: React.FC = () => {
  const [savedMap, setSavedMap] = useState<RolePermissionsMap>({});
  const [draftMap, setDraftMap] = useState<RolePermissionsMap>({});
  const [roles, setRoles] = useState(listConfigurableRoles);
  const [activeRole, setActiveRole] = useState(listConfigurableRoles()[0]?.roleKey || 'doctor');
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Dynamic Role Creation Modal State
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [newRoleKey, setNewRoleKey] = useState('');
  const [newRoleDept, setNewRoleDept] = useState('Clinical');
  const [newRoleClearance, setNewRoleClearance] = useState(3);
  const [newRoleError, setNewRoleError] = useState<string | null>(null);

  const reload = () => {
    const m = getRolePermissionsMap();
    setSavedMap(m);
    setDraftMap(JSON.parse(JSON.stringify(m)));
    setRoles(listConfigurableRoles());
  };

  useEffect(() => {
    reload();
    const fn = () => reload();
    window.addEventListener('medcore-role-permissions', fn);
    window.addEventListener('medcore-admin-sync', fn);
    window.addEventListener(CUSTOM_ROLES_EVT, fn);
    return () => {
      window.removeEventListener('medcore-role-permissions', fn);
      window.removeEventListener('medcore-admin-sync', fn);
      window.removeEventListener(CUSTOM_ROLES_EVT, fn);
    };
  }, []);

  const enabled = useMemo(() => new Set(draftMap[activeRole] || []), [draftMap, activeRole]);

  const activeRoleMeta = useMemo(() => roles.find((r) => r.roleKey === activeRole), [roles, activeRole]);

  const dirty = useMemo(() => {
    const a = JSON.stringify(savedMap[activeRole] || []);
    const b = JSON.stringify(draftMap[activeRole] || []);
    return a !== b;
  }, [savedMap, draftMap, activeRole]);

  const anyDirty = useMemo(() => {
    const allRoles = new Set([...Object.keys(savedMap), ...Object.keys(draftMap)]);
    for (const r of allRoles) {
      if (JSON.stringify(savedMap[r] || []) !== JSON.stringify(draftMap[r] || [])) return true;
    }
    return false;
  }, [savedMap, draftMap]);

  const toggle = (moduleKey: string) => {
    setDraftMap((prev) => {
      const cur = new Set(prev[activeRole] || ['dashboard']);
      if (cur.has(moduleKey)) cur.delete(moduleKey);
      else cur.add(moduleKey);
      cur.add('dashboard'); // always keep home
      return { ...prev, [activeRole]: Array.from(cur) };
    });
  };

  const selectAll = () => {
    setDraftMap((prev) => ({
      ...prev,
      [activeRole]: MODULE_CATALOG.map((m) => m.key),
    }));
  };

  const clearApps = () => {
    setDraftMap((prev) => ({
      ...prev,
      [activeRole]: ['dashboard', 'my-card', 'patient.identity'],
    }));
  };

  const discard = () => {
    setDraftMap(JSON.parse(JSON.stringify(savedMap)));
  };

  const save = async () => {
    if (!anyDirty || saving) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 480));
    setRolePermissionsMap(draftMap);
    setSavedMap(JSON.parse(JSON.stringify(draftMap)));
    emitLiveAction(`Role visibility saved · ${activeRole}`, { module: 'role-permissions' });
    pushActivity(`Role visibility saved for ${activeRole} (${(draftMap[activeRole] || []).length} modules)`);
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
      .replace(/_+/g, '_');

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
      },
      ['dashboard', 'my-card', 'patient-360', 'notifications', 'emr']
    );

    if (!ok) {
      setNewRoleError('A role with this key or identifier already exists');
      return;
    }

    emitLiveAction(`Custom role created: ${newRoleLabel}`, { module: 'role-permissions' });
    pushActivity(`Administrator created new role: ${newRoleLabel} (${key})`);

    reload();
    setActiveRole(key);
    setShowAddRoleModal(false);
    setNewRoleLabel('');
    setNewRoleKey('');
  };

  const handleDeleteRole = (roleKey: string) => {
    if (window.confirm(`Are you sure you want to delete the custom role "${activeRoleMeta?.label || roleKey}"?`)) {
      deleteCustomRole(roleKey);
      emitLiveAction(`Deleted custom role: ${roleKey}`, { module: 'role-permissions' });
      pushActivity(`Administrator deleted role ${roleKey}`);
      reload();
      setActiveRole(listConfigurableRoles()[0]?.roleKey || 'doctor');
    }
  };

  const groups = Array.from(new Set(MODULE_CATALOG.map((m) => m.group)));
  const roleLabel = activeRoleMeta?.label || activeRole;
  const selectedCount = enabled.size;

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
          padding: 14px 28px;
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
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(12px);
          border: 1px solid #E2E8F0;
          box-shadow: 0 -8px 32px rgba(15,23,42,0.08);
          display: flex;
          align-items: center;
          justifyContent: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }
      `}</style>

      {/* Header with Title + Create Role Button */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={24} color="#0052D4" />
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#0F172A' }}>
              Role Visibility & Module Authorization Matrix
            </h2>
          </div>
          <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '0.85rem' }}>
            Control sidebar page access and patient data scopes per hospital role. Changes apply live across workstations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddRoleModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)',
          }}
        >
          <Plus size={16} color="#38BDF8" />
          <span>+ Create New Role</span>
        </button>
      </div>

      {/* Role tabs bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {roles.map((r) => {
          const on = activeRole === r.roleKey;
          const roleDirty =
            JSON.stringify(savedMap[r.roleKey] || []) !== JSON.stringify(draftMap[r.roleKey] || []);
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
              }}
            >
              {r.label}
              {r.isCustom && (
                <span
                  style={{
                    fontSize: '0.65rem',
                    marginLeft: 6,
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0A2540' }}>
                Modules for <span style={{ color: '#0052D4' }}>{roleLabel}</span>
              </h3>
              {activeRoleMeta?.isCustom && (
                <button
                  type="button"
                  onClick={() => handleDeleteRole(activeRole)}
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
              )}
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
              {selectedCount} selected · {MODULE_CATALOG.length} pages & scopes in catalog
              {dirty ? ' · unsaved changes' : ' · in sync'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="os-ghost-btn" style={{ fontSize: 12 }} onClick={selectAll}>
              Select all
            </button>
            <button type="button" className="os-ghost-btn" style={{ fontSize: 12 }} onClick={clearApps}>
              Reset to minimal
            </button>
            <button
              type="button"
              className="os-ghost-btn"
              style={{ fontSize: 12 }}
              onClick={discard}
              disabled={!dirty}
            >
              <RotateCcw size={13} /> Revert
            </button>
          </div>
        </div>

        {/* Grouped Module Checkboxes */}
        {groups.map((grp) => (
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
              {MODULE_CATALOG.filter((m) => m.group === grp).map((m) => {
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
                      transition: 'border-color 0.15s, background 0.15s, transform 0.15s',
                    }}
                  >
                    {on ? <CheckSquare size={18} color="#0052D4" /> : <Square size={18} color="#94A3B8" />}
                    <span style={{ lineHeight: 1.3 }}>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sticky animated save bar */}
      <div className="rbac-save-bar">
        <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600 }}>
          {savedFlash ? (
            <span style={{ color: '#059669', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={18} style={{ animation: 'rbacCheckPop 0.4s ease' }} />
              Visibility saved · sidebars update now
            </span>
          ) : anyDirty ? (
            <span style={{ color: '#B45309' }}>Unsaved changes — press Save to apply realtime</span>
          ) : (
            <span>All visibility settings saved</span>
          )}
        </div>
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

      {/* Create New Role Modal */}
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
              maxWidth: 480,
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
                  placeholder="e.g. Physiotherapist, Triage Officer, Dietitian"
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
                  placeholder="e.g. physiotherapist"
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
                    <option value={3}>L3 — Clinical & Diagnostics</option>
                    <option value={4}>L4 — Senior Clinical</option>
                    <option value={5}>L5 — Executive / Directorate</option>
                  </select>
                </div>
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
