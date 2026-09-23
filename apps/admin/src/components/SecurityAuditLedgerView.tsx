'use client';

import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Download,
  Search,
  Lock,
  Key,
  Fingerprint,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Clock,
  Hash,
  Server,
} from 'lucide-react';

const SECURITY_KPIS = {
  encryption: 'AES-256-GCM',
  transit: 'TLS 1.3',
  auditBlocks: 892,
  tampering: '0.00%',
  dualAuthEvents: 47,
  phiAccessToday: 128,
  failedLogins: 3,
  lastChainVerify: '2026-09-16 09:14 WAT',
};

const AUDIT_EVENTS = [
  { id: 'AUD-892', time: '09:14:02', actor: 'System · Chain Verifier', action: 'Full SHA-256 chain re-verification', result: 'PASS', severity: 'info' },
  { id: 'AUD-891', time: '08:52:17', actor: 'Commissioner · Dual-Auth', action: 'PHI access granted — Maternal case MAT-001', result: 'AUTHORISED', severity: 'critical' },
  { id: 'AUD-890', time: '08:41:03', actor: 'Dr. E. Vance · Inspector', action: 'Opened facility audit report FAC-004', result: 'LOGGED', severity: 'info' },
  { id: 'AUD-889', time: '08:22:45', actor: 'Finance Officer · Bassey', action: 'Exported revenue ledger (Paystack channel)', result: 'LOGGED', severity: 'info' },
  { id: 'AUD-888', time: '07:58:11', actor: 'System · Auth Gateway', action: 'Failed login attempt — unknown IP 102.89.x.x', result: 'BLOCKED', severity: 'elevated' },
  { id: 'AUD-887', time: '07:45:30', actor: 'M87 Cortex', action: 'Proposed ventilator reallocation action', result: 'PROPOSED', severity: 'info' },
  { id: 'AUD-886', time: '07:12:08', actor: 'System · Auth Gateway', action: 'Commissioner session established (biometric + OTP)', result: 'SUCCESS', severity: 'critical' },
  { id: 'AUD-885', time: '06:55:44', actor: 'System · Chain Verifier', action: 'Nightly integrity sweep — 891 blocks', result: 'PASS', severity: 'info' },
  { id: 'AUD-884', time: '02:18:09', actor: 'System · Auth Gateway', action: 'Failed login attempt — rate limited', result: 'BLOCKED', severity: 'elevated' },
  { id: 'AUD-883', time: '00:04:22', actor: 'System · Backup', action: 'Encrypted snapshot sealed to sovereign Tier-4', result: 'SUCCESS', severity: 'info' },
];

const CHAIN_PROOF = {
  genesis: 'a3f9d1c8e2b4…4bfe',
  head: 'e71bc20f9a3d…99a2',
  blocks: 892,
  algorithm: 'SHA-256',
  status: 'FULLY VERIFIED',
};

export const SecurityAuditLedgerView: React.FC = () => {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');

  const filteredEvents = useMemo(() => {
    return AUDIT_EVENTS.filter((e) => {
      if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          e.id.toLowerCase().includes(q) ||
          e.actor.toLowerCase().includes(q) ||
          e.action.toLowerCase().includes(q) ||
          e.result.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [search, severityFilter]);

  return (
    <div className="exec-view anim-fade-up">
      {/* Header */}
      <div className="exec-view-header">
        <div className="exec-view-title-block">
          <div className="exec-view-icon-wrap exec-icon-security">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="exec-view-title">Security & Audit Ledger</h1>
            <p className="exec-view-subtitle">Cryptographic integrity, access control & immutable event trail</p>
          </div>
        </div>
        <button type="button" className="exec-export-btn">
          <Download size={15} />
          Export Proof Report
        </button>
      </div>

      {/* KPI Ribbon */}
      <div className="exec-kpi-ribbon">
        <div className="exec-kpi-card">
          <div className="exec-kpi-label">Encryption at Rest</div>
          <div className="exec-kpi-value exec-kpi-sm">{SECURITY_KPIS.encryption}</div>
          <div className="exec-kpi-sub">Field-level envelope</div>
        </div>
        <div className="exec-kpi-card">
          <div className="exec-kpi-label">In Transit</div>
          <div className="exec-kpi-value exec-kpi-sm">{SECURITY_KPIS.transit}</div>
          <div className="exec-kpi-sub">Mutual cert pinning</div>
        </div>
        <div className="exec-kpi-card exec-kpi-hero">
          <div className="exec-kpi-label">Audit Blocks</div>
          <div className="exec-kpi-value">{SECURITY_KPIS.auditBlocks}</div>
          <div className="exec-kpi-sub">SHA-256 chained</div>
        </div>
        <div className="exec-kpi-card exec-kpi-clean">
          <div className="exec-kpi-label">Tampering</div>
          <div className="exec-kpi-value">{SECURITY_KPIS.tampering}</div>
          <div className="exec-kpi-sub">Mathematical invariant</div>
        </div>
        <div className="exec-kpi-card">
          <div className="exec-kpi-label">Dual-Auth Events</div>
          <div className="exec-kpi-value">{SECURITY_KPIS.dualAuthEvents}</div>
          <div className="exec-kpi-sub">Commissioner + OTP</div>
        </div>
        <div className="exec-kpi-card">
          <div className="exec-kpi-label">Failed Logins (24h)</div>
          <div className="exec-kpi-value">{SECURITY_KPIS.failedLogins}</div>
          <div className="exec-kpi-sub">All blocked</div>
        </div>
      </div>

      {/* Chain proof + Compliance */}
      <div className="exec-two-col">
        <div className="exec-panel">
          <div className="exec-panel-header">
            <Hash size={16} />
            <h2>Cryptographic Chain Proof</h2>
          </div>
          <div className="exec-chain-proof">
            <div className="exec-chain-row">
              <span className="exec-chain-label">Genesis Hash</span>
              <code className="exec-chain-hash">{CHAIN_PROOF.genesis}</code>
            </div>
            <div className="exec-chain-row">
              <span className="exec-chain-label">Head Hash</span>
              <code className="exec-chain-hash">{CHAIN_PROOF.head}</code>
            </div>
            <div className="exec-chain-row">
              <span className="exec-chain-label">Blocks Sealed</span>
              <strong>{CHAIN_PROOF.blocks}</strong>
            </div>
            <div className="exec-chain-row">
              <span className="exec-chain-label">Algorithm</span>
              <strong>{CHAIN_PROOF.algorithm}</strong>
            </div>
            <div className="exec-chain-status">
              <CheckCircle2 size={18} />
              <span>{CHAIN_PROOF.status}</span>
            </div>
            <div className="exec-chain-meta">
              Last verification: {SECURITY_KPIS.lastChainVerify}
            </div>
          </div>
        </div>

        <div className="exec-panel">
          <div className="exec-panel-header">
            <Lock size={16} />
            <h2>Privacy & Compliance Posture</h2>
          </div>
          <div className="exec-compliance-list">
            <div className="exec-compliance-item">
              <Fingerprint size={16} />
              <div>
                <strong>Zero-knowledge PHI access</strong>
                <p>Raw clinical data requires Commissioner biometric + OTP dual authorisation</p>
              </div>
            </div>
            <div className="exec-compliance-item">
              <Key size={16} />
              <div>
                <strong>HIPAA Safe Harbor</strong>
                <p>All 18 identifiers stripped before any public-health streaming</p>
              </div>
            </div>
            <div className="exec-compliance-item">
              <Server size={16} />
              <div>
                <strong>NDPR Data Residency</strong>
                <p>All databases reside in Sovereign Tier-4 national datacentres</p>
              </div>
            </div>
            <div className="exec-compliance-item">
              <Eye size={16} />
              <div>
                <strong>Immutable audit trail</strong>
                <p>Every access, export and configuration change is permanently sealed</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live audit ledger */}
      <div className="exec-panel" style={{ marginTop: 18 }}>
        <div className="exec-panel-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={16} />
            <h2>Immutable Audit Ledger</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <select
              className="exec-filter-select"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="all">All severity</option>
              <option value="critical">Critical</option>
              <option value="elevated">Elevated</option>
              <option value="info">Info</option>
            </select>
            <div className="exec-search-wrap">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search ledger…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="exec-search-input"
              />
            </div>
          </div>
        </div>
        <div className="table-responsive">
          <table className="moh-data-table">
            <thead>
              <tr>
                <th>Block</th>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Result</th>
                <th>Severity</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((e) => (
                <tr key={e.id} className="clickable-row">
                  <td><code className="license-code">{e.id}</code></td>
                  <td>
                    <span className="exec-time">
                      <Clock size={11} /> {e.time}
                    </span>
                  </td>
                  <td>{e.actor}</td>
                  <td>{e.action}</td>
                  <td>
                    <span className={`exec-result exec-result--${e.result.toLowerCase()}`}>
                      {e.result}
                    </span>
                  </td>
                  <td>
                    <span className={`exec-status-pill exec-status--${e.severity === 'critical' ? 'critical' : e.severity === 'elevated' ? 'elevated' : 'normal'}`}>
                      {e.severity}
                    </span>
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
