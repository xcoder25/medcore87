'use client';

import React, { useState } from 'react';
import {
  Droplet, AlertTriangle, ShieldAlert, CheckCircle2,
  Search, RefreshCw, Layers, ShieldCheck
} from 'lucide-react';
import type { BloodStockUnit } from '@medcore/types';

const INITIAL_BLOOD_STOCK: BloodStockUnit[] = [
  { id: 'BLD-01', bloodGroup: 'O-', component: 'Packed RBC', unitsAvailable: 3, criticalThreshold: 6, nearestExpiry: '2026-10-12', testingStatus: 'cleared_hiv_hep_syphilis' },
  { id: 'BLD-02', bloodGroup: 'O+', component: 'Packed RBC', unitsAvailable: 24, criticalThreshold: 15, nearestExpiry: '2026-10-25', testingStatus: 'cleared_hiv_hep_syphilis' },
  { id: 'BLD-03', bloodGroup: 'A+', component: 'Packed RBC', unitsAvailable: 16, criticalThreshold: 10, nearestExpiry: '2026-10-18', testingStatus: 'cleared_hiv_hep_syphilis' },
  { id: 'BLD-04', bloodGroup: 'A-', component: 'Packed RBC', unitsAvailable: 2, criticalThreshold: 4, nearestExpiry: '2026-10-09', testingStatus: 'cleared_hiv_hep_syphilis' },
  { id: 'BLD-05', bloodGroup: 'B+', component: 'Packed RBC', unitsAvailable: 14, criticalThreshold: 8, nearestExpiry: '2026-10-22', testingStatus: 'cleared_hiv_hep_syphilis' },
  { id: 'BLD-06', bloodGroup: 'B-', component: 'Packed RBC', unitsAvailable: 1, criticalThreshold: 4, nearestExpiry: '2026-10-05', testingStatus: 'cleared_hiv_hep_syphilis' },
  { id: 'BLD-07', bloodGroup: 'AB+', component: 'Fresh Frozen Plasma', unitsAvailable: 18, criticalThreshold: 8, nearestExpiry: '2026-12-31', testingStatus: 'cleared_hiv_hep_syphilis' },
  { id: 'BLD-08', bloodGroup: 'O+', component: 'Platelets', unitsAvailable: 8, criticalThreshold: 5, nearestExpiry: '2026-09-22', testingStatus: 'cleared_hiv_hep_syphilis' },
];

export const BloodBankSuite: React.FC = () => {
  const [stock, setStock] = useState<BloodStockUnit[]>(INITIAL_BLOOD_STOCK);

  const totalUnits = stock.reduce((sum, s) => sum + s.unitsAvailable, 0);
  const criticalShortage = stock.filter(s => s.unitsAvailable < s.criticalThreshold);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Telemetry */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid #DC2626' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Total Blood Units Stored</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#F87171' }}>{totalUnits} Units</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>+4°C Cold Chain OK</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>All Serologically Screened (ELISA/NAT)</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #EF4444' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Universal Donor O- Stock</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#EF4444' }}>3 Units</span>
            <span style={{ fontSize: '0.75rem', color: '#F87171' }}>CRITICAL LOW</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Minimum Safety Reserve: 6 Units</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Fresh Frozen Plasma</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#60A5FA' }}>18 Packs</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--os-text-dim)' }}>-20°C Freezers</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Coagulopathy & Trauma Standby</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Cross-match Compatibility</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34D399' }}>100%</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>Coombs Tested</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Zero Hemolytic Transfusion Reactions</span>
        </div>
      </div>

      {/* Critical Stock Warning Banner if any */}
      {criticalShortage.length > 0 && (
        <div style={{ padding: '12px 18px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} style={{ color: '#EF4444' }} />
            <span style={{ fontSize: '0.85rem', color: '#FCA5A5', fontWeight: 600 }}>
              CRITICAL SHORTAGE ALERT: Groups {criticalShortage.map(c => c.bloodGroup).join(', ')} below regulatory minimum reserve.
            </span>
          </div>
          <button
            type="button"
            className="os-action-btn-primary"
            style={{ background: '#DC2626', fontSize: '0.75rem' }}
            onClick={() => alert(`Donor Mobilization Broadcast initiated to Akwa Ibom State Voluntary Blood Donor Registry.`)}
          >
            Dispatch Donor Mobilization SMS
          </button>
        </div>
      )}

      {/* Blood Group Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {stock.map(unit => {
          const isLow = unit.unitsAvailable < unit.criticalThreshold;
          return (
            <div key={unit.id} className="os-card" style={{ padding: 18, borderLeft: isLow ? '4px solid #EF4444' : '4px solid #34D399' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '1.6rem', fontWeight: 900, color: '#FFF' }}>{unit.bloodGroup}</span>
                <span style={{
                  fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                  background: isLow ? 'rgba(239,68,68,0.2)' : 'rgba(5,150,105,0.12)',
                  color: isLow ? '#F87171' : '#34D399',
                }}>
                  {isLow ? 'CRITICAL SHORTAGE' : 'ADEQUATE'}
                </span>
              </div>

              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--ak-orange-light)', marginBottom: 4 }}>
                {unit.component}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--os-text-muted)', marginBottom: 8 }}>
                <span>Stock: <strong style={{ color: isLow ? '#EF4444' : '#FFF', fontSize: '1rem' }}>{unit.unitsAvailable} Units</strong></span>
                <span>Min Reserve: {unit.criticalThreshold}</span>
              </div>

              <div style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', borderTop: '1px solid #FFFFFF', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>Expiry: {unit.nearestExpiry}</span>
                <span style={{ color: '#34D399' }}>NAT Screened</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
