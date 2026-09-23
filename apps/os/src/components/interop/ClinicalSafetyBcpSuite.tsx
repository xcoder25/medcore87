'use client';

import React, { useState } from 'react';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, Lock,
  FileCheck, RefreshCw, Server, HardDrive
} from 'lucide-react';

export const ClinicalSafetyBcpSuite: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Telemetry */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Patient Consent Status</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34D399' }}>100% Digitized</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>NDPR / HIPAA Patient Privacy Compliant</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Disaster Recovery RPO / RTO</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#60A5FA' }}>RPO &lt; 5s</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#34D399' }}>RTO &lt; 60s (Auto-Failover Active)</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid var(--ak-orange)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Field-Level Data Encryption</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--ak-orange-light)' }}>AES-256-GCM</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Zero Plaintext Clinical Data at Rest</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #8B5CF6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Chained Audit Ledger</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#A78BFA' }}>SHA-256</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#34D399' }}>Tamper-Evident State Audit Ledger Active</span>
        </div>
      </div>

      {/* Safety & BCP Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="os-card" style={{ padding: 22 }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', color: '#0A2540' }}>Patient Consent & Data Governance</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--os-text-muted)', lineHeight: 1.5, margin: '0 0 14px 0' }}>
            All patient records maintain granular consent flags for EHR sharing across the Akwa Ibom State Unified Health Network, academic clinical research, and anonymized epidemiological surveillance.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, fontSize: '0.78rem' }}>
              <span>Clinical Treatment Consent:</span>
              <span style={{ color: '#34D399', fontWeight: 700 }}>Mandatory Digital Signature Verified</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, fontSize: '0.78rem' }}>
              <span>State Epidemiological Sharing:</span>
              <span style={{ color: '#34D399', fontWeight: 700 }}>De-identified Tier 1 Enabled</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, fontSize: '0.78rem' }}>
              <span>Right to Erasure (Audit Exempt):</span>
              <span style={{ color: '#60A5FA', fontWeight: 700 }}>NDPR Policy Enforced</span>
            </div>
          </div>
        </div>

        <div className="os-card" style={{ padding: 22 }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', color: '#0A2540' }}>Business Continuity & Offline Survivability</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--os-text-muted)', lineHeight: 1.5, margin: '0 0 14px 0' }}>
            In the event of total public telecommunications outage, Hospi OS operates autonomously on local hospital edge micro-clusters with automated mesh peer sync when connectivity restores.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, fontSize: '0.78rem' }}>
              <span>Local Edge SQLite Cache:</span>
              <span style={{ color: '#34D399', fontWeight: 700 }}>Active (Offline-First Ready)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, fontSize: '0.78rem' }}>
              <span>Geo-Redundant Cloud Replica:</span>
              <span style={{ color: '#34D399', fontWeight: 700 }}>Synchronized (Lagos & Uyo DCs)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, fontSize: '0.78rem' }}>
              <span>Cryptographic Ledger Verification:</span>
              <span style={{ color: '#A78BFA', fontWeight: 700 }}>100% Chain Integrity Intact</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
