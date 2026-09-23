'use client';

import React, { useState } from 'react';
import {
  PhoneCall, ShieldAlert, CheckCircle2, Clock, MapPin,
  Compass, User, ArrowRight
} from 'lucide-react';
import type { AmbulanceUnit } from '@medcore/types';

const INITIAL_FLEET: AmbulanceUnit[] = [
  {
    id: 'AMB-01',
    callSign: 'Ibom Medic 1 (ALS)',
    vehicleType: 'Type C Advanced Life Support',
    status: 'patient_onboard',
    crew: ['Paramedic Bassey', 'EMT Okon', 'Dr. Inyang'],
    currentLocation: 'Oron Road Flyover, Uyo',
    etaMinutes: 6,
    destination: 'Ibom Specialist Hospital (A&E Bay 1)',
  },
  {
    id: 'AMB-02',
    callSign: 'Ibom Medic 2 (BLS)',
    vehicleType: 'Type B Basic Life Support',
    status: 'en_route_scene',
    crew: ['EMT Uwem', 'Driver Daniel'],
    currentLocation: 'Ikot Ekpene Road, Plaza junction',
    etaMinutes: 11,
    destination: 'Accident Scene (Mbiabong)',
  },
  {
    id: 'AMB-03',
    callSign: 'Ibom Neo-Trans (NICU)',
    vehicleType: 'Neonatal Transport',
    status: 'available',
    crew: ['Neonatal Nurse Aisha', 'EMT Udoh'],
    currentLocation: 'Hospital Ambulance Bay',
    destination: 'Standby for Inter-Facility Transfer',
  },
  {
    id: 'AMB-04',
    callSign: 'Ibom Medic 4 (ALS)',
    vehicleType: 'Type C Advanced Life Support',
    status: 'available',
    crew: ['Paramedic Edet', 'Driver Nsikak'],
    currentLocation: 'Hospital Ambulance Bay',
    destination: 'Ready for Dispatch',
  },
];

export const AmbulanceTransfersSuite: React.FC = () => {
  const [fleet, setFleet] = useState<AmbulanceUnit[]>(INITIAL_FLEET);

  const activeMissions = fleet.filter(f => f.status === 'en_route_scene' || f.status === 'patient_onboard').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Telemetry */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid var(--ak-orange)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Ambulance Fleet Status</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--ak-orange-light)' }}>{fleet.length} Units</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>GPS Active</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>2 Standby � 2 On Mission</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #EF4444' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Active Emergency Missions</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#EF4444' }}>{activeMissions} Active</span>
            <span style={{ fontSize: '0.75rem', color: '#F87171' }}>Critical Priority</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Fast-track A&E notification sent</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Average Response Time</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#60A5FA' }}>7.8 min</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>Target &lt; 9m</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>State Emergency Dispatch Network</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Inter-Hospital Transfers</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34D399' }}>4 Transfers</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--os-text-dim)' }}>Completed Today</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Referrals to UUTH & General Hospital Eket</span>
        </div>
      </div>

      {/* Fleet Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        {fleet.map(unit => (
          <div key={unit.id} className="os-card" style={{ padding: 18, borderLeft: unit.status === 'patient_onboard' ? '4px solid #EF4444' : unit.status === 'en_route_scene' ? '4px solid var(--ak-orange)' : '4px solid #10B981' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0A2540' }}>{unit.callSign}</span>
              <span style={{
                fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                background: unit.status === 'patient_onboard' ? '#DC2626' : unit.status === 'en_route_scene' ? 'rgba(234,88,12,0.2)' : 'rgba(5,150,105,0.12)',
                color: unit.status === 'patient_onboard' ? '#FFF' : unit.status === 'en_route_scene' ? 'var(--ak-orange-light)' : '#34D399',
              }}>
                {unit.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--os-text-muted)', marginBottom: 8 }}>{unit.vehicleType}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 6, fontSize: '0.76rem', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={12} style={{ color: 'var(--ak-orange-light)' }} />
                <span>Current Location: <strong style={{ color: '#0A2540' }}>{unit.currentLocation}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Compass size={12} style={{ color: '#60A5FA' }} />
                <span>Destination: <strong style={{ color: '#0A2540' }}>{unit.destination}</strong></span>
              </div>
              {unit.etaMinutes && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#FBBF24', fontWeight: 700 }}>
                  <Clock size={12} />
                  <span>ETA Hospital Trauma Bay: {unit.etaMinutes} Minutes</span>
                </div>
              )}
            </div>

            <div style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', marginBottom: 10 }}>
              Crew: {unit.crew.join(' � ')}
            </div>

            <button
              type="button"
              className="os-ghost-btn"
              style={{ width: '100%', justifyContent: 'center', fontSize: '0.75rem' }}
              onClick={() => alert(`Radio frequency opened with ${unit.callSign} dispatch unit.`)}
            >
              <PhoneCall size={12} /> Open Radio Dispatch Channel
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
