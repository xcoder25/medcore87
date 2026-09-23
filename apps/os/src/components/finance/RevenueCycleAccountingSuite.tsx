'use client';

import React, { useState } from 'react';
import {
  TrendingUp, BarChart3, AlertTriangle, CheckCircle2,
  DollarSign, ArrowUpRight, ArrowDownRight, Layers
} from 'lucide-react';

export const RevenueCycleAccountingSuite: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Telemetry */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Gross Hospital Revenue (MTD)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.7rem', fontWeight: 800, color: '#34D399' }}>₦842.6M</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#34D399', display: 'flex', alignItems: 'center', gap: 4 }}>
            <ArrowUpRight size={12} /> +14.2% vs previous month
          </span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid var(--ak-orange)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Accounts Receivable (A/R)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--ak-orange-light)' }}>₦128.4M</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Avg Days in A/R: 28 Days (Target &lt; 35d)</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>State Treasury Remittance</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.7rem', fontWeight: 800, color: '#60A5FA' }}>100% Remitted</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>AkwaRemit Automated Settlement</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #EF4444' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Revenue Leakage Detected</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.7rem', fontWeight: 800, color: '#EF4444' }}>0.0%</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#34D399' }}>AI Anti-Theft Double-Entry Ledger Active</span>
        </div>
      </div>

      {/* A/R Aging Buckets Card */}
      <div className="os-card" style={{ padding: 22 }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--os-text-muted)', textTransform: 'uppercase' }}>
          Accounts Receivable (A/R) Aging Analysis
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 14 }}>
          <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: '#6EE7B7', fontWeight: 700 }}>0 – 30 DAYS (CURRENT)</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0A2540', marginTop: 4 }}>₦92,400,000</div>
            <span style={{ fontSize: '0.7rem', color: '#34D399' }}>72.0% of Total A/R</span>
          </div>
          <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: '#93C5FD', fontWeight: 700 }}>31 – 60 DAYS</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0A2540', marginTop: 4 }}>₦22,100,000</div>
            <span style={{ fontSize: '0.7rem', color: '#60A5FA' }}>17.2% of Total A/R</span>
          </div>
          <div style={{ background: 'rgba(234,88,12,0.1)', border: '1px solid rgba(234,88,12,0.25)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--ak-orange-light)', fontWeight: 700 }}>61 – 90 DAYS</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0A2540', marginTop: 4 }}>₦9,800,000</div>
            <span style={{ fontSize: '0.7rem', color: 'var(--ak-orange-light)' }}>7.6% of Total A/R</span>
          </div>
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: '#FCA5A5', fontWeight: 700 }}>90+ DAYS (DELINQUENT)</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0A2540', marginTop: 4 }}>₦4,100,000</div>
            <span style={{ fontSize: '0.7rem', color: '#F87171' }}>3.2% (Under Recovery)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
