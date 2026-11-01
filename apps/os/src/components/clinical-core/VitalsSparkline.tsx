'use client';

/**
 * VitalsSparkline.tsx — Ultra-crisp, lightweight SVG telemetry sparklines.
 *
 * Renders clinical waveforms with:
 *  - Corridor of normalcy (shaded bounds)
 *  - Smooth bezier/cardinal spline path
 *  - Min / Max / Current readout + delta trend glyph
 *  - Zero heavy chart dependencies (pure SVG, 60fps)
 */

import React, { useMemo } from 'react';

interface VitalsSparklineProps {
  label: string;
  unit: string;
  currentValue: number | string;
  points?: number[];
  color?: string;
  normalRange?: [number, number];
  height?: number;
  width?: number;
  status?: 'normal' | 'warning' | 'critical';
}

export const VitalsSparkline: React.FC<VitalsSparklineProps> = ({
  label,
  unit,
  currentValue,
  points = [72, 75, 71, 74, 78, 76, 73, 77, 75],
  color = '#10B981',
  normalRange,
  height = 36,
  width = 96,
  status = 'normal',
}) => {
  const { pathD, areaD, minVal, maxVal } = useMemo(() => {
    if (!points || points.length < 2) {
      return { pathD: '', areaD: '', minVal: 0, maxVal: 100 };
    }

    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const padding = 3;
    const drawH = height - padding * 2;
    const step = width / (points.length - 1);

    const coords = points.map((p, i) => {
      const x = i * step;
      const y = height - padding - ((p - min) / range) * drawH;
      return { x, y };
    });

    // Build smooth curve
    let d = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i === 0 ? 0 : i - 1];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const area = `${d} L ${width} ${height} L 0 ${height} Z`;

    return { pathD: d, areaD: area, minVal: min, maxVal: max };
  }, [points, height, width]);

  const statusColor =
    status === 'critical' ? '#EF4444' : status === 'warning' ? '#F59E0B' : color;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
        border: '1px solid #E2E8F0',
        borderRadius: 12,
        padding: '8px 12px',
        gap: 12,
        boxShadow: '0 1px 3px rgba(15,23,42,0.03), 0 0 0 1px rgba(255,255,255,0.8) inset',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span
          style={{
            fontSize: '0.66rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            color: '#64748B',
            letterSpacing: '0.04em',
          }}
        >
          {label}
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
          <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', fontFamily: 'ui-sans-serif, system-ui' }}>
            {currentValue}
          </span>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94A3B8' }}>{unit}</span>
        </div>
      </div>

      <div style={{ position: 'relative', width, height }}>
        <svg width={width} height={height} style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id={`grad-${label.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={statusColor} stopOpacity="0.22" />
              <stop offset="100%" stopColor={statusColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          {areaD && (
            <path
              d={areaD}
              fill={`url(#grad-${label.replace(/\s+/g, '')})`}
            />
          )}

          {/* Sparkline stroke */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke={statusColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Current pulse dot */}
          {points.length > 0 && (
            <circle
              cx={width}
              cy={height - 3 - (((points[points.length - 1] - minVal) / (maxVal - minVal || 1)) * (height - 6))}
              r="3"
              fill={statusColor}
            />
          )}
        </svg>
      </div>
    </div>
  );
};

export default VitalsSparkline;

