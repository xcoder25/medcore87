'use client';

/**
 * Admin configures which modules each role can see.
 * Full MODULE_CATALOG (every sidebar page) + animated Save for realtime apply.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  MODULE_CATALOG,
  CONFIGURABLE_ROLES,
  getRolePermissionsMap,
  setRolePermissionsMap,
  type RolePermissionsMap,
} from '../../lib/rolePermissionsStore';
import { emitLiveAction } from '../../lib/liveActions';
import { pushActivity } from '../../lib/adminRealtimeStore';
import { Shield, CheckSquare, Square, Save, Loader2, CheckCircle2, RotateCcw } from 'lucide-react';

export const RolePermissionsMatrix: React.FC = () => {
  const [savedMap, setSavedMap] = useState<RolePermissionsMap>({});
  const [draftMap, setDraftMap] = useState<RolePermissionsMap>({});
  const [activeRole, setActiveRole] = useState(CONFIGURABLE_ROLES[0].roleKey);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const reload = () => {
    const m = getRolePermissionsMap();
    setSavedMap(m);
    setDraftMap(JSON.parse(JSON.stringify(m)));
  };

  useEffect(() => {
    reload();
    const fn = () => reload();
    window.addEventListener('medcore-role-permissions', fn);
    window.addEventListener('medcore-admin-sync', fn);
    return () => {
      window.removeEventListener('medcore-role-permissions', fn);
      window.removeEventListener('medcore-admin-sync', fn);
    };
  }, []);

  const enabled = useMemo(() => new Set(draftMap[activeRole] || []), [draftMap, activeRole]);

  const dirty = useMemo(() => {
    const a = JSON.stringify(savedMap[activeRole] || []);
    const b = JSON.stringify(draftMap[activeRole] || []);
    return a !== b;
  }, [savedMap, draftMap, activeRole]);

  const anyDirty = useMemo(() => {
    const roles = new Set([...Object.keys(savedMap), ...Object.keys(draftMap)]);
    for (const r of roles) {
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
    // keep dashboard + patient identity minimum for safety
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
    // brief animation beat
    await new Promise((r) => setTimeout(r, 480));
    setRolePermissionsMap(draftMap);
    setSavedMap(JSON.parse(JSON.stringify(draftMap)));
    emitLiveAction(`Role visibility saved · ${activeRole}`, { module: 'role-permissions' });
    pushActivity(`Role visibility saved for ${activeRole} (${(draftMap[activeRole] || []).length} modules)`);
    setSaving(false);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2200);
  };

  const groups = Array.from(new Set(MODULE_CATALOG.map((m) => m.group)));
  const roleLabel = CONFIGURABLE_ROLES.find((r) => r.roleKey === activeRole)?.label || activeRole;
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
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
      `}</style>

      <div className="os-insight-banner">
        <Shield size={18} style={{ color: '#0066FF', flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 4 }}>
            Role visibility · every screen for every role
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: 1.5 }}>
            Tick modules and patient-data scopes for each role. Changes stay as a draft until you press{' '}
            <strong>Save visibility</strong> — then sidebars update in realtime for that role.
          </div>
        </div>
      </div>

      {/* Role tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {CONFIGURABLE_ROLES.map((r) => {
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
                borderColor: on ? '#0052D4' : undefined,
                color: on ? '#0052D4' : undefined,
                background: on ? 'rgba(0,82,212,0.08)' : undefined,
                fontWeight: on ? 800 : 600,
                position: 'relative',
              }}
            >
              {r.label}
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
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0A2540' }}>
              Modules for <span style={{ color: '#0052D4' }}>{roleLabel}</span>
            </h3>
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
              Minimal set
            </button>
            {dirty && (
              <button type="button" className="os-ghost-btn" style={{ fontSize: 12 }} onClick={discard}>
                <RotateCcw size={13} /> Discard
              </button>
            )}
          </div>
        </div>

        {groups.map((g) => (
          <div key={g} style={{ marginBottom: 18 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#94A3B8',
                letterSpacing: '0.08em',
                marginBottom: 10,
              }}
            >
              {g.toUpperCase()} · {MODULE_CATALOG.filter((m) => m.group === g).length}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 8,
              }}
            >
              {MODULE_CATALOG.filter((m) => m.group === g).map((m) => {
                const on = enabled.has(m.key) || enabled.has('*');
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => toggle(m.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      textAlign: 'left',
                      padding: '11px 12px',
                      borderRadius: 12,
                      border: `1.5px solid ${on ? 'rgba(0,82,212,0.4)' : '#E2E8F0'}`,
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
    </div>
  );
};

export default RolePermissionsMatrix;
