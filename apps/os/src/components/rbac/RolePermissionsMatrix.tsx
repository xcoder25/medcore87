'use client';

/**
 * Admin configures which modules each role can see.
 * All staff with the same roleKey share one dashboard; this matrix gates modules.
 */
import React, { useEffect, useState } from 'react';
import {
  MODULE_CATALOG,
  CONFIGURABLE_ROLES,
  getRolePermissionsMap,
  setRoleModule,
  setRolePermissionsMap,
  type RolePermissionsMap,
} from '../../lib/rolePermissionsStore';
import { emitLiveAction } from '../../lib/liveActions';
import { pushActivity } from '../../lib/adminRealtimeStore';
import { Shield, CheckSquare, Square } from 'lucide-react';

export const RolePermissionsMatrix: React.FC = () => {
  const [map, setMap] = useState<RolePermissionsMap>({});
  const [activeRole, setActiveRole] = useState(CONFIGURABLE_ROLES[0].roleKey);

  const reload = () => setMap(getRolePermissionsMap());

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

  const enabled = new Set(map[activeRole] || []);

  const toggle = (moduleKey: string) => {
    const next = setRoleModule(activeRole, moduleKey, !enabled.has(moduleKey));
    setMap(getRolePermissionsMap());
    emitLiveAction(`Role access · ${activeRole} · ${moduleKey}`, { module: 'role-permissions' });
    pushActivity(`Role permissions updated: ${activeRole}`);
  };

  const selectAll = () => {
    const all = MODULE_CATALOG.map((m) => m.key);
    const m = getRolePermissionsMap();
    m[activeRole] = all;
    setRolePermissionsMap(m);
    setMap(m);
  };

  const groups = Array.from(new Set(MODULE_CATALOG.map((m) => m.group)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="os-insight-banner">
        <Shield size={18} style={{ color: '#0066FF', flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 4 }}>
            Role visibility · what each role can see
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: 1.5 }}>
            Staff accounts open the <strong>same dashboard for their role</strong> (e.g. all doctors share the doctor
            workspace). Tick modules below to control what that role is allowed to open. Hospital admin always has full access.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {CONFIGURABLE_ROLES.map((r) => (
          <button
            key={r.roleKey}
            type="button"
            className="os-ghost-btn"
            onClick={() => setActiveRole(r.roleKey)}
            style={{
              borderColor: activeRole === r.roleKey ? '#0052D4' : undefined,
              color: activeRole === r.roleKey ? '#0052D4' : undefined,
              background: activeRole === r.roleKey ? 'rgba(0,82,212,0.08)' : undefined,
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="os-card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>
            Modules for <span style={{ color: '#0052D4' }}>{CONFIGURABLE_ROLES.find((r) => r.roleKey === activeRole)?.label}</span>
          </h3>
          <button type="button" className="os-ghost-btn" style={{ fontSize: 12 }} onClick={selectAll}>
            Select all
          </button>
        </div>

        {groups.map((g) => (
          <div key={g} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', letterSpacing: '0.06em', marginBottom: 8 }}>
              {g.toUpperCase()}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
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
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1px solid ${on ? 'rgba(0,82,212,0.35)' : '#E2E8F0'}`,
                      background: on ? 'rgba(0,82,212,0.06)' : '#fff',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#0A2540',
                    }}
                  >
                    {on ? <CheckSquare size={18} color="#0052D4" /> : <Square size={18} color="#94A3B8" />}
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RolePermissionsMatrix;
