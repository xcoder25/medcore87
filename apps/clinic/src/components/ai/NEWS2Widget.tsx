import React from 'react';

interface NEWS2WidgetProps {
  news2Score?: number;
  news2Risk?: string;
  qsofaScore?: number;
  sepsisRisk?: boolean;
  patientName?: string;
  breakdown?: {
    respiratoryRate: number;
    spO2: number;
    supplementalOxygen: number;
    systolicBP: number;
    heartRate: number;
    temperature: number;
    consciousness: number;
  };
  compact?: boolean;
}

const RISK_COLORS = {
  HIGH:       '#ff2d55',
  MEDIUM:     '#ff9500',
  LOW_MEDIUM: '#ff9f0a',
  LOW:        '#30d158',
};

const PARAMETER_LABELS: Record<string, string> = {
  respiratoryRate:   'RR',
  spO2:              'SpO₂',
  supplementalOxygen:'O₂',
  systolicBP:        'SBP',
  heartRate:         'HR',
  temperature:       'Temp',
  consciousness:     'ACVPU',
};

export default function NEWS2Widget({ news2Score, news2Risk = 'LOW', qsofaScore, sepsisRisk, patientName, breakdown, compact = false }: NEWS2WidgetProps) {
  if (news2Score === undefined) {
    return (
      <div style={{ background: '#1a1a2e', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', color: '#636366', fontSize: 12 }}>
        <div style={{ fontSize: 24, marginBottom: 4 }}>📊</div>
        Record vitals to compute NEWS2
      </div>
    );
  }

  const riskColor = RISK_COLORS[(news2Risk as keyof typeof RISK_COLORS)] || RISK_COLORS.LOW;
  const isCritical = news2Score >= 5 || sepsisRisk;

  if (compact) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px',
        borderRadius: 20, background: `${riskColor}22`, border: `1px solid ${riskColor}55`,
        animation: isCritical ? 'newsGlow 2s ease-in-out infinite' : 'none',
      }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: riskColor }}>NEWS2</span>
        <span style={{ fontSize: 18, fontWeight: 900, color: riskColor }}>{news2Score}</span>
        <span style={{ fontSize: 10, color: riskColor, opacity: 0.8 }}>{news2Risk}</span>
        {sepsisRisk && <span style={{ fontSize: 10, color: '#ff2d55', fontWeight: 700 }}>qSOFA:{qsofaScore}</span>}
        <style>{`@keyframes newsGlow { 0%,100% { box-shadow: 0 0 6px ${riskColor}44; } 50% { box-shadow: 0 0 16px ${riskColor}88; } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: 'Inter, system-ui, sans-serif',
      background: isCritical ? `linear-gradient(135deg, #1a1a2e, ${riskColor}11)` : '#1a1a2e',
      borderRadius: 14, border: `1px solid ${isCritical ? riskColor + '44' : 'rgba(255,255,255,0.08)'}`,
      overflow: 'hidden',
      boxShadow: isCritical ? `0 0 20px ${riskColor}33` : 'none',
      animation: isCritical ? 'newsGlow 2s ease-in-out infinite' : 'none',
    }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: '#636366', fontWeight: 600 }}>NEWS2 SCORE{patientName ? ` · ${patientName}` : ''}</div>
          <div style={{ fontSize: 11, color: '#48484a', marginTop: 1 }}>National Early Warning Score 2</div>
        </div>
        {sepsisRisk && (
          <div style={{ fontSize: 11, padding: '3px 10px', borderRadius: 8, background: 'rgba(255,45,85,0.15)', color: '#ff2d55', fontWeight: 700, border: '1px solid rgba(255,45,85,0.3)', animation: 'pulse 1s ease-in-out infinite' }}>
            🚨 SEPSIS RISK
          </div>
        )}
      </div>

      <div style={{ padding: 14 }}>
        {/* Score display */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: `conic-gradient(${riskColor} ${news2Score * 100 / 20}%, rgba(255,255,255,0.06) 0)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 0 4px #1a1a2e, 0 0 0 6px ${riskColor}44`,
          }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#1a1a2e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: riskColor, lineHeight: 1 }}>{news2Score}</span>
              <span style={{ fontSize: 9, color: '#636366' }}>/20</span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: riskColor }}>{news2Risk?.replace('_', '-')}</div>
            <div style={{ fontSize: 11, color: '#aeaeb2', marginTop: 2 }}>
              {news2Score >= 7 ? 'Continuous monitoring · Immediate review' :
               news2Score >= 5 ? 'Urgent review within 1 hour' :
               news2Score >= 3 ? 'Review within 4–6 hours' : 'Routine monitoring q12h'}
            </div>
            {qsofaScore !== undefined && (
              <div style={{ fontSize: 11, color: sepsisRisk ? '#ff2d55' : '#636366', marginTop: 4, fontWeight: sepsisRisk ? 700 : 400 }}>
                qSOFA: {qsofaScore}/3 {sepsisRisk ? '— Sepsis bundle required' : ''}
              </div>
            )}
          </div>
        </div>

        {/* Breakdown bars */}
        {breakdown && (
          <div>
            <div style={{ fontSize: 10, color: '#636366', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Score Breakdown</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
              {(Object.entries(breakdown) as [string, number][]).map(([key, val]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: '#636366', minWidth: 40 }}>{PARAMETER_LABELS[key] || key}</span>
                  <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(val / 3) * 100}%`, background: val === 0 ? '#30d158' : val === 1 ? '#ff9f0a' : val === 2 ? '#ff9500' : '#ff2d55', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: val === 0 ? '#30d158' : val >= 3 ? '#ff2d55' : '#ff9500', minWidth: 12 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes newsGlow { 0%,100% { box-shadow: 0 0 20px ${riskColor}33; } 50% { box-shadow: 0 0 35px ${riskColor}55; } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
      `}</style>
    </div>
  );
}
