'use client';

/**
 * Full clinical UX depth suite — Epic/Cerner parity surfaces for MedCore.
 */
import React, { useEffect, useMemo, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  listPatients, type FacilityPatient, getPatient,
} from '../../lib/patientRegistryStore';
import {
  listProblems, upsertProblem, removeProblem,
  listAllergies, upsertAllergy, removeAllergy,
  listActiveMeds, upsertActiveMed, listMarDoses, upsertMarDose, generateMarForMed,
  listVitals, addVital,
  listNotes, upsertNote, NOTE_TEMPLATES, expandPhrases,
  listMessages, sendMessage, markMessageRead,
  listCareTeam, upsertCareMember, removeCareMember,
  loadPrefs, savePrefs,
  getDischarge, saveDischarge,
  getOpenCharts, addOpenChart, removeOpenChart,
  listTeleSessions, upsertTeleSession,
  populationSnapshot,
  subscribeClinicalUx,
  type ActiveMed, type ClinicalNote,
} from '../../lib/clinicalUxStores';
import { listOrders, subscribeOrders } from '../../lib/clinicalEventBus';
import { listAppointments, todayVisits, subscribeReceptionOps } from '../../lib/receptionOpsStore';
import { setPatientContext, getPatientContext } from '../../lib/patientContextStore';
import { PatientChartBanner } from '../clinical-core/PatientChartBanner';
import { ORDER_SETS } from '../../lib/clinicalIntelligenceEngine';
import {
  Calendar, Pill, AlertTriangle, Activity, FileText, Inbox, ListOrdered,
  LogOut, Layers, Settings, Printer, Image, Users, Shield, BarChart3,
  Stethoscope, Video, Plus, Check, X, Search, Clock,
} from 'lucide-react';

const C = {
  blue: '#0052D4', teal: '#0D9488', text: '#0F172A', muted: '#64748B', border: '#E2E8F0',
};

type Tab =
  | 'schedule' | 'meds' | 'problems' | 'vitals' | 'notes' | 'messages'
  | 'orders' | 'discharge' | 'charts' | 'prefs' | 'print' | 'imaging'
  | 'careteam' | 'privacy' | 'population' | 'analytics' | 'specialty' | 'telehealth';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'schedule', label: 'Clinic schedule', icon: Calendar },
  { id: 'meds', label: 'Meds & MAR', icon: Pill },
  { id: 'problems', label: 'Problems & allergies', icon: AlertTriangle },
  { id: 'vitals', label: 'Vitals flowsheet', icon: Activity },
  { id: 'notes', label: 'Note writer', icon: FileText },
  { id: 'messages', label: 'Messages', icon: Inbox },
  { id: 'orders', label: 'Order tracker', icon: ListOrdered },
  { id: 'discharge', label: 'Discharge', icon: LogOut },
  { id: 'charts', label: 'Open charts', icon: Layers },
  { id: 'prefs', label: 'My preferences', icon: Settings },
  { id: 'print', label: 'Print / PDF', icon: Printer },
  { id: 'imaging', label: 'Report viewer', icon: Image },
  { id: 'careteam', label: 'Care team', icon: Users },
  { id: 'privacy', label: 'Privacy & lock', icon: Shield },
  { id: 'population', label: 'Population', icon: BarChart3 },
  { id: 'analytics', label: 'Analytics studio', icon: BarChart3 },
  { id: 'specialty', label: 'Specialty views', icon: Stethoscope },
  { id: 'telehealth', label: 'Telehealth', icon: Video },
];

interface Props {
  session: UserSession;
  onNavigate?: (k: string) => void;
  onLock?: () => void;
  initialTab?: Tab;
}

function uid(p: string) {
  return `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export const ClinicalUxSuite: React.FC<Props> = ({ session, onNavigate, onLock, initialTab }) => {
  const facilityId = session.hospitalId || 'IGH-EKT';
  const [tab, setTab] = useState<Tab>(initialTab || 'schedule');
  const [tick, setTick] = useState(0);
  const [patientId, setPatientId] = useState(() => getPatientContext()?.patientId || '');
  const [flash, setFlash] = useState('');
  const reload = () => setTick((t) => t + 1);

  useEffect(() => {
    const u1 = subscribeClinicalUx(reload);
    const u2 = subscribeOrders(reload);
    const u3 = subscribeReceptionOps(reload);
    const onSync = () => reload();
    window.addEventListener('medcore-admin-sync', onSync);
    window.addEventListener('storage', onSync);
    const id = window.setInterval(reload, 8000); // soft poll for multi-tab
    return () => {
      u1(); u2(); u3();
      window.removeEventListener('medcore-admin-sync', onSync);
      window.removeEventListener('storage', onSync);
      window.clearInterval(id);
    };
  }, []);

  const patients = useMemo(() => listPatients(facilityId), [facilityId, tick]);
  const patient = patientId ? getPatient(patientId) || patients.find((p) => p.id === patientId) : null;

  const selectPatient = (id: string) => {
    setPatientId(id);
    const p = getPatient(id) || patients.find((x) => x.id === id);
    if (p) {
      setPatientContext(p, session.name);
      addOpenChart({ patientId: p.id, name: `${p.firstName} ${p.lastName}`, hn: p.hospitalNumber });
    }
  };

  const toast = (m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(''), 2500);
  };

  const card: React.CSSProperties = {
    background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 32 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>Clinical workspace</div>
          <div style={{ fontSize: 12, color: C.muted }}>Schedule · meds · notes · messages · discharge · more</div>
        </div>
        <span style={{ flex: 1 }} />
        <select
          value={patientId}
          onChange={(e) => selectPatient(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 10, border: `1px solid ${C.border}`, minWidth: 220, fontWeight: 600 }}
        >
          <option value="">Select patient…</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>{p.firstName} {p.lastName} · {p.hospitalNumber}</option>
          ))}
        </select>
        {flash && <span style={{ fontSize: 12, fontWeight: 700, color: C.teal }}>{flash}</span>}
      </div>

      {patient && <PatientChartBanner patient={patient} compact />}

      {/* Open chart tabs */}
      {getOpenCharts().length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {getOpenCharts().map((t) => (
            <button
              key={t.patientId}
              type="button"
              onClick={() => selectPatient(t.patientId)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 10px', borderRadius: 999,
                border: t.patientId === patientId ? `2px solid ${C.blue}` : `1px solid ${C.border}`,
                background: t.patientId === patientId ? '#EFF6FF' : '#fff',
                fontWeight: 700, fontSize: 11, cursor: 'pointer',
              }}
            >
              {t.name}
              <span
                onClick={(e) => { e.stopPropagation(); removeOpenChart(t.patientId); reload(); }}
                style={{ color: C.muted }}
              >×</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', borderRadius: 10, border: on ? 'none' : `1px solid ${C.border}`,
                background: on ? 'linear-gradient(135deg,#0052D4,#0D9488)' : '#fff',
                color: on ? '#fff' : C.text, fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── SCHEDULE ── */}
      {tab === 'schedule' && (
        <ScheduleBoard facilityId={facilityId} session={session} onSelect={selectPatient} />
      )}

      {/* ── MEDS + MAR ── */}
      {tab === 'meds' && patient && (
        <MedsMarPanel
          facilityId={facilityId}
          patient={patient}
          session={session}
          onToast={toast}
        />
      )}
      {tab === 'meds' && !patient && <EmptyPick />}

      {/* ── PROBLEMS + ALLERGIES ── */}
      {tab === 'problems' && patient && (
        <ProblemsAllergiesPanel facilityId={facilityId} patient={patient} session={session} onToast={toast} />
      )}
      {tab === 'problems' && !patient && <EmptyPick />}

      {/* ── VITALS ── */}
      {tab === 'vitals' && patient && (
        <VitalsFlowsheet facilityId={facilityId} patient={patient} session={session} onToast={toast} />
      )}
      {tab === 'vitals' && !patient && <EmptyPick />}

      {/* ── NOTES ── */}
      {tab === 'notes' && patient && (
        <NoteWriter facilityId={facilityId} patient={patient} session={session} onToast={toast} />
      )}
      {tab === 'notes' && !patient && <EmptyPick />}

      {/* ── MESSAGES ── */}
      {tab === 'messages' && (
        <MessagesPanel facilityId={facilityId} session={session} patients={patients} onToast={toast} />
      )}

      {/* ── ORDER TRACKER ── */}
      {tab === 'orders' && (
        <OrderTracker facilityId={facilityId} patientId={patientId || undefined} />
      )}

      {/* ── DISCHARGE ── */}
      {tab === 'discharge' && patient && (
        <DischargeChecklistPanel facilityId={facilityId} patient={patient} session={session} onToast={toast} onNavigate={onNavigate} />
      )}
      {tab === 'discharge' && !patient && <EmptyPick />}

      {/* ── OPEN CHARTS info ── */}
      {tab === 'charts' && (
        <div style={card}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Multi-patient workspace</div>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
            Open up to 6 charts. Tabs appear above. Select a patient from any module to pin them here.
          </p>
          {getOpenCharts().length === 0 && <div style={{ color: C.muted }}>No charts open yet.</div>}
          {getOpenCharts().map((t) => (
            <div key={t.patientId} style={{ display: 'flex', padding: 10, borderBottom: `1px solid ${C.border}`, alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700 }}>{t.name}</span>
              <span style={{ fontSize: 12, color: C.muted }}>{t.hn}</span>
              <button type="button" onClick={() => selectPatient(t.patientId)} style={{ marginLeft: 'auto', ...btnSec }}>Open</button>
              <button type="button" onClick={() => { removeOpenChart(t.patientId); reload(); }} style={btnGhost}>Close</button>
            </div>
          ))}
        </div>
      )}

      {/* ── PREFS ── */}
      {tab === 'prefs' && (
        <PrefsPanel session={session} onToast={toast} onNavigate={onNavigate} />
      )}

      {/* ── PRINT ── */}
      {tab === 'print' && patient && (
        <PrintCenter patient={patient} facilityId={facilityId} session={session} />
      )}
      {tab === 'print' && !patient && <EmptyPick />}

      {/* ── IMAGING VIEWER ── */}
      {tab === 'imaging' && (
        <ImagingViewer facilityId={facilityId} patientId={patientId || undefined} />
      )}

      {/* ── CARE TEAM ── */}
      {tab === 'careteam' && patient && (
        <CareTeamPanel facilityId={facilityId} patient={patient} session={session} onToast={toast} />
      )}
      {tab === 'careteam' && !patient && <EmptyPick />}

      {/* ── PRIVACY ── */}
      {tab === 'privacy' && (
        <PrivacyPanel session={session} onLock={onLock} onToast={toast} />
      )}

      {/* ── POPULATION ── */}
      {tab === 'population' && (
        <PopulationPanel facilityId={facilityId} />
      )}

      {/* ── ANALYTICS ── */}
      {tab === 'analytics' && (
        <AnalyticsStudio facilityId={facilityId} />
      )}

      {/* ── SPECIALTY ── */}
      {tab === 'specialty' && (
        <SpecialtyViews facilityId={facilityId} patient={patient} />
      )}

      {/* ── TELEHEALTH ── */}
      {tab === 'telehealth' && (
        <TelehealthPanel facilityId={facilityId} session={session} patients={patients} onToast={toast} />
      )}
    </div>
  );
};

const btnPri: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 10, border: 'none',
  background: 'linear-gradient(135deg,#0052D4,#0D9488)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
};
const btnSec: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 8, border: 'none', background: 'transparent', color: C.muted, fontWeight: 600, fontSize: 12, cursor: 'pointer',
};

function EmptyPick() {
  return (
    <div style={{ padding: 32, textAlign: 'center', color: C.muted, border: `1px dashed ${C.border}`, borderRadius: 14 }}>
      Select a patient above to use this panel.
    </div>
  );
}

function ScheduleBoard({ facilityId, session, onSelect }: { facilityId: string; session: UserSession; onSelect: (id: string) => void }) {
  const appts = listAppointments(facilityId);
  const visits = todayVisits(facilityId);
  const byProvider = useMemo(() => {
    const map = new Map<string, typeof appts>();
    for (const a of appts) {
      const k = a.doctor || 'Unassigned';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(a);
    }
    return map;
  }, [appts]);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>Today&apos;s clinic board</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
          {appts.length} appointments · {visits.filter((v) => v.status === 'waiting').length} waiting in queue
        </div>
        {appts.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>No appointments booked for today. Use Appointments module to schedule.</div>}
        {[...byProvider.entries()].map(([prov, list]) => (
          <div key={prov} style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.blue, marginBottom: 8 }}>{prov}</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {list.map((a) => (
                <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', borderRadius: 10, border: `1px solid ${C.border}` }}>
                  <Clock size={14} color={C.muted} />
                  <span style={{ fontWeight: 700, fontSize: 12, minWidth: 56 }}>{a.scheduledAt ? new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                  <span style={{ fontWeight: 700 }}>{a.patientName}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{a.department}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: a.status === 'completed' ? '#D1FAE5' : a.status === 'cancelled' ? '#FEE2E2' : '#DBEAFE', color: '#0F172A' }}>{a.status}</span>
                  {a.patientId && (
                    <button type="button" style={btnSec} onClick={() => onSelect(a.patientId!)}>Chart</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Live queue (same day)</div>
        {visits.slice(0, 12).map((v) => (
          <div key={v.id} style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
            <span style={{ fontWeight: 800, color: C.blue }}>{v.queueNumber}</span>
            <span style={{ fontWeight: 700 }}>{v.patientName}</span>
            <span style={{ color: C.muted }}>{v.department}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11 }}>{v.status}</span>
            {v.patientId && <button type="button" style={btnGhost} onClick={() => onSelect(v.patientId)}>Open</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

function MedsMarPanel({ facilityId, patient, session, onToast }: { facilityId: string; patient: FacilityPatient; session: UserSession; onToast: (m: string) => void }) {
  const meds = listActiveMeds(facilityId, patient.id);
  const doses = listMarDoses(facilityId, patient.id);
  const [drug, setDrug] = useState('');
  const [dose, setDose] = useState('');
  const [freq, setFreq] = useState('8 hourly');
  const [route, setRoute] = useState('oral');

  const add = () => {
    if (!drug.trim()) return;
    const m: ActiveMed = {
      id: uid('MED'),
      facilityId,
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      drugName: drug.trim(),
      dose: dose || '1',
      route,
      frequency: freq,
      status: 'active',
      startAt: new Date().toISOString(),
      orderedBy: session.name,
    };
    upsertActiveMed(m);
    generateMarForMed(m);
    setDrug('');
    onToast('Medication added · MAR doses generated');
  };

  const give = (id: string) => {
    const d = doses.find((x) => x.id === id);
    if (!d) return;
    upsertMarDose({ ...d, status: 'given', givenAt: new Date().toISOString(), givenBy: session.name });
    onToast('Dose recorded as given');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Active medications</div>
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <input placeholder="Drug name" value={drug} onChange={(e) => setDrug(e.target.value)} style={inp} />
          <div style={{ display: 'flex', gap: 8 }}>
            <input placeholder="Dose" value={dose} onChange={(e) => setDose(e.target.value)} style={{ ...inp, flex: 1 }} />
            <input placeholder="Route" value={route} onChange={(e) => setRoute(e.target.value)} style={{ ...inp, flex: 1 }} />
            <input placeholder="Frequency" value={freq} onChange={(e) => setFreq(e.target.value)} style={{ ...inp, flex: 1 }} />
          </div>
          <button type="button" style={btnPri} onClick={add}>Add to active list</button>
        </div>
        {meds.map((m) => (
          <div key={m.id} style={{ padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontWeight: 700 }}>{m.drugName} <span style={{ fontWeight: 500, color: C.muted }}>{m.dose} {m.route}</span></div>
            <div style={{ fontSize: 11, color: C.muted }}>{m.frequency} · {m.status} · {m.orderedBy}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button type="button" style={btnSec} onClick={() => { upsertActiveMed({ ...m, status: 'held' }); onToast('Held'); }}>Hold</button>
              <button type="button" style={btnSec} onClick={() => { upsertActiveMed({ ...m, status: 'stopped', stopAt: new Date().toISOString() }); onToast('Stopped'); }}>Stop</button>
            </div>
          </div>
        ))}
        {meds.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>No active meds.</div>}
      </div>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>eMAR — due doses</div>
        {doses.filter((d) => d.status === 'due').slice(0, 20).map((d) => {
          const med = meds.find((m) => m.id === d.medId);
          return (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{med?.drugName || 'Med'}</div>
                <div style={{ fontSize: 11, color: C.muted }}>Due {new Date(d.dueAt).toLocaleString()}</div>
              </div>
              <button type="button" style={btnPri} onClick={() => give(d.id)}>Give</button>
            </div>
          );
        })}
        {doses.filter((d) => d.status === 'due').length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>No doses due.</div>}
      </div>
    </div>
  );
}

const inp: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, width: '100%',
};

function ProblemsAllergiesPanel({ facilityId, patient, session, onToast }: { facilityId: string; patient: FacilityPatient; session: UserSession; onToast: (m: string) => void }) {
  const problems = listProblems(facilityId, patient.id);
  const allergies = listAllergies(facilityId, patient.id);
  const [pname, setPname] = useState('');
  const [asub, setAsub] = useState('');
  const [asev, setAsev] = useState<'mild' | 'moderate' | 'severe' | 'unknown'>('moderate');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Problem list</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input placeholder="Problem / diagnosis" value={pname} onChange={(e) => setPname(e.target.value)} style={inp} />
          <button type="button" style={btnPri} onClick={() => {
            if (!pname.trim()) return;
            upsertProblem({ id: uid('PRB'), facilityId, patientId: patient.id, name: pname.trim(), status: 'active', notedBy: session.name, notedAt: new Date().toISOString() });
            setPname(''); onToast('Problem added');
          }}>Add</button>
        </div>
        {problems.map((p) => (
          <div key={p.id} style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: `1px solid ${C.border}`, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{p.status} · {p.notedBy}</div>
            </div>
            <button type="button" style={btnSec} onClick={() => { upsertProblem({ ...p, status: 'resolved' }); onToast('Resolved'); }}>Resolve</button>
            <button type="button" style={btnGhost} onClick={() => removeProblem(p.id)}>×</button>
          </div>
        ))}
      </div>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Allergies</div>
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <input placeholder="Substance" value={asub} onChange={(e) => setAsub(e.target.value)} style={inp} />
          <select value={asev} onChange={(e) => setAsev(e.target.value as any)} style={inp}>
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
            <option value="unknown">Unknown</option>
          </select>
          <button type="button" style={btnPri} onClick={() => {
            if (!asub.trim()) return;
            upsertAllergy({ id: uid('ALG'), facilityId, patientId: patient.id, substance: asub.trim(), severity: asev, notedBy: session.name, notedAt: new Date().toISOString() });
            setAsub(''); onToast('Allergy recorded');
          }}>Add allergy</button>
        </div>
        {allergies.map((a) => (
          <div key={a.id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
            <AlertTriangle size={14} color="#DC2626" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{a.substance}</div>
              <div style={{ fontSize: 11, color: '#991B1B' }}>{a.severity}</div>
            </div>
            <button type="button" style={btnGhost} onClick={() => removeAllergy(a.id)}>×</button>
          </div>
        ))}
        {allergies.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>No structured allergies (NKDA).</div>}
      </div>
    </div>
  );
}

function VitalsFlowsheet({ facilityId, patient, session, onToast }: { facilityId: string; patient: FacilityPatient; session: UserSession; onToast: (m: string) => void }) {
  const rows = listVitals(facilityId, patient.id);
  const [form, setForm] = useState({ bpSys: '', bpDia: '', hr: '', rr: '', spo2: '', temp: '' });

  const save = () => {
    addVital({
      id: uid('VIT'),
      facilityId,
      patientId: patient.id,
      at: new Date().toISOString(),
      bpSys: form.bpSys ? Number(form.bpSys) : undefined,
      bpDia: form.bpDia ? Number(form.bpDia) : undefined,
      hr: form.hr ? Number(form.hr) : undefined,
      rr: form.rr ? Number(form.rr) : undefined,
      spo2: form.spo2 ? Number(form.spo2) : undefined,
      temp: form.temp ? Number(form.temp) : undefined,
      recordedBy: session.name,
    });
    setForm({ bpSys: '', bpDia: '', hr: '', rr: '', spo2: '', temp: '' });
    onToast('Vitals recorded');
  };

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ fontWeight: 800, marginBottom: 12 }}>Vitals flowsheet</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {(['bpSys', 'bpDia', 'hr', 'rr', 'spo2', 'temp'] as const).map((k) => (
          <input key={k} placeholder={k} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} style={{ ...inp, width: 90 }} />
        ))}
        <button type="button" style={btnPri} onClick={save}>Record</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }} className="mc-clinical-dense">
          <thead>
            <tr style={{ textAlign: 'left', color: C.muted }}>
              <th style={{ padding: 8 }}>Time</th>
              <th>BP</th><th>HR</th><th>RR</th><th>SpO₂</th><th>Temp</th><th>By</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={{ padding: 8 }}>{new Date(r.at).toLocaleString()}</td>
                <td>{r.bpSys && r.bpDia ? `${r.bpSys}/${r.bpDia}` : '—'}</td>
                <td>{r.hr ?? '—'}</td>
                <td>{r.rr ?? '—'}</td>
                <td>{r.spo2 != null ? `${r.spo2}%` : '—'}</td>
                <td>{r.temp != null ? `${r.temp}°` : '—'}</td>
                <td>{r.recordedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div style={{ color: C.muted, padding: 12 }}>No vitals yet.</div>}
      </div>
    </div>
  );
}

function NoteWriter({ facilityId, patient, session, onToast }: { facilityId: string; patient: FacilityPatient; session: UserSession; onToast: (m: string) => void }) {
  const notes = listNotes(facilityId, patient.id);
  const [body, setBody] = useState(NOTE_TEMPLATES[0].body);
  const [title, setTitle] = useState('Progress note');

  const save = (sign: boolean) => {
    const expanded = expandPhrases(body, patient);
    const n: ClinicalNote = {
      id: uid('NOTE'),
      facilityId,
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      type: 'soap',
      title,
      body: expanded,
      author: session.name,
      authorBadge: session.badgeId,
      createdAt: new Date().toISOString(),
      signed: sign,
      signedAt: sign ? new Date().toISOString() : undefined,
    };
    upsertNote(n);
    onToast(sign ? 'Note signed' : 'Note saved as draft');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 14 }}>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Write note</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {NOTE_TEMPLATES.map((t) => (
            <button key={t.id} type="button" style={btnSec} onClick={() => { setBody(t.body); setTitle(t.label); }}>{t.label}</button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
          Smart phrases: <code>.vitals</code> <code>.allergies</code> <code>.name</code> <code>.hn</code>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ ...inp, marginBottom: 8 }} />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} style={{ ...inp, fontFamily: 'inherit', resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button type="button" style={btnSec} onClick={() => save(false)}>Save draft</button>
          <button type="button" style={btnPri} onClick={() => save(true)}>Sign note</button>
        </div>
      </div>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Prior notes</div>
        {notes.map((n) => (
          <div key={n.id} style={{ padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{n.title} {n.signed && <Check size={12} color="#16A34A" />}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{n.author} · {new Date(n.createdAt).toLocaleString()}</div>
            <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', marginTop: 6, color: C.text, fontFamily: 'inherit' }}>{n.body.slice(0, 200)}{n.body.length > 200 ? '…' : ''}</pre>
          </div>
        ))}
        {notes.length === 0 && <div style={{ color: C.muted }}>No notes yet.</div>}
      </div>
    </div>
  );
}

function MessagesPanel({ facilityId, session, patients, onToast }: { facilityId: string; session: UserSession; patients: FacilityPatient[]; onToast: (m: string) => void }) {
  const msgs = listMessages(facilityId);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [toRole, setToRole] = useState('doctor');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Inbox</div>
        {msgs.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => { markMessageRead(m.id); onToast('Marked read'); }}
            style={{ width: '100%', textAlign: 'left', border: 'none', background: m.read ? 'transparent' : '#EFF6FF', padding: 10, borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}
          >
            <div style={{ fontWeight: 700, fontSize: 13 }}>{m.subject}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{m.fromName} · {new Date(m.createdAt).toLocaleString()}</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>{m.body.slice(0, 80)}</div>
          </button>
        ))}
        {msgs.length === 0 && <div style={{ color: C.muted }}>No messages.</div>}
      </div>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Compose</div>
        <select value={toRole} onChange={(e) => setToRole(e.target.value)} style={{ ...inp, marginBottom: 8 }}>
          <option value="doctor">Doctors</option>
          <option value="nurse">Nurses</option>
          <option value="pharmacy">Pharmacy</option>
          <option value="reception">Reception</option>
          <option value="lab">Laboratory</option>
        </select>
        <input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} style={{ ...inp, marginBottom: 8 }} />
        <textarea placeholder="Message" value={body} onChange={(e) => setBody(e.target.value)} rows={5} style={{ ...inp, marginBottom: 8 }} />
        <button type="button" style={btnPri} onClick={() => {
          if (!subject.trim()) return;
          sendMessage({
            id: uid('MSG'), facilityId, fromName: session.name, fromBadge: session.badgeId,
            toRole, subject: subject.trim(), body: body.trim(), createdAt: new Date().toISOString(),
            read: false, kind: 'staff',
          });
          setSubject(''); setBody('');
          onToast('Message sent');
        }}>Send</button>
      </div>
    </div>
  );
}

function OrderTracker({ facilityId, patientId }: { facilityId: string; patientId?: string }) {
  const orders = listOrders(facilityId).filter((o) => !patientId || o.patientId === patientId);
  const steps = ['ordered', 'accepted', 'in_progress', 'resulted'] as const;

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ fontWeight: 800, marginBottom: 12 }}>Order status tracker</div>
      {orders.slice(0, 30).map((o) => {
        const idx = steps.indexOf(o.status as any);
        return (
          <div key={o.id} style={{ padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700 }}>{o.name}</span>
              <span style={{ fontSize: 11, color: C.muted }}>{o.patientName} · {o.type}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700 }}>{o.status}</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {steps.map((s, i) => (
                <div key={s} style={{ flex: 1, height: 6, borderRadius: 3, background: i <= idx ? C.blue : '#E2E8F0' }} title={s} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.muted, marginTop: 4 }}>
              <span>Ordered</span><span>Accepted</span><span>In progress</span><span>Resulted</span>
            </div>
          </div>
        );
      })}
      {orders.length === 0 && <div style={{ color: C.muted }}>No orders on the bus.</div>}
    </div>
  );
}

function DischargeChecklistPanel({ facilityId, patient, session, onToast, onNavigate }: { facilityId: string; patient: FacilityPatient; session: UserSession; onToast: (m: string) => void; onNavigate?: (k: string) => void }) {
  const existing = getDischarge(facilityId, patient.id);
  const [state, setState] = useState({
    medsReconciled: existing?.medsReconciled || false,
    followUpSet: existing?.followUpSet || false,
    instructionsGiven: existing?.instructionsGiven || false,
    bedFreed: existing?.bedFreed || false,
    summarySigned: existing?.summarySigned || false,
  });

  const toggle = (k: keyof typeof state) => setState((s) => ({ ...s, [k]: !s[k] }));

  const allDone = Object.values(state).every(Boolean);

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, maxWidth: 520 }}>
      <div style={{ fontWeight: 800, marginBottom: 4 }}>Discharge checklist</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>{patient.firstName} {patient.lastName}</div>
      {([
        ['medsReconciled', 'Medications reconciled'],
        ['followUpSet', 'Follow-up appointment set'],
        ['instructionsGiven', 'Patient instructions given'],
        ['bedFreed', 'Bed freed / ward notified'],
        ['summarySigned', 'Discharge summary signed'],
      ] as const).map(([k, label]) => (
        <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}>
          <input type="checkbox" checked={state[k]} onChange={() => toggle(k)} />
          <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
        </label>
      ))}
      <button
        type="button"
        style={{ ...btnPri, marginTop: 14, opacity: allDone ? 1 : 0.7 }}
        onClick={() => {
          saveDischarge({
            patientId: patient.id,
            facilityId,
            ...state,
            completedAt: allDone ? new Date().toISOString() : undefined,
            by: session.name,
          });
          onToast(allDone ? 'Discharge complete' : 'Checklist saved');
          if (allDone && onNavigate) onNavigate('beds');
        }}
      >
        {allDone ? 'Complete discharge' : 'Save progress'}
      </button>
    </div>
  );
}

function PrefsPanel({ session, onToast, onNavigate }: { session: UserSession; onToast: (m: string) => void; onNavigate?: (k: string) => void }) {
  const uid = session.id || session.badgeId || 'user';
  const [prefs, setPrefs] = useState(() => loadPrefs(uid));
  const modules = ['dashboard', 'patient-360', 'laboratory', 'pharmacy', 'emr', 'clinical-ux', 'patient-flow'];

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, maxWidth: 480 }}>
      <div style={{ fontWeight: 800, marginBottom: 12 }}>My preferences</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Pinned modules</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {modules.map((m) => {
          const on = prefs.pinnedModules.includes(m);
          return (
            <button
              key={m}
              type="button"
              onClick={() => setPrefs((p) => ({
                ...p,
                pinnedModules: on ? p.pinnedModules.filter((x) => x !== m) : [...p.pinnedModules, m],
              }))}
              style={{
                padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: on ? 'none' : `1px solid ${C.border}`,
                background: on ? C.blue : '#fff', color: on ? '#fff' : C.text,
              }}
            >
              {m}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Idle lock (minutes)</div>
      <input
        type="number"
        min={1}
        max={60}
        value={prefs.idleLockMinutes}
        onChange={(e) => setPrefs({ ...prefs, idleLockMinutes: Number(e.target.value) || 15 })}
        style={{ ...inp, width: 100, marginBottom: 12 }}
      />
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Favorite order sets</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {ORDER_SETS.map((s) => {
          const on = prefs.favoriteOrderSets.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setPrefs((p) => ({
                ...p,
                favoriteOrderSets: on ? p.favoriteOrderSets.filter((x) => x !== s.id) : [...p.favoriteOrderSets, s.id],
              }))}
              style={{
                padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: on ? 'none' : `1px solid ${C.border}`,
                background: on ? C.teal : '#fff', color: on ? '#fff' : C.text,
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      <button type="button" style={btnPri} onClick={() => { savePrefs(uid, prefs); onToast('Preferences saved'); }}>
        Save preferences
      </button>
    </div>
  );
}

function PrintCenter({ patient, facilityId, session }: { patient: FacilityPatient; facilityId: string; session: UserSession }) {
  const notes = listNotes(facilityId, patient.id).filter((n) => n.signed);
  const meds = listActiveMeds(facilityId, patient.id);
  const printBlock = (title: string, body: string) => {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px;color:#0f172a} h1{font-size:18px} pre{white-space:pre-wrap;font-family:inherit}</style>
      </head><body><h1>${title}</h1><p><strong>${patient.firstName} ${patient.lastName}</strong> · ${patient.hospitalNumber}</p>
      <p style="color:#64748b;font-size:12px">${session.facility || facilityId} · Printed ${new Date().toLocaleString()} by ${session.name}</p>
      <hr/><pre>${body}</pre></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ fontWeight: 800, marginBottom: 12 }}>Print / PDF centre</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" style={btnSec} onClick={() => printBlock('Patient summary', `Name: ${patient.firstName} ${patient.lastName}\nHN: ${patient.hospitalNumber}\nSex/DOB: ${patient.sex} / ${patient.dob}\nPhone: ${patient.phone || '—'}\nAllergies: ${(patient.allergies || []).join(', ') || 'NKDA'}`)}>Patient summary</button>
        <button type="button" style={btnSec} onClick={() => printBlock('Active medications', meds.map((m) => `${m.drugName} ${m.dose} ${m.route} ${m.frequency}`).join('\n') || 'None')}>Rx list</button>
        <button type="button" style={btnSec} onClick={() => printBlock('Clinical notes', notes.map((n) => `--- ${n.title} (${n.author}) ---\n${n.body}`).join('\n\n') || 'No signed notes')}>Notes</button>
        <button type="button" style={btnSec} onClick={() => printBlock('Discharge advice', 'Rest, medication adherence, return if danger signs. Follow-up as advised.')}>Discharge advice</button>
      </div>
    </div>
  );
}

function ImagingViewer({ facilityId, patientId }: { facilityId: string; patientId?: string }) {
  const reports = listOrders(facilityId).filter((o) => o.type === 'imaging' && o.status === 'resulted' && (!patientId || o.patientId === patientId));
  const [sel, setSel] = useState<string | null>(null);
  const order = reports.find((o) => o.id === sel) || reports[0];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14, minHeight: 360 }}>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Imaging reports</div>
        {reports.map((o) => (
          <button key={o.id} type="button" onClick={() => setSel(o.id)} style={{ width: '100%', textAlign: 'left', padding: 8, border: 'none', background: order?.id === o.id ? '#EFF6FF' : 'transparent', borderRadius: 8, cursor: 'pointer', marginBottom: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 12 }}>{o.name}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{o.patientName}</div>
          </button>
        ))}
        {reports.length === 0 && <div style={{ color: C.muted, fontSize: 12 }}>No resulted imaging yet.</div>}
      </div>
      <div style={{ background: '#0B1220', borderRadius: 14, padding: 20, color: '#E2E8F0' }}>
        {order ? (
          <>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>{order.name}</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 16 }}>{order.patientName} · {order.hospitalNumber}</div>
            <div style={{ background: '#1E293B', borderRadius: 12, padding: 24, minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, color: '#94A3B8', fontSize: 13 }}>
              Image viewport — connect Orthanc/PACS for DICOM. Report text below.
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13 }}>{order.resultSummary || 'No report text.'}</pre>
          </>
        ) : (
          <div style={{ opacity: 0.6 }}>Select a report</div>
        )}
      </div>
    </div>
  );
}

function CareTeamPanel({ facilityId, patient, session, onToast }: { facilityId: string; patient: FacilityPatient; session: UserSession; onToast: (m: string) => void }) {
  const team = listCareTeam(facilityId, patient.id);
  const [role, setRole] = useState('Primary doctor');
  const [name, setName] = useState(session.name);

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, maxWidth: 480 }}>
      <div style={{ fontWeight: 800, marginBottom: 12 }}>Care team</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input value={role} onChange={(e) => setRole(e.target.value)} style={inp} placeholder="Role" />
        <input value={name} onChange={(e) => setName(e.target.value)} style={inp} placeholder="Name" />
        <button type="button" style={btnPri} onClick={() => {
          upsertCareMember({ id: uid('CT'), facilityId, patientId: patient.id, role, name, badgeId: session.badgeId, assignedAt: new Date().toISOString() });
          onToast('Team member added');
        }}>Add</button>
      </div>
      {team.map((m) => (
        <div key={m.id} style={{ display: 'flex', padding: '8px 0', borderBottom: `1px solid ${C.border}`, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>{m.name}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{m.role}</div>
          </div>
          <button type="button" style={btnGhost} onClick={() => removeCareMember(m.id)}>Remove</button>
        </div>
      ))}
      {team.length === 0 && <div style={{ color: C.muted }}>No care team assigned.</div>}
    </div>
  );
}

function PrivacyPanel({ session, onLock, onToast }: { session: UserSession; onLock?: () => void; onToast: (m: string) => void }) {
  const prefs = loadPrefs(session.id || session.badgeId || 'user');
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, maxWidth: 480 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>Privacy glass & workstation lock</div>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
        Auto-lock after {prefs.idleLockMinutes} minutes of idle time (set under My preferences). Lock now before leaving the desk.
      </p>
      <button type="button" style={btnPri} onClick={() => { onLock?.(); onToast('Workstation locked'); }}>
        Lock workstation now
      </button>
      <div style={{ marginTop: 16, padding: 12, background: '#FEF3C7', borderRadius: 10, fontSize: 12, color: '#92400E' }}>
        Break-the-glass access is audited. Only open charts you are authorised to see.
      </div>
    </div>
  );
}

function PopulationPanel({ facilityId }: { facilityId: string }) {
  const snap = populationSnapshot(facilityId);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 12 }}>
      {[
        ['Registry', snap.registry],
        ['Visits today', snap.visitsToday],
        ['Waiting', snap.waiting],
        ['Orders today', snap.ordersToday],
        ['With allergy flag', snap.chronicHint],
      ].map(([l, v]) => (
        <div key={String(l)} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{l}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.text }}>{v}</div>
        </div>
      ))}
      <div style={{ gridColumn: '1 / -1', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Sex distribution (registry)</div>
        {Object.entries(snap.bySex).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <span style={{ width: 24, fontWeight: 700 }}>{k}</span>
            <div style={{ flex: 1, height: 10, background: '#F1F5F9', borderRadius: 5 }}>
              <div style={{ width: `${Math.min(100, (v / Math.max(1, snap.registry)) * 100)}%`, height: '100%', background: C.blue, borderRadius: 5 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsStudio({ facilityId }: { facilityId: string }) {
  const visits = todayVisits(facilityId);
  const orders = listOrders(facilityId);
  const byHour: Record<number, number> = {};
  for (const v of visits) {
    const h = new Date(v.checkedInAt).getHours();
    byHour[h] = (byHour[h] || 0) + 1;
  }
  const max = Math.max(1, ...Object.values(byHour));

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ fontWeight: 800, marginBottom: 4 }}>Analytics studio</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Check-ins by hour (today) · {orders.length} orders on bus</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 140 }}>
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: '100%', background: C.blue, borderRadius: '4px 4px 0 0', height: `${((byHour[h] || 0) / max) * 120}px`, minHeight: byHour[h] ? 4 : 0 }} title={`${h}:00 — ${byHour[h] || 0}`} />
            {h % 3 === 0 && <span style={{ fontSize: 9, color: C.muted }}>{h}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function SpecialtyViews({ facilityId, patient }: { facilityId: string; patient: FacilityPatient | null | undefined }) {
  const [view, setView] = useState<'maternity' | 'paeds' | 'cardiac'>('maternity');
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['maternity', 'paeds', 'cardiac'] as const).map((v) => (
          <button key={v} type="button" onClick={() => setView(v)} style={view === v ? btnPri : btnSec}>{v}</button>
        ))}
      </div>
      {view === 'maternity' && (
        <div>
          <div style={{ fontWeight: 800 }}>Maternity focus</div>
          <p style={{ fontSize: 13, color: C.muted }}>ANC visits, labour board link, gravidity/parity fields — use Maternity module for full board. Patient: {patient ? `${patient.firstName} ${patient.lastName}` : 'none selected'}.</p>
        </div>
      )}
      {view === 'paeds' && (
        <div>
          <div style={{ fontWeight: 800 }}>Paediatrics focus</div>
          <p style={{ fontSize: 13, color: C.muted }}>Growth chart hooks, immunisation — open Paediatric module for full suite. Facility {facilityId}.</p>
        </div>
      )}
      {view === 'cardiac' && (
        <div>
          <div style={{ fontWeight: 800 }}>Cardiac focus</div>
          <p style={{ fontSize: 13, color: C.muted }}>ECG/report queue via imaging orders; BP trends in vitals flowsheet.</p>
        </div>
      )}
    </div>
  );
}

function TelehealthPanel({ facilityId, session, patients, onToast }: { facilityId: string; session: UserSession; patients: FacilityPatient[]; onToast: (m: string) => void }) {
  const sessions = listTeleSessions(facilityId);
  const [pid, setPid] = useState('');

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ fontWeight: 800, marginBottom: 12 }}>Telehealth</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <select value={pid} onChange={(e) => setPid(e.target.value)} style={{ ...inp, maxWidth: 240 }}>
          <option value="">Patient…</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
        </select>
        <button type="button" style={btnPri} onClick={() => {
          const p = patients.find((x) => x.id === pid);
          if (!p) return;
          upsertTeleSession({
            id: uid('TEL'), facilityId, patientId: p.id, patientName: `${p.firstName} ${p.lastName}`,
            provider: session.name, status: 'scheduled', scheduledAt: new Date().toISOString(),
          });
          onToast('Visit scheduled');
        }}>Schedule video visit</button>
      </div>
      {sessions.map((s) => (
        <div key={s.id} style={{ display: 'flex', gap: 8, padding: '10px 0', borderBottom: `1px solid ${C.border}`, alignItems: 'center' }}>
          <Video size={16} color={C.blue} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>{s.patientName}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{s.provider} · {s.status} · {new Date(s.scheduledAt).toLocaleString()}</div>
          </div>
          {s.status !== 'ended' && (
            <button type="button" style={btnSec} onClick={() => { upsertTeleSession({ ...s, status: s.status === 'live' ? 'ended' : 'live' }); onToast(s.status === 'live' ? 'Ended' : 'Live'); }}>
              {s.status === 'live' ? 'End' : 'Start'}
            </button>
          )}
        </div>
      ))}
      {sessions.length === 0 && <div style={{ color: C.muted }}>No telehealth sessions.</div>}
    </div>
  );
}

export default ClinicalUxSuite;
