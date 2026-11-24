'use client';

import React, { useMemo, useState } from 'react';
import { MapPin, ZoomIn, ZoomOut, RotateCcw, ExternalLink } from 'lucide-react';
import type { MohFacilityTelemetry, MohOperationalStatus } from '../../lib/mohTypes';

interface MohGisMapProps {
  facilities: MohFacilityTelemetry[];
  onSelectFacility: (facility: MohFacilityTelemetry) => void;
}

const MIN_LAT = 4.46;
const MAX_LAT = 5.56;
const MIN_LNG = 7.42;
const MAX_LNG = 8.38;

function projectPoint(lat: number, lng: number): { x: number; y: number } {
  const clampedLng = Math.max(MIN_LNG, Math.min(MAX_LNG, lng || 7.91));
  const clampedLat = Math.max(MIN_LAT, Math.min(MAX_LAT, lat || 5.03));
  const x = 80 + ((clampedLng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * 640;
  const y = 475 - ((clampedLat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * 410;
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

const STATUS_STYLE: Record<
  MohOperationalStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  fully_functional: {
    label: 'Fully Functional',
    color: '#059669',
    bg: '#ECFDF5',
    border: '#A7F3D0',
  },
  partially_functional: {
    label: 'Partially Functional',
    color: '#D97706',
    bg: '#FFFBEB',
    border: '#FDE68A',
  },
  closed: {
    label: 'Closed',
    color: '#64748B',
    bg: '#F1F5F9',
    border: '#CBD5E1',
  },
  sealed: {
    label: 'Sealed / Sanctioned',
    color: '#DC2626',
    bg: '#FEF2F2',
    border: '#FECACA',
  },
};

export const MohGisMap: React.FC<MohGisMapProps> = ({ facilities, onSelectFacility }) => {
  const [statusFilter, setStatusFilter] = useState<'all' | MohOperationalStatus>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [zoom, setZoom] = useState<number>(1);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const typeBuckets = useMemo(() => {
    const set = new Set<string>();
    for (const f of facilities) {
      if (/tertiary|teaching/i.test(f.facilityType)) set.add('Tertiary');
      else if (/cottage/i.test(f.facilityType)) set.add('Cottage Hospital');
      else if (/primary|phc|comprehensive health/i.test(f.facilityType)) set.add('PHC / CHC');
      else if (/private|clinic|maternity/i.test(f.facilityType) || f.ownership === 'private') set.add('Private Clinic');
      else set.add('General Hospital');
    }
    return Array.from(set).sort();
  }, [facilities]);

  const filtered = useMemo(() => {
    return facilities.filter((f) => {
      if (statusFilter !== 'all' && f.operationalStatus !== statusFilter) return false;
      if (typeFilter !== 'all') {
        const ft = f.facilityType.toLowerCase();
        if (typeFilter === 'Tertiary' && !ft.includes('tertiary') && !ft.includes('teaching')) return false;
        if (typeFilter === 'Cottage Hospital' && !ft.includes('cottage')) return false;
        if (typeFilter === 'PHC / CHC' && !ft.includes('primary') && !ft.includes('phc') && !ft.includes('comprehensive')) return false;
        if (typeFilter === 'Private Clinic' && !ft.includes('private') && f.ownership !== 'private') return false;
        if (
          typeFilter === 'General Hospital' &&
          (ft.includes('tertiary') || ft.includes('cottage') || ft.includes('primary') || ft.includes('comprehensive') || ft.includes('private'))
        ) {
          return false;
        }
      }
      return true;
    });
  }, [facilities, statusFilter, typeFilter]);

  const counts = useMemo(() => {
    const map: Record<MohOperationalStatus, number> = {
      fully_functional: 0,
      partially_functional: 0,
      closed: 0,
      sealed: 0,
    };
    for (const f of facilities) {
      map[f.operationalStatus] = (map[f.operationalStatus] || 0) + 1;
    }
    return map;
  }, [facilities]);

  const activePin = useMemo(
    () => filtered.find((f) => f.facilityId === hoveredId) || null,
    [filtered, hoveredId]
  );

  // Compute SVG viewBox center crop for deterministic zoom without jitter
  const vbW = 800 / zoom;
  const vbH = 540 / zoom;
  const vbX = (800 - vbW) / 2;
  const vbY = (540 - vbH) / 2;

  return (
    <div className="moh-panel">
      <div className="moh-panel-head" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 className="moh-panel-title">
            <MapPin size={17} color="#065F46" />
            <span>Akwa Ibom Statewide GPS Health Facility Map ({filtered.length} plotted)</span>
          </h2>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 2 }}>
            Click any GPS facility pin to open its full 360° Hospital Command Dossier.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="moh-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter map by facility level"
          >
            <option value="all">All Levels ({facilities.length})</option>
            {typeBuckets.map((tb) => (
              <option key={tb} value={tb}>
                {tb}
              </option>
            ))}
          </select>

          <div style={{ display: 'inline-flex', gap: 4 }}>
            <button
              type="button"
              className="moh-icon-btn"
              onClick={() => setZoom((z) => Math.min(2, Number((z + 0.35).toFixed(2))))}
              aria-label="Zoom in map"
              title="Zoom in"
            >
              <ZoomIn size={15} />
            </button>
            <button
              type="button"
              className="moh-icon-btn"
              onClick={() => setZoom((z) => Math.max(1, Number((z - 0.35).toFixed(2))))}
              aria-label="Zoom out map"
              title="Zoom out"
            >
              <ZoomOut size={15} />
            </button>
            {zoom > 1 && (
              <button
                type="button"
                className="moh-icon-btn"
                onClick={() => setZoom(1)}
                aria-label="Reset zoom"
                title="Reset map zoom"
              >
                <RotateCcw size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status Filter Legend Pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button
          type="button"
          className="moh-btn-outline"
          style={{
            padding: '5px 11px',
            fontSize: '0.74rem',
            background: statusFilter === 'all' ? '#ECFDF5' : '#FFFFFF',
            borderColor: statusFilter === 'all' ? '#065F46' : '#CBD5E1',
            color: statusFilter === 'all' ? '#065F46' : '#334155',
          }}
          onClick={() => setStatusFilter('all')}
        >
          All Statuses ({facilities.length})
        </button>
        {(Object.keys(STATUS_STYLE) as MohOperationalStatus[]).map((stKey) => {
          const st = STATUS_STYLE[stKey];
          const active = statusFilter === stKey;
          return (
            <button
              key={stKey}
              type="button"
              className="moh-btn-outline"
              style={{
                padding: '5px 11px',
                fontSize: '0.74rem',
                background: active ? st.bg : '#FFFFFF',
                borderColor: active ? st.color : '#CBD5E1',
                color: active ? st.color : '#334155',
              }}
              onClick={() => setStatusFilter(active ? 'all' : stKey)}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: st.color,
                  display: 'inline-block',
                }}
              />
              <span>
                {st.label} ({counts[stKey] || 0})
              </span>
            </button>
          );
        })}
      </div>

      {/* SVG Map + Pin Details Side Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(240px, 1fr)', gap: 14, alignItems: 'stretch' }}>
        <div
          style={{
            borderRadius: 14,
            border: '1px solid #CBD5E1',
            background: 'linear-gradient(180deg, #F8FAFC 0%, #EFF6FF 100%)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <svg
            viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
            style={{ width: '100%', height: 360, display: 'block' }}
            role="img"
            aria-label="GPS map of Akwa Ibom State health facilities"
          >
            {/* Coordinate graticule */}
            {[160, 320, 480, 640].map((gx) => (
              <line key={gx} x1={gx} y1={20} x2={gx} y2={520} stroke="#E2E8F0" strokeDasharray="4 4" />
            ))}
            {[120, 240, 360, 460].map((gy) => (
              <line key={gy} x1={40} y1={gy} x2={760} y2={gy} stroke="#E2E8F0" strokeDasharray="4 4" />
            ))}

            {/* Generalized Akwa Ibom State Polygon */}
            <path
              d="M 275 110 L 345 125 L 445 170 L 490 230 L 535 280 L 650 345 L 655 405 L 555 442 L 455 452 L 350 458 L 265 462 L 168 430 L 145 315 L 185 245 L 195 168 Z"
              fill="#FFFFFF"
              fillOpacity={0.92}
              stroke="#065F46"
              strokeWidth={2}
              strokeOpacity={0.45}
            />

            {/* Atlantic Ocean South Coast Hint */}
            <text x={420} y={505} fontSize="11" fill="#64748B" textAnchor="middle" fontWeight={600}>
              Bight of Bonny / Atlantic Coastline
            </text>

            {/* Senatorial Zone Watermarks */}
            <text x={250} y={185} fontSize="11" fill="#94A3B8" fontWeight={700}>
              IKOT EKPENE DISTRICT
            </text>
            <text x={430} y={248} fontSize="11" fill="#94A3B8" fontWeight={700}>
              UYO DISTRICT
            </text>
            <text x={430} y={405} fontSize="11" fill="#94A3B8" fontWeight={700}>
              EKET DISTRICT
            </text>

            {/* GPS Facility Pins */}
            {filtered.map((fac) => {
              const { x, y } = projectPoint(fac.latitude, fac.longitude);
              const style = STATUS_STYLE[fac.operationalStatus] || STATUS_STYLE.partially_functional;
              const isSelected = hoveredId === fac.facilityId;
              const isTertiary = fac.tier === 'national_referral' || fac.tier === 'regional_general';
              const radius = isTertiary ? 8 : fac.enrollmentStatus === 'active' ? 6.5 : 5;
              return (
                <g
                  key={fac.facilityId}
                  transform={`translate(${x}, ${y})`}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredId(fac.facilityId)}
                  onClick={() => {
                    setHoveredId(fac.facilityId);
                    onSelectFacility(fac);
                  }}
                >
                  {isSelected && (
                    <circle r={radius + 6} fill={style.color} fillOpacity={0.22} />
                  )}
                  <circle
                    r={radius}
                    fill={style.color}
                    stroke="#FFFFFF"
                    strokeWidth={2}
                  />
                  {(isSelected || isTertiary || fac.operationalStatus === 'sealed') && (
                    <text
                      x={0}
                      y={-radius - 5}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight={800}
                      fill="#0F172A"
                    >
                      {fac.facilityId}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected / Hovered Pin Inspector */}
        <div
          style={{
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            background: '#F8FAFC',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          {activePin ? (
            <>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <code style={{ fontWeight: 800, color: '#065F46', fontSize: '0.82rem' }}>
                    {activePin.facilityId}
                  </code>
                  <span
                    className="moh-pill"
                    style={{
                      background: STATUS_STYLE[activePin.operationalStatus].bg,
                      color: STATUS_STYLE[activePin.operationalStatus].color,
                      borderColor: STATUS_STYLE[activePin.operationalStatus].border,
                    }}
                  >
                    {STATUS_STYLE[activePin.operationalStatus].label}
                  </span>
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.96rem', color: '#0F172A' }}>
                  {activePin.facilityName}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 3 }}>
                  {activePin.lga} LGA · {activePin.district} District
                </div>
                <div style={{ fontSize: '0.74rem', fontFamily: 'monospace', color: '#475569', marginTop: 6 }}>
                  GPS: {activePin.latitude.toFixed(4)}° N, {activePin.longitude.toFixed(4)}° E
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                  <div style={{ background: '#FFFFFF', padding: '8px 10px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700 }}>BEDS</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>
                      {activePin.occupiedBeds}/{activePin.totalBeds}
                    </div>
                  </div>
                  <div style={{ background: '#FFFFFF', padding: '8px 10px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700 }}>STAFF</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>
                      {activePin.activeStaffCount}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: 10 }}>
                  Scope: <strong>{activePin.approvedServices.slice(0, 3).join(', ')}</strong>
                </div>
              </div>

              <button
                type="button"
                className="moh-btn-primary"
                style={{ justifyContent: 'center' }}
                onClick={() => onSelectFacility(activePin)}
              >
                <span>Open 360° Command Dossier</span>
                <ExternalLink size={14} />
              </button>
            </>
          ) : (
            <div style={{ margin: 'auto 0', textAlign: 'center', color: '#64748B', fontSize: '0.82rem', lineHeight: 1.5 }}>
              <MapPin size={26} color="#065F46" style={{ margin: '0 auto 8px' }} />
              <div>
                Hover over or tap any GPS facility marker on the Akwa Ibom map to inspect operational status, license standing, and live clinical telemetry.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
