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
import { SearchablePatientSelect } from '../common/SearchablePatientSelect';
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
  const [search, setSearch] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [notice, setNotice] = useState<string | null>(null);

  const reload = () => {
    setRows(listSpecimens(facilityId));
    setStats(lisTatStats(facilityId));
  };

  useEffect(() => {
    reload();
    return subscribeLis(reload);
  }, [facilityId]);

  const stages: LisStage[] = ['ordered', 'collected', 'received', 'processing', 'verified', 'resulted'];

  const stageLabels: Record<LisStage, string> = {
    ordered: '1. Ordered (Queue)',
    collected: '2. Phlebotomy (Collected)',
    received: '3. Lab Received (Accessioned)',
    processing: '4. On Bench (Analyzing)',
    verified: '5. Verified (MLS Sign-off)',
    resulted: '6. Resulted (EHR Released)',
  };

  const inferTubeColor = (testName: string) => {
    const t = testName.toLowerCase();
    if (t.includes('fbc') || t.includes('cbc') || t.includes('malaria') || t.includes('hba1c') || t.includes('film')) return { cap: '#7C3AED', name: 'EDTA Lavender' };
    if (t.includes('pt') || t.includes('inr') || t.includes('coag')) return { cap: '#0284C7', name: 'Citrate Blue' };
    if (t.includes('glucose') || t.includes('fbs') || t.includes('sugar')) return { cap: '#64748B', name: 'Fluoride Grey' };
    if (t.includes('urine') || t.includes('stool') || t.includes('sputum') || t.includes('culture')) return { cap: '#D97706', name: 'Sterile Yellow' };
    return { cap: '#CA8A04', name: 'SST Gold / Red' };
  };

  const filtered = rows.filter((s) => {
    if (selectedStage !== 'all' && s.stage !== selectedStage) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!s.patientName?.toLowerCase().includes(q) && !s.testName?.toLowerCase().includes(q) && !s.barcode?.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {notice && (
        <div style={{
          position: 'fixed', top: 22, right: 24, zIndex: 9999,
          background: '#0F172A', color: '#38BDF8', border: '1px solid #0284C7',
          borderRadius: 12, padding: '12px 20px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.86rem', fontWeight: 600,
        }}>
          <FlaskConical size={16} color="#38BDF8" />
          <span>{notice}</span>
        </div>
      )}

      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        borderRadius: 16, padding: '20px 24px', color: '#FFFFFF',
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>Specimen Pipeline & TAT Tracking</h2>
            <span style={{ background: '#0284C7', color: '#FFFFFF', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 800 }}>
              LIS REALTIME
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#94A3B8' }}>
            Chain-of-custody specimen tracking from venipuncture to bench accessioning and EHR verification.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => {
              reload();
              setNotice('Specimen pipeline re-synchronized.');
              setTimeout(() => setNotice(null), 3000);
            }}
            style={{
              background: '#0891B2', color: '#FFFFFF', border: 'none',
              padding: '8px 16px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <FlaskConical size={14} /> Refresh Pipeline
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 18px' }}>
          <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Active In-Flight</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', marginTop: 4 }}>{stats.open}</div>
          <div style={{ fontSize: '0.72rem', color: '#0284C7', fontWeight: 600 }}>Specimens in queue</div>
        </div>
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 18px' }}>
          <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Completed & Resulted</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#16A34A', marginTop: 4 }}>{stats.completed}</div>
          <div style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 600 }}>Transmitted to EMR</div>
        </div>
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 18px' }}>
          <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Average Turnaround (TAT)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2563EB', marginTop: 4 }}>{stats.avgTatMinutes} min</div>
          <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Target &lt; 45 mins</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '12px 18px',
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12
      }}>
        <input
          type="text"
          placeholder="Filter by barcode, patient name, test…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '7px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem',
            minWidth: 260, flex: 1, maxWidth: 360, outline: 'none'
          }}
        />

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['all', ...stages].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setSelectedStage(st)}
              style={{
                padding: '4px 10px', borderRadius: 6, border: '1px solid',
                borderColor: selectedStage === st ? '#0891B2' : '#E2E8F0',
                background: selectedStage === st ? '#E0F2FE' : '#FFFFFF',
                color: selectedStage === st ? '#0369A1' : '#475569',
                fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize'
              }}
            >
              {st === 'all' ? 'All Stages' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Specimen Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 ? (
          <div style={{ background: '#FFFFFF', border: '1px dashed #CBD5E1', borderRadius: 14, padding: '36px 20px', textAlign: 'center', color: '#64748B' }}>
            <FlaskConical size={32} color="#94A3B8" style={{ margin: '0 auto 8px auto' }} />
            <div style={{ fontWeight: 700, color: '#1E293B' }}>No specimens found</div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem' }}>Orders placed from clinical desks will automatically appear in this specimen pipeline.</p>
          </div>
        ) : (
          filtered.map((s) => {
            const tube = inferTubeColor(s.testName);
            const currentIdx = stages.indexOf(s.stage);

            return (
              <div
                key={s.id}
                style={{
                  background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14,
                  padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12,
                  boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, background: `${tube.cap}15`,
                      border: `2px solid ${tube.cap}`, display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <FlaskConical size={18} color={tube.cap} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: '0.94rem', color: '#0F172A' }}>{s.patientName}</span>
                        <code style={{ fontSize: '0.72rem', background: '#F1F5F9', padding: '2px 6px', borderRadius: 4, color: '#0284C7', fontWeight: 700 }}>
                          {s.barcode}
                        </code>
                        <span style={{ fontSize: '0.7rem', color: tube.cap, fontWeight: 700 }}>
                          {tube.name}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0891B2', marginTop: 2 }}>
                        {s.testName}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 800,
                      background: s.stage === 'resulted' ? '#DCFCE7' : s.stage === 'processing' ? '#CFFAFE' : '#FEF3C7',
                      color: s.stage === 'resulted' ? '#15803D' : s.stage === 'processing' ? '#0E7490' : '#B45309',
                      textTransform: 'uppercase'
                    }}>
                      {s.stage}
                    </span>
                    {s.tatMinutes != null && (
                      <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>
                        TAT: {s.tatMinutes}m
                      </span>
                    )}
                  </div>
                </div>

                {/* Visual Stage Progress Bar */}
                <div style={{ display: 'flex', gap: 4, background: '#F8FAFC', padding: 8, borderRadius: 8, border: '1px solid #E2E8F0', overflowX: 'auto' }}>
                  {stages.map((st, i) => {
                    const isDone = i <= currentIdx;
                    const isCurrent = i === currentIdx;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          advanceSpecimen(s.id, st, st === 'resulted' ? (s.result || 'Validated & Released') : undefined);
                          reload();
                          setNotice(`Advanced specimen ${s.barcode} to stage: ${st}`);
                          setTimeout(() => setNotice(null), 3000);
                        }}
                        style={{
                          flex: 1, minWidth: 100, padding: '6px 8px', borderRadius: 6, border: 'none',
                          background: isCurrent ? '#0891B2' : isDone ? '#E0F2FE' : '#FFFFFF',
                          color: isCurrent ? '#FFFFFF' : isDone ? '#0369A1' : '#94A3B8',
                          fontSize: '0.7rem', fontWeight: isDone ? 700 : 500, cursor: 'pointer',
                          textAlign: 'center', transition: 'all 0.15s ease'
                        }}
                      >
                        {stageLabels[st]}
                      </button>
                    );
                  })}
                </div>

                {s.result && (
                  <div style={{ background: '#F0FDF4', padding: '6px 12px', borderRadius: 6, border: '1px solid #BBF7D0', fontSize: '0.76rem', color: '#166534', fontWeight: 600 }}>
                    <strong>Report:</strong> {s.result}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
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
      <div style={{ maxWidth: 420 }}>
        <SearchablePatientSelect
          facilityId={facilityId}
          value={pid}
          onChange={(p) => setPid(p?.id || '')}
          placeholder="Search patient for clinical knowledge graph…"
        />
      </div>
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
