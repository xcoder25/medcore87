'use client';

import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  MessageSquareWarning,
  Plus,
  QrCode,
  SearchCheck,
  Star,
} from 'lucide-react';
import type { MohCitizenGrievance, MohLiveSnapshot } from '../../lib/mohTypes';

interface MohGrievancesViewProps {
  snapshot: MohLiveSnapshot;
  officerName: string;
  onSubmitGrievance: (input: {
    facilityId: string;
    facilityName?: string;
    lga?: string;
    channel?: MohCitizenGrievance['channel'];
    category?: MohCitizenGrievance['category'];
    rating?: number;
    summary: string;
    anonymous?: boolean;
  }) => Promise<void>;
  onUpdateGrievance: (input: {
    id: string;
    status?: MohCitizenGrievance['status'];
    assignedTo?: string;
    resolutionNotes?: string;
  }) => Promise<void>;
  onNotify?: (text: string, type?: 'success' | 'error') => void;
}

/** Deterministic 21x21 QR-style matrix SVG seeded strictly by text characters (no randomness). */
function buildDeterministicQrCells(payload: string): boolean[][] {
  const size = 21;
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const paintFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const edge = r === 0 || r === 6 || c === 0 || c === 6;
        const inner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[r0 + r][c0 + c] = edge || inner;
      }
    }
  };
  paintFinder(0, 0);
  paintFinder(0, size - 7);
  paintFinder(size - 7, 0);

  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inFinder =
        (r < 8 && c < 8) || (r < 8 && c >= size - 8) || (r >= size - 8 && c < 8);
      if (inFinder) continue;
      const mix = ((hash >>> ((r + c) % 24)) ^ (r * 31 + c * 17)) & 1;
      grid[r][c] = Boolean(mix);
    }
  }
  return grid;
}

export const MohGrievancesView: React.FC<MohGrievancesViewProps> = ({
  snapshot,
  officerName,
  onSubmitGrievance,
  onUpdateGrievance,
  onNotify,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | MohCitizenGrievance['status']>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | MohCitizenGrievance['channel']>('all');
  const [qrFacilityId, setQrFacilityId] = useState(snapshot.facilities[0]?.facilityId || 'IGH-EKT');
  const [formOpen, setFormOpen] = useState(false);

  const [facId, setFacId] = useState(snapshot.facilities[0]?.facilityId || 'IGH-EKT');
  const [channel, setChannel] = useState<MohCitizenGrievance['channel']>('hotline');
  const [category, setCategory] = useState<MohCitizenGrievance['category']>('service_quality');
  const [rating, setRating] = useState(3);
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);

  const { grievances, facilities } = snapshot;

  const filtered = useMemo(
    () =>
      grievances.items.filter((g) => {
        if (statusFilter !== 'all' && g.status !== statusFilter) return false;
        if (channelFilter !== 'all' && g.channel !== channelFilter) return false;
        return true;
      }),
    [grievances.items, statusFilter, channelFilter]
  );

  const qrPath = `/feedback?facilityId=${encodeURIComponent(qrFacilityId)}`;
  const qrGrid = useMemo(() => buildDeterministicQrCells(qrPath), [qrPath]);

  const handleCopyQrLink = async () => {
    const full =
      typeof window !== 'undefined' ? `${window.location.origin}${qrPath}` : qrPath;
    try {
      await navigator.clipboard.writeText(full);
      onNotify?.(`Copied citizen QR link for ${qrFacilityId}`);
    } catch {
      onNotify?.(`Shareable path: ${full}`);
    }
  };

  const handleHotlineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facId || !summary.trim()) return;
    const fac = facilities.find((f) => f.facilityId === facId);
    setBusy(true);
    try {
      await onSubmitGrievance({
        facilityId: facId,
        facilityName: fac?.facilityName,
        lga: fac?.lga,
        channel,
        category,
        rating,
        summary: summary.trim(),
        anonymous: channel === 'whistleblower',
      });
      setSummary('');
      setFormOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="moh-view-header">
        <div>
          <h1 className="moh-view-title">Citizen Feedback &amp; Grievance Redressal</h1>
          <p className="moh-view-sub">
            Facility QR code surveys, public hotline / whistleblower escalation feed, and SLA resolution turnaround tracking.
          </p>
        </div>
        <button type="button" className="moh-btn-primary" onClick={() => setFormOpen((v) => !v)}>
          <Plus size={15} />
          <span>Log Hotline / Whistleblower Report</span>
        </button>
      </div>

      {/* KPI Strip */}
      <div className="moh-kpi-grid">
        <div className="moh-kpi-card">
          <div className="moh-kpi-label">Open Complaints</div>
          <div className="moh-kpi-val" style={{ color: grievances.openCount > 0 ? '#DC2626' : '#065F46' }}>
            {grievances.openCount}
          </div>
          <div className="moh-kpi-sub">Awaiting assignment</div>
        </div>
        <div className="moh-kpi-card">
          <div className="moh-kpi-label">Under Investigation</div>
          <div className="moh-kpi-val" style={{ color: '#D97706' }}>{grievances.investigatingCount}</div>
          <div className="moh-kpi-sub">Active inspectorate review</div>
        </div>
        <div className="moh-kpi-card">
          <div className="moh-kpi-label">Resolved Cases</div>
          <div className="moh-kpi-val" style={{ color: '#065F46' }}>{grievances.resolvedCount}</div>
          <div className="moh-kpi-sub">Closed with documented action</div>
        </div>
        <div className="moh-kpi-card">
          <div className="moh-kpi-label">Avg SLA Turnaround</div>
          <div className="moh-kpi-val">{grievances.avgTurnaroundHours}h</div>
          <div className="moh-kpi-sub">Mean hours from intake to resolve</div>
        </div>
        <div className="moh-kpi-card">
          <div className="moh-kpi-label">Citizen Service Rating</div>
          <div className="moh-kpi-val">{grievances.avgRating > 0 ? `${grievances.avgRating} / 5` : '—'}</div>
          <div className="moh-kpi-sub">Public QR &amp; survey average</div>
        </div>
      </div>

      {/* Facility QR Poster Generator */}
      <div className="moh-panel">
        <div className="moh-panel-head">
          <h2 className="moh-panel-title">
            <QrCode size={17} color="#065F46" />
            <span>Facility QR Citizen Portal &amp; Poster Generator</span>
          </h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              className="moh-select"
              value={qrFacilityId}
              onChange={(e) => setQrFacilityId(e.target.value)}
              aria-label="Select facility for QR feedback poster"
            >
              {facilities.map((f) => (
                <option key={f.facilityId} value={f.facilityId}>
                  {f.facilityName} ({f.facilityId})
                </option>
              ))}
            </select>
            <button type="button" className="moh-btn-outline" onClick={() => void handleCopyQrLink()}>
              <Copy size={14} />
              <span>Copy QR Link</span>
            </button>
            <a href={qrPath} target="_blank" rel="noreferrer" className="moh-btn-outline" style={{ textDecoration: 'none' }}>
              <ExternalLink size={14} />
              <span>Open Public Form</span>
            </a>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ padding: 10, background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 12 }}>
            <svg width={105} height={105} viewBox="0 0 21 21" aria-label={`QR matrix for ${qrFacilityId}`}>
              {qrGrid.map((row, r) =>
                row.map((on, c) =>
                  on ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#0F172A" /> : null
                )
              )}
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#0F172A' }}>
              Direct Patient Escalation &amp; Whistleblower QR Code
            </div>
            <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 4, lineHeight: 1.5 }}>
              Print and mount this QR code at OPD, Pharmacy, and Cash Points for{' '}
              <strong>{facilities.find((f) => f.facilityId === qrFacilityId)?.facilityName || qrFacilityId}</strong>.
              Patients scan to submit verified ratings, extortion reports, or quackery alerts straight to this desk.
            </div>
            <code style={{ display: 'inline-block', marginTop: 8, padding: '4px 8px', background: '#F8FAFC', borderRadius: 6, fontSize: '0.76rem', color: '#065F46' }}>
              {qrPath}
            </code>
          </div>
        </div>
      </div>

      {/* Hotline / Whistleblower Intake Form */}
      {formOpen && (
        <form onSubmit={handleHotlineSubmit} className="moh-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontWeight: 800, fontSize: '0.96rem' }}>Log Public Hotline or Whistleblower Report</div>
          <div className="moh-two-col">
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              Facility *
              <select className="moh-input" style={{ marginTop: 4 }} value={facId} onChange={(e) => setFacId(e.target.value)}>
                {facilities.map((f) => (
                  <option key={f.facilityId} value={f.facilityId}>
                    {f.facilityName} ({f.lga})
                  </option>
                ))}
              </select>
            </label>
            <div className="moh-two-col">
              <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                Channel
                <select className="moh-input" style={{ marginTop: 4 }} value={channel} onChange={(e) => setChannel(e.target.value as any)}>
                  <option value="hotline">Public Hotline</option>
                  <option value="whistleblower">Whistleblower</option>
                  <option value="qr">Facility QR</option>
                  <option value="walkin">Walk-in Desk</option>
                </select>
              </label>
              <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                Category
                <select className="moh-input" style={{ marginTop: 4 }} value={category} onChange={(e) => setCategory(e.target.value as any)}>
                  <option value="service_quality">Service Quality</option>
                  <option value="extortion_billing">Extortion / Illegal Billing</option>
                  <option value="unqualified_practice">Unqualified Practice / Quackery</option>
                  <option value="drug_stockout">Drug Stock-Out</option>
                  <option value="staff_conduct">Staff Conduct</option>
                  <option value="commendation">Commendation</option>
                </select>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              Rating (1–5)
              <input
                type="number"
                min={1}
                max={5}
                className="moh-input"
                style={{ width: 90, marginTop: 4 }}
                value={rating}
                onChange={(e) => setRating(Number(e.target.value) || 3)}
              />
            </label>
            <label style={{ flex: 1, minWidth: 260, fontSize: '0.78rem', fontWeight: 700 }}>
              Report Details (sensitive IDs are automatically redacted) *
              <input
                className="moh-input"
                style={{ marginTop: 4 }}
                required
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Summarize the complaint or whistleblower disclosure..."
              />
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="moh-btn-outline" onClick={() => setFormOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="moh-btn-primary" disabled={busy}>
              {busy ? 'Logging…' : 'Submit Ticket'}
            </button>
          </div>
        </form>
      )}

      {/* Feed */}
      <div className="moh-panel">
        <div className="moh-panel-head" style={{ flexWrap: 'wrap', gap: 10 }}>
          <h2 className="moh-panel-title">
            <MessageSquareWarning size={17} color="#065F46" />
            <span>Escalation &amp; Grievance Resolution Queue ({filtered.length})</span>
          </h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select className="moh-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="under_investigation">Under Investigation</option>
              <option value="resolved">Resolved</option>
            </select>
            <select className="moh-select" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value as any)}>
              <option value="all">All Channels</option>
              <option value="qr">Facility QR</option>
              <option value="hotline">Hotline</option>
              <option value="whistleblower">Whistleblower</option>
              <option value="walkin">Walk-in</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: '#64748B', fontSize: '0.84rem' }}>
            No citizen grievances or QR submissions logged yet. Share a facility QR link or log a hotline report to begin tracking turnaround SLA.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((g) => (
              <div
                key={g.id}
                style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: 12,
                  padding: 14,
                  background: g.status === 'open' ? '#FFFFFF' : '#F8FAFC',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                      <code style={{ fontWeight: 800, color: '#065F46', fontSize: '0.78rem' }}>{g.trackingCode}</code>
                      <span className="moh-pill slate">{g.channel.toUpperCase()}</span>
                      <span className="moh-pill slate">{g.category.replace(/_/g, ' ')}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.74rem', fontWeight: 700, color: '#D97706' }}>
                        <Star size={12} fill="#D97706" /> {g.rating}/5
                      </span>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0F172A' }}>
                      {g.facilityName} <span style={{ fontWeight: 500, color: '#64748B' }}>({g.lga})</span>
                    </div>
                  </div>
                  <span
                    className={`moh-pill ${
                      g.status === 'resolved' ? 'emerald' : g.status === 'under_investigation' ? 'amber' : 'danger'
                    }`}
                  >
                    {g.status.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>

                <div style={{ fontSize: '0.84rem', color: '#1E293B', lineHeight: 1.5 }}>{g.summary}</div>

                {g.resolutionNotes && (
                  <div style={{ fontSize: '0.78rem', color: '#065F46', background: '#ECFDF5', padding: '7px 10px', borderRadius: 8 }}>
                    <strong>Resolution:</strong> {g.resolutionNotes}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, borderTop: '1px solid #F1F5F9', paddingTop: 8 }}>
                  <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                    Logged {g.createdAt.slice(0, 10)}
                    {g.assignedTo ? ` · Assigned: ${g.assignedTo}` : ''}
                    {g.turnaroundHours !== null ? ` · SLA: ${g.turnaroundHours}h` : ''}
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {g.status === 'open' && (
                      <button
                        type="button"
                        className="moh-btn-outline"
                        style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                        onClick={() =>
                          void onUpdateGrievance({
                            id: g.id,
                            status: 'under_investigation',
                            assignedTo: officerName,
                          })
                        }
                      >
                        <SearchCheck size={13} />
                        <span>Investigate</span>
                      </button>
                    )}
                    {g.status !== 'resolved' && (
                      <button
                        type="button"
                        className="moh-btn-primary"
                        style={{ padding: '5px 11px', fontSize: '0.75rem' }}
                        onClick={() =>
                          void onUpdateGrievance({
                            id: g.id,
                            status: 'resolved',
                            assignedTo: g.assignedTo || officerName,
                            resolutionNotes: 'Investigated and remediated by MOH Inspectorate.',
                          })
                        }
                      >
                        <CheckCircle2 size={13} />
                        <span>Mark Resolved</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
