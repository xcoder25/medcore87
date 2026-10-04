'use client';

import React, { useEffect, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import { Search, User, RefreshCw, FileText, Pill, FlaskConical, Wallet, Calendar } from 'lucide-react';
import { buildPatient360, searchPatients360, type Patient360Bundle, type TimelineEvent } from '../../lib/patient360';
import { scanEarlyWarnings } from '../../lib/clinicalEarlyWarning';

interface Props {
  session?: UserSession;
  onNavigate?: (key: string) => void;
  initialPatientId?: string;
}

const kindIcon: Record<string, React.ReactNode> = {
  registration: <User size={14} />,
  visit: <Calendar size={14} />,
  appointment: <Calendar size={14} />,
  lab: <FlaskConical size={14} />,
  rx: <Pill size={14} />,
  imaging: <FileText size={14} />,
  payment: <Wallet size={14} />,
  bill: <Wallet size={14} />,
};

export const Patient360View: React.FC<Props> = ({ session, initialPatientId }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';
  const [q, setQ] = useState(initialPatientId || '');
  const [bundle, setBundle] = useState<Patient360Bundle | null>(null);
  const [hits, setHits] = useState(() => searchPatients360(facilityId, ''));
  const [warnings, setWarnings] = useState(scanEarlyWarnings(facilityId));

  const load = (key: string) => {
    const b = buildPatient360(facilityId, key);
    setBundle(b);
    setWarnings(scanEarlyWarnings(facilityId));
  };

  useEffect(() => {
    if (initialPatientId) load(initialPatientId);
  }, [initialPatientId, facilityId]);

  useEffect(() => {
    setHits(searchPatients360(facilityId, q));
  }, [q, facilityId]);

  const p = bundle?.patient;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Patient 360°</h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748B' }}>
          Longitudinal profile from registry, visits, orders, bills — source of truth, not AI inventing data.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: '#94A3B8' }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, hospital no, phone, NIN…"
            style={{
              width: '100%',
              padding: '10px 12px 10px 34px',
              borderRadius: 12,
              border: '1px solid #E2E8F0',
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
        </div>
        <button type="button" className="os-ghost-btn mc-btn-live" onClick={() => bundle && load(bundle.patient.id)}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {!p && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 12, maxHeight: 280, overflowY: 'auto' }}>
          {hits.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: '#64748B' }}>No patients match — register at reception.</div>
          )}
          {hits.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => {
                setQ(h.hospitalNumber);
                load(h.id);
              }}
              style={{
                display: 'flex',
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                border: 'none',
                borderBottom: '1px solid #F1F5F9',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>
                  {h.firstName} {h.lastName}
                </div>
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  {h.hospitalNumber} · {h.phone}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {p && bundle && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 18 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 14,
                    background: 'linear-gradient(135deg,#2563EB,#0D9488)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 18,
                  }}
                >
                  {(p.firstName[0] || '') + (p.lastName[0] || '')}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>
                    {p.firstName} {p.middleName} {p.lastName}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>{p.hospitalNumber}</div>
                </div>
              </div>
              <div style={{ marginTop: 14, fontSize: 13, display: 'grid', gap: 6 }}>
                {[
                  ['Sex / DOB', `${p.sex} · ${p.dob || '—'}`],
                  ['Phone', p.phone || '—'],
                  ['NIN', p.nin || '—'],
                  ['Blood / Genotype', `${p.bloodGroup || '—'} / ${p.genotype || '—'}`],
                  ['Address', p.address || '—'],
                  ['LGA / State', `${p.lga || '—'}, ${p.state || '—'}`],
                  ['Insurance', `${p.insuranceProvider || 'None'} ${p.insuranceId || ''}`],
                  ['Emergency', p.emergencyContact || '—'],
                ].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ color: '#64748B' }}>{l}</span>
                    <span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 12,
                  background: bundle.balanceNgn > 0 ? '#FEF3C7' : '#ECFDF5',
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                Balance: ₦{bundle.balanceNgn.toLocaleString()}
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Open clinical work</div>
              {bundle.openOrders.length === 0 && (
                <div style={{ fontSize: 12, color: '#64748B' }}>No open orders</div>
              )}
              {bundle.openOrders.map((o) => (
                <div key={o.id} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <strong>{o.type}</strong> · {o.name} · {o.status}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {warnings.filter((w) => w.patientId === p.id || w.patientName.includes(p.lastName)).length > 0 && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 14, padding: 14 }}>
                <div style={{ fontWeight: 800, color: '#B91C1C', marginBottom: 8 }}>Early warnings</div>
                {warnings
                  .filter((w) => w.patientId === p.id || w.patientName.includes(p.lastName))
                  .map((w) => (
                    <div key={w.id} style={{ fontSize: 13, marginBottom: 6 }}>
                      🔴 {w.message}
                    </div>
                  ))}
              </div>
            )}

            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 18 }}>
              <div style={{ fontWeight: 800, marginBottom: 12 }}>Timeline</div>
              {bundle.events.map((ev: TimelineEvent) => (
                <div
                  key={ev.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '24px 1fr',
                    gap: 10,
                    padding: '10px 0',
                    borderBottom: '1px solid #F1F5F9',
                  }}
                >
                  <div style={{ color: '#2563EB', marginTop: 2 }}>{kindIcon[ev.kind] || <FileText size={14} />}</div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{ev.title}</span>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>{ev.at.slice(0, 16).replace('T', ' ')}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>{ev.detail}</div>
                    {ev.status && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#64748B',
                          background: '#F1F5F9',
                          padding: '2px 8px',
                          borderRadius: 999,
                        }}
                      >
                        {ev.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Patient360View;
