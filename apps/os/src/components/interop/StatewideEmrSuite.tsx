'use client';

/**
 * Statewide EMR completeness suite — messaging, telehealth, coding/denials,
 * FHIR/HIE export, migration, DR, live analytics feed.
 */
import React, { useEffect, useMemo, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  listThreads,
  listMessages,
  startThread,
  replyToThread,
  markThreadRead,
  subscribeMessages,
} from '../../lib/secureMessagingStore';
import {
  listTeleVisits,
  scheduleTeleVisit,
  updateTeleVisit,
  subscribeTelehealth,
} from '../../lib/telehealthStore';
import {
  listCodingCases,
  upsertCodingCase,
  markDenied,
  markAppealed,
  COMMON_ICD10,
  COMMON_CPT_NHIA,
  type ClaimCodingCase,
} from '../../lib/codingDenialStore';
import {
  parseCsv,
  suggestFieldMap,
  validateMigration,
  commitMigration,
  type FieldMap,
  type MigrationRow,
} from '../../lib/dataMigrationToolkit';
import {
  getDrStatus,
  createBackupSnapshot,
  setRunbookStep,
  DR_RUNBOOK,
} from '../../lib/disasterRecoveryStore';
import { listPatients } from '../../lib/patientRegistryStore';
import { listOrders } from '../../lib/clinicalEventBus';
import { listVisits } from '../../lib/receptionOpsStore';
import { exportFacilityFhirBundle } from '../../lib/fhirStub';
import { exportPatientBundle, listEndpoints, saveEndpoints, type HieEndpoint } from '../../lib/hieGateway';
import {
  MessageSquare,
  Video,
  FileCode,
  Database,
  Shield,
  Receipt,
  Download,
  Send,
  Plus,
  CheckCircle2,
} from 'lucide-react';

type Tab =
  | 'messaging'
  | 'telehealth'
  | 'coding'
  | 'fhir'
  | 'migration'
  | 'dr'
  | 'coverage';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'coverage', label: 'Coverage', icon: CheckCircle2 },
  { id: 'messaging', label: 'Secure messages', icon: MessageSquare },
  { id: 'telehealth', label: 'Telehealth', icon: Video },
  { id: 'coding', label: 'Coding & denials', icon: Receipt },
  { id: 'fhir', label: 'FHIR / HIE', icon: FileCode },
  { id: 'migration', label: 'Data migration', icon: Database },
  { id: 'dr', label: 'Backup & DR', icon: Shield },
];

const COVERAGE = [
  { area: 'Analytics & reporting', status: 'Live KPIs + exportable facility metrics' },
  { area: 'Patient charts', status: 'Registry, vitals, visits, specialty flowsheets' },
  { area: 'Clinical workflow', status: 'Registration, check-in, OPD, beds, queues' },
  { area: 'Collaboration', status: 'Secure messaging + notifications' },
  { area: 'Telehealth', status: 'Schedule + join URL + chart notes' },
  { area: 'E-Prescribing', status: 'Orders → pharmacy + formulary safety' },
  { area: 'Order entry', status: 'Lab, imaging, clinical orders (CPOE)' },
  { area: 'Billing & coding', status: 'Cashier, NHIA flags, ICD/CPT, denials' },
  { area: 'Progress notes', status: 'SOAP / ambient assist + templates' },
  { area: 'Identity & RBAC', status: 'Staff Access, badge/PIN, audit' },
  { area: 'Interop', status: 'FHIR R4 bundles, HIE endpoints, DHIS2 map' },
  { area: 'Migration', status: 'CSV inventory → map → validate → import' },
  { area: 'Disaster recovery', status: 'Snapshots, runbook, onsite hub path' },
];

export function StatewideEmrSuite({ session }: { session: UserSession }) {
  const facilityId = session.hospitalId || 'DEFAULT';
  const badge = session.badgeId || session.id || 'ADMIN';
  const [tab, setTab] = useState<Tab>('coverage');
  const [, setTick] = useState(0);
  const refresh = () => setTick((x) => x + 1);

  useEffect(() => {
    const u1 = subscribeMessages(facilityId, refresh);
    const u2 = subscribeTelehealth(facilityId, refresh);
    return () => {
      u1();
      u2();
    };
  }, [facilityId]);

  // Messaging
  const threads = listThreads(facilityId, badge);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [msgBody, setMsgBody] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newTo, setNewTo] = useState('');
  const messages = activeThread ? listMessages(facilityId, activeThread) : [];

  // Telehealth
  const tele = listTeleVisits(facilityId);
  const [tvPatient, setTvPatient] = useState('');
  const [tvReason, setTvReason] = useState('Follow-up consultation');
  const [tvWhen, setTvWhen] = useState(() => new Date().toISOString().slice(0, 16));

  // Coding
  const cases = listCodingCases(facilityId);
  const [codePatient, setCodePatient] = useState('');
  const [codeHn, setCodeHn] = useState('');
  const [codeAmt, setCodeAmt] = useState(5000);

  // Migration
  const [csvText, setCsvText] = useState('');
  const [migRows, setMigRows] = useState<MigrationRow[]>([]);
  const [fieldMap, setFieldMap] = useState<FieldMap>({});
  const [migResult, setMigResult] = useState('');

  // FHIR
  const patients = useMemo(() => listPatients(facilityId), [facilityId, tab]);
  const orders = useMemo(() => {
    try {
      return listOrders(facilityId);
    } catch {
      return [];
    }
  }, [facilityId, tab]);
  const visits = useMemo(() => {
    try {
      return listVisits(facilityId);
    } catch {
      return [];
    }
  }, [facilityId, tab]);
  const [endpoints, setEndpoints] = useState<HieEndpoint[]>(() => listEndpoints());

  // DR
  const dr = getDrStatus(facilityId);

  const downloadJson = (filename: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 6px', fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
        Statewide EMR operations
      </h2>
      <p style={{ margin: '0 0 16px', color: '#64748B', fontSize: 14 }}>
        Collaboration, telehealth, coding/denials, FHIR/HIE, migration, and disaster recovery — facility{' '}
        <strong>{facilityId}</strong>
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                border: on ? '1.5px solid #0052D4' : '1px solid #E2E8F0',
                background: on ? '#EFF6FF' : '#FFF',
                color: on ? '#0C4A6E' : '#475569',
                borderRadius: 999,
                padding: '8px 12px',
                fontWeight: 650,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'coverage' && (
        <div style={{ display: 'grid', gap: 8 }}>
          {COVERAGE.map((c) => (
            <div
              key={c.area}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid #BBF7D0',
                background: '#F0FDF4',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: '#14532D' }}>{c.area}</div>
                <div style={{ fontSize: 13, color: '#166534' }}>{c.status}</div>
              </div>
              <CheckCircle2 size={18} color="#16A34A" />
            </div>
          ))}
        </div>
      )}

      {tab === 'messaging' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14, minHeight: 360 }}>
          <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 12, background: '#FFF' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Threads</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              <input
                placeholder="Subject"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                style={inp}
              />
              <input
                placeholder="To badge IDs (comma)"
                value={newTo}
                onChange={(e) => setNewTo(e.target.value)}
                style={inp}
              />
              <button
                type="button"
                className="os-primary-btn"
                style={{ fontSize: 13 }}
                onClick={() => {
                  if (!newSubject.trim() || !msgBody.trim()) return;
                  const thr = startThread({
                    facilityId,
                    subject: newSubject.trim(),
                    fromBadge: badge,
                    fromName: session.name || badge,
                    toBadges: newTo.split(',').map((s) => s.trim()).filter(Boolean),
                    body: msgBody.trim(),
                  });
                  setActiveThread(thr.id);
                  setNewSubject('');
                  setMsgBody('');
                  refresh();
                }}
              >
                <Plus size={14} /> New message
              </button>
            </div>
            {threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveThread(t.id);
                  markThreadRead(facilityId, t.id, badge);
                  refresh();
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  background: activeThread === t.id ? '#EFF6FF' : 'transparent',
                  padding: '8px 6px',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 650, fontSize: 13 }}>{t.subject}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>{t.lastBody.slice(0, 48)}</div>
              </button>
            ))}
          </div>
          <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 14, background: '#FFF' }}>
            {activeThread ? (
              <>
                <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 12 }}>
                  {messages.map((m) => (
                    <div key={m.id} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>
                        {m.fromName} · {new Date(m.createdAt).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 14, color: '#0F172A' }}>{m.body}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    style={{ ...inp, flex: 1 }}
                    value={msgBody}
                    onChange={(e) => setMsgBody(e.target.value)}
                    placeholder="Reply…"
                  />
                  <button
                    type="button"
                    className="os-primary-btn"
                    onClick={() => {
                      if (!msgBody.trim() || !activeThread) return;
                      replyToThread({
                        facilityId,
                        threadId: activeThread,
                        fromBadge: badge,
                        fromName: session.name || badge,
                        body: msgBody.trim(),
                      });
                      setMsgBody('');
                      refresh();
                    }}
                  >
                    <Send size={14} />
                  </button>
                </div>
              </>
            ) : (
              <div style={{ color: '#64748B' }}>Select or start a thread. Use badge IDs of colleagues.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'telehealth' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10 }}>
            <input style={inp} placeholder="Patient name" value={tvPatient} onChange={(e) => setTvPatient(e.target.value)} />
            <input style={inp} placeholder="Reason" value={tvReason} onChange={(e) => setTvReason(e.target.value)} />
            <input style={inp} type="datetime-local" value={tvWhen} onChange={(e) => setTvWhen(e.target.value)} />
            <button
              type="button"
              className="os-primary-btn"
              onClick={() => {
                if (!tvPatient.trim()) return;
                scheduleTeleVisit({
                  facilityId,
                  patientId: `tele-${Date.now()}`,
                  patientName: tvPatient.trim(),
                  clinicianBadge: badge,
                  clinicianName: session.name || badge,
                  scheduledAt: new Date(tvWhen).toISOString(),
                  reason: tvReason,
                });
                setTvPatient('');
                refresh();
              }}
            >
              Schedule
            </button>
          </div>
          {tele.map((v) => (
            <div
              key={v.id}
              style={{
                border: '1px solid #E2E8F0',
                borderRadius: 12,
                padding: 12,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                background: '#FFF',
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{v.patientName}</div>
                <div style={{ fontSize: 13, color: '#64748B' }}>
                  {v.reason} · {new Date(v.scheduledAt).toLocaleString()} · {v.status}
                </div>
                <a href={v.joinUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#0052D4' }}>
                  Join room
                </a>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="os-ghost-btn" onClick={() => { updateTeleVisit(facilityId, v.id, { status: 'in_progress' }); refresh(); }}>
                  Start
                </button>
                <button type="button" className="os-ghost-btn" onClick={() => { updateTeleVisit(facilityId, v.id, { status: 'completed' }); refresh(); }}>
                  Complete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'coding' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px auto', gap: 8 }}>
            <input style={inp} placeholder="Patient name" value={codePatient} onChange={(e) => setCodePatient(e.target.value)} />
            <input style={inp} placeholder="Hospital number" value={codeHn} onChange={(e) => setCodeHn(e.target.value)} />
            <input style={inp} type="number" value={codeAmt} onChange={(e) => setCodeAmt(Number(e.target.value) || 0)} />
            <button
              type="button"
              className="os-primary-btn"
              onClick={() => {
                if (!codePatient.trim()) return;
                const row: ClaimCodingCase = {
                  id: `CLM-${Date.now().toString(36).toUpperCase()}`,
                  facilityId,
                  patientName: codePatient.trim(),
                  hospitalNumber: codeHn || '—',
                  visitDate: new Date().toISOString().slice(0, 10),
                  codes: [
                    { system: 'ICD-10', code: COMMON_ICD10[0].code, display: COMMON_ICD10[0].display },
                    { system: 'NHIA', code: COMMON_CPT_NHIA[0].code, display: COMMON_CPT_NHIA[0].display },
                  ],
                  status: 'coded',
                  payer: 'NHIA',
                  amountNgn: codeAmt,
                  updatedAt: new Date().toISOString(),
                  coderBadge: badge,
                };
                upsertCodingCase(row);
                setCodePatient('');
                refresh();
              }}
            >
              Add coded claim
            </button>
          </div>
          <div style={{ fontSize: 12, color: '#64748B' }}>
            Quick codes: {COMMON_ICD10.map((c) => c.code).join(', ')} · {COMMON_CPT_NHIA.map((c) => c.code).join(', ')}
          </div>
          {cases.map((c) => (
            <div key={c.id} style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 12, background: '#FFF' }}>
              <div style={{ fontWeight: 700 }}>
                {c.patientName} · {c.hospitalNumber} · ₦{c.amountNgn.toLocaleString()} · {c.status}
              </div>
              <div style={{ fontSize: 13, color: '#475569' }}>
                {c.codes.map((x) => `${x.system}:${x.code}`).join(' · ')}
              </div>
              {c.denialReason && (
                <div style={{ fontSize: 13, color: '#B91C1C' }}>Denial: {c.denialCode} — {c.denialReason}</div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" className="os-ghost-btn" onClick={() => { markDenied(facilityId, c.id, 'CO-16', 'Missing / incomplete documentation'); refresh(); }}>
                  Mark denied
                </button>
                <button type="button" className="os-ghost-btn" onClick={() => { markAppealed(facilityId, c.id, 'Supporting notes attached'); refresh(); }}>
                  Appeal
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'fhir' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ margin: 0, color: '#64748B', fontSize: 14 }}>
            Export live facility data as FHIR R4 Bundle. HIE endpoints are configurable below.
          </p>
          <button
            type="button"
            className="os-primary-btn"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => {
              const bundle = exportFacilityFhirBundle({ patients, orders: orders as any, visits: visits as any });
              downloadJson(`fhir-bundle-${facilityId}.json`, bundle);
            }}
          >
            <Download size={14} /> Export facility FHIR bundle ({patients.length} patients)
          </button>
          {patients[0] && (
            <button
              type="button"
              className="os-ghost-btn"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => {
                const b = exportPatientBundle(facilityId, patients[0].id);
                if (b) downloadJson(`fhir-patient-${patients[0].hospitalNumber}.json`, b);
              }}
            >
              Export first patient bundle
            </button>
          )}
          <div style={{ fontWeight: 700 }}>HIE endpoints</div>
          {endpoints.map((ep, i) => (
            <div key={ep.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 8 }}>
              <input
                style={inp}
                value={ep.name}
                onChange={(e) => {
                  const next = [...endpoints];
                  next[i] = { ...ep, name: e.target.value };
                  setEndpoints(next);
                }}
              />
              <input
                style={inp}
                value={ep.baseUrl}
                onChange={(e) => {
                  const next = [...endpoints];
                  next[i] = { ...ep, baseUrl: e.target.value };
                  setEndpoints(next);
                }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={ep.enabled}
                  onChange={(e) => {
                    const next = [...endpoints];
                    next[i] = { ...ep, enabled: e.target.checked };
                    setEndpoints(next);
                  }}
                />
                On
              </label>
            </div>
          ))}
          <button
            type="button"
            className="os-primary-btn"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => saveEndpoints(endpoints)}
          >
            Save endpoints
          </button>
        </div>
      )}

      {tab === 'migration' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 14, color: '#64748B' }}>
            Paste legacy CSV (header row required). Map columns → MedCore patient fields → validate → import.
          </p>
          <textarea
            style={{ ...inp, minHeight: 120, fontFamily: 'monospace', fontSize: 12 }}
            placeholder={'hospital_number,first_name,last_name,sex,phone\nHN001,Ada,Okoro,F,0803...'}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="os-ghost-btn"
              onClick={() => {
                const rows = parseCsv(csvText);
                setMigRows(rows);
                setFieldMap(suggestFieldMap(rows[0] ? Object.keys(rows[0]) : []));
                setMigResult(`Parsed ${rows.length} rows`);
              }}
            >
              Parse & suggest map
            </button>
            <button
              type="button"
              className="os-ghost-btn"
              onClick={() => {
                const v = validateMigration(facilityId, migRows, fieldMap);
                setMigResult(`Valid ${v.ok}, failed ${v.failed}`);
              }}
            >
              Validate
            </button>
            <button
              type="button"
              className="os-primary-btn"
              onClick={() => {
                const r = commitMigration(facilityId, migRows, fieldMap);
                setMigResult(`Imported ${r.imported}, skipped ${r.skipped}`);
                refresh();
              }}
            >
              Import patients
            </button>
          </div>
          {Object.keys(fieldMap).length > 0 && (
            <div style={{ fontSize: 12, color: '#475569' }}>
              Map: {Object.entries(fieldMap).map(([k, v]) => `${k}→${v || '—'}`).join(' · ')}
            </div>
          )}
          {migResult && <div style={{ color: '#0C4A6E', fontWeight: 650 }}>{migResult}</div>}
        </div>
      )}

      {tab === 'dr' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 10,
            }}
          >
            <Stat label="Last backup" value={dr.lastBackupAt ? new Date(dr.lastBackupAt).toLocaleString() : 'Never'} />
            <Stat label="Replication" value={dr.replicationHealthy ? 'Online path OK' : 'Offline / queue'} />
            <Stat label="Onsite hub" value={dr.lanHubConfigured ? 'Configured' : 'Not set'} />
            <Stat label="Snapshots" value={String(dr.snapshots?.length || 0)} />
          </div>
          <button
            type="button"
            className="os-primary-btn"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => {
              createBackupSnapshot(facilityId, 'Manual DR snapshot');
              refresh();
            }}
          >
            <Download size={14} /> Create backup snapshot (download)
          </button>
          <div style={{ fontWeight: 700 }}>Failover runbook</div>
          {DR_RUNBOOK.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setRunbookStep(facilityId, s.id);
                refresh();
              }}
              style={{
                textAlign: 'left',
                border: dr.runbookStep === s.id ? '1.5px solid #0052D4' : '1px solid #E2E8F0',
                background: dr.runbookStep === s.id ? '#EFF6FF' : '#FFF',
                borderRadius: 12,
                padding: 12,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 700 }}>
                {s.id}. {s.title}
              </div>
              <div style={{ fontSize: 13, color: '#64748B' }}>{s.body}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 12, background: '#F8FAFC' }}>
      <div style={{ fontSize: 11, color: '#64748B', fontWeight: 650 }}>{label}</div>
      <div style={{ fontWeight: 700, color: '#0F172A', fontSize: 14 }}>{value}</div>
    </div>
  );
}

const inp: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #E2E8F0',
  fontSize: 14,
  outline: 'none',
};

export default StatewideEmrSuite;
