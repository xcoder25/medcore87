'use client';

/**
 * Maternity EMR Desk — Epic Stork + Cerner PowerChart parity
 * L&D Grease Board · MFTI Triage · Partograph · Delivery Summary · Newborn link · PPH/QBL
 * Maternity-only sidebar. Realtime via maternityStore + CTG pulse + WebSocket.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Baby, BedDouble, BookOpen, CalendarHeart, CheckCircle2,
  ClipboardList, Heart, HeartPulse, LayoutDashboard, Plus, RefreshCw,
  Siren, Users, X, Award, Radio,
} from 'lucide-react';
import { SharedBedStrip } from '../beds/SharedBedStrip';
import { useRealtimeEvents } from '../../hooks/useRealtimeEvents';
import { getActiveFacilityId } from '../../lib/adminRealtimeStore';
import {
  listMaternity, upsertMaternity, subscribeMaternity, pulseActiveLabour,
  maternityKpis, newMaternityId, newNewbornId,
  MFTI_META, STAGE_LABEL, MODE_LABEL,
  type MaternityRecord, type MatRisk, type MatStage, type DeliveryMode,
  type MftiLevel, type GbsStatus, type RomStatus,
} from '../../lib/maternityStore';
import { buildAncPlan, computeEddFromLmp, gaWeeksFromLmp } from '../../lib/ancNpiSms';

type MatPage =
  | 'grease' | 'anc' | 'triage' | 'labour' | 'delivery' | 'postnatal' | 'beds' | 'emergency' | 'register';

const NAV: { key: MatPage; label: string; icon: React.ElementType; badge?: string }[] = [
  { key: 'grease', label: 'L&D Grease Board', icon: LayoutDashboard, badge: 'Live' },
  { key: 'anc', label: 'Prenatal / ANC', icon: CalendarHeart },
  { key: 'triage', label: 'OB Triage (MFTI)', icon: ClipboardList },
  { key: 'labour', label: 'Labour & Partograph', icon: HeartPulse, badge: 'CTG' },
  { key: 'delivery', label: 'Delivery Summary', icon: Baby },
  { key: 'postnatal', label: 'Postpartum', icon: Heart },
  { key: 'beds', label: 'Maternity Beds', icon: BedDouble },
  { key: 'emergency', label: 'OB Emergency', icon: Siren },
  { key: 'register', label: 'Birth Register', icon: BookOpen },
];

const RISK_META: Record<MatRisk, { label: string; color: string; bg: string; border: string }> = {
  low: { label: 'Low risk', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
  moderate: { label: 'Moderate', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  high: { label: 'High risk', color: '#EA580C', bg: '#FFF7ED', border: '#FDBA74' },
  critical: { label: 'Critical', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
};

function riskFromFhr(fhr: number, base: MatRisk = 'low'): MatRisk {
  if (fhr > 160 || fhr < 110) return 'critical';
  if (fhr > 155 || fhr < 120) return 'high';
  return base;
}

const card: React.CSSProperties = {
  background: '#FFFFFF', border: '1px solid #FCE7F3', borderRadius: 14,
  boxShadow: '0 1px 2px rgba(190, 24, 93, 0.04)',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #FBCFE8',
  fontSize: '0.86rem', background: '#FFF', outline: 'none', color: '#0F172A',
};
const labelStyle: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 700, color: '#9D174D', display: 'block',
  marginBottom: 4, letterSpacing: '0.02em',
};

export const MaternityOgSuite: React.FC = () => {
  const facilityId = (typeof window !== 'undefined' && getActiveFacilityId()) || 'IGH-EKT';

  const [page, setPage] = useState<MatPage>('grease');
  const [records, setRecords] = useState<MaternityRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [liveTick, setLiveTick] = useState(0);

  const [showAncModal, setShowAncModal] = useState(false);
  const [showTriageModal, setShowTriageModal] = useState(false);
  const [showLabourAdmit, setShowLabourAdmit] = useState(false);
  const [showPartograph, setShowPartograph] = useState(false);
  const [showDelivery, setShowDelivery] = useState(false);

  const [ancName, setAncName] = useState('');
  const [ancPhone, setAncPhone] = useState('');
  const [ancGp, setAncGp] = useState('G1P0');
  const [ancLmp, setAncLmp] = useState('');
  const [ancAge, setAncAge] = useState('28');
  const [ancBg, setAncBg] = useState('O+');
  const [ancGbs, setAncGbs] = useState<GbsStatus>('unknown');

  const [triName, setTriName] = useState('');
  const [triGp, setTriGp] = useState('G2P1');
  const [triMfti, setTriMfti] = useState<MftiLevel>(3);
  const [triChief, setTriChief] = useState('Labour pains');
  const [triGa, setTriGa] = useState('39');

  const [labName, setLabName] = useState('');
  const [labGp, setLabGp] = useState('G2P1 (39 wks)');
  const [labDil, setLabDil] = useState('3');
  const [labEff, setLabEff] = useState('50');
  const [labSta, setLabSta] = useState('-2');
  const [labFhr, setLabFhr] = useState('140');
  const [labCtx, setLabCtx] = useState('3');
  const [labBed, setLabBed] = useState('MT-03');
  const [labRom, setLabRom] = useState<RomStatus>('intact');

  const [editDil, setEditDil] = useState('6');
  const [editEff, setEditEff] = useState('80');
  const [editSta, setEditSta] = useState('0');
  const [editFhr, setEditFhr] = useState('140');
  const [editCtx, setEditCtx] = useState('4');
  const [editBp, setEditBp] = useState('120/80');
  const [editNotes, setEditNotes] = useState('');

  const [delMode, setDelMode] = useState<DeliveryMode>('svd');
  const [delGender, setDelGender] = useState<'Male' | 'Female'>('Female');
  const [delWeight, setDelWeight] = useState('3.2');
  const [delApgar1, setDelApgar1] = useState('9');
  const [delApgar5, setDelApgar5] = useState('10');
  const [delEbl, setDelEbl] = useState('250');
  const [delLac, setDelLac] = useState('None');

  const toast = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3200);
  }, []);

  const refresh = useCallback(() => {
    setRecords(listMaternity(facilityId));
    setLiveTick((t) => t + 1);
  }, [facilityId]);

  useEffect(() => {
    refresh();
    return subscribeMaternity(refresh);
  }, [refresh]);

  useEffect(() => {
    const iv = setInterval(() => {
      pulseActiveLabour(facilityId);
      refresh();
    }, 6000);
    return () => clearInterval(iv);
  }, [facilityId, refresh]);

  const { connected } = useRealtimeEvents({
    app: 'MEDCORE_OS_MATERNITY',
    facilityId,
    topics: ['STAFF_*', 'PRESENCE_*', 'BED_*', 'MATERNITY_*', 'VITALS_*', '*'],
    onEvent: (evt) => {
      const t = evt.topic || '';
      if (/MATERNITY|LABOUR|CTG|BED|VITALS|STORK/i.test(t)) {
        refresh();
        toast(`Live · ${t.replace(/_/g, ' ').toLowerCase()}`);
      }
    },
  });

  const selected = useMemo(
    () => records.find((r) => r.id === selectedId) || records[0],
    [records, selectedId]
  );
  const kpis = useMemo(() => maternityKpis(facilityId), [facilityId, records, liveTick]);
  const labourCases = useMemo(
    () => records.filter((r) => ['admitted_labour', 'active_labour', 'second_stage', 'triage'].includes(r.stage)),
    [records]
  );
  const ancCases = useMemo(() => records.filter((r) => r.stage === 'anc'), [records]);
  const triageCases = useMemo(() => records.filter((r) => r.stage === 'triage'), [records]);
  const postnatalCases = useMemo(
    () => records.filter((r) => r.stage === 'postnatal' || r.stage === 'delivered'),
    [records]
  );
  const emergencyCases = useMemo(
    () => records.filter((r) =>
      r.risk === 'critical' || r.risk === 'high' || r.pph || r.mfti === 1 || r.mfti === 2 || r.deliveryMode === 'emergency_cs'
    ),
    [records]
  );
  const births = useMemo(
    () => records.filter((r) => r.delivered).sort((a, b) => (b.deliveryAt || '').localeCompare(a.deliveryAt || '')),
    [records]
  );

  const handleAncBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ancName.trim()) return;
    const lmp = ancLmp || new Date(Date.now() - 20 * 7 * 864e5).toISOString().slice(0, 10);
    const edd = computeEddFromLmp(lmp);
    const ga = gaWeeksFromLmp(lmp);
    const rec: MaternityRecord = {
      id: newMaternityId(), facilityId, patientName: ancName.trim(), phone: ancPhone || undefined,
      age: parseInt(ancAge) || undefined, gravidaPara: ancGp, lmp, edd, gaWeeks: ga,
      bloodGroup: ancBg, gbs: ancGbs, risk: ga < 28 && Math.random() > 0.85 ? 'moderate' : 'low',
      stage: 'anc', partograph: [], midwifeOnDuty: 'ANC Midwife', pphRisk: 'low',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    upsertMaternity(rec);
    try { buildAncPlan({ facilityId, patientId: rec.id, patientName: rec.patientName, lmp, gaWeeks: ga }); } catch { /* */ }
    setShowAncModal(false); setAncName(''); setSelectedId(rec.id); refresh();
    toast(`Prenatal chart · ${rec.patientName} · EDD ${edd}`);
  };

  const handleTriage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!triName.trim()) return;
    const risk: MatRisk = triMfti <= 2 ? 'critical' : triMfti === 3 ? 'high' : triMfti === 4 ? 'moderate' : 'low';
    const rec: MaternityRecord = {
      id: newMaternityId(), facilityId, patientName: triName.trim(), gravidaPara: triGp,
      gaWeeks: parseInt(triGa) || 39, mfti: triMfti, risk, stage: 'triage', notes: triChief,
      partograph: [], midwifeOnDuty: 'Triage Midwife',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    upsertMaternity(rec); setShowTriageModal(false); setTriName(''); setSelectedId(rec.id); setPage('triage'); refresh();
    toast(`OB triage · MFTI ${triMfti} · ${rec.patientName}`);
  };

  const handleLabourAdmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!labName.trim()) return;
    const fhr = parseInt(labFhr) || 140;
    const dil = parseFloat(labDil) || 3;
    const rec: MaternityRecord = {
      id: newMaternityId(), facilityId, patientName: labName.trim(), gravidaPara: labGp,
      cervicalDilationCm: dil, effacementPct: parseInt(labEff) || 50, station: parseInt(labSta) || -2,
      fetalHeartRateBpm: fhr, contractionsPer10Min: parseInt(labCtx) || 3, romStatus: labRom,
      romAt: labRom !== 'intact' ? new Date().toISOString() : undefined, bedNo: labBed,
      risk: riskFromFhr(fhr), stage: dil >= 4 ? 'active_labour' : 'admitted_labour',
      partograph: [{ at: new Date().toISOString(), dilationCm: dil, effacementPct: parseInt(labEff) || 50, station: parseInt(labSta) || -2, fhrBpm: fhr, contractionsPer10Min: parseInt(labCtx) || 3 }],
      midwifeOnDuty: 'Labour Midwife on duty', pphRisk: 'medium',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    upsertMaternity(rec); setShowLabourAdmit(false); setLabName(''); setSelectedId(rec.id); setPage('labour'); refresh();
    toast(`L&D admit · ${rec.patientName} · Bed ${labBed}`);
  };

  const handlePartograph = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const dil = parseFloat(editDil) || selected.cervicalDilationCm || 0;
    const fhr = parseInt(editFhr) || selected.fetalHeartRateBpm || 140;
    const ctx = parseInt(editCtx) || selected.contractionsPer10Min || 3;
    const point = {
      at: new Date().toISOString(), dilationCm: dil,
      effacementPct: parseInt(editEff) || selected.effacementPct,
      station: parseInt(editSta) || selected.station, fhrBpm: fhr, contractionsPer10Min: ctx,
      bp: editBp, notes: editNotes || undefined,
    };
    const next: MaternityRecord = {
      ...selected, cervicalDilationCm: dil, effacementPct: point.effacementPct, station: point.station,
      fetalHeartRateBpm: fhr, contractionsPer10Min: ctx, risk: riskFromFhr(fhr, selected.risk),
      stage: dil >= 10 ? 'second_stage' : dil >= 4 ? 'active_labour' : selected.stage,
      partograph: [...(selected.partograph || []), point], updatedAt: new Date().toISOString(),
    };
    upsertMaternity(next); setShowPartograph(false); setEditNotes(''); refresh();
    toast(`Partograph · ${dil} cm · Sta ${point.station} · FHR ${fhr}`);
  };

  const handleDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const nbId = newNewbornId();
    const wt = parseFloat(delWeight) || 3.2;
    const next: MaternityRecord = {
      ...selected, delivered: true, deliveryMode: delMode, deliveryAt: new Date().toISOString(),
      placentaAt: new Date().toISOString(), babyGender: delGender, birthWeightKg: wt,
      birthWeightG: Math.round(wt * 1000), apgar1: parseInt(delApgar1) || 9, apgar5: parseInt(delApgar5) || 10,
      eblMl: parseInt(delEbl) || 250, qblMl: parseInt(delEbl) || 250, laceration: delLac,
      skinToSkin: true, newbornId: nbId, stage: 'postnatal', postnatalDay: 0, breastfeeding: true,
      risk: delMode === 'emergency_cs' ? 'high' : selected.risk === 'critical' ? 'moderate' : selected.risk,
      updatedAt: new Date().toISOString(),
    };
    upsertMaternity(next); setShowDelivery(false); setPage('delivery'); refresh();
    toast(`Delivery · NB ${nbId} · ${delGender} · ${wt} kg · APGAR ${delApgar1}/${delApgar5}`);
  };

  const flagPph = (id: string) => {
    const r = records.find((x) => x.id === id);
    if (!r) return;
    upsertMaternity({ ...r, pph: true, risk: 'critical', pphRisk: 'high', updatedAt: new Date().toISOString() });
    refresh();
    toast(`⚠ PPH protocol · ${r.patientName}`);
  };

  const RiskPill = ({ risk }: { risk: MatRisk }) => {
    const m = RISK_META[risk];
    return (
      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: m.color, background: m.bg, border: `1px solid ${m.border}`, borderRadius: 999, padding: '3px 10px' }}>{m.label}</span>
    );
  };

  const MftiPill = ({ level }: { level?: MftiLevel }) => {
    if (!level) return null;
    const m = MFTI_META[level];
    return (
      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: m.color, background: m.bg, borderRadius: 999, padding: '3px 10px' }}>{m.label}</span>
    );
  };

  const Empty = ({ text, action }: { text: string; action?: () => void }) => (
    <div style={{ ...card, padding: 40, textAlign: 'center', color: '#94A3B8' }}>
      <Baby size={36} color="#F9A8D4" style={{ marginBottom: 12 }} />
      <div style={{ fontWeight: 600, color: '#64748B', marginBottom: 8 }}>{text}</div>
      {action && (
        <button type="button" onClick={action} style={{ marginTop: 8, background: 'linear-gradient(135deg, #DB2777, #EC4899)', color: '#FFF', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer' }}>
          <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Add
        </button>
      )}
    </div>
  );

  const primaryBtn = (label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} style={{ background: 'linear-gradient(135deg, #DB2777, #EC4899)', color: '#FFF', border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
      <Plus size={16} />{label}
    </button>
  );

  const PageShell = ({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#831843', fontWeight: 800 }}>{title}</h2>
        <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#94A3B8' }}>{sub}</p>
      </div>
      {children}
    </div>
  );

  const boardAll = labourCases.length ? labourCases : records.filter((r) => r.stage !== 'anc' && r.stage !== 'discharged');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minHeight: 'calc(100vh - 120px)', background: 'linear-gradient(180deg, #FFF5F9 0%, #F8FAFC 42%)', borderRadius: 16, overflow: 'hidden', border: '1px solid #FCE7F3' }}>
      {/* Unified top command bar (no second sidebar) */}
      <div style={{ background: 'linear-gradient(90deg, #831843 0%, #9D174D 40%, #BE185D 100%)', color: '#FFF', padding: '12px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Baby size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.01em' }}>Maternity · Labour & CTG</div>
              <div style={{ fontSize: '0.68rem', opacity: 0.8 }}>Epic Stork / Cerner PowerChart parity · single desk</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', background: 'rgba(0,0,0,0.18)', borderRadius: 999, padding: '5px 10px' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? '#4ADE80' : '#FBBF24', boxShadow: connected ? '0 0 6px #4ADE80' : 'none' }} />
              {connected ? 'Gateway live' : 'Local realtime'}
            </span>
            <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>{records.length} OB · CTG 6s</span>
            <button type="button" onClick={() => { pulseActiveLabour(facilityId); refresh(); toast('Board synced'); }} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.12)', color: '#FFF', borderRadius: 8, padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
              <RefreshCw size={13} /> Sync
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 0, scrollbarWidth: 'thin' }}>
          {NAV.map((item) => {
            const active = page === item.key;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setPage(item.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
                  border: 'none', borderRadius: '10px 10px 0 0', padding: '10px 14px', cursor: 'pointer',
                  background: active ? '#FFF5F9' : 'transparent',
                  color: active ? '#831843' : 'rgba(255,255,255,0.92)',
                  fontWeight: active ? 800 : 600, fontSize: '0.78rem',
                }}
              >
                <Icon size={14} strokeWidth={active ? 2.5 : 2} />
                {item.label}
                {item.badge && (
                  <span style={{ background: item.badge === 'Live' ? '#4ADE80' : '#F9A8D4', color: item.badge === 'Live' ? '#14532D' : '#831843', fontSize: '0.58rem', fontWeight: 800, borderRadius: 999, padding: '2px 6px' }}>{item.badge}</span>
                )}
                {item.key === 'labour' && kpis.inLabour > 0 && (
                  <span style={{ background: active ? '#BE185D' : '#FFF', color: active ? '#FFF' : '#BE185D', fontSize: '0.62rem', fontWeight: 800, borderRadius: 999, padding: '2px 6px' }}>{kpis.inLabour}</span>
                )}
                {item.key === 'emergency' && kpis.critical > 0 && (
                  <span style={{ background: '#FEE2E2', color: '#DC2626', fontSize: '0.62rem', fontWeight: 800, borderRadius: 999, padding: '2px 6px' }}>{kpis.critical}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <main style={{ flex: 1, padding: '18px 20px', overflow: 'auto', background: 'linear-gradient(180deg, #FFF5F9 0%, #FFFFFF 30%)' }}>
        {page === 'grease' && (
          <PageShell title="L&D Grease Board" sub="Epic Stork · Cerner Tracking Shell · live status">
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
              {primaryBtn('OB Triage', () => setShowTriageModal(true))}
              {primaryBtn('Admit labour', () => setShowLabourAdmit(true))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 14 }}>
              {[
                { label: 'In labour', value: kpis.inLabour, color: '#DB2777' },
                { label: 'Triage', value: kpis.triage, color: '#D97706' },
                { label: 'Deliveries today', value: kpis.deliveredToday, color: '#059669' },
                { label: 'Postpartum', value: kpis.postnatal, color: '#2563EB' },
                { label: 'Critical / MFTI 1–2', value: kpis.critical, color: '#DC2626' },
                { label: 'ANC active', value: kpis.anc, color: '#7C3AED' },
              ].map((k) => (
                <div key={k.label} style={{ ...card, padding: '14px 12px', borderTop: `3px solid ${k.color}` }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{k.label}</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', marginTop: 4 }}>{k.value}</div>
                </div>
              ))}
            </div>
            <SharedBedStrip wardFilter={['Maternity']} title="Maternity beds · live" />
            {boardAll.length === 0 ? (
              <Empty text="Grease board empty — triage or admit a mother" action={() => setShowTriageModal(true)} />
            ) : (
              <div style={{ ...card, overflow: 'auto', marginTop: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: '#FDF2F8', color: '#9D174D', textAlign: 'left' }}>
                      {'Bed|Mother|Status|G/P|Dil|Eff|Sta|FHR|Ctx|ROM|GBS|MFTI|Risk|PPH'.split('|').map((h) => (
                        <th key={h} style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {boardAll.map((m) => (
                      <tr key={m.id} onClick={() => { setSelectedId(m.id); setPage('labour'); }} style={{ borderTop: '1px solid #FCE7F3', cursor: 'pointer', background: m.risk === 'critical' ? '#FEF2F2' : m.mfti && m.mfti <= 2 ? '#FFF7ED' : undefined }}>
                        <td style={{ padding: '10px 8px', fontWeight: 700 }}>{m.bedNo || '—'}</td>
                        <td style={{ padding: '10px 8px', fontWeight: 600 }}>{m.patientName}</td>
                        <td style={{ padding: '10px 8px' }}>{STAGE_LABEL[m.stage]}</td>
                        <td style={{ padding: '10px 8px' }}>{m.gravidaPara}</td>
                        <td style={{ padding: '10px 8px', fontWeight: 700 }}>{m.cervicalDilationCm ?? '—'}</td>
                        <td style={{ padding: '10px 8px' }}>{m.effacementPct != null ? `${m.effacementPct}%` : '—'}</td>
                        <td style={{ padding: '10px 8px' }}>{m.station != null ? m.station : '—'}</td>
                        <td style={{ padding: '10px 8px', fontWeight: 700, color: (m.fetalHeartRateBpm || 0) > 160 || (m.fetalHeartRateBpm || 0) < 110 ? '#DC2626' : '#059669' }}>{m.fetalHeartRateBpm ?? '—'}</td>
                        <td style={{ padding: '10px 8px' }}>{m.contractionsPer10Min ?? '—'}</td>
                        <td style={{ padding: '10px 8px' }}>{m.romStatus || '—'}</td>
                        <td style={{ padding: '10px 8px' }}>{m.gbs || '—'}</td>
                        <td style={{ padding: '10px 8px' }}><MftiPill level={m.mfti} /></td>
                        <td style={{ padding: '10px 8px' }}><RiskPill risk={m.risk} /></td>
                        <td style={{ padding: '10px 8px', color: m.pph ? '#DC2626' : '#94A3B8', fontWeight: m.pph ? 800 : 400 }}>{m.pph ? '⚠ PPH' : m.pphRisk || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PageShell>
        )}

        {page === 'anc' && (
          <PageShell title="Prenatal / ANC" sub="Pregnancy record · EDD · GBS · risk factors · WHO contacts">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>{primaryBtn('Book ANC', () => setShowAncModal(true))}</div>
            {ancCases.length === 0 ? <Empty text="No prenatal charts" action={() => setShowAncModal(true)} /> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {ancCases.map((m) => (
                  <div key={m.id} style={{ ...card, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 800, color: '#0F172A' }}>{m.patientName}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748B' }}>{m.gravidaPara} · GA {m.gaWeeks ?? '—'}w</div>
                      </div>
                      <RiskPill risk={m.risk} />
                    </div>
                    <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.78rem', color: '#475569' }}>
                      <div><span style={{ color: '#9D174D', fontWeight: 700 }}>EDD</span><div>{m.edd || '—'}</div></div>
                      <div><span style={{ color: '#9D174D', fontWeight: 700 }}>Blood</span><div>{m.bloodGroup || '—'}</div></div>
                      <div><span style={{ color: '#9D174D', fontWeight: 700 }}>GBS</span><div>{m.gbs || '—'}</div></div>
                      <div><span style={{ color: '#9D174D', fontWeight: 700 }}>Phone</span><div>{m.phone || '—'}</div></div>
                    </div>
                    <button type="button" onClick={() => { setLabName(m.patientName); setLabGp(`${m.gravidaPara}${m.gaWeeks ? ` (${m.gaWeeks} wks)` : ''}`); setShowLabourAdmit(true); }} style={{ marginTop: 12, width: '100%', border: '1px solid #F9A8D4', background: '#FDF2F8', color: '#9D174D', borderRadius: 8, padding: 8, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>Admit to L&D →</button>
                  </div>
                ))}
              </div>
            )}
          </PageShell>
        )}

        {page === 'triage' && (
          <PageShell title="OB Triage · MFTI" sub="Maternal Fetal Triage Index (Epic) · 5-level acuity">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>{primaryBtn('New triage', () => setShowTriageModal(true))}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
              {([1, 2, 3, 4, 5] as MftiLevel[]).map((l) => {
                const m = MFTI_META[l];
                const n = triageCases.filter((t) => t.mfti === l).length;
                return (
                  <div key={l} style={{ ...card, padding: 12, borderTop: `3px solid ${m.color}` }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: m.color }}>{m.label}</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{n}</div>
                    <div style={{ fontSize: '0.65rem', color: '#94A3B8' }}>{m.desc}</div>
                  </div>
                );
              })}
            </div>
            {triageCases.length === 0 ? <Empty text="No patients in OB triage" action={() => setShowTriageModal(true)} /> : triageCases.map((m) => (
              <div key={m.id} style={{ ...card, padding: 14, marginBottom: 8, borderLeft: `4px solid ${m.mfti ? MFTI_META[m.mfti].color : '#94A3B8'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{m.patientName}</strong>
                    <span style={{ marginLeft: 8, fontSize: '0.78rem', color: '#64748B' }}>{m.gravidaPara} · GA {m.gaWeeks}w · {m.notes}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <MftiPill level={m.mfti} />
                    <button type="button" onClick={() => { setLabName(m.patientName); setLabGp(m.gravidaPara); setShowLabourAdmit(true); }} style={{ background: '#DB2777', color: '#FFF', border: 'none', borderRadius: 8, padding: '6px 12px', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer' }}>Admit L&D</button>
                  </div>
                </div>
              </div>
            ))}
          </PageShell>
        )}

        {page === 'labour' && (() => {
          const list = labourCases.length ? labourCases : records.filter((r) => !r.delivered && !['anc', 'postnatal', 'discharged'].includes(r.stage));
          const focus = list.find((r) => r.id === selectedId) || list[0];
          if (!focus) return (
            <PageShell title="Labour & Partograph" sub="CTG · dilation · station · ROM">
              <Empty text="No active labour" action={() => setShowLabourAdmit(true)} />
            </PageShell>
          );
          return (
            <PageShell title="Labour & Partograph" sub="CTG telemetry · WHO partograph · station / effacement">
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>{primaryBtn('Admit labour', () => setShowLabourAdmit(true))}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14 }}>
                <div style={{ ...card, padding: 10, maxHeight: 520, overflowY: 'auto' }}>
                  {list.map((m) => (
                    <button key={m.id} type="button" onClick={() => setSelectedId(m.id)} style={{ width: '100%', textAlign: 'left', border: m.id === focus.id ? '2px solid #EC4899' : '1px solid #FCE7F3', background: m.id === focus.id ? '#FDF2F8' : '#FFF', borderRadius: 10, padding: 10, marginBottom: 6, cursor: 'pointer' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.86rem' }}>{m.patientName}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{STAGE_LABEL[m.stage]} · {m.bedNo || '—'}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.72rem' }}>
                        <span>{m.cervicalDilationCm ?? '—'} cm</span>
                        <span style={{ fontWeight: 700, color: (m.fetalHeartRateBpm || 0) > 160 ? '#DC2626' : '#059669' }}>{m.fetalHeartRateBpm ?? '—'} bpm</span>
                      </div>
                    </button>
                  ))}
                </div>
                <div style={{ ...card, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#EC4899', textTransform: 'uppercase' }}>{focus.bedNo || 'L&D bed'} · CTG live</div>
                      <h3 style={{ margin: '4px 0 2px', fontSize: '1.25rem' }}>{focus.patientName}</h3>
                      <div style={{ fontSize: '0.82rem', color: '#64748B' }}>{focus.gravidaPara} · ROM: {focus.romStatus || '—'} · {focus.midwifeOnDuty || 'Midwife'}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                      <RiskPill risk={focus.risk} />
                      <MftiPill level={focus.mfti} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, margin: '16px 0' }}>
                    {[
                      { l: 'DILATION', v: `${focus.cervicalDilationCm ?? '—'} / 10`, c: '#DB2777', bg: '#FDF2F8' },
                      { l: 'EFFACEMENT', v: focus.effacementPct != null ? `${focus.effacementPct}%` : '—', c: '#7C3AED', bg: '#F5F3FF' },
                      { l: 'STATION', v: focus.station != null ? String(focus.station) : '—', c: '#2563EB', bg: '#EFF6FF' },
                      { l: 'FHR (CTG)', v: `${focus.fetalHeartRateBpm ?? '—'} bpm`, c: (focus.fetalHeartRateBpm || 0) > 160 ? '#DC2626' : '#059669', bg: '#ECFDF5' },
                    ].map((x) => (
                      <div key={x.l} style={{ background: x.bg, borderRadius: 12, padding: 12, textAlign: 'center' }}>
                        <div style={{ fontSize: '0.62rem', fontWeight: 800, color: x.c }}>{x.l}</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginTop: 4 }}>{x.v}</div>
                      </div>
                    ))}
                  </div>
                  {(focus.partograph || []).length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#9D174D', marginBottom: 6 }}>PARTOGRAPH TRAIL</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {focus.partograph.slice(-10).map((p, i) => (
                          <div key={i} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px 10px', fontSize: '0.7rem', color: '#475569' }}>
                            {p.dilationCm}cm · sta {p.station ?? '—'} · {p.fhrBpm} · {new Date(p.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" onClick={() => { setEditDil(String(focus.cervicalDilationCm ?? 6)); setEditEff(String(focus.effacementPct ?? 80)); setEditSta(String(focus.station ?? 0)); setEditFhr(String(focus.fetalHeartRateBpm ?? 140)); setEditCtx(String(focus.contractionsPer10Min ?? 4)); setShowPartograph(true); }} style={{ background: 'linear-gradient(135deg, #DB2777, #EC4899)', color: '#FFF', border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer' }}>Update partograph</button>
                    <button type="button" onClick={() => { setSelectedId(focus.id); setShowDelivery(true); }} style={{ background: '#FFF', color: '#9D174D', border: '1.5px solid #F9A8D4', borderRadius: 10, padding: '10px 16px', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer' }}>Delivery summary</button>
                  </div>
                </div>
              </div>
            </PageShell>
          );
        })()}

        {page === 'delivery' && (
          <PageShell title="Delivery Summary" sub="Mode · APGAR · QBL · newborn ID · placenta · laceration">
            {labourCases.filter((m) => !m.delivered).length > 0 && (
              <div style={{ ...card, padding: 14, marginBottom: 12 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#9D174D', marginBottom: 8 }}>READY FOR DELIVERY</div>
                {labourCases.filter((m) => !m.delivered).map((m) => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #FCE7F3' }}>
                    <span><strong>{m.patientName}</strong> · {STAGE_LABEL[m.stage]} · {m.cervicalDilationCm ?? '—'} cm</span>
                    <button type="button" onClick={() => { setSelectedId(m.id); setShowDelivery(true); }} style={{ background: 'linear-gradient(135deg, #DB2777, #EC4899)', color: '#FFF', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer' }}>Complete delivery</button>
                  </div>
                ))}
              </div>
            )}
            {births.length === 0 ? <Empty text="No deliveries recorded" /> : births.map((m) => (
              <div key={m.id} style={{ ...card, padding: 16, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #F9A8D4, #EC4899)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Award size={22} color="#FFF" /></div>
                  <div>
                    <div style={{ fontWeight: 800 }}>{m.patientName}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748B' }}>{MODE_LABEL[m.deliveryMode || 'unknown']} · {m.babyGender} · {m.birthWeightKg} kg ({m.birthWeightG}g) · APGAR {m.apgar1}/{m.apgar5} · EBL {m.eblMl ?? '—'} ml</div>
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>NB {m.newbornId} · {m.deliveryAt ? new Date(m.deliveryAt).toLocaleString() : ''}{m.skinToSkin ? ' · Skin-to-skin' : ''}</div>
                  </div>
                </div>
                <RiskPill risk={m.risk} />
              </div>
            ))}
          </PageShell>
        )}

        {page === 'postnatal' && (
          <PageShell title="Postpartum" sub="PPH watch · QBL · breastfeeding · recovery (Epic recovery band)">
            {postnatalCases.length === 0 ? <Empty text="No postpartum mothers" /> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                {postnatalCases.map((m) => (
                  <div key={m.id} style={{ ...card, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{m.patientName}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748B' }}>Day {m.postnatalDay ?? 0} · {m.babyGender} · {m.birthWeightKg ?? '—'} kg</div>
                      </div>
                      <RiskPill risk={m.risk} />
                    </div>
                    <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#475569' }}>
                      <div>Mode: {MODE_LABEL[m.deliveryMode || 'unknown']}</div>
                      <div>QBL: {m.qblMl ?? m.eblMl ?? '—'} ml · PPH risk: {m.pphRisk || '—'}</div>
                      <div>Breastfeeding: {m.breastfeeding ? 'Yes' : '—'} · NB: {m.newbornId || '—'}</div>
                      {m.pph && <div style={{ color: '#DC2626', fontWeight: 800, marginTop: 4 }}>⚠ PPH active</div>}
                    </div>
                    <button type="button" onClick={() => flagPph(m.id)} style={{ marginTop: 10, width: '100%', border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', borderRadius: 8, padding: 8, fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer' }}>Flag PPH / escalate</button>
                  </div>
                ))}
              </div>
            )}
          </PageShell>
        )}

        {page === 'beds' && (
          <PageShell title="Maternity Beds" sub="Ward board · Maternity filter only">
            <SharedBedStrip wardFilter={['Maternity']} title="Maternity · labour · postpartum beds" />
          </PageShell>
        )}

        {page === 'emergency' && (
          <PageShell title="Obstetric Emergency" sub="PPH · eclampsia pathway · EmCS · MFTI 1–2">
            {emergencyCases.length === 0 ? (
              <div style={{ ...card, padding: 32, textAlign: 'center' }}>
                <CheckCircle2 size={32} color="#10B981" style={{ marginBottom: 8 }} />
                <div style={{ fontWeight: 700, color: '#059669' }}>No active OB emergencies</div>
              </div>
            ) : emergencyCases.map((m) => (
              <div key={m.id} style={{ ...card, padding: 16, marginBottom: 8, borderLeft: '4px solid #DC2626', background: m.risk === 'critical' ? '#FEF2F2' : '#FFF' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{m.patientName}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748B' }}>{STAGE_LABEL[m.stage]} · FHR {m.fetalHeartRateBpm ?? '—'} · Dil {m.cervicalDilationCm ?? '—'}{m.pph ? ' · PPH' : ''}{m.deliveryMode === 'emergency_cs' ? ' · EmCS' : ''}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}><MftiPill level={m.mfti} /><RiskPill risk={m.risk} /></div>
                </div>
                <button type="button" onClick={() => { setSelectedId(m.id); setPage('labour'); }} style={{ marginTop: 10, background: '#DC2626', color: '#FFF', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>Open labour chart</button>
              </div>
            ))}
          </PageShell>
        )}

        {page === 'register' && (
          <PageShell title="Birth Register" sub="Facility birth log · mode mix · outcomes (Cerner birth log)">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 14 }}>
              <div style={{ ...card, padding: 12, textAlign: 'center' }}><div style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 700 }}>TOTAL</div><div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{births.length}</div></div>
              <div style={{ ...card, padding: 12, textAlign: 'center' }}><div style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 700 }}>TODAY</div><div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669' }}>{kpis.deliveredToday}</div></div>
              <div style={{ ...card, padding: 12, textAlign: 'center' }}><div style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 700 }}>SVD</div><div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{births.filter((b) => b.deliveryMode === 'svd').length}</div></div>
              <div style={{ ...card, padding: 12, textAlign: 'center' }}><div style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 700 }}>CS</div><div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{births.filter((b) => b.deliveryMode === 'elective_cs' || b.deliveryMode === 'emergency_cs').length}</div></div>
            </div>
            {births.length === 0 ? <Empty text="Birth register empty" /> : (
              <div style={{ ...card, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: '#FDF2F8', color: '#9D174D', textAlign: 'left' }}>
                      {'Mother|Mode|Neonate|APGAR|QBL|NB ID|When'.split('|').map((h) => (
                        <th key={h} style={{ padding: '10px 12px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {births.map((m) => (
                      <tr key={m.id} style={{ borderTop: '1px solid #FCE7F3' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{m.patientName}</td>
                        <td style={{ padding: '10px 12px' }}>{MODE_LABEL[m.deliveryMode || 'unknown']}</td>
                        <td style={{ padding: '10px 12px' }}>{m.babyGender} · {m.birthWeightKg} kg</td>
                        <td style={{ padding: '10px 12px' }}>{m.apgar1}/{m.apgar5}</td>
                        <td style={{ padding: '10px 12px' }}>{m.qblMl ?? m.eblMl ?? '—'} ml</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.75rem' }}>{m.newbornId}</td>
                        <td style={{ padding: '10px 12px', color: '#64748B' }}>{m.deliveryAt ? new Date(m.deliveryAt).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PageShell>
        )}
      </main>

      {notice && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 99999, background: '#831843', border: '1px solid #F9A8D4', borderRadius: 12, padding: '14px 18px', boxShadow: '0 12px 32px rgba(131, 24, 67, 0.35)', display: 'flex', alignItems: 'center', gap: 10, color: '#FFF', fontSize: '0.88rem', fontWeight: 600, maxWidth: 380 }}>
          <CheckCircle2 size={18} color="#F9A8D4" /><span>{notice}</span>
        </div>
      )}

      {showAncModal && (
        <Modal title="Open prenatal chart (ANC)" onClose={() => setShowAncModal(false)}>
          <form onSubmit={handleAncBook} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Mother's full name *"><input style={inputStyle} required value={ancName} onChange={(e) => setAncName(e.target.value)} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Age"><input style={inputStyle} value={ancAge} onChange={(e) => setAncAge(e.target.value)} /></Field>
              <Field label="Phone"><input style={inputStyle} value={ancPhone} onChange={(e) => setAncPhone(e.target.value)} /></Field>
              <Field label="Gravida / Para"><input style={inputStyle} value={ancGp} onChange={(e) => setAncGp(e.target.value)} /></Field>
              <Field label="Blood group"><select style={inputStyle} value={ancBg} onChange={(e) => setAncBg(e.target.value)}>{'O+|O-|A+|A-|B+|B-|AB+|AB-'.split('|').map((b) => <option key={b}>{b}</option>)}</select></Field>
              <Field label="LMP"><input style={inputStyle} type="date" value={ancLmp} onChange={(e) => setAncLmp(e.target.value)} /></Field>
              <Field label="GBS"><select style={inputStyle} value={ancGbs} onChange={(e) => setAncGbs(e.target.value as GbsStatus)}><option value="unknown">Unknown</option><option value="negative">Negative</option><option value="positive">Positive</option><option value="pending">Pending</option></select></Field>
            </div>
            <ModalActions onCancel={() => setShowAncModal(false)} submitLabel="Open prenatal chart" />
          </form>
        </Modal>
      )}
      {showTriageModal && (
        <Modal title="OB Triage · MFTI" onClose={() => setShowTriageModal(false)}>
          <form onSubmit={handleTriage} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Mother's name *"><input style={inputStyle} required value={triName} onChange={(e) => setTriName(e.target.value)} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="G/P"><input style={inputStyle} value={triGp} onChange={(e) => setTriGp(e.target.value)} /></Field>
              <Field label="GA (weeks)"><input style={inputStyle} value={triGa} onChange={(e) => setTriGa(e.target.value)} /></Field>
            </div>
            <Field label="Chief complaint"><input style={inputStyle} value={triChief} onChange={(e) => setTriChief(e.target.value)} /></Field>
            <Field label="MFTI acuity"><select style={inputStyle} value={triMfti} onChange={(e) => setTriMfti(Number(e.target.value) as MftiLevel)}>{([1, 2, 3, 4, 5] as MftiLevel[]).map((l) => <option key={l} value={l}>{MFTI_META[l].label} — {MFTI_META[l].desc}</option>)}</select></Field>
            <ModalActions onCancel={() => setShowTriageModal(false)} submitLabel="Register triage" />
          </form>
        </Modal>
      )}
      {showLabourAdmit && (
        <Modal title="Admit to Labour & Delivery" onClose={() => setShowLabourAdmit(false)}>
          <form onSubmit={handleLabourAdmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Mother's name *"><input style={inputStyle} required value={labName} onChange={(e) => setLabName(e.target.value)} /></Field>
            <Field label="G/P / GA"><input style={inputStyle} value={labGp} onChange={(e) => setLabGp(e.target.value)} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <Field label="Dilation (cm)"><input style={inputStyle} value={labDil} onChange={(e) => setLabDil(e.target.value)} /></Field>
              <Field label="Effacement %"><input style={inputStyle} value={labEff} onChange={(e) => setLabEff(e.target.value)} /></Field>
              <Field label="Station"><input style={inputStyle} value={labSta} onChange={(e) => setLabSta(e.target.value)} /></Field>
              <Field label="FHR"><input style={inputStyle} value={labFhr} onChange={(e) => setLabFhr(e.target.value)} /></Field>
              <Field label="Ctx / 10 min"><input style={inputStyle} value={labCtx} onChange={(e) => setLabCtx(e.target.value)} /></Field>
              <Field label="Bed"><input style={inputStyle} value={labBed} onChange={(e) => setLabBed(e.target.value)} /></Field>
            </div>
            <Field label="ROM"><select style={inputStyle} value={labRom} onChange={(e) => setLabRom(e.target.value as RomStatus)}><option value="intact">Intact</option><option value="spontaneous">SROM</option><option value="artificial">AROM</option></select></Field>
            <ModalActions onCancel={() => setShowLabourAdmit(false)} submitLabel="Admit to L&D" />
          </form>
        </Modal>
      )}
      {showPartograph && selected && (
        <Modal title={`Partograph · ${selected.patientName}`} onClose={() => setShowPartograph(false)}>
          <form onSubmit={handlePartograph} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <Field label="Dilation (cm)"><input style={inputStyle} value={editDil} onChange={(e) => setEditDil(e.target.value)} /></Field>
              <Field label="Effacement %"><input style={inputStyle} value={editEff} onChange={(e) => setEditEff(e.target.value)} /></Field>
              <Field label="Station"><input style={inputStyle} value={editSta} onChange={(e) => setEditSta(e.target.value)} /></Field>
              <Field label="FHR"><input style={inputStyle} value={editFhr} onChange={(e) => setEditFhr(e.target.value)} /></Field>
              <Field label="Contractions"><input style={inputStyle} value={editCtx} onChange={(e) => setEditCtx(e.target.value)} /></Field>
              <Field label="BP"><input style={inputStyle} value={editBp} onChange={(e) => setEditBp(e.target.value)} /></Field>
            </div>
            <Field label="Notes"><input style={inputStyle} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} /></Field>
            <ModalActions onCancel={() => setShowPartograph(false)} submitLabel="Save partograph entry" />
          </form>
        </Modal>
      )}
      {showDelivery && selected && (
        <Modal title={`Delivery summary · ${selected.patientName}`} onClose={() => setShowDelivery(false)}>
          <form onSubmit={handleDelivery} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Mode of delivery"><select style={inputStyle} value={delMode} onChange={(e) => setDelMode(e.target.value as DeliveryMode)}><option value="svd">Spontaneous vaginal</option><option value="assisted">Assisted vaginal</option><option value="elective_cs">Elective CS</option><option value="emergency_cs">Emergency CS</option></select></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Neonate gender"><select style={inputStyle} value={delGender} onChange={(e) => setDelGender(e.target.value as 'Male' | 'Female')}><option value="Female">Female</option><option value="Male">Male</option></select></Field>
              <Field label="Birth weight (kg)"><input style={inputStyle} type="number" step="0.1" required value={delWeight} onChange={(e) => setDelWeight(e.target.value)} /></Field>
              <Field label="APGAR 1 min"><input style={inputStyle} value={delApgar1} onChange={(e) => setDelApgar1(e.target.value)} /></Field>
              <Field label="APGAR 5 min"><input style={inputStyle} value={delApgar5} onChange={(e) => setDelApgar5(e.target.value)} /></Field>
              <Field label="EBL / QBL (ml)"><input style={inputStyle} value={delEbl} onChange={(e) => setDelEbl(e.target.value)} /></Field>
              <Field label="Laceration"><input style={inputStyle} value={delLac} onChange={(e) => setDelLac(e.target.value)} /></Field>
            </div>
            <ModalActions onCancel={() => setShowDelivery(false)} submitLabel="Complete delivery + create newborn" />
          </form>
        </Modal>
      )}
    </div>
  );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99990, background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#FFF', borderRadius: 16, width: '100%', maxWidth: 480, padding: 22, boxShadow: '0 24px 48px rgba(131, 24, 67, 0.2)', border: '1px solid #FCE7F3', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#831843', fontWeight: 800 }}>{title}</h3>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onCancel, submitLabel }: { onCancel: () => void; submitLabel: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
      <button type="button" onClick={onCancel} style={{ border: '1px solid #E2E8F0', background: '#FFF', borderRadius: 10, padding: '9px 14px', fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer', color: '#64748B' }}>Cancel</button>
      <button type="submit" style={{ background: 'linear-gradient(135deg, #DB2777, #EC4899)', color: '#FFF', border: 'none', borderRadius: 10, padding: '9px 16px', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer' }}>{submitLabel}</button>
    </div>
  );
}

export default MaternityOgSuite;
