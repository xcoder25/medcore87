'use client';

/**
 * Hospital Command Centre — live KPIs from beds, queue, staff, ambulance.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BedDouble, Users, PhoneCall, RefreshCw, AlertTriangle } from 'lucide-react';
import { listBeds, ensureDefaultBeds, subscribeBeds } from '../../lib/bedBoardStore';
import { listUnits, ensureDefaultFleet, subscribeAmbulance } from '../../lib/ambulanceDispatchStore';
import { dayStats, todayVisits, subscribeReceptionOps } from '../../lib/receptionOpsStore';
import { getStaffRegistry, subscribeAdminSync, getActiveFacilityId } from '../../lib/adminRealtimeStore';
import { emitLiveAction } from '../../lib/liveActions';
import { buildOpsIntelligence } from '../../lib/opsIntelligence';
import { scanEarlyWarnings } from '../../lib/clinicalEarlyWarning';

export const CommandCentreDashboard: React.FC = () => {
  const facilityId = (typeof window !== 'undefined' && getActiveFacilityId()) || 'IGH-EKT';
  const [tick, setTick] = useState(0);

  const reload = () => {
    ensureDefaultBeds(facilityId);
    ensureDefaultFleet(facilityId);
    setTick((t) => t + 1);
  };

  useEffect(() => {
    reload();
    const u1 = subscribeBeds(reload);
    const u2 = subscribeAmbulance(reload);
    const u3 = subscribeReceptionOps(reload);
    const u4 = subscribeAdminSync(reload);
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [facilityId]);

  const beds = useMemo(() => listBeds(facilityId), [facilityId, tick]);
  const units = useMemo(() => listUnits(facilityId), [facilityId, tick]);
  const stats = useMemo(() => dayStats(facilityId), [facilityId, tick]);
  const visits = useMemo(() => todayVisits(facilityId), [facilityId, tick]);
  const staff = useMemo(() => getStaffRegistry(), [tick]);

  const occupied = beds.filter((b) => b.status === 'occupied').length;
  const available = beds.filter((b) => b.status === 'available').length;
  const ambBusy = units.filter((u) => u.status === 'en_route' || u.status === 'at_scene').length;
  const ambAvail = units.filter((u) => u.status === 'available').length;
  const waiting = visits.filter((v) => v.status === 'waiting' || v.status === 'called').length;

  const byWard = useMemo(() => {
    const m = new Map<string, { total: number; occ: number }>();
    for (const b of beds) {
      const cur = m.get(b.ward) || { total: 0, occ: 0 };
      cur.total += 1;
      if (b.status === 'occupied') cur.occ += 1;
      m.set(b.ward, cur);
    }
    return Array.from(m.entries()).map(([name, v]) => ({ name, ...v }));
  }, [beds]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Hospital Command Centre</h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748B' }}>
            Live operations pulse — beds, queue, fleet, staff. No demo occupancy figures.
          </p>
        </div>
        <button
          type="button"
          className="os-ghost-btn mc-btn-live"
          onClick={() => {
            reload();
            emitLiveAction('Command centre refreshed', { module: 'command' });
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
        {[
          { l: 'Beds occupied', v: occupied, s: `${available} free`, c: '#EA580C', icon: BedDouble },
          { l: 'Queue waiting', v: waiting, s: `${stats.checkIns} check-ins today`, c: '#2563EB', icon: Activity },
          { l: 'Active staff', v: staff.length, s: 'Roster', c: '#0D9488', icon: Users },
          { l: 'Ambulances out', v: ambBusy, s: `${ambAvail} available`, c: '#7C3AED', icon: PhoneCall },
          {
            l: 'Alerts',
            v: waiting > 8 ? 1 : 0,
            s: waiting > 8 ? 'Queue pressure' : 'Clear',
            c: waiting > 8 ? '#DC2626' : '#16A34A',
            icon: AlertTriangle,
          },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.l}
              style={{
                background: '#fff',
                borderRadius: 14,
                border: '1px solid #E2E8F0',
                padding: 14,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Icon size={16} color={k.c} />
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 8, fontWeight: 600 }}>{k.l}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A' }}>{k.v}</div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>{k.s}</div>
            </div>
          );
        })}
      </div>

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>AI operational recommendations</div>
        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 10 }}>From live queues, beds, lab/Rx — assistive only</div>
        {buildOpsIntelligence(facilityId).map((r) => (
          <div
            key={r.id}
            style={{
              padding: '10px 12px',
              marginBottom: 8,
              borderRadius: 12,
              border: '1px solid #E2E8F0',
              background:
                r.level === 'critical' ? '#FEF2F2' : r.level === 'warn' ? '#FFFBEB' : r.level === 'ok' ? '#ECFDF5' : '#F8FAFC',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13 }}>{r.title}</div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{r.detail}</div>
            {r.action && <div style={{ fontSize: 11, color: '#2563EB', marginTop: 4 }}>{r.action}</div>}
          </div>
        ))}
        {scanEarlyWarnings(facilityId).slice(0, 5).map((w) => (
          <div key={w.id} style={{ fontSize: 12, padding: '6px 0', borderTop: '1px solid #F1F5F9' }}>
            <strong style={{ color: w.level === 'high' ? '#DC2626' : '#D97706' }}>{w.level.toUpperCase()}</strong>
            {' · '}{w.patientName}: {w.message}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 12 }}>Ward occupancy</div>
          {byWard.length === 0 && (
            <div style={{ color: '#64748B', fontSize: 13 }}>No beds configured yet.</div>
          )}
          {byWard.map((w) => {
            const pct = w.total ? Math.round((w.occ / w.total) * 100) : 0;
            return (
              <div key={w.name} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{w.name}</span>
                  <span style={{ color: '#64748B' }}>
                    {w.occ}/{w.total} ({pct}%)
                  </span>
                </div>
                <div
                  style={{
                    height: 8,
                    borderRadius: 999,
                    background: '#F1F5F9',
                    marginTop: 6,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: pct > 90 ? '#DC2626' : pct > 70 ? '#F59E0B' : '#22C55E',
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 12 }}>Fleet snapshot</div>
          {units.map((u) => (
            <div
              key={u.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: '1px solid #F1F5F9',
                fontSize: 13,
              }}
            >
              <span style={{ fontWeight: 700 }}>{u.callSign}</span>
              <span style={{ color: '#64748B' }}>{u.status.replace('_', ' ')}</span>
              <span style={{ color: '#94A3B8', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {u.location}
              </span>
            </div>
          ))}
          <div style={{ fontWeight: 800, margin: '16px 0 8px' }}>Queue (today)</div>
          {visits.slice(0, 6).map((v) => (
            <div
              key={v.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                padding: '6px 0',
                borderBottom: '1px solid #F8FAFC',
              }}
            >
              <span style={{ fontWeight: 600 }}>{v.patientName}</span>
              <span style={{ color: '#64748B' }}>{v.status}</span>
            </div>
          ))}
          {visits.length === 0 && (
            <div style={{ fontSize: 13, color: '#64748B' }}>No check-ins yet today.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandCentreDashboard;
