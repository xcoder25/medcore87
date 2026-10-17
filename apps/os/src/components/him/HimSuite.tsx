'use client';

/**
 * Epic/Cerner-style HIM suite: deficiency, coding, ROI, chart complete, MPI merge, document index.
 * Facility-scoped realtime via himStore.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  FileCode2,
  Share2,
  CheckCircle2,
  GitMerge,
  FolderOpen,
  Plus,
  RefreshCw,
  Shield,
} from 'lucide-react';
import type { UserSession } from '../auth/AuthScreen';
import { listPatients } from '../../lib/patientRegistryStore';
import { SearchablePatientSelect } from '../common/SearchablePatientSelect';
import {
  subscribeHim,
  himSummary,
  listDeficiencies,
  addDeficiency,
  updateDeficiency,
  listCoding,
  addCodingCase,
  updateCoding,
  listRoi,
  addRoiRequest,
  updateRoi,
  listChartGates,
  upsertChartGate,
  listMerges,
  proposeMpiMerge,
  updateMerge,
  listDocuments,
  indexDocument,
  type HimDeficiencyType,
  type HimDocType,
} from '../../lib/himStore';

type Tab = 'deficiency' | 'coding' | 'roi' | 'chart' | 'merge' | 'docs';

interface Props {
  session?: UserSession;
  onNavigate?: (k: string) => void;
  initialTab?: Tab;
}

const DEF_TYPES: { value: HimDeficiencyType; label: string }[] = [
  { value: 'unsigned_note', label: 'Unsigned note' },
  { value: 'missing_discharge_summary', label: 'Missing discharge summary' },
  { value: 'incomplete_demographics', label: 'Incomplete demographics' },
  { value: 'missing_consent', label: 'Missing consent' },
  { value: 'missing_op_report', label: 'Missing op report' },
  { value: 'other', label: 'Other' },
];

const DOC_TYPES: { value: HimDocType; label: string }[] = [
  { value: 'external_scan', label: 'External scan' },
  { value: 'referral_letter', label: 'Referral letter' },
  { value: 'consent', label: 'Consent' },
  { value: 'lab_paper', label: 'Lab (paper)' },
  { value: 'imaging_cd', label: 'Imaging CD / media' },
  { value: 'other', label: 'Other' },
];

export const HimSuite: React.FC<Props> = ({ session, initialTab }) => {
  const facilityId = session?.hospitalId || session?.facility || 'IGH-EKT';
  const actor = session?.name || session?.badgeId || 'Records';
  const [tab, setTab] = useState<Tab>(initialTab || 'deficiency');
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => subscribeHim(reload), [reload]);

  const summary = useMemo(() => himSummary(facilityId), [facilityId, tick]);
  const patients = useMemo(() => listPatients(facilityId), [facilityId, tick]);
  const deficiencies = useMemo(() => listDeficiencies(facilityId), [facilityId, tick]);
  const coding = useMemo(() => listCoding(facilityId), [facilityId, tick]);
  const roi = useMemo(() => listRoi(facilityId), [facilityId, tick]);
  const charts = useMemo(() => listChartGates(facilityId), [facilityId, tick]);
  const merges = useMemo(() => listMerges(facilityId), [facilityId, tick]);
  const docs = useMemo(() => listDocuments(facilityId), [facilityId, tick]);

  const [patientId, setPatientId] = useState('');
  const [defType, setDefType] = useState<HimDeficiencyType>('unsigned_note');
  const [defDetail, setDefDetail] = useState('');
  const [icd, setIcd] = useState('');
  const [proc, setProc] = useState('');
  const [roiRequestor, setRoiRequestor] = useState('');
  const [roiPurpose, setRoiPurpose] = useState('');
  const [roiDocs, setRoiDocs] = useState('Full chart (legal medical record)');
  const [mergeSurvivor, setMergeSurvivor] = useState('');
  const [mergeDup, setMergeDup] = useState('');
  const [mergeReason, setMergeReason] = useState('Possible duplicate MPI');
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState<HimDocType>('external_scan');

  const patientOpts = patients.map((p) => ({
    id: p.id,
    label: `${p.firstName} ${p.lastName} · ${p.hospitalNumber}`,
    name: `${p.firstName} ${p.lastName}`,
    hn: p.hospitalNumber,
  }));

  const pickPatient = (id: string) => patientOpts.find((p) => p.id === id);

  const tabs: { key: Tab; label: string; count?: number; icon: React.ReactNode }[] = [
    { key: 'deficiency', label: 'Deficiency', count: summary.defOpen, icon: <AlertTriangle size={14} /> },
    { key: 'coding', label: 'Coding', count: summary.codePending, icon: <FileCode2 size={14} /> },
    { key: 'roi', label: 'ROI', count: summary.roiOpen, icon: <Share2 size={14} /> },
    { key: 'chart', label: 'Chart complete', count: summary.chartHold, icon: <CheckCircle2 size={14} /> },
    { key: 'merge', label: 'MPI merge', count: summary.mergeOpen, icon: <GitMerge size={14} /> },
    { key: 'docs', label: 'Documents', count: summary.docs, icon: <FolderOpen size={14} /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1100 }}>
      <div
        style={{
          background: 'linear-gradient(135deg,#0F172A,#134E4A)',
          color: '#fff',
          borderRadius: 16,
          padding: '18px 20px',
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.85 }}>Health Information Management · Epic / Cerner pattern</div>
        <h2 style={{ margin: '4px 0 6px', fontSize: 22, fontWeight: 800 }}>HIM workqueues</h2>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
          Deficiency, coding, release of information, chart-complete / bill-hold, MPI merge, and document index —
          synced live across Hospital OS workstations.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            ['Open deficiencies', summary.defOpen],
            ['Coding queue', summary.codePending],
            ['ROI open', summary.roiOpen],
            ['Chart holds', summary.chartHold],
            ['Merges', summary.mergeOpen],
          ].map(([l, v]) => (
            <span
              key={String(l)}
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.12)',
              }}
            >
              {l}: {v}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 10,
              border: tab === t.key ? '1.5px solid #0D9488' : '1px solid #E2E8F0',
              background: tab === t.key ? '#F0FDFA' : '#fff',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              color: '#0F172A',
            }}
          >
            {t.icon}
            {t.label}
            {typeof t.count === 'number' && t.count > 0 && (
              <span
                style={{
                  background: '#0D9488',
                  color: '#fff',
                  borderRadius: 999,
                  padding: '1px 7px',
                  fontSize: 10,
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={reload}
          style={{
            marginLeft: 'auto',
            border: '1px solid #E2E8F0',
            borderRadius: 10,
            padding: '8px 12px',
            background: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Patient picker shared */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #E2E8F0',
          borderRadius: 12,
          padding: 12,
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>Patient / folder</span>
        <div style={{ flex: 1, minWidth: 260 }}>
          <SearchablePatientSelect
            facilityId={facilityId}
            value={patientId}
            onChange={(p) => setPatientId(p?.id || '')}
            placeholder="Type patient name or hospital number to open folder…"
          />
        </div>
      </div>

      {tab === 'deficiency' && (
        <Panel title="Chart deficiency workqueue">
          <Row>
            <select value={defType} onChange={(e) => setDefType(e.target.value as HimDeficiencyType)} style={sel}>
              {DEF_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <input
              placeholder="Detail (e.g. unsigned progress note 10 Oct)"
              value={defDetail}
              onChange={(e) => setDefDetail(e.target.value)}
              style={inp}
            />
            <button
              type="button"
              style={btn}
              onClick={() => {
                const p = pickPatient(patientId);
                if (!p || !defDetail.trim()) return;
                addDeficiency({
                  facilityId,
                  patientId: p.id,
                  patientName: p.name,
                  hospitalNumber: p.hn,
                  type: defType,
                  detail: defDetail.trim(),
                  assignedTo: actor,
                });
                setDefDetail('');
                reload();
              }}
            >
              <Plus size={14} /> Add deficiency
            </button>
          </Row>
          {deficiencies.length === 0 && <Empty>No deficiencies logged</Empty>}
          {deficiencies.map((d) => (
            <Card key={d.id}>
              <strong>
                {d.patientName} · {d.hospitalNumber}
              </strong>
              <div style={muted}>
                {DEF_TYPES.find((x) => x.value === d.type)?.label || d.type} · {d.status}
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>{d.detail}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {(['open', 'in_progress', 'resolved', 'waived'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    style={chip(d.status === s)}
                    onClick={() => {
                      updateDeficiency(
                        d.id,
                        {
                          status: s,
                          resolvedAt: s === 'resolved' || s === 'waived' ? new Date().toISOString() : undefined,
                          resolvedBy: s === 'resolved' || s === 'waived' ? actor : undefined,
                        },
                        facilityId
                      );
                      reload();
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </Panel>
      )}

      {tab === 'coding' && (
        <Panel title="Coding & abstracting (ICD-10 / procedures)">
          <Row>
            <input
              placeholder="Principal diagnosis ICD-10 (e.g. B50.9)"
              value={icd}
              onChange={(e) => setIcd(e.target.value)}
              style={inp}
            />
            <input
              placeholder="Procedure codes (comma-separated)"
              value={proc}
              onChange={(e) => setProc(e.target.value)}
              style={inp}
            />
            <button
              type="button"
              style={btn}
              onClick={() => {
                const p = pickPatient(patientId);
                if (!p) return;
                addCodingCase({
                  facilityId,
                  patientId: p.id,
                  patientName: p.name,
                  hospitalNumber: p.hn,
                  principalDiagnosis: icd.trim() || undefined,
                  procedures: proc
                    .split(',')
                    .map((x) => x.trim())
                    .filter(Boolean),
                  assignedTo: actor,
                  status: 'pending',
                });
                setIcd('');
                setProc('');
                reload();
              }}
            >
              <Plus size={14} /> Add coding case
            </button>
          </Row>
          {coding.length === 0 && <Empty>No coding cases</Empty>}
          {coding.map((c) => (
            <Card key={c.id}>
              <strong>
                {c.patientName} · {c.hospitalNumber}
              </strong>
              <div style={muted}>
                Status: {c.status} · Dx: {c.principalDiagnosis || '—'} · Px: {(c.procedures || []).join(', ') || '—'}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {(['pending', 'in_progress', 'coded', 'queried', 'final'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    style={chip(c.status === s)}
                    onClick={() => {
                      updateCoding(c.id, { status: s }, facilityId);
                      reload();
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </Panel>
      )}

      {tab === 'roi' && (
        <Panel title="Release of information (ROI)">
          <Row>
            <input
              placeholder="Requestor name / org"
              value={roiRequestor}
              onChange={(e) => setRoiRequestor(e.target.value)}
              style={inp}
            />
            <input
              placeholder="Purpose (treatment, legal, insurance…)"
              value={roiPurpose}
              onChange={(e) => setRoiPurpose(e.target.value)}
              style={inp}
            />
            <input
              placeholder="Documents requested"
              value={roiDocs}
              onChange={(e) => setRoiDocs(e.target.value)}
              style={inp}
            />
            <button
              type="button"
              style={btn}
              onClick={() => {
                const p = pickPatient(patientId);
                if (!p || !roiRequestor.trim()) return;
                addRoiRequest({
                  facilityId,
                  patientId: p.id,
                  patientName: p.name,
                  hospitalNumber: p.hn,
                  requestor: roiRequestor.trim(),
                  purpose: roiPurpose.trim() || 'Not specified',
                  documentsRequested: roiDocs.trim(),
                });
                setRoiRequestor('');
                reload();
              }}
            >
              <Plus size={14} /> Log ROI request
            </button>
          </Row>
          {roi.length === 0 && <Empty>No ROI requests</Empty>}
          {roi.map((r) => (
            <Card key={r.id}>
              <strong>
                {r.patientName} · {r.requestor}
              </strong>
              <div style={muted}>
                {r.purpose} · {r.status} · Auth: {r.authOnFile ? 'yes' : 'no'}
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>{r.documentsRequested}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  style={chip(r.authOnFile)}
                  onClick={() => {
                    updateRoi(r.id, { authOnFile: true, status: 'auth_pending' }, actor, 'Authorization on file', facilityId);
                    reload();
                  }}
                >
                  <Shield size={12} /> Auth on file
                </button>
                {(['approved', 'disclosed', 'denied', 'cancelled'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    style={chip(r.status === s)}
                    onClick={() => {
                      updateRoi(
                        r.id,
                        {
                          status: s,
                          disclosedAt: s === 'disclosed' ? new Date().toISOString() : r.disclosedAt,
                          disclosedBy: s === 'disclosed' ? actor : r.disclosedBy,
                        },
                        actor,
                        `Status → ${s}`,
                        facilityId
                      );
                      reload();
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {r.auditTrail?.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#64748B' }}>
                  Audit: {r.auditTrail.slice(-3).map((a) => `${a.action} (${a.by})`).join(' · ')}
                </div>
              )}
            </Card>
          ))}
        </Panel>
      )}

      {tab === 'chart' && (
        <Panel title="Chart complete / bill-hold">
          <Row>
            <button
              type="button"
              style={btn}
              onClick={() => {
                const p = pickPatient(patientId);
                if (!p) return;
                upsertChartGate({
                  facilityId,
                  patientId: p.id,
                  patientName: p.name,
                  hospitalNumber: p.hn,
                  status: 'him_review',
                  notes: 'Opened for HIM review',
                });
                reload();
              }}
            >
              <Plus size={14} /> Open HIM review
            </button>
            <button
              type="button"
              style={btn}
              onClick={() => {
                const p = pickPatient(patientId);
                if (!p) return;
                upsertChartGate({
                  facilityId,
                  patientId: p.id,
                  patientName: p.name,
                  hospitalNumber: p.hn,
                  status: 'complete',
                  markedCompleteBy: actor,
                  markedCompleteAt: new Date().toISOString(),
                  notes: 'Chart complete — ready for revenue cycle',
                });
                reload();
              }}
            >
              Mark chart complete
            </button>
            <button
              type="button"
              style={{ ...btn, background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}
              onClick={() => {
                const p = pickPatient(patientId);
                if (!p) return;
                upsertChartGate({
                  facilityId,
                  patientId: p.id,
                  patientName: p.name,
                  hospitalNumber: p.hn,
                  status: 'bill_hold',
                  billHoldReason: 'HIM deficiency outstanding',
                  notes: 'Bill hold until deficiency cleared',
                });
                reload();
              }}
            >
              Place bill hold
            </button>
          </Row>
          {charts.length === 0 && <Empty>No chart gates</Empty>}
          {charts.map((c) => (
            <Card key={c.id}>
              <strong>
                {c.patientName} · {c.hospitalNumber}
              </strong>
              <div style={muted}>
                {c.status}
                {c.billHoldReason ? ` · ${c.billHoldReason}` : ''}
                {c.markedCompleteBy ? ` · complete by ${c.markedCompleteBy}` : ''}
              </div>
              {c.notes && <div style={{ fontSize: 12, marginTop: 4 }}>{c.notes}</div>}
            </Card>
          ))}
        </Panel>
      )}

      {tab === 'merge' && (
        <Panel title="Duplicate MPI merge / unmerge queue">
          <Row>
            <select value={mergeSurvivor} onChange={(e) => setMergeSurvivor(e.target.value)} style={sel}>
              <option value="">Survivor (keep)…</option>
              {patientOpts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <select value={mergeDup} onChange={(e) => setMergeDup(e.target.value)} style={sel}>
              <option value="">Duplicate (retire)…</option>
              {patientOpts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <input value={mergeReason} onChange={(e) => setMergeReason(e.target.value)} style={inp} />
            <button
              type="button"
              style={btn}
              onClick={() => {
                const s = pickPatient(mergeSurvivor);
                const d = pickPatient(mergeDup);
                if (!s || !d || s.id === d.id) return;
                proposeMpiMerge({
                  facilityId,
                  survivorId: s.id,
                  survivorName: s.name,
                  survivorHn: s.hn,
                  duplicateId: d.id,
                  duplicateName: d.name,
                  duplicateHn: d.hn,
                  reason: mergeReason,
                  proposedBy: actor,
                });
                reload();
              }}
            >
              Propose merge
            </button>
          </Row>
          {merges.length === 0 && <Empty>No merge proposals</Empty>}
          {merges.map((m) => (
            <Card key={m.id}>
              <strong>
                Keep {m.survivorName} ({m.survivorHn}) ← retire {m.duplicateName} ({m.duplicateHn})
              </strong>
              <div style={muted}>
                {m.status} · {m.reason}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {(['approved', 'merged', 'rejected'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    style={chip(m.status === s)}
                    onClick={() => {
                      updateMerge(m.id, { status: s, resolvedBy: actor }, facilityId);
                      reload();
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </Panel>
      )}

      {tab === 'docs' && (
        <Panel title="Document index / external scans">
          <Row>
            <select value={docType} onChange={(e) => setDocType(e.target.value as HimDocType)} style={sel}>
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <input
              placeholder="Document title"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              style={inp}
            />
            <button
              type="button"
              style={btn}
              onClick={() => {
                const p = pickPatient(patientId);
                if (!p || !docTitle.trim()) return;
                indexDocument({
                  facilityId,
                  patientId: p.id,
                  patientName: p.name,
                  hospitalNumber: p.hn,
                  docType,
                  title: docTitle.trim(),
                  indexedBy: actor,
                });
                setDocTitle('');
                reload();
              }}
            >
              <Plus size={14} /> Index document
            </button>
          </Row>
          {docs.length === 0 && <Empty>No indexed documents</Empty>}
          {docs.map((d) => (
            <Card key={d.id}>
              <strong>
                {d.title} · {d.patientName}
              </strong>
              <div style={muted}>
                {d.docType} · {d.hospitalNumber} · by {d.indexedBy || '—'} · {new Date(d.createdAt).toLocaleString()}
              </div>
            </Card>
          ))}
        </Panel>
      )}
    </div>
  );
};

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 14 }}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, color: '#0F172A' }}>{title}</div>
      {children}
    </div>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>{children}</div>;
}
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #F1F5F9', borderRadius: 10, padding: 12, marginBottom: 8 }}>{children}</div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 16, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>{children}</div>;
}

const muted: React.CSSProperties = { fontSize: 12, color: '#64748B', marginTop: 2 };
const inp: React.CSSProperties = {
  flex: 1,
  minWidth: 140,
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  fontSize: 13,
};
const sel: React.CSSProperties = { ...inp, flex: '0 1 180px' };
const btn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 12px',
  borderRadius: 8,
  border: 'none',
  background: '#0D9488',
  color: '#fff',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
};
function chip(active: boolean): React.CSSProperties {
  return {
    padding: '4px 10px',
    borderRadius: 999,
    border: active ? '1px solid #0D9488' : '1px solid #E2E8F0',
    background: active ? '#CCFBF1' : '#F8FAFC',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    color: '#0F172A',
  };
}

export default HimSuite;
