'use client';

import React, { useState } from 'react';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, Search,
  FileText, Clock, ExternalLink, RefreshCw
} from 'lucide-react';
import type { HmoInsuranceClaim } from '@medcore/types';

const INITIAL_CLAIMS: HmoInsuranceClaim[] = [
  { id: 'CLM-01', claimNumber: 'AKSHIA-CLM-2026-114', hmoProvider: 'AKSHIA (State Scheme)', patientNhiaId: 'AK/UYO/448102', amountNgn: 147600, submittedDate: '2026-09-15', status: 'paid' },
  { id: 'CLM-02', claimNumber: 'HYG-CLM-2026-884', hmoProvider: 'Hygeia HMO', patientNhiaId: 'HYG/CORP/00914', amountNgn: 396000, submittedDate: '2026-09-16', status: 'preauthorized' },
  { id: 'CLM-03', claimNumber: 'REL-CLM-2026-302', hmoProvider: 'Reliance HMO', patientNhiaId: 'REL/IND/77210', amountNgn: 192000, submittedDate: '2026-09-16', status: 'submitted' },
  { id: 'CLM-04', claimNumber: 'AXA-CLM-2026-042', hmoProvider: 'AXA Mansard', patientNhiaId: 'AXA/PRV/11824', amountNgn: 256000, submittedDate: '2026-09-14', status: 'denied', denialReason: 'Pre-authorization code missing for MRI study.' },
];

export const InsuranceHmoClaimsSuite: React.FC = () => {
  const [claims, setClaims] = useState<HmoInsuranceClaim[]>(INITIAL_CLAIMS);

  const totalSubmitted = claims.reduce((sum, c) => sum + c.amountNgn, 0);
  const paidCount = claims.filter(c => c.status === 'paid').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Telemetry */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>AKSHIA State Scheme Health Insurance</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34D399' }}>100% Direct</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Instant Remittance from Akwa Ibom State</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Claims Batched Today</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#60A5FA' }}>?{totalSubmitted.toLocaleString()}</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>4 Claims Transmitted to HMO Gateways</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid var(--ak-orange)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Pre-Authorization Approval Rate</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--ak-orange-light)' }}>94.2%</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Avg Clearance Time: 12 min</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #EF4444' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Claim Denials in Dispute</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#EF4444' }}>1 Denial</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Appeals Desk Auto-Dispute Triggered</span>
        </div>
      </div>

      {/* Claims Table */}
      <div className="os-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--os-text-muted)', textTransform: 'uppercase' }}>
            HMO / NHIA Claim Adjudication Register
          </span>
          <button
            type="button"
            className="os-action-btn-primary"
            style={{ fontSize: '0.72rem' }}
            onClick={() => alert('Batch transmission dispatched to NHIA portal.')}
          >
            Transmit Daily HMO Claims Batch
          </button>
        </div>

        <div className="os-table-wrap">
          <table className="os-table">
            <thead>
              <tr>
                <th>Claim ID</th>
                <th>HMO Provider</th>
                <th>Patient NHIA ID</th>
                <th>Claim Amount</th>
                <th>Submitted Date</th>
                <th>Status</th>
                <th>Notes / Action</th>
              </tr>
            </thead>
            <tbody>
              {claims.map(claim => (
                <tr key={claim.id}>
                  <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.74rem', color: 'var(--ak-orange-light)', fontWeight: 700 }}>
                    {claim.claimNumber}
                  </td>
                  <td style={{ fontWeight: 700, color: '#0A2540' }}>{claim.hmoProvider}</td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--os-text-dim)' }}>{claim.patientNhiaId}</td>
                  <td style={{ fontWeight: 800, color: '#0A2540' }}>?{claim.amountNgn.toLocaleString()}</td>
                  <td style={{ fontSize: '0.76rem', color: 'var(--os-text-dim)' }}>{claim.submittedDate}</td>
                  <td>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      background: claim.status === 'paid' ? 'rgba(5,150,105,0.1)' : claim.status === 'denied' ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
                      color: claim.status === 'paid' ? '#34D399' : claim.status === 'denied' ? '#F87171' : '#60A5FA',
                    }}>
                      {claim.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    {claim.denialReason ? (
                      <span style={{ fontSize: '0.72rem', color: '#F87171' }}>{claim.denialReason}</span>
                    ) : (
                      <span style={{ fontSize: '0.72rem', color: '#34D399' }}>Verified clean claim</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
