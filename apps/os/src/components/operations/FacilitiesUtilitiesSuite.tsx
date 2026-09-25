'use client';

import React, { useState } from 'react';
import {
  Flame, Zap, Droplets, Wind, ShieldCheck,
  AlertTriangle, CheckCircle2, RefreshCw, Gauge
} from 'lucide-react';
import type { FacilityTelemetry } from '@medcore/types';

const INITIAL_UTILITIES: FacilityTelemetry = {} as FacilityTelemetry;

export const FacilitiesUtilitiesSuite: React.FC = () => {
  const [telemetry, setTelemetry] = useState<FacilityTelemetry>(INITIAL_UTILITIES);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Main Telemetry Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        {/* Oxygen Plant */}
        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Medical Oxygen Manifold</span>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: 'rgba(5,150,105,0.1)', color: '#34D399' }}>
              {telemetry.oxygenStatus}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '6px 0' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#60A5FA' }}>{telemetry.oxygenManifoldPsi} PSI</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)' }}>
            Pipeline Pressure: Normal (50�60 PSI) � Liquid O2 Tank at 92%
          </div>
        </div>

        {/* Backup Power Generators */}
        <div className="os-card" style={{ borderLeft: '4px solid var(--ak-orange)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Emergency Power Plant</span>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: 'rgba(234,88,12,0.15)', color: 'var(--ak-orange-light)' }}>
              STANDBY READY
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '6px 0' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--ak-orange-light)' }}>{telemetry.backupGeneratorKw} KW</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)' }}>
            Cummins Diesel 1.5 MVA � Fuel Tank: {telemetry.generatorFuelPercent}% (~36h Runtime)
          </div>
        </div>

        {/* Medical Vacuum */}
        <div className="os-card" style={{ borderLeft: '4px solid #10B981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Central Surgical Vacuum</span>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: 'rgba(5,150,105,0.1)', color: '#34D399' }}>
              SUCTION OK
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '6px 0' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#34D399' }}>{telemetry.medicalVacuumBar} Bar</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)' }}>
            Operating Theatres & ICU Continuous Negative Suction
          </div>
        </div>

        {/* Clean Water Reserve */}
        <div className="os-card" style={{ borderLeft: '4px solid #06B6D4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Treated Water Reserve</span>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: 'rgba(6,182,212,0.15)', color: '#22D3EE' }}>
              RESERVE FULL
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '6px 0' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#22D3EE' }}>{telemetry.waterSupplyLiters.toLocaleString()} L</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)' }}>
            Reverse Osmosis (RO) Plant Operational for Dialysis & CSSD
          </div>
        </div>
      </div>

      {/* Facilities Plant Schematic Card */}
      <div className="os-card" style={{ padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--os-text-muted)', textTransform: 'uppercase' }}>
            Critical Hospital Infrastructure & Engineering Telemetry
          </span>
          <span style={{ fontSize: '0.72rem', color: '#34D399', fontWeight: 700 }}>? SCADA AUTOMATION SYSTEM ONLINE</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: 14, borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <strong style={{ color: '#0A2540', fontSize: '0.9rem' }}>HVAC & Cleanroom Positive Pressure</strong>
            <p style={{ margin: '6px 0', fontSize: '0.78rem', color: 'var(--os-text-muted)' }}>
              Operating Theatres HEPA Filter differential pressure: <strong>{telemetry.hvacHepaPressurePa} Pa</strong> (Target 30�50 Pa). Air changes per hour: 24 ACH.
            </p>
            <span style={{ color: '#34D399', fontSize: '0.72rem', fontWeight: 700 }}>Compliant with ISO Class 7</span>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: 14, borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <strong style={{ color: '#0A2540', fontSize: '0.9rem' }}>Medical Gas Alarm Panel</strong>
            <p style={{ margin: '6px 0', fontSize: '0.78rem', color: 'var(--os-text-muted)' }}>
              Nitrous Oxide (N2O): 4.1 Bar � Medical Air 400: 4.0 Bar � Surgical Tool Air 700: 7.2 Bar.
            </p>
            <span style={{ color: '#34D399', fontSize: '0.72rem', fontWeight: 700 }}>Zero Leaks Detected (NFPA 99)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
