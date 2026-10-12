'use client';

/**
 * Radiology RIS / PACS desk — worklist, viewer, imaging history, critical findings, schedule.
 * Radiology-only pages (no generic patient MPI under "imaging history").
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileText, Search, ZoomIn, ZoomOut, RotateCw, Layers, CheckCircle2, ShieldAlert,
  Eye, User, Calendar, Plus, X, Edit3, Send, Sparkles, RefreshCw, ClipboardList,
  History, AlertTriangle, Clock, Radio, LayoutDashboard, Scan, BarChart3, Phone,
} from 'lucide-react';
import type { RadiologyStudy } from '@medcore/types';
import {
  listOrders,
  subscribeOrders,
  updateOrderStatus,
  type ClinicalOrder,
} from '../../lib/clinicalEventBus';
import {
  draftImagingReport,
  hasImagingAiAssist,
  type MedGemmaModality,
} from '../../lib/medgemmaClient';
import {
  saveAssistDraft,
  getLatestAssist,
  setAssistStatus,
  subscribeMedgemmaAssist,
  type ImagingAiAssist,
} from '../../lib/medgemmaAssistStore';
import {
  fetchOrthancStudies,
  linkStudyToOrder,
  linkSimulatedStudy,
  getLinkForOrder,
  type OrthancStudyRef,
} from '../../lib/orthancClient';

type RadPage = 'worklist' | 'reading' | 'viewer' | 'history' | 'critical' | 'protocol' | 'schedule' | 'analytics';

/** Extended study fields aligned with Epic Radiant / Cerner RadNet */
type Priority = 'stat' | 'urgent' | 'routine';
type PatientClass = 'ED' | 'IP' | 'OP' | 'UC';
type ReportPhase = 'none' | 'preliminary' | 'final' | 'addendum';

interface RadStudyExt extends RadiologyStudy {
  priority?: Priority;
  patientClass?: PatientClass;
  reportPhase?: ReportPhase;
  protocol?: string;
  contrast?: string;
  doseDlp?: number;
  techNotes?: string;
  orderingProvider?: string;
  criticalFlagged?: boolean;
  criticalAcked?: boolean;
  criticalAckBy?: string;
  criticalAckAt?: string;
  comparisonAccession?: string;
}

const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string; sort: number }> = {
  stat: { label: 'STAT', color: '#DC2626', bg: '#FEF2F2', sort: 0 },
  urgent: { label: 'Urgent', color: '#D97706', bg: '#FFFBEB', sort: 1 },
  routine: { label: 'Routine', color: '#64748B', bg: '#F8FAFC', sort: 2 },
};

const CLASS_META: Record<PatientClass, { label: string; color: string }> = {
  ED: { label: 'ED', color: '#DC2626' },
  IP: { label: 'Inpatient', color: '#D97706' },
  UC: { label: 'Urgent care', color: '#2563EB' },
  OP: { label: 'Outpatient', color: '#059669' },
};

/** Structured report templates (Radiant / RadNet style) */
const REPORT_TEMPLATES: { id: string; name: string; modality: string; body: string }[] = [
  {
    id: 'xr-chest',
    name: 'Chest XR — standard',
    modality: 'XR',
    body: 'TECHNIQUE: PA and lateral chest radiographs.\n\nCOMPARISON: None available.\n\nFINDINGS:\nLungs are clear bilaterally. No focal consolidation, effusion, or pneumothorax.\nCardiomediastinal silhouette is within normal limits.\n\nIMPRESSION:\nNo acute cardiopulmonary process.',
  },
  {
    id: 'ct-head',
    name: 'CT Head — non-contrast',
    modality: 'CT',
    body: 'TECHNIQUE: Non-contrast CT head.\n\nCOMPARISON: None.\n\nFINDINGS:\nNo intracranial hemorrhage, mass effect, or midline shift.\nVentricles and cisterns are normal.\nGray-white differentiation preserved.\n\nIMPRESSION:\nNo acute intracranial abnormality.',
  },
  {
    id: 'us-abd',
    name: 'Abdomen US',
    modality: 'US',
    body: 'TECHNIQUE: Transabdominal ultrasound of the abdomen.\n\nFINDINGS:\nLiver normal in size and echotexture. No focal lesion.\nGallbladder without stones or wall thickening.\nKidneys normal bilaterally. Spleen unremarkable.\n\nIMPRESSION:\nNormal abdominal ultrasound.',
  },
  {
    id: 'mri-spine',
    name: 'Lumbar MRI',
    modality: 'MRI',
    body: 'TECHNIQUE: MRI lumbar spine without contrast.\n\nFINDINGS:\nAlignment maintained. Disc desiccation as noted. No significant central canal stenosis.\nNeural foramina patent. Cord/conus normal.\n\nIMPRESSION:\nMild degenerative changes without significant stenosis.',
  },
];

const NAV: { key: RadPage; label: string; icon: React.ElementType; badge?: string }[] = [
  { key: 'worklist', label: 'Tech worklist', icon: ClipboardList, badge: 'MWL' },
  { key: 'reading', label: 'Reading worklist', icon: Eye, badge: 'Read' },
  { key: 'viewer', label: 'PACS & report', icon: Scan, badge: 'DICOM' },
  { key: 'protocol', label: 'Protocol queue', icon: FileText },
  { key: 'history', label: 'Imaging history', icon: History },
  { key: 'critical', label: 'Critical results', icon: ShieldAlert },
  { key: 'schedule', label: 'Schedule', icon: Calendar },
  { key: 'analytics', label: 'TAT & analytics', icon: Clock },
];

const STATUS_META: Record<RadiologyStudy['status'], { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Scheduled', color: '#2563EB', bg: '#EFF6FF' },
  in_progress: { label: 'In progress', color: '#D97706', bg: '#FFFBEB' },
  acquired: { label: 'Acquired · unread', color: '#7C3AED', bg: '#F5F3FF' },
  reported: { label: 'Reported', color: '#059669', bg: '#ECFDF5' },
};

function facilityIdGuess(): string {
  try {
    return (
      localStorage.getItem('medcore_active_facility_id') ||
      localStorage.getItem('medcore_os_facility_id') ||
      'IGH-EKT'
    );
  } catch {
    return 'IGH-EKT';
  }
}

function modalityFromName(name: string): MedGemmaModality {
  const u = name.toUpperCase();
  if (u.includes('CT')) return 'CT';
  if (u.includes('MRI') || u.includes('MR ')) return 'MRI';
  if (u.includes('US') || u.includes('ULTRASOUND')) return 'US';
  if (u.includes('XR') || u.includes('X-RAY') || u.includes('XRAY') || u.includes('CHEST')) return 'XR';
  return 'OTHER';
}

const RAD_STUDIES_KEY = 'medcore_os_radiology_studies_v1';

function loadPersistedStudies(): RadiologyStudy[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RAD_STUDIES_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function persistStudies(studies: RadiologyStudy[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RAD_STUDIES_KEY, JSON.stringify(studies.slice(0, 200)));
  } catch {
    /* quota */
  }
}

function seedDemoIfEmpty(existing: RadiologyStudy[]): RadiologyStudy[] {
  if (existing.length > 0) return existing;
  const now = Date.now();
  const base: RadStudyExt[] = [
    {
      id: 'RAD-2026-0101',
      patientId: 'IGH-PT-2CKAR3',
      patientName: 'Michael James',
      modality: 'XR',
      bodyPart: 'Chest PA',
      reason: 'Cough · rule out consolidation',
      status: 'acquired',
      orderedAt: new Date(now - 2 * 3600e3).toISOString(),
      radiologist: 'Pending',
      findings: '',
      priority: 'stat',
      patientClass: 'ED',
      reportPhase: 'none',
      protocol: 'XR Chest 2 views',
      orderingProvider: 'Dr. Amara Okafor',
      contrast: 'None',
    },
    {
      id: 'RAD-2026-0102',
      patientId: 'IGH-PT-40OLLG',
      patientName: 'Chioma Etim',
      modality: 'US',
      bodyPart: 'Abdomen',
      reason: 'RUQ pain · gallstones?',
      status: 'reported',
      orderedAt: new Date(now - 26 * 3600e3).toISOString(),
      radiologist: 'Dr. Bassey Ntuen',
      findings: 'Normal abdominal ultrasound. No cholelithiasis. Liver, spleen, kidneys unremarkable.',
      priority: 'routine',
      patientClass: 'OP',
      reportPhase: 'final',
      protocol: 'US Abdomen complete',
      orderingProvider: 'Dr. Emeka Adeyemi',
    },
    {
      id: 'RAD-2026-0103',
      patientId: 'IGH-PT-YB13KN',
      patientName: 'Dahlia nen Arcade',
      modality: 'CT',
      bodyPart: 'Head',
      reason: 'Headache · trauma screen',
      status: 'in_progress',
      orderedAt: new Date(now - 45 * 60e3).toISOString(),
      radiologist: 'Pending',
      priority: 'urgent',
      patientClass: 'ED',
      reportPhase: 'none',
      protocol: 'CT Head non-contrast',
      orderingProvider: 'ED Physician',
      doseDlp: 620,
      contrast: 'None',
    },
    {
      id: 'RAD-2026-0104',
      patientId: 'IGH-PT-2CKAR3',
      patientName: 'Michael James',
      modality: 'CT',
      bodyPart: 'Chest',
      reason: 'Suspected PE',
      status: 'acquired',
      orderedAt: new Date(now - 90 * 60e3).toISOString(),
      radiologist: 'Pending',
      priority: 'stat',
      patientClass: 'IP',
      reportPhase: 'none',
      protocol: 'CTPA PE protocol',
      orderingProvider: 'Dr. Amara Okafor',
      contrast: 'IV contrast — 80 ml',
      doseDlp: 410,
      criticalFlagged: false,
    },
    {
      id: 'RAD-2026-0098',
      patientId: 'IGH-PT-2CKAR3',
      patientName: 'Michael James',
      modality: 'XR',
      bodyPart: 'Left knee',
      reason: 'Pain after fall',
      status: 'reported',
      orderedAt: new Date(now - 14 * 864e5).toISOString(),
      radiologist: 'Dr. Bassey Ntuen',
      findings: 'No fracture. Mild joint space narrowing. Soft tissues intact.',
      priority: 'routine',
      patientClass: 'OP',
      reportPhase: 'final',
    },
    {
      id: 'RAD-2026-0090',
      patientId: 'IGH-PT-40OLLG',
      patientName: 'Chioma Etim',
      modality: 'MRI',
      bodyPart: 'Lumbar spine',
      reason: 'Chronic LBP',
      status: 'reported',
      orderedAt: new Date(now - 60 * 864e5).toISOString(),
      radiologist: 'Dr. Fatima Al-Hassan',
      findings: 'L4-L5 disc desiccation without significant canal stenosis. No cord compression.',
      priority: 'routine',
      patientClass: 'OP',
      reportPhase: 'final',
      comparisonAccession: 'RAD-2025-0440',
    },
    {
      id: 'RAD-2026-0088',
      patientId: 'IGH-PT-YB13KN',
      patientName: 'Dahlia nen Arcade',
      modality: 'XR',
      bodyPart: 'Chest',
      reason: 'Fever',
      status: 'reported',
      orderedAt: new Date(now - 3 * 864e5).toISOString(),
      radiologist: 'Nathan · IGH-EKT-RAD-GO8D',
      findings: 'CRITICAL: Large right pneumothorax with mediastinal shift. Immediate clinical correlation advised.',
      priority: 'stat',
      patientClass: 'ED',
      reportPhase: 'final',
      criticalFlagged: true,
      criticalAcked: false,
    },
  ];
  return base as RadiologyStudy[];
}

export const RadiologyPacsSuite: React.FC = () => {
  const facilityId = facilityIdGuess();
  const [page, setPage] = useState<RadPage>('worklist');
  const [studies, setStudies] = useState<RadiologyStudy[]>(() => seedDemoIfEmpty(loadPersistedStudies()));
  const [busOrders, setBusOrders] = useState<ClinicalOrder[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [historyPatient, setHistoryPatient] = useState('');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [windowPreset, setWindowPreset] = useState<'lung' | 'bone' | 'soft_tissue'>('soft_tissue');
  const [findingsText, setFindingsText] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiDraft, setAiDraft] = useState<ImagingAiAssist | null>(null);
  const [orthancStudies, setOrthancStudies] = useState<OrthancStudyRef[]>([]);
  const [orthancMsg, setOrthancMsg] = useState('');
  const [modalityFilter, setModalityFilter] = useState<string>('all');

  const toast = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3200);
  }, []);

  useEffect(() => {
    persistStudies(studies);
  }, [studies]);

  const refreshBus = useCallback(() => {
    setBusOrders(listOrders(facilityId).filter((o) => o.type === 'imaging'));
  }, [facilityId]);

  useEffect(() => {
    refreshBus();
    return subscribeOrders(() => refreshBus());
  }, [refreshBus]);

  useEffect(() => subscribeMedgemmaAssist(() => {}), []);

  const selectedStudy = useMemo(
    () => studies.find((s) => s.id === selectedId) || studies.find((s) => s.status !== 'reported') || studies[0],
    [studies, selectedId]
  );

  const worklist = useMemo(() => {
    let list = studies.filter((s) => s.status !== 'reported');
    if (modalityFilter !== 'all') list = list.filter((s) => s.modality === modalityFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.patientName.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          s.bodyPart.toLowerCase().includes(q)
      );
    }
    const sorted = list.sort((a, b) => {
      const pa = PRIORITY_META[(a as RadStudyExt).priority || 'routine'].sort;
      const pb = PRIORITY_META[(b as RadStudyExt).priority || 'routine'].sort;
      if (pa !== pb) return pa - pb;
      return a.orderedAt.localeCompare(b.orderedAt); // oldest first within priority
    });
    return sorted;
  }, [studies, search, modalityFilter]);

  const readingList = useMemo(() => {
    let list = studies.filter((s) => s.status === 'acquired' || (s as RadStudyExt).reportPhase === 'preliminary');
    if (modalityFilter !== 'all') list = list.filter((s) => s.modality === modalityFilter);
    return list.sort((a, b) => {
      const pa = PRIORITY_META[(a as RadStudyExt).priority || 'routine'].sort;
      const pb = PRIORITY_META[(b as RadStudyExt).priority || 'routine'].sort;
      if (pa !== pb) return pa - pb;
      return a.orderedAt.localeCompare(b.orderedAt);
    });
  }, [studies, modalityFilter]);

  const protocolQueue = useMemo(
    () => studies.filter((s) => s.status === 'scheduled' && !(s as RadStudyExt).protocol),
    [studies]
  );

  const avgTatHours = useMemo(() => {
    const reported = studies.filter((s) => s.status === 'reported' && s.findings);
    if (!reported.length) return 0;
    // demo: approximate TAT from ordered to "now" delta capped
    const hours = reported.map((s) => Math.min(48, (Date.now() - new Date(s.orderedAt).getTime()) / 3600e3));
    return Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10;
  }, [studies]);

  const historyList = useMemo(() => {
    let list = [...studies].sort((a, b) => b.orderedAt.localeCompare(a.orderedAt));
    if (historyPatient.trim()) {
      const q = historyPatient.toLowerCase();
      list = list.filter(
        (s) =>
          s.patientName.toLowerCase().includes(q) ||
          s.patientId.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q)
      );
    }
    if (modalityFilter !== 'all') list = list.filter((s) => s.modality === modalityFilter);
    return list;
  }, [studies, historyPatient, modalityFilter]);

  const criticalList = useMemo(
    () =>
      studies.filter((s) => {
        const ext = s as RadStudyExt;
        if (ext.criticalFlagged) return true;
        const f = (s.findings || '').toLowerCase();
        return /critical|urgent|hemorrhage|pneumothorax|stroke|immediate/.test(f);
      }),
    [studies]
  );

  const scheduled = useMemo(
    () => studies.filter((s) => s.status === 'scheduled' || s.status === 'in_progress'),
    [studies]
  );

  const kpis = useMemo(() => {
    const unread = studies.filter((s) => s.status === 'acquired').length;
    const today = studies.filter((s) => s.orderedAt.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;
    const reported = studies.filter((s) => s.status === 'reported').length;
    const bus = busOrders.filter((o) => o.status === 'ordered' || o.status === 'in_progress').length;
    return { unread, today, reported, bus, total: studies.length };
  }, [studies, busOrders]);

  const openViewer = (id: string) => {
    setSelectedId(id);
    const s = studies.find((x) => x.id === id);
    setFindingsText(s?.findings || '');
    setPage('viewer');
  };

  const signReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudy) return;
    const text = findingsText.trim() || 'Normal examination. No acute pathology identified.';
    const isCritical = /critical|pneumothorax|hemorrhage|stroke|immediate/i.test(text);
    setStudies((prev) =>
      prev.map((s) =>
        s.id === selectedStudy.id
          ? ({
              ...s,
              status: 'reported' as const,
              findings: text,
              radiologist: 'Nathan · IGH-EKT-RAD-GO8D',
              reportPhase: 'final',
              criticalFlagged: isCritical || (s as RadStudyExt).criticalFlagged,
              criticalAcked: isCritical ? false : (s as RadStudyExt).criticalAcked,
            } as RadiologyStudy)
          : s
      )
    );
    setShowReport(false);
    toast(`Report signed · ${selectedStudy.id}`);
  };

  const addFromOrder = (o: ClinicalOrder) => {
    const id = `RAD-${Date.now().toString(36).toUpperCase()}`;
    const label = String(o.name || o.code || o.notes || 'Study');
    const firstTok = label.toUpperCase().split(/\s+/)[0];
    const modality = (['XR', 'CT', 'MRI', 'US', 'MAMMO'].includes(firstTok)
      ? (firstTok as RadiologyStudy['modality'])
      : 'XR');
    const study: RadiologyStudy = {
      id,
      patientId: o.patientId || 'UNK',
      patientName: o.patientName || 'Unknown',
      modality,
      bodyPart: label,
      reason: o.notes || o.name || 'Clinical indication',
      status: 'scheduled',
      orderedAt: o.createdAt || new Date().toISOString(),
      radiologist: 'Pending',
    };
    setStudies((prev) => [study, ...prev]);
    try {
      updateOrderStatus(o.id, 'in_progress');
    } catch {
      /* */
    }
    toast(`Added to worklist · ${id}`);
    setSelectedId(id);
  };

  const pullOrthanc = async () => {
    setOrthancMsg('Querying PACS…');
    try {
      const list = await fetchOrthancStudies();
      setOrthancStudies(list || []);
      setOrthancMsg(list?.length ? `${list.length} studies from Orthanc` : 'No Orthanc studies (link optional)');
    } catch {
      setOrthancMsg('Orthanc unreachable — local RIS active');
      setOrthancStudies([]);
    }
  };

  const runAiDraft = async () => {
    if (!selectedStudy) return;
    if (!hasImagingAiAssist()) {
      toast('Imaging AI assist not configured');
      return;
    }
    setAiBusy(true);
    try {
      const result = await draftImagingReport({
        modality: modalityFromName(selectedStudy.modality + ' ' + selectedStudy.bodyPart),
        bodyPart: selectedStudy.bodyPart,
        indication: selectedStudy.reason,
        patientName: selectedStudy.patientName,
      });
      setAiDraft(result as ImagingAiAssist);
      if (result?.impression || result?.findings) {
        setFindingsText([result.findings, result.impression].filter(Boolean).join('\n\n'));
      }
      toast('AI draft ready — review before sign');
    } catch {
      toast('AI draft failed');
    } finally {
      setAiBusy(false);
    }
  };

  const card: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #E2E8F0',
    borderRadius: 14,
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: 'calc(100vh - 120px)',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid #E2E8F0',
        background: '#F8FAFC',
      }}
    >
      {/* Radiology-only sidebar */}
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          background: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)',
          color: '#F8FAFC',
          padding: '16px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div style={{ padding: '4px 10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: 'rgba(124,58,237,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Layers size={18} color="#C4B5FD" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>RIS / PACS</div>
              <div style={{ fontSize: '0.62rem', opacity: 0.7 }}>Radiology only</div>
            </div>
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: '0.68rem',
              background: 'rgba(0,0,0,0.25)',
              borderRadius: 8,
              padding: '6px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Radio size={11} color="#34D399" />
            {kpis.unread} unread · {kpis.bus} bus orders
          </div>
        </div>
        {NAV.map((item) => {
          const active = page === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setPage(item.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                textAlign: 'left',
                border: 'none',
                borderRadius: 10,
                padding: '10px 12px',
                cursor: 'pointer',
                background: active ? 'rgba(124,58,237,0.35)' : 'transparent',
                color: '#F8FAFC',
                fontWeight: active ? 800 : 600,
                fontSize: '0.8rem',
              }}
            >
              <Icon size={15} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && (
                <span
                  style={{
                    fontSize: '0.58rem',
                    fontWeight: 800,
                    background: '#4C1D95',
                    color: '#E9D5FF',
                    borderRadius: 999,
                    padding: '2px 6px',
                  }}
                >
                  {item.badge}
                </span>
              )}
              {item.key === 'worklist' && kpis.unread > 0 && (
                <span
                  style={{
                    background: '#F59E0B',
                    color: '#111',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    borderRadius: 999,
                    padding: '2px 7px',
                  }}
                >
                  {kpis.unread}
                </span>
              )}
            </button>
          );
        })}
        <div style={{ marginTop: 'auto', padding: '10px 8px', fontSize: '0.62rem', opacity: 0.5 }}>
          Tech · Reading · PACS · Protocol · History · Critical · TAT
        </div>
      </aside>

      <main style={{ flex: 1, padding: 16, overflow: 'auto' }}>
        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 10, marginBottom: 14 }}>
          {[
            { l: 'Unread', v: kpis.unread, c: '#7C3AED' },
            { l: 'Today', v: kpis.today, c: '#2563EB' },
            { l: 'Reported', v: kpis.reported, c: '#059669' },
            { l: 'Bus orders', v: kpis.bus, c: '#D97706' },
            { l: 'Archive', v: kpis.total, c: '#64748B' },
          ].map((k) => (
            <div key={k.l} style={{ ...card, padding: '12px 14px', borderTop: `3px solid ${k.c}` }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{k.l}</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0F172A' }}>{k.v}</div>
            </div>
          ))}
        </div>

        {page === 'worklist' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', flex: 1 }}>Modality worklist</h2>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#94A3B8' }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Patient, accession, body part…"
                  style={{
                    padding: '9px 12px 9px 32px',
                    borderRadius: 10,
                    border: '1px solid #E2E8F0',
                    fontSize: '0.84rem',
                    minWidth: 220,
                  }}
                />
              </div>
              <select
                value={modalityFilter}
                onChange={(e) => setModalityFilter(e.target.value)}
                style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: '0.84rem' }}
              >
                <option value="all">All modalities</option>
                {['XR', 'CT', 'MRI', 'US', 'MAMMO'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => { refreshBus(); pullOrthanc(); toast('Worklist refreshed'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #E2E8F0',
                  background: '#fff', borderRadius: 10, padding: '9px 12px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                }}
              >
                <RefreshCw size={14} /> Sync
              </button>
            </div>

            {busOrders.length > 0 && (
              <div style={{ ...card, padding: 14 }}>
                <div style={{ fontWeight: 800, fontSize: '0.8rem', marginBottom: 8, color: '#7C3AED' }}>
                  Live imaging orders (clinical bus)
                </div>
                {busOrders.slice(0, 8).map((o) => (
                  <div
                    key={o.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 0', borderBottom: '1px solid #F1F5F9', gap: 10,
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.86rem' }}>{o.patientName}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{o.name || o.code || o.notes} · {o.status}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addFromOrder(o)}
                      style={{
                        background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 8,
                        padding: '7px 12px', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
                      }}
                    >
                      Add to RIS
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ ...card, overflow: 'hidden' }}>
              {worklist.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
                  <ClipboardList size={32} color="#C4B5FD" style={{ marginBottom: 8 }} />
                  <div style={{ fontWeight: 700, color: '#64748B' }}>Worklist clear</div>
                  <div style={{ fontSize: '0.82rem' }}>New imaging orders from clinicians appear here.</div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', color: '#64748B', textAlign: 'left' }}>
                      {['Pri', 'Class', 'Accession', 'Patient', 'Modality', 'Body part', 'Indication', 'Status', ''].map((h) => (
                        <th key={h} style={{ padding: '10px 12px', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {worklist.map((s) => {
                      const st = STATUS_META[s.status];
                      return (
                        <tr key={s.id} style={{ borderTop: '1px solid #F1F5F9', background: (s as RadStudyExt).priority === 'stat' ? '#FEF2F2' : undefined }}>
                          <td style={{ padding: '10px 12px' }}>
                            {(() => {
                              const p = (s as RadStudyExt).priority || 'routine';
                              const m = PRIORITY_META[p];
                              return <span style={{ background: m.bg, color: m.color, fontWeight: 800, fontSize: '0.65rem', padding: '2px 7px', borderRadius: 6 }}>{m.label}</span>;
                            })()}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, fontSize: '0.72rem', color: CLASS_META[(s as RadStudyExt).patientClass || 'OP'].color }}>
                            {(s as RadStudyExt).patientClass || 'OP'}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.75rem' }}>{s.id}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                            {s.patientName}
                            <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 500 }}>{s.patientId}</div>
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 800, color: '#7C3AED' }}>{s.modality}</td>
                          <td style={{ padding: '10px 12px' }}>{s.bodyPart}</td>
                          <td style={{ padding: '10px 12px', color: '#64748B', maxWidth: 180 }}>{s.reason}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ background: st.bg, color: st.color, fontWeight: 700, fontSize: '0.7rem', padding: '3px 8px', borderRadius: 999 }}>{st.label}</span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <button
                              type="button"
                              onClick={() => openViewer(s.id)}
                              style={{
                                background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', color: '#fff', border: 'none',
                                borderRadius: 8, padding: '7px 12px', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
                              }}
                            >
                              Open PACS
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {page === 'viewer' && (
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 12 }}>
            <div style={{ ...card, padding: 10, maxHeight: 560, overflowY: 'auto' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#7C3AED', marginBottom: 8 }}>STUDIES</div>
              {studies.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setSelectedId(s.id); setFindingsText(s.findings || ''); }}
                  style={{
                    width: '100%', textAlign: 'left', marginBottom: 6, borderRadius: 10, padding: 10, cursor: 'pointer',
                    border: selectedStudy?.id === s.id ? '2px solid #7C3AED' : '1px solid #E2E8F0',
                    background: selectedStudy?.id === s.id ? '#F5F3FF' : '#fff',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '0.82rem' }}>{s.patientName}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{s.modality} · {s.bodyPart}</div>
                </button>
              ))}
            </div>
            <div style={{ ...card, overflow: 'hidden' }}>
              {!selectedStudy ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Select a study</div>
              ) : (
                <>
                  <div style={{ background: '#0F172A', color: '#E2E8F0', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 800, color: '#C4B5FD' }}>{selectedStudy.modality}: {selectedStudy.bodyPart}</div>
                      <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{selectedStudy.patientName} · {selectedStudy.id} · {selectedStudy.reason}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button type="button" onClick={() => setZoomLevel((z) => Math.max(50, z - 15))} style={viewerBtn}><ZoomOut size={14} /></button>
                      <span style={{ fontSize: '0.75rem', minWidth: 36, textAlign: 'center' }}>{zoomLevel}%</span>
                      <button type="button" onClick={() => setZoomLevel((z) => Math.min(200, z + 15))} style={viewerBtn}><ZoomIn size={14} /></button>
                      <button type="button" onClick={() => setZoomLevel(100)} style={viewerBtn}><RotateCw size={14} /></button>
                      {(['lung', 'bone', 'soft_tissue'] as const).map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setWindowPreset(w)}
                          style={{
                            ...viewerBtn,
                            background: windowPreset === w ? 'rgba(124,58,237,0.4)' : viewerBtn.background,
                            borderColor: windowPreset === w ? '#A78BFA' : '#334155',
                          }}
                        >
                          {w.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div
                    style={{
                      height: 280,
                      background: 'radial-gradient(circle at 40% 40%, #1E293B, #020617)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(220, zoomLevel * 1.1)}px`,
                        height: `${Math.min(220, zoomLevel * 1.1)}px`,
                        borderRadius: 8,
                        border: '2px solid #475569',
                        background:
                          windowPreset === 'bone'
                            ? 'linear-gradient(135deg,#e2e8f0,#64748b)'
                            : windowPreset === 'lung'
                              ? 'linear-gradient(135deg,#0f172a,#334155)'
                              : 'linear-gradient(135deg,#475569,#94a3b8)',
                        boxShadow: '0 0 40px rgba(124,58,237,0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#CBD5E1',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      DICOM preview
                    </div>
                    <div style={{ position: 'absolute', bottom: 10, left: 12, fontSize: '0.7rem', color: '#64748B' }}>
                      Window: {windowPreset} · Simulated viewer (Orthanc optional)
                    </div>
                  </div>
                  <div style={{ padding: 14 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setShowReport(true)}
                        style={{
                          background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', color: '#fff', border: 'none',
                          borderRadius: 10, padding: '10px 14px', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer',
                        }}
                      >
                        <Edit3 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                        Report / sign
                      </button>
                      <button
                        type="button"
                        disabled={aiBusy}
                        onClick={runAiDraft}
                        style={{
                          border: '1px solid #DDD6FE', background: '#F5F3FF', color: '#5B21B6',
                          borderRadius: 10, padding: '10px 14px', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer',
                        }}
                      >
                        <Sparkles size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                        {aiBusy ? 'Drafting…' : 'AI draft'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setHistoryPatient(selectedStudy.patientName); setPage('history'); }}
                        style={{
                          border: '1px solid #E2E8F0', background: '#fff', color: '#475569',
                          borderRadius: 10, padding: '10px 14px', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer',
                        }}
                      >
                        <History size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                        Patient history
                      </button>
                    </div>
                    {selectedStudy.findings && (
                      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 12, fontSize: '0.84rem', color: '#334155' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.72rem', color: '#7C3AED', marginBottom: 4 }}>PRIOR / CURRENT FINDINGS</div>
                        {selectedStudy.findings}
                        <div style={{ marginTop: 6, fontSize: '0.72rem', color: '#94A3B8' }}>{selectedStudy.radiologist}</div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {page === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Imaging history</h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748B' }}>
                Prior studies by patient · accession · modality (not patient registration)
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#94A3B8' }} />
                <input
                  value={historyPatient}
                  onChange={(e) => setHistoryPatient(e.target.value)}
                  placeholder="Filter by patient name or hospital number…"
                  style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: '0.84rem' }}
                />
              </div>
              <select
                value={modalityFilter}
                onChange={(e) => setModalityFilter(e.target.value)}
                style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: '0.84rem' }}
              >
                <option value="all">All modalities</option>
                {['XR', 'CT', 'MRI', 'US', 'MAMMO'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div style={{ ...card, overflow: 'hidden' }}>
              {historyList.length === 0 ? (
                <div style={{ padding: 36, textAlign: 'center', color: '#94A3B8' }}>
                  <History size={28} color="#C4B5FD" style={{ marginBottom: 8 }} />
                  <div style={{ fontWeight: 700 }}>No imaging studies match</div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#F5F3FF', color: '#5B21B6', textAlign: 'left' }}>
                      {['Date', 'Accession', 'Patient', 'Study', 'Status', 'Report'].map((h) => (
                        <th key={h} style={{ padding: '10px 12px', fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historyList.map((s) => (
                      <tr
                        key={s.id}
                        style={{ borderTop: '1px solid #F1F5F9', cursor: 'pointer' }}
                        onClick={() => openViewer(s.id)}
                      >
                        <td style={{ padding: '10px 12px', color: '#64748B', whiteSpace: 'nowrap' }}>
                          {new Date(s.orderedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.75rem' }}>{s.id}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                          {s.patientName}
                          <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 500 }}>{s.patientId}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontWeight: 800, color: '#7C3AED' }}>{s.modality}</span> {s.bodyPart}
                          <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{s.reason}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            background: STATUS_META[s.status].bg,
                            color: STATUS_META[s.status].color,
                            fontWeight: 700, fontSize: '0.7rem', padding: '3px 8px', borderRadius: 999,
                          }}>{STATUS_META[s.status].label}</span>
                        </td>
                        <td style={{ padding: '10px 12px', maxWidth: 220, color: '#475569', fontSize: '0.78rem' }}>
                          {s.findings ? (
                            <>
                              {(s.findings || '').slice(0, 90)}{(s.findings || '').length > 90 ? '…' : ''}
                              <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: 2 }}>{s.radiologist}</div>
                            </>
                          ) : (
                            <span style={{ color: '#94A3B8' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        
        {page === 'reading' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Reading worklist</h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748B' }}>
                Epic Radiant–style unread queue · STAT first · then ED / IP / OP
              </p>
            </div>
            <div style={{ ...card, overflow: 'hidden' }}>
              {readingList.length === 0 ? (
                <div style={{ padding: 36, textAlign: 'center', color: '#94A3B8' }}>No studies waiting for interpretation</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#F5F3FF', color: '#5B21B6', textAlign: 'left' }}>
                      {['Pri', 'Class', 'Accession', 'Patient', 'Exam', 'Ordered', ''].map((h) => (
                        <th key={h} style={{ padding: '10px 12px', fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {readingList.map((s) => {
                      const ext = s as RadStudyExt;
                      const pri = PRIORITY_META[ext.priority || 'routine'];
                      return (
                        <tr key={s.id} style={{ borderTop: '1px solid #F1F5F9', background: ext.priority === 'stat' ? '#FEF2F2' : undefined }}>
                          <td style={{ padding: '10px 12px' }}><span style={{ background: pri.bg, color: pri.color, fontWeight: 800, fontSize: '0.65rem', padding: '2px 7px', borderRadius: 6 }}>{pri.label}</span></td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: CLASS_META[ext.patientClass || 'OP'].color }}>{ext.patientClass || 'OP'}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.75rem' }}>{s.id}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 700 }}>{s.patientName}</td>
                          <td style={{ padding: '10px 12px' }}>{s.modality} · {s.bodyPart}</td>
                          <td style={{ padding: '10px 12px', color: '#64748B' }}>{new Date(s.orderedAt).toLocaleString()}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <button type="button" onClick={() => openViewer(s.id)} style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>
                              Open &amp; report
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {page === 'protocol' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Protocol queue</h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748B' }}>
                Assign acquisition protocol before modality (Radiant Protocol Work List)
              </p>
            </div>
            {studies.filter((s) => s.status === 'scheduled' || s.status === 'in_progress').map((s) => {
              const ext = s as RadStudyExt;
              return (
                <div key={s.id} style={{ ...card, padding: 14, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{s.patientName} · {s.modality} {s.bodyPart}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748B' }}>{s.reason} · Ordered by {ext.orderingProvider || '—'}</div>
                    <div style={{ fontSize: '0.78rem', marginTop: 4, color: '#5B21B6', fontWeight: 600 }}>Protocol: {ext.protocol || 'Not assigned'}</div>
                  </div>
                  <select
                    value={ext.protocol || ''}
                    onChange={(e) => {
                      const protocol = e.target.value;
                      setStudies((prev) => prev.map((x) => x.id === s.id ? { ...x, protocol } as RadiologyStudy : x));
                      toast(`Protocol set · ${protocol}`);
                    }}
                    style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.8rem', maxWidth: 220 }}
                  >
                    <option value="">Select protocol…</option>
                    <option value="XR Chest 2 views">XR Chest 2 views</option>
                    <option value="CT Head non-contrast">CT Head non-contrast</option>
                    <option value="CTPA PE protocol">CTPA PE protocol</option>
                    <option value="US Abdomen complete">US Abdomen complete</option>
                    <option value="MRI Lumbar without contrast">MRI Lumbar without contrast</option>
                    <option value="Mammography screening">Mammography screening</option>
                  </select>
                </div>
              );
            })}
          </div>
        )}

        {page === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>TAT &amp; analytics</h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748B' }}>
                Radiant-style operational metrics · turnaround · modality mix
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
              {[
                { l: 'Avg report TAT (h)', v: avgTatHours || '—', c: '#7C3AED' },
                { l: 'Unread backlog', v: kpis.unread, c: '#DC2626' },
                { l: 'Reported', v: kpis.reported, c: '#059669' },
                { l: 'STAT in queue', v: studies.filter((s) => (s as RadStudyExt).priority === 'stat' && s.status !== 'reported').length, c: '#EA580C' },
              ].map((k) => (
                <div key={k.l} style={{ ...card, padding: 14, borderTop: `3px solid ${k.c}` }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{k.l}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{k.v}</div>
                </div>
              ))}
            </div>
            <div style={{ ...card, padding: 16 }}>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: 12 }}>Modality volume</div>
              {['XR', 'CT', 'MRI', 'US', 'MAMMO'].map((m) => {
                const n = studies.filter((s) => s.modality === m).length;
                const pct = studies.length ? Math.round((n / studies.length) * 100) : 0;
                return (
                  <div key={m} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700 }}>{m}</span>
                      <span style={{ color: '#64748B' }}>{n} · {pct}%</span>
                    </div>
                    <div style={{ height: 8, background: '#F1F5F9', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#7C3AED,#A78BFA)', borderRadius: 999 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {page === 'critical' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Critical results · closed loop</h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748B' }}>
              Radiant / RadNet style · flag → notify ordering provider → acknowledge
            </p>
            {criticalList.length === 0 ? (
              <div style={{ ...card, padding: 32, textAlign: 'center' }}>
                <CheckCircle2 size={28} color="#10B981" />
                <div style={{ fontWeight: 700, color: '#059669', marginTop: 8 }}>No critical queue items</div>
              </div>
            ) : (
              criticalList.map((s) => (
                <div
                  key={s.id}
                  style={{ ...card, padding: 14, borderLeft: '4px solid #DC2626', display: 'flex', justifyContent: 'space-between', gap: 12 }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>{s.patientName} · {s.modality} {s.bodyPart}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748B' }}>{s.id} · {STATUS_META[s.status].label}</div>
                    {s.findings && <div style={{ fontSize: '0.82rem', marginTop: 6, color: '#334155' }}>{s.findings}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button type="button" onClick={() => openViewer(s.id)} style={{
                      background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px',
                      fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                    }}>Review</button>
                    {(s as RadStudyExt).criticalFlagged && !(s as RadStudyExt).criticalAcked && (
                      <button
                        type="button"
                        onClick={() => {
                          setStudies((prev) => prev.map((x) => x.id === s.id ? {
                            ...x,
                            criticalAcked: true,
                            criticalAckBy: 'Ordering provider',
                            criticalAckAt: new Date().toISOString(),
                          } as RadiologyStudy : x));
                          toast('Critical result acknowledged · loop closed');
                        }}
                        style={{
                          border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C',
                          borderRadius: 8, padding: '7px 10px', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer',
                        }}
                      >
                        Mark acknowledged
                      </button>
                    )}
                    {(s as RadStudyExt).criticalAcked && (
                      <span style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 700 }}>✓ Acknowledged</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {page === 'schedule' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Imaging schedule</h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748B' }}>Scheduled and in-progress exams</p>
            <div style={{ ...card, overflow: 'hidden' }}>
              {scheduled.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8' }}>No scheduled slots</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', textAlign: 'left', color: '#64748B' }}>
                      {['When', 'Patient', 'Exam', 'Status'].map((h) => (
                        <th key={h} style={{ padding: '10px 12px', fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scheduled.map((s) => (
                      <tr key={s.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '10px 12px' }}>{new Date(s.orderedAt).toLocaleString()}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>{s.patientName}</td>
                        <td style={{ padding: '10px 12px' }}>{s.modality} · {s.bodyPart}</td>
                        <td style={{ padding: '10px 12px' }}>{STATUS_META[s.status].label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <button type="button" onClick={pullOrthanc} style={{
              alignSelf: 'flex-start', border: '1px solid #E2E8F0', background: '#fff', borderRadius: 10,
              padding: '10px 14px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
            }}>
              Query Orthanc PACS
            </button>
            {orthancMsg && <div style={{ fontSize: '0.78rem', color: '#64748B' }}>{orthancMsg}</div>}
          </div>
        )}
      </main>

      {notice && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 99999, background: '#4C1D95', color: '#fff',
          padding: '12px 16px', borderRadius: 12, fontWeight: 600, fontSize: '0.86rem',
          boxShadow: '0 12px 32px rgba(76,29,149,0.35)',
        }}>
          {notice}
        </div>
      )}

      {showReport && selectedStudy && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 99990, background: 'rgba(15,23,42,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
          onClick={() => setShowReport(false)}
        >
          <form
            onSubmit={signReport}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, padding: 22,
              border: '1px solid #E9D5FF', boxShadow: '0 24px 48px rgba(76,29,149,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontWeight: 800, color: '#5B21B6' }}>Report · {selectedStudy.id}</h3>
              <button type="button" onClick={() => setShowReport(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#64748B', marginBottom: 10 }}>
              {selectedStudy.patientName} · {selectedStudy.modality} {selectedStudy.bodyPart}
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#5B21B6' }}>Structured template</label>
              <select
                onChange={(e) => {
                  const t = REPORT_TEMPLATES.find((x) => x.id === e.target.value);
                  if (t) setFindingsText(t.body);
                }}
                defaultValue=""
                style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #E9D5FF', fontSize: '0.84rem' }}
              >
                <option value="">Select template (optional)…</option>
                {REPORT_TEMPLATES.filter((t) => !selectedStudy || t.modality === selectedStudy.modality || t.modality === 'XR').map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <textarea
              value={findingsText}
              onChange={(e) => setFindingsText(e.target.value)}
              rows={8}
              placeholder="Findings and impression…"
              style={{ width: '100%', borderRadius: 10, border: '1px solid #E2E8F0', padding: 12, fontSize: '0.88rem', resize: 'vertical' }}
            />
            <p style={{ margin: '8px 0 0', fontSize: '0.72rem', color: '#94A3B8' }}>
              Preliminary → Final · Critical language auto-flags closed-loop notification
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button type="button" onClick={() => setShowReport(false)} style={{ border: '1px solid #E2E8F0', background: '#fff', borderRadius: 10, padding: '9px 14px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button type="submit" style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 16px', fontWeight: 700, cursor: 'pointer' }}>
                Sign &amp; save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const viewerBtn: React.CSSProperties = {
  border: '1px solid #334155',
  background: 'rgba(30,41,59,0.8)',
  color: '#E2E8F0',
  borderRadius: 6,
  padding: '4px 8px',
  cursor: 'pointer',
  fontSize: '0.68rem',
};

export default RadiologyPacsSuite;
