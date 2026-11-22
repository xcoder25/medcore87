'use client';

import React, { useMemo, useState } from 'react';
import { ArrowRightLeft, Search, Users, Check, X as XIcon } from 'lucide-react';
import type { MohLiveSnapshot, MohTransferRecord } from '../../lib/mohTypes';

interface MohWorkforceViewProps {
  snapshot: MohLiveSnapshot;
  officerName: string;
  onOpenTransferModal: () => void;
  onDecideTransfer: (id: string, status: MohTransferRecord['status']) => Promise<void>;
}

export const MohWorkforceView: React.FC<MohWorkforceViewProps> = ({
  snapshot,
  onOpenTransferModal,
  onDecideTransfer,
}) => {
  const [search, setSearch] = useState('');
  const [subTab, setSubTab] = useState<'transfers' | 'directory'>('transfers');

  const { workforce, transfers } = snapshot;

  const filteredStaff = useMemo(() => {
    if (!search.trim()) return workforce.staffDirectory;
    const q = search.toLowerCase();
    return workforce.staffDirectory.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q) ||
        s.facilityName.toLowerCase().includes(q) ||
        s.badgeId.toLowerCase().includes(q)
    );
  }, [workforce.staffDirectory, search]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="moh-view-header">
        <div>
          <h1 className="moh-view-title">Clinical Workforce &amp; Staff Transfers</h1>
          <p className="moh-view-sub">
            Statewide staff roster distribution and inter-facility redeployment approvals.
          </p>
        </div>
        <button type="button" className="moh-btn-primary" onClick={onOpenTransferModal}>
          <ArrowRightLeft size={15} />
          <span>Dispatch Staff Transfer</span>
        </button>
      </div>

      {/* Cadre Distribution Summary */}
      <div className="moh-panel">
        <div className="moh-panel-head">
          <h2 className="moh-panel-title">
            <Users size={17} color="#065F46" />
            Active Cadre Breakdown ({workforce.totalActive} total active clinicians)
          </h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className={subTab === 'transfers' ? 'moh-btn-primary' : 'moh-btn-outline'}
              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              onClick={() => setSubTab('transfers')}
            >
              Transfers ({transfers.length})
            </button>
            <button
              type="button"
              className={subTab === 'directory' ? 'moh-btn-primary' : 'moh-btn-outline'}
              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              onClick={() => setSubTab('directory')}
            >
              Clinician Roster ({workforce.staffDirectory.length})
            </button>
          </div>
        </div>

        {workforce.byCadre.length === 0 ? (
          <div style={{ fontSize: '0.82rem', color: '#64748B' }}>
            Enrolled hospital staff will populate automatically as facilities onboard in MedCore OS.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {workforce.byCadre.slice(0, 8).map((c) => (
              <div key={c.cadre} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>{c.cadre}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginTop: 2 }}>{c.count}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {subTab === 'transfers' ? (
        <div className="moh-panel">
          <div className="moh-panel-head">
            <h2 className="moh-panel-title">Inter-Facility Deployment Orders</h2>
          </div>
          <div className="moh-table-wrap">
            <table className="moh-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Origin → Destination</th>
                  <th>Type / Priority</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((tr) => (
                  <tr key={tr.id}>
                    <td>
                      <strong>{tr.staffName}</strong>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                        {tr.cadre} {tr.staffBadge ? `· ${tr.staffBadge}` : ''}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{tr.fromFacilityName}</div>
                      <div style={{ fontSize: '0.74rem', color: '#065F46', fontWeight: 700 }}>→ {tr.toFacilityName}</div>
                    </td>
                    <td>
                      <span className="moh-pill slate">{tr.transferType.replace(/_/g, ' ')}</span>
                    </td>
                    <td style={{ maxWidth: 260 }}>{tr.reason}</td>
                    <td>
                      <span className={`moh-pill ${tr.status === 'approved' || tr.status === 'completed' ? 'emerald' : tr.status === 'declined' ? 'danger' : 'amber'}`}>
                        {tr.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {tr.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button type="button" className="moh-btn-outline" style={{ padding: '4px 8px', color: '#065F46' }} onClick={() => void onDecideTransfer(tr.id, 'approved')}>
                            <Check size={13} /> Approve
                          </button>
                          <button type="button" className="moh-btn-outline" style={{ padding: '4px 8px', color: '#DC2626' }} onClick={() => void onDecideTransfer(tr.id, 'declined')}>
                            <XIcon size={13} /> Decline
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.74rem', color: '#64748B' }}>{tr.decidedBy || 'Recorded'}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {transfers.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 28, color: '#64748B' }}>
                      No transfer orders logged yet. Click <strong>Dispatch Staff Transfer</strong> to initiate a facility deployment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="moh-panel">
          <div className="moh-panel-head">
            <h2 className="moh-panel-title">Statewide Clinician Directory</h2>
            <div style={{ position: 'relative', minWidth: 240 }}>
              <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                className="moh-input"
                style={{ paddingLeft: 32, height: 34 }}
                placeholder="Search clinician or facility…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="moh-table-wrap">
            <table className="moh-table">
              <thead>
                <tr>
                  <th>Badge ID</th>
                  <th>Name</th>
                  <th>Role &amp; Unit</th>
                  <th>Facility</th>
                  <th>District</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((s) => (
                  <tr key={`${s.facilityId}-${s.badgeId}`}>
                    <td><code style={{ color: '#065F46', fontWeight: 700 }}>{s.badgeId}</code></td>
                    <td><strong>{s.fullName}</strong></td>
                    <td>
                      <div>{s.role}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{s.department}</div>
                    </td>
                    <td>{s.facilityName}</td>
                    <td>{s.district}</td>
                    <td>
                      <span className={`moh-pill ${s.status === 'active' ? 'emerald' : 'amber'}`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredStaff.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 28, color: '#64748B' }}>
                      No staff records found in the connected facilities database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
