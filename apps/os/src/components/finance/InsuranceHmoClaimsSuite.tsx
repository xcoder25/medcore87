'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Plus,
  Download,
  RefreshCw,
} from 'lucide-react';
import { getActiveFacilityId } from '../../lib/adminRealtimeStore';
import type { ClaimBatchSummary, ClaimRecord } from '../../lib/akshiaClaimsEngine';

interface ClaimsMetrics {
  totalClaims: number;
  cleanRatePct: number;
  totalBilledNgn: number;
  totalSubmittedNgn: number;
  totalPaidNgn: number;
  paidCount: number;
  queriedCount: number;
  avgTurnaroundDays: number;
}

export const InsuranceHmoClaimsSuite: React.FC = () => {
  const facilityId = (typeof window !== 'undefined' && getActiveFacilityId()) || 'IGH-EKT';
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [batches, setBatches] = useState<ClaimBatchSummary[]>([]);
  const [metrics, setMetrics] = useState<ClaimsMetrics>({
    totalClaims: 0,
    cleanRatePct: 100,
    totalBilledNgn: 0,
    totalSubmittedNgn: 0,
    totalPaidNgn: 0,
    paidCount: 0,
    queriedCount: 0,
    avgTurnaroundDays: 0,
  });
  const [batchNotice, setBatchNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Quick Claim Draft Form
  const [scheme, setScheme] = useState<ClaimRecord['scheme']>('AKSHIA');
  const [patientName, setPatientName] = useState('');
  const [enrolleeId, setEnrolleeId] = useState('');
  const [icd11Code, setIcd11Code] = useState('1F40');
  const [diagnosis, setDiagnosis] = useState('Uncomplicated Malaria');
  const [authorizationCode, setAuthorizationCode] = useState('');
  const [totalAmountNgn, setTotalAmountNgn] = useState<number>(8500);

  const flashNotice = (msg: string) => {
    setBatchNotice(msg);
    setTimeout(() => setBatchNotice(null), 5000);
  };

  const loadClaims = useCallback(async () => {
    try {
      const res = await fetch(`/api/akshia/claims?facilityId=${encodeURIComponent(facilityId)}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.ok) {
        setClaims(Array.isArray(json.claims) ? json.claims : []);
        setBatches(Array.isArray(json.batches) ? json.batches : []);
        if (json.metrics) setMetrics(json.metrics);
      }
    } catch {
      // fail soft offline
    }
  }, [facilityId]);

  useEffect(() => {
    void loadClaims();
  }, [loadClaims]);

  const handleAddClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/akshia/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_claim',
          facilityId,
          claim: {
            scheme,
            patientName: patientName.trim(),
            enrolleeId: enrolleeId.trim(),
            icd11Code: icd11Code.trim(),
            diagnosis: diagnosis.trim(),
            authorizationCode: authorizationCode.trim() || undefined,
            totalAmountNgn: Number(totalAmountNgn || 0),
          },
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setPatientName('');
        setEnrolleeId('');
        setAuthorizationCode('');
        await loadClaims();
        flashNotice(
          json.claim.status === 'vetted_ready'
            ? `Claim ${json.claim.claimNumber} vetted CLEAN (${json.claim.readinessScore}/100) and queued for monthly batch.`
            : `Claim ${json.claim.claimNumber} saved as DRAFT — fix ${json.claim.denialRisks.length} denial flag(s) before batching.`
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleTransmitBatch = async () => {
    setBusy(true);
    try {
      const periodMonth = new Date().toISOString().slice(0, 7);
      const res = await fetch('/api/akshia/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_batch',
          facilityId,
          periodMonth,
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        await loadClaims();
        flashNotice(
          json.submittedCount > 0
            ? `Batch ${json.batch.batchId} transmitted: ${json.submittedCount} clean claims (₦${Number(json.batch.cleanAmountNgn).toLocaleString()}). ${json.blockedCount} risky claim(s) held back.`
            : 'No vetted clean claims ready for batch submission yet.'
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleReconcile = async (id: string, status: 'paid' | 'queried') => {
    const res = await fetch('/api/akshia/claims', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      await loadClaims();
      flashNotice(`Claim status reconciled to ${status.toUpperCase()}.`);
    }
  };

  const exportClaimsJson = () => {
    if (typeof window === 'undefined') return;
    const blob = new Blob([JSON.stringify({ facilityId, batches, claims, metrics }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `akshia-nhia-claims-${facilityId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {batchNotice && (
        <div
          style={{
            position: 'fixed',
            top: 22,
            right: 24,
            zIndex: 99999,
            background: '#0F172A',
            color: '#38BDF8',
            border: '1px solid #0284C7',
            borderRadius: 12,
            padding: '14px 20px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: '0.88rem',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={18} color="#38BDF8" />
          <span>{batchNotice}</span>
        </div>
      )}

      {/* Top Live Telemetry */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
            First-Pass Clean Claim Rate
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669' }}>{metrics.cleanRatePct}%</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>
            Auto-scrubbed against AKSHIA / NHIA denial rules
          </span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
            Submitted Claims Volume
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#2563EB' }}>
              ₦{metrics.totalSubmittedNgn.toLocaleString()}
            </span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>
            {batches.length} signed batch(es) · ₦{metrics.totalBilledNgn.toLocaleString()} total billed
          </span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #059669' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
            Reimbursed Collections
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#047857' }}>
              ₦{metrics.totalPaidNgn.toLocaleString()}
            </span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>
            {metrics.paidCount} paid · Avg turnaround {metrics.avgTurnaroundDays}d
          </span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #EF4444' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
            Queried / Disputed Claims
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: metrics.queriedCount > 0 ? '#DC2626' : '#059669' }}>
              {metrics.queriedCount}
            </span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Tracked for rapid PA/ICD remediation</span>
        </div>
      </div>

      {/* Add & Auto-Scrub AKSHIA / NHIA Claim */}
      <form onSubmit={handleAddClaim} className="os-card" style={{ padding: 18 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} color="#0284C7" />
          <span>Draft &amp; Auto-Scrub New AKSHIA / NHIA / BHCPF Claim</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
          <select value={scheme} onChange={(e) => setScheme(e.target.value as any)} className="os-input">
            <option value="AKSHIA">AKSHIA</option>
            <option value="NHIA">NHIA</option>
            <option value="BHCPF">BHCPF</option>
            <option value="Private HMO">Private HMO</option>
          </select>
          <input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Patient Name *" className="os-input" required />
          <input value={enrolleeId} onChange={(e) => setEnrolleeId(e.target.value)} placeholder="Enrollee ID (e.g. AKSHIA-8821)" className="os-input" />
          <input value={icd11Code} onChange={(e) => setIcd11Code(e.target.value)} placeholder="ICD-11 Code" className="os-input" />
          <input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Clinical Diagnosis" className="os-input" />
          <input value={authorizationCode} onChange={(e) => setAuthorizationCode(e.target.value)} placeholder="Pre-Auth Code (if >= ₦15k)" className="os-input" />
          <input type="number" value={totalAmountNgn} onChange={(e) => setTotalAmountNgn(Number(e.target.value) || 0)} placeholder="Amount (₦)" className="os-input" />
          <button type="submit" disabled={busy} className="os-action-btn-primary">
            {busy ? 'Vetting…' : 'Vet & Queue Claim'}
          </button>
        </div>
      </form>

      {/* Claims Register */}
      <div className="os-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--os-text-muted)', textTransform: 'uppercase' }}>
            AKSHIA / NHIA Claim Adjudication &amp; Batch Register ({claims.length})
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => void loadClaims()} className="os-action-btn-secondary" style={{ fontSize: '0.72rem' }}>
              <RefreshCw size={13} /> Refresh
            </button>
            <button type="button" onClick={exportClaimsJson} className="os-action-btn-secondary" style={{ fontSize: '0.72rem' }}>
              <Download size={13} /> Export Claim Bundle
            </button>
            <button type="button" disabled={busy} className="os-action-btn-primary" style={{ fontSize: '0.72rem' }} onClick={() => void handleTransmitBatch()}>
              Transmit Zero-Denial Monthly Batch
            </button>
          </div>
        </div>

        <div className="os-table-wrap">
          <table className="os-table">
            <thead>
              <tr>
                <th>Claim ID</th>
                <th>Scheme / Enrollee</th>
                <th>Diagnosis (ICD-11)</th>
                <th>Readiness</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Remittance / Notes</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim) => (
                <tr key={claim.id}>
                  <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.74rem', fontWeight: 700, color: '#0369A1' }}>
                    {claim.claimNumber}
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: '#0A2540' }}>{claim.patientName}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{claim.scheme} · {claim.enrolleeId || 'MISSING ID'}</div>
                  </td>
                  <td style={{ fontSize: '0.76rem' }}>
                    {claim.diagnosis} ({claim.icd11Code || 'Uncoded'})
                  </td>
                  <td style={{ fontWeight: 800, color: claim.readinessScore >= 85 ? '#059669' : '#D97706' }}>
                    {claim.readinessScore}/100
                  </td>
                  <td style={{ fontWeight: 800, color: '#0A2540' }}>₦{claim.totalAmountNgn.toLocaleString()}</td>
                  <td>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background:
                          claim.status === 'paid'
                            ? 'rgba(5,150,105,0.12)'
                            : claim.status === 'queried'
                              ? 'rgba(239,68,68,0.15)'
                              : 'rgba(59,130,246,0.15)',
                        color: claim.status === 'paid' ? '#047857' : claim.status === 'queried' ? '#B91C1C' : '#1D4ED8',
                      }}
                    >
                      {claim.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    {claim.denialRisks.length > 0 ? (
                      <div style={{ fontSize: '0.72rem', color: '#B91C1C', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={12} /> {claim.denialRisks[0].message}
                      </div>
                    ) : claim.status === 'submitted' ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" onClick={() => void handleReconcile(claim.id, 'paid')} style={{ padding: '3px 8px', borderRadius: 6, border: 'none', background: '#059669', color: '#FFF', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          Mark Paid
                        </button>
                        <button type="button" onClick={() => void handleReconcile(claim.id, 'queried')} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          Log Query
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.72rem', color: '#059669' }}>
                        {claim.queryReason || 'Verified clean claim'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {claims.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>
                    No claims drafted for {facilityId} yet. Draft a claim above to run zero-denial scrubber and monthly batching.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
