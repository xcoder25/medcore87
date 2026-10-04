'use client';

/**
 * Advanced hospital capability suites — ambient SOAP, LIS, formulary, MFA/SSO,
 * knowledge graph, predictive staffing, infection control, HIE, PACS worklist.
 */
import React, { useEffect, useState, useRef } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import { Mic, Square, Pill, FlaskConical, Shield, Network, Users, Bug, Globe, Image as ImageIcon } from 'lucide-react';
import {
  seedDefaultFormulary,
  listFormulary,
  listBatches,
  stockQty,
  subscribeFormulary,
  upsertDrug,
  addBatch,
} from '../../lib/formularyInventory';
import {
  listSpecimens,
  advanceSpecimen,
  lisTatStats,
  subscribeLis,
  type LisStage,
} from '../../lib/lisPipeline';
import { buildPatientKnowledgeGraph, graphSummary } from '../../lib/knowledgeGraph';
import { forecastStaffing } from '../../lib/predictiveStaffing';
import {
  enableMfa,
  isMfaEnabled,
  getMfaHint,
  verifyMfaCode,
  getSsoConfig,
  saveSsoConfig,
  ssoAuthorizeUrl,
} from '../../lib/mfaAuth';
import {
  listInfectionCases,
  addInfectionCase,
  clearInfectionCase,
  subscribeInfection,
  type IsolationType,
} from '../../lib/infectionControl';
import { listEndpoints, saveEndpoints, pushBundle, exportFacilityDhis2, logHie } from '../../lib/hieGateway';
import { listPatients } from '../../lib/patientRegistryStore';
import { listOrders } from '../../lib/clinicalEventBus';
import { emitLiveAction } from '../../lib/liveActions';

interface Props {
  session?: UserSession;
  onNavigate?: (k: string) => void;
  mode:
    | 'ambient-soap'
    | 'lis'
    | 'formulary'
    | 'mfa-sso'
    | 'knowledge-graph'
    | 'predictive-staffing'
    | 'infection'
    | 'hie'
    | 'pacs-advanced';
}

export const AdvancedHospitalSuites: React.FC<Props> = ({ session, mode }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';

  if (mode === 'ambient-soap') return <AmbientSoap session={session} />;
  if (mode === 'lis') return <LisBoard facilityId={facilityId} />;
  if (mode === 'formulary') return <FormularyBoard facilityId={facilityId} />;
  if (mode === 'mfa-sso') return <MfaSsoBoard session={session} />;
  if (mode === 'knowledge-graph') return <KnowledgeGraphBoard facilityId={facilityId} />;
  if (mode === 'predictive-staffing') return <StaffingForecastBoard facilityId={facilityId} />;
  if (mode === 'infection') return <InfectionBoard facilityId={facilityId} session={session} />;
  if (mode === 'hie') return <HieBoard facilityId={facilityId} />;
  if (mode === 'pacs-advanced') return <PacsAdvanced facilityId={facilityId} />;
  return null;
};

function AmbientSoap({ session }: { session?: UserSession }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [soap, setSoap] = useState({ s: '', o: '', a: '', p: '' });
  const recRef = useRef<any>(null);

  const start = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setTranscript('Speech recognition not supported in this browser. Type notes below.');
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-NG';
    rec.onresult = (e: any) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript + ' ';
      setTranscript(text.trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const stop = () => {
    recRef.current?.stop();
    setListening(false);
  };

  const toSoap = () => {
    const t = transcript.toLowerCase();
    const s =
      transcript.slice(0, 400) ||
      'Chief complaint captured from ambient audio.';
    const o = /bp|temp|pulse|spo2|fever|tachycard/.test(t)
      ? 'Vitals/exam cues detected in transcript — clinician to confirm.'
      : 'Examination findings pending clinician confirmation.';
    const a = /malaria|asthma|diabet|hypertens|pneumonia|infection/.test(t)
      ? 'Possible considerations mentioned in speech — not a diagnosis.'
      : 'Assessment to be completed by clinician.';
    const p = 'Investigations / treatment / follow-up — draft only for clinician edit.';
    setSoap({ s, o, a, p });
    emitLiveAction('Ambient SOAP draft generated', { module: 'ambient-soap' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ margin: 0, fontWeight: 800 }}>Ambient voice → SOAP</h2>
      <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>
        Clinician-controlled draft only. AI does not file the note without your review.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        {!listening ? (
          <button type="button" onClick={start} style={btnPrimary}>
            <Mic size={14} /> Start listening
          </button>
        ) : (
          <button type="button" onClick={stop} style={{ ...btnPrimary, background: '#DC2626' }}>
            <Square size={14} /> Stop
          </button>
        )}
        <button type="button" onClick={toSoap} style={btnGhost}>
          Generate SOAP draft
        </button>
      </div>
      <textarea
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        rows={5}
        placeholder="Live transcript appears here…"
        style={input}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {(['s', 'o', 'a', 'p'] as const).map((k) => (
          <label key={k} style={{ fontSize: 12, fontWeight: 700 }}>
            {k.toUpperCase()}
            <textarea
              value={soap[k]}
              onChange={(e) => setSoap({ ...soap, [k]: e.target.value })}
              rows={4}
              style={{ ...input, marginTop: 4 }}
            />
          </label>
        ))}
      </div>
      <div style={{ fontSize: 12, color: '#64748B' }}>Signed in as {session?.name || 'Clinician'} — review before saving to EMR.</div>
    </div>
  );
}

function LisBoard({ facilityId }: { facilityId: string }) {
  const [rows, setRows] = useState(listSpecimens(facilityId));
  const [stats, setStats] = useState(lisTatStats(facilityId));
  const reload = () => {
    setRows(listSpecimens(facilityId));
    setStats(lisTatStats(facilityId));
  };
  useEffect(() => {
    reload();
    return subscribeLis(reload);
  }, [facilityId]);

  const stages: LisStage[] = ['ordered', 'collected', 'received', 'processing', 'verified', 'resulted'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ margin: 0, fontWeight: 800 }}>LIS · Barcode & TAT</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        <Kpi label="Open specimens" value={stats.open} />
        <Kpi label="Completed" value={stats.completed} />
        <Kpi label="Avg TAT (min)" value={stats.avgTatMinutes} />
      </div>
      {rows.map((s) => (
        <div key={s.id} style={card}>
          <div style={{ fontWeight: 800 }}>
            {s.barcode} · {s.testName}
          </div>
          <div style={{ fontSize: 12, color: '#64748B' }}>
            {s.patientName} · {s.stage}
            {s.tatMinutes != null ? ` · TAT ${s.tatMinutes}m` : ''}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {stages.map((st) => (
              <button
                key={st}
                type="button"
                disabled={stages.indexOf(st) <= stages.indexOf(s.stage) && s.stage !== 'ordered'}
                onClick={() => {
                  advanceSpecimen(st === 'resulted' ? s.id : s.id, st, st === 'resulted' ? 'Result entered in LIS' : undefined);
                  reload();
                }}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '4px 8px',
                  borderRadius: 8,
                  border: '1px solid #E2E8F0',
                  background: s.stage === st ? '#2563EB' : '#fff',
                  color: s.stage === st ? '#fff' : '#334155',
                  cursor: 'pointer',
                }}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      ))}
      {rows.length === 0 && <div style={{ color: '#64748B' }}>No lab specimens — place lab orders from doctor desk.</div>}
    </div>
  );
}

function FormularyBoard({ facilityId }: { facilityId: string }) {
  const [drugs, setDrugs] = useState(listFormulary(facilityId));
  useEffect(() => {
    seedDefaultFormulary(facilityId);
    const r = () => setDrugs(listFormulary(facilityId));
    r();
    return subscribeFormulary(r);
  }, [facilityId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0, fontWeight: 800 }}>Formulary & inventory</h2>
      {drugs.map((d) => (
        <div key={d.id} style={card}>
          <div style={{ fontWeight: 800 }}>
            {d.name} · ₦{d.unitPriceNgn}
          </div>
          <div style={{ fontSize: 12, color: '#64748B' }}>
            {d.genericName} · {d.form} · Stock {stockQty(facilityId, d.id)} · Reorder {d.reorderLevel}
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
            Batches: {listBatches(facilityId, d.id).map((b) => `${b.batchNo}(${b.qty}) exp ${b.expiry}`).join(' · ') || 'none'}
          </div>
        </div>
      ))}
    </div>
  );
}

function MfaSsoBoard({ session }: { session?: UserSession }) {
  const badge = session?.badgeId || 'ADMIN';
  const [enabled, setEnabled] = useState(isMfaEnabled(badge));
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [sso, setSso] = useState(getSsoConfig());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
      <h2 style={{ margin: 0, fontWeight: 800 }}>MFA & SSO</h2>
      <div style={card}>
        <div style={{ fontWeight: 700 }}>Multi-factor (staff badge)</div>
        <p style={{ fontSize: 12, color: '#64748B' }}>{enabled ? getMfaHint(badge) : 'Not enrolled'}</p>
        <button
          type="button"
          style={btnPrimary}
          onClick={() => {
            enableMfa(badge);
            setEnabled(true);
            setMsg('MFA enrolled — use hint code at sensitive actions');
          }}
        >
          Enrol MFA
        </button>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Verify code" style={{ ...input, marginTop: 8 }} />
        <button
          type="button"
          style={btnGhost}
          onClick={() => setMsg(verifyMfaCode(badge, code) ? 'MFA OK' : 'Invalid code')}
        >
          Verify
        </button>
        {msg && <div style={{ fontSize: 12, marginTop: 8 }}>{msg}</div>}
      </div>
      <div style={card}>
        <div style={{ fontWeight: 700 }}>SSO (OIDC)</div>
        <label style={{ fontSize: 12 }}>
          Issuer
          <input value={sso.issuer} onChange={(e) => setSso({ ...sso, issuer: e.target.value })} style={input} />
        </label>
        <label style={{ fontSize: 12 }}>
          Client ID
          <input value={sso.clientId} onChange={(e) => setSso({ ...sso, clientId: e.target.value })} style={input} />
        </label>
        <label style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <input type="checkbox" checked={sso.enabled} onChange={(e) => setSso({ ...sso, enabled: e.target.checked })} /> Enable SSO
        </label>
        <button
          type="button"
          style={btnPrimary}
          onClick={() => {
            saveSsoConfig(sso);
            setMsg('SSO config saved');
          }}
        >
          Save SSO
        </button>
        {ssoAuthorizeUrl() && (
          <a href={ssoAuthorizeUrl()!} style={{ fontSize: 13, color: '#2563EB' }}>
            Open IdP authorize URL
          </a>
        )}
      </div>
    </div>
  );
}

function KnowledgeGraphBoard({ facilityId }: { facilityId: string }) {
  const patients = listPatients(facilityId);
  const [pid, setPid] = useState(patients[0]?.id || '');
  const g = pid ? buildPatientKnowledgeGraph(facilityId, pid) : { nodes: [], edges: [] };
  const sum = graphSummary(g);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0, fontWeight: 800 }}>Clinical knowledge graph</h2>
      <select value={pid} onChange={(e) => setPid(e.target.value)} style={input}>
        <option value="">Select patient</option>
        {patients.map((p) => (
          <option key={p.id} value={p.id}>
            {p.firstName} {p.lastName} · {p.hospitalNumber}
          </option>
        ))}
      </select>
      <div style={{ fontSize: 13 }}>
        {sum.nodeCount} nodes · {sum.edgeCount} edges · {JSON.stringify(sum.byType)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {g.nodes.map((n) => (
          <span key={n.id} style={{ padding: '6px 10px', borderRadius: 999, background: '#EFF6FF', fontSize: 12, fontWeight: 700 }}>
            {n.type}: {n.label}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 12, color: '#64748B' }}>
        {g.edges.map((e) => (
          <div key={e.id}>
            {e.from} —{e.rel}→ {e.to}
          </div>
        ))}
      </div>
    </div>
  );
}

function StaffingForecastBoard({ facilityId }: { facilityId: string }) {
  const f = forecastStaffing(facilityId);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0, fontWeight: 800 }}>Predictive staffing</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
        <Kpi label="Expected patients" value={f.expectedPatients} />
        <Kpi label="Horizon (hours)" value={f.horizonHours} />
        <Kpi label="Doctors" value={f.recommendedDoctors} />
        <Kpi label="Nurses" value={f.recommendedNurses} />
        <Kpi label="Pharmacy staff" value={f.recommendedPharmacy} />
        <Kpi label="Lab staff" value={f.recommendedLab} />
      </div>
      <div style={card}>
        <div style={{ fontWeight: 700 }}>Confidence: {f.confidence}</div>
        <div style={{ fontSize: 13, color: '#475569' }}>{f.rationale}</div>
      </div>
    </div>
  );
}

function InfectionBoard({ facilityId, session }: { facilityId: string; session?: UserSession }) {
  const [cases, setCases] = useState(listInfectionCases(facilityId));
  const [syndrome, setSyndrome] = useState('Suspected TB');
  const [isolation, setIsolation] = useState<IsolationType>('airborne');
  const patients = listPatients(facilityId);
  const [pid, setPid] = useState(patients[0]?.id || '');

  useEffect(() => subscribeInfection(() => setCases(listInfectionCases(facilityId))), [facilityId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0, fontWeight: 800 }}>Infection control</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <select value={pid} onChange={(e) => setPid(e.target.value)} style={input}>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </option>
          ))}
        </select>
        <input value={syndrome} onChange={(e) => setSyndrome(e.target.value)} style={input} />
        <select value={isolation} onChange={(e) => setIsolation(e.target.value as IsolationType)} style={input}>
          {['standard', 'contact', 'droplet', 'airborne', 'protective'].map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
        <button
          type="button"
          style={btnPrimary}
          onClick={() => {
            const p = patients.find((x) => x.id === pid);
            if (!p) return;
            addInfectionCase({
              facilityId,
              patientId: p.id,
              patientName: `${p.firstName} ${p.lastName}`,
              hospitalNumber: p.hospitalNumber,
              syndrome,
              isolation,
              notedBy: session?.name || 'IPC',
            });
            setCases(listInfectionCases(facilityId));
          }}
        >
          Add isolation case
        </button>
      </div>
      {cases.map((c) => (
        <div key={c.id} style={card}>
          <div style={{ fontWeight: 800 }}>
            {c.patientName} · {c.isolation}
          </div>
          <div style={{ fontSize: 12 }}>
            {c.syndrome} · {c.status}
          </div>
          {c.status === 'active' && (
            <button type="button" style={btnGhost} onClick={() => { clearInfectionCase(c.id); setCases(listInfectionCases(facilityId)); }}>
              Clear
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function HieBoard({ facilityId }: { facilityId: string }) {
  const [eps, setEps] = useState(listEndpoints());
  const patients = listPatients(facilityId);
  const [pid, setPid] = useState(patients[0]?.id || '');
  const [log, setLog] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0, fontWeight: 800 }}>National HIE / FHIR / DHIS2</h2>
      {eps.map((e, i) => (
        <label key={e.id} style={{ ...card, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={e.enabled}
            onChange={(ev) => {
              const next = [...eps];
              next[i] = { ...e, enabled: ev.target.checked };
              setEps(next);
              saveEndpoints(next);
            }}
          />
          <span>
            <strong>{e.name}</strong> · {e.type} · {e.baseUrl || '—'}
          </span>
        </label>
      ))}
      <select value={pid} onChange={(e) => setPid(e.target.value)} style={input}>
        {patients.map((p) => (
          <option key={p.id} value={p.id}>
            {p.firstName} {p.lastName}
          </option>
        ))}
      </select>
      <button
        type="button"
        style={btnPrimary}
        onClick={async () => {
          const r = await pushBundle(facilityId, pid);
          setLog(r.message + (r.bundle ? ` · Bundle ${r.bundle.entry?.length || 0} entries` : ''));
        }}
      >
        Push FHIR patient bundle
      </button>
      <button
        type="button"
        style={btnGhost}
        onClick={() => {
          const events = exportFacilityDhis2(facilityId);
          logHie(`DHIS2 export ${events.length} events`);
          setLog(`DHIS2 events prepared: ${events.length}`);
        }}
      >
        Export DHIS2 OPD events
      </button>
      {log && <div style={{ fontSize: 13 }}>{log}</div>}
    </div>
  );
}

function PacsAdvanced({ facilityId }: { facilityId: string }) {
  const studies = listOrders(facilityId).filter((o) => o.type === 'imaging');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0, fontWeight: 800 }}>PACS / DICOM worklist</h2>
      <p style={{ fontSize: 13, color: '#64748B' }}>
        Worklist from clinical bus. Connect real PACS URL for pixel data; metadata and reports run here.
      </p>
      {studies.length === 0 && <div style={{ color: '#64748B' }}>No imaging orders yet.</div>}
      {studies.map((s) => (
        <div key={s.id} style={card}>
          <div style={{ fontWeight: 800 }}>
            {s.name} · {s.patientName}
          </div>
          <div style={{ fontSize: 12, color: '#64748B' }}>
            Accession {s.id} · status {s.status} · modality inferred from order
          </div>
          <div
            style={{
              marginTop: 8,
              height: 120,
              borderRadius: 12,
              background: 'linear-gradient(135deg,#0F172A,#1E293B)',
              color: '#94A3B8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
            }}
          >
            DICOM viewport placeholder · series 1 · instance 1
          </div>
        </div>
      ))}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 12, color: '#64748B' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #E2E8F0',
  padding: 14,
};
const input: React.CSSProperties = {
  width: '100%',
  padding: 10,
  borderRadius: 10,
  border: '1px solid #E2E8F0',
  fontSize: 14,
  boxSizing: 'border-box',
};
const btnPrimary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '10px 14px',
  borderRadius: 10,
  border: 'none',
  background: 'linear-gradient(135deg,#2563EB,#0D9488)',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #E2E8F0',
  background: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};

export default AdvancedHospitalSuites;
