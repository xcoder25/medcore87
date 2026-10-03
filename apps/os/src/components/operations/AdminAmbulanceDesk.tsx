'use client';

import React, { useEffect, useState } from 'react';
import { PhoneCall, RefreshCw, MapPin, User } from 'lucide-react';
import {
  listUnits,
  ensureDefaultFleet,
  dispatchUnit,
  updateUnit,
  subscribeAmbulance,
  type AmbulanceUnit,
  type UnitStatus,
} from '../../lib/ambulanceDispatchStore';
import { getActiveFacilityId } from '../../lib/adminRealtimeStore';
import { emitLiveAction } from '../../lib/liveActions';

const STATUS: Record<UnitStatus, { label: string; color: string }> = {
  available: { label: 'Available', color: '#16A34A' },
  en_route: { label: 'En route', color: '#2563EB' },
  at_scene: { label: 'At scene', color: '#D97706' },
  returning: { label: 'Returning', color: '#7C3AED' },
  offline: { label: 'Offline', color: '#94A3B8' },
};

export const AdminAmbulanceDesk: React.FC = () => {
  const facilityId = (typeof window !== 'undefined' && getActiveFacilityId()) || 'IGH-EKT';
  const [units, setUnits] = useState<AmbulanceUnit[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const reload = () => {
    ensureDefaultFleet(facilityId);
    setUnits(listUnits(facilityId));
  };

  useEffect(() => {
    reload();
    return subscribeAmbulance(reload);
  }, [facilityId]);

  const flash = (m: string) => {
    setToast(m);
    emitLiveAction(m, { module: 'ambulance' });
    setTimeout(() => setToast(null), 2800);
  };

  const onDispatch = (u: AmbulanceUnit) => {
    const location = prompt('Destination / pickup location:', u.location || 'Community call');
    if (!location) return;
    const patient = prompt('Patient name (optional):', u.patient || '') || undefined;
    const crew = prompt('Crew names:', u.crew !== 'Unassigned' ? u.crew : '') || u.crew;
    dispatchUnit(u.id, { location, patient, crew, notes: 'Dispatched from admin desk' });
    reload();
    flash(`${u.callSign} dispatched to ${location}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 50,
            background: '#0F172A',
            color: '#fff',
            padding: '12px 16px',
            borderRadius: 12,
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {toast}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Ambulance &amp; Dispatch</h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748B' }}>
            Live fleet board — dispatch, update status, return to bay. No demo missions.
          </p>
        </div>
        <button type="button" className="os-ghost-btn mc-btn-live" onClick={reload}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {units.map((u) => {
          const st = STATUS[u.status];
          return (
            <div
              key={u.id}
              style={{
                background: '#fff',
                borderRadius: 16,
                border: '1px solid #E2E8F0',
                padding: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{u.callSign}</div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: st.color,
                    background: `${st.color}18`,
                    padding: '3px 10px',
                    borderRadius: 999,
                  }}
                >
                  {st.label}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>{u.plate}</div>
              <div style={{ marginTop: 10, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={13} /> {u.location}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <User size={13} /> {u.crew}
                </span>
                {u.patient && <span>Patient: {u.patient}</span>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {u.status === 'available' && (
                  <button
                    type="button"
                    className="mc-btn-live"
                    onClick={() => onDispatch(u)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: 'none',
                      background: '#2563EB',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <PhoneCall size={13} /> Dispatch
                  </button>
                )}
                {u.status === 'en_route' && (
                  <button
                    type="button"
                    className="mc-btn-live"
                    onClick={() => {
                      updateUnit(u.id, { status: 'at_scene' });
                      reload();
                      flash(`${u.callSign} at scene`);
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: 'none',
                      background: '#FEF3C7',
                      color: '#B45309',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    At scene
                  </button>
                )}
                {(u.status === 'at_scene' || u.status === 'en_route') && (
                  <button
                    type="button"
                    className="mc-btn-live"
                    onClick={() => {
                      updateUnit(u.id, { status: 'returning' });
                      reload();
                      flash(`${u.callSign} returning`);
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1px solid #E2E8F0',
                      background: '#fff',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Returning
                  </button>
                )}
                {u.status !== 'available' && u.status !== 'offline' && (
                  <button
                    type="button"
                    className="mc-btn-live"
                    onClick={() => {
                      updateUnit(u.id, {
                        status: 'available',
                        location: 'Station bay',
                        patient: undefined,
                        notes: undefined,
                      });
                      reload();
                      flash(`${u.callSign} back at bay`);
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: 'none',
                      background: '#ECFDF5',
                      color: '#047857',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Clear / available
                  </button>
                )}
                {u.status === 'offline' && (
                  <button
                    type="button"
                    className="mc-btn-live"
                    onClick={() => {
                      updateUnit(u.id, { status: 'available', location: 'Station bay' });
                      reload();
                      flash(`${u.callSign} online`);
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1px solid #E2E8F0',
                      background: '#fff',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Bring online
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminAmbulanceDesk;
