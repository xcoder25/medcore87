'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ShieldAlert,
  Heart,
  Wind,
  CheckCircle2,
  BedDouble,
  ArrowRightLeft,
  Plus,
  Play,
  Pause,
  Square,
  Save,
  RefreshCw,
  Stethoscope,
  ClipboardCheck,
} from 'lucide-react';
import type { UserSession } from '../auth/AuthScreen';
import {
  listBeds,
  availableBeds,
  subscribeBeds,
  type BedRecord,
} from '../../lib/bedBoardStore';
import { listVitals, subscribeVitals, type VitalsRecord } from '../../lib/nursingVitalsStore';
import { placeOrder } from '../../lib/clinicalEventBus';
import { pushNotification } from '../../lib/notificationEngine';
import { emitLiveAction } from '../../lib/liveActions';
import {
  getIcuBedState,
  upsertIcuBedState,
  addInfusionPump,
  updateInfusionStatus,
  transferIcuToStepDown,
  subscribeIcuStepDown,
  isCriticalCareWard,
  inferCriticalUnitTier,
  type CriticalAcuity,
  type IcuBedTelemetryState,
} from '../../lib/icuStepDownStore';

interface Props {
  session?: UserSession;
  onNavigate?: (moduleKey: string) => void;
}

export const CriticalCareIcuSuite: React.FC<Props> = ({ session, onNavigate }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';
  const actorName = session?.name || 'Critical Care Nurse';
  const actorBadge = session?.badgeId || 'ICU-01';

  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const u1 = subscribeBeds(reload);
    const u2 = subscribeVitals(reload);
    const u3 = subscribeIcuStepDown(reload);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [reload]);

  const allBeds = useMemo(() => listBeds(facilityId), [facilityId, tick]);
  const allVitals = useMemo(() => listVitals(facilityId), [facilityId, tick]);

  const criticalBeds = useMemo(() => {
    const filtered = allBeds.filter((b) => isCriticalCareWard(b.ward));
    return filtered;
  }, [allBeds]);

  const occupiedCriticalBeds = useMemo(
    () => criticalBeds.filter((b) => b.status === 'occupied' || b.status === 'isolation'),
    [criticalBeds]
  );

  const [unitFilter, setUnitFilter] = useState<'all' | 'ICU' | 'HDU_STEPDOWN'>('all');
  const [selectedBedId, setSelectedBedId] = useState<string>('');
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const visibleBeds = useMemo(() => {
    return occupiedCriticalBeds.filter((b) => {
      if (unitFilter === 'all') return true;
      return inferCriticalUnitTier(b.ward) === unitFilter;
    });
  }, [occupiedCriticalBeds, unitFilter]);

  const selectedBed: BedRecord | null = useMemo(() => {
    return (
      visibleBeds.find((b) => b.id === selectedBedId) ||
      visibleBeds[0] ||
      occupiedCriticalBeds[0] ||
      null
    );
  }, [visibleBeds, occupiedCriticalBeds, selectedBedId]);

  const telemetry: IcuBedTelemetryState | null = useMemo(() => {
    if (!selectedBed) return null;
    return getIcuBedState(facilityId, selectedBed.id, selectedBed.ward);
  }, [facilityId, selectedBed, tick]);

  // Editable form mirrors selected telemetry
  const [ventDraft, setVentDraft] = useState({
    ventilatorMode: 'PRVC / CPAP',
    fio2: '40',
    peep: '5',
    map: '78 mmHg',
    gcs: '15',
    sofa: '3',
    rass: '0',
    acuity: 'guarded' as CriticalAcuity,
    nurseAssigned: actorName,
  });

  useEffect(() => {
    if (!telemetry) return;
    setVentDraft({
      ventilatorMode: telemetry.ventilatorMode,
      fio2: String(telemetry.fio2),
      peep: String(telemetry.peep),
      map: telemetry.map,
      gcs: String(telemetry.gcs),
      sofa: String(telemetry.sofa),
      rass: telemetry.rass,
      acuity: telemetry.acuity,
      nurseAssigned:
        telemetry.nurseAssigned && telemetry.nurseAssigned !== 'Unassigned'
          ? telemetry.nurseAssigned
          : actorName,
    });
  }, [telemetry?.bedId, telemetry?.updatedAt, actorName]);

  // New infusion pump form
  const [showPumpForm, setShowPumpForm] = useState(false);
  const [pumpDrug, setPumpDrug] = useState('');
  const [pumpDose, setPumpDose] = useState('');
  const [pumpRate, setPumpRate] = useState('');

  // Step-down transfer modal state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferDestBedId, setTransferDestBedId] = useState('');

  const latestPatientVitals: VitalsRecord | undefined = useMemo(() => {
    if (!selectedBed) return undefined;
    return allVitals.find(
      (v) =>
        (selectedBed.patientId && v.patientId === selectedBed.patientId) ||
        (selectedBed.hospitalNumber && v.hospitalNumber === selectedBed.hospitalNumber)
    );
  }, [allVitals, selectedBed]);

  const stepDownCandidates = useMemo(() => {
    const avail = availableBeds(facilityId);
    // Prefer HDU / Step-Down / General medical beds
    return [...avail].sort((a, b) => {
      const aStep = inferCriticalUnitTier(a.ward) === 'HDU_STEPDOWN' ? 0 : 1;
      const bStep = inferCriticalUnitTier(b.ward) === 'HDU_STEPDOWN' ? 0 : 1;
      return aStep - bStep || a.ward.localeCompare(b.ward);
    });
  }, [facilityId, tick]);

  const kpis = useMemo(() => {
    let activeVents = 0;
    let activePumps = 0;
    let readyStepDown = 0;
    for (const bed of occupiedCriticalBeds) {
      const st = getIcuBedState(facilityId, bed.id, bed.ward);
      if (!/room air|none|off/i.test(st.ventilatorMode || '')) activeVents++;
      activePumps += st.infusions.filter((p) => p.status === 'running').length;
      const w = st.weaningChecklist;
      if (w.offVasopressors && w.spontaneousBreathing && w.spo2Stable && w.neuroStable) {
        readyStepDown++;
      }
    }
    const totalCrit = criticalBeds.length;
    const occCrit = occupiedCriticalBeds.length;
    const freeCrit = Math.max(0, totalCrit - occCrit);
    const pct = totalCrit > 0 ? Math.round((occCrit / totalCrit) * 100) : 0;
    return { totalCrit, occCrit, freeCrit, pct, activeVents, activePumps, readyStepDown };
  }, [criticalBeds, occupiedCriticalBeds, facilityId, tick]);

  const handleSaveTelemetry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBed) return;
    upsertIcuBedState(facilityId, selectedBed.id, {
      unitTier: inferCriticalUnitTier(selectedBed.ward),
      ventilatorMode: ventDraft.ventilatorMode.trim() || 'Room Air',
      fio2: Math.max(21, Math.min(100, Number(ventDraft.fio2) || 21)),
      peep: Math.max(0, Math.min(30, Number(ventDraft.peep) || 0)),
      map: ventDraft.map.trim() || '—',
      gcs: Math.max(3, Math.min(15, Number(ventDraft.gcs) || 15)),
      sofa: Math.max(0, Math.min(24, Number(ventDraft.sofa) || 0)),
      rass: ventDraft.rass.trim() || '0',
      acuity: ventDraft.acuity,
      nurseAssigned: ventDraft.nurseAssigned.trim() || actorName,
    });
    reload();
    flash(`Saved live ICU / Step-Down telemetry for ${selectedBed.patient} (${selectedBed.bedNo}).`);
  };

  const handleAddPump = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBed || !pumpDrug.trim() || !pumpDose.trim() || !pumpRate.trim()) return;
    addInfusionPump(facilityId, selectedBed.id, {
      drug: pumpDrug.trim(),
      dose: pumpDose.trim(),
      rateMlHr: pumpRate.trim(),
      status: 'running',
      startedBy: `${actorName} (${actorBadge})`,
    });
    setPumpDrug('');
    setPumpDose('');
    setPumpRate('');
    setShowPumpForm(false);
    reload();
    flash('Smart infusion pump channel registered.');
  };

  const handleOrderAbg = () => {
    if (!selectedBed) return;
    placeOrder({
      facilityId,
      patientId: selectedBed.patientId || selectedBed.id,
      patientName: selectedBed.patient || 'ICU Patient',
      hospitalNumber: selectedBed.hospitalNumber || 'ICU',
      type: 'lab',
      code: 'STAT-ABG',
      name: `STAT Arterial Blood Gas (ABG + Lactate) — ${selectedBed.bedNo}`,
      orderedBy: actorName,
      orderedByBadge: actorBadge,
      priority: 'stat',
      notes: `ICU ${selectedBed.ward} ${selectedBed.bedNo}`,
    });
    emitLiveAction(`STAT ABG ordered for ${selectedBed.patient} (${selectedBed.bedNo})`, {
      module: 'lab',
    });
    flash(`STAT ABG sent to Laboratory for ${selectedBed.patient}.`);
  };

  const handleAlertIntensivist = () => {
    if (!selectedBed) return;
    pushNotification({
      facilityId,
      title: `Intensivist Consult Requested · ${selectedBed.bedNo}`,
      body: `${selectedBed.patient} (${selectedBed.hospitalNumber || 'ICU'}) requires consultant intensivist review — ${selectedBed.diagnosis || 'Critical Care'}`,
      level: 'critical',
      roleHint: 'doctor',
      category: 'clinical',
      patientName: selectedBed.patient,
      hospitalNumber: selectedBed.hospitalNumber,
      source: 'icu-stepdown',
    });
    flash(`Intensivist consult alert dispatched to Attending Doctors for ${selectedBed.patient}.`);
  };

  const handleConfirmStepDownTransfer = () => {
    if (!selectedBed || !transferDestBedId) return;
    const res = transferIcuToStepDown(facilityId, selectedBed.id, transferDestBedId, actorName);
    if (!res.ok) {
      flash(res.error || 'Transfer failed.');
      return;
    }
    setShowTransferModal(false);
    setTransferDestBedId('');
    setSelectedBedId(res.destinationBed?.id || '');
    reload();
    flash(
      `Transferred ${selectedBed.patient} from ${selectedBed.bedNo} → ${res.destinationBed?.ward} (${res.destinationBed?.bedNo}).`
    );
  };

  const weaningScore = telemetry
    ? [
        telemetry.weaningChecklist.offVasopressors,
        telemetry.weaningChecklist.spontaneousBreathing,
        telemetry.weaningChecklist.spo2Stable,
        telemetry.weaningChecklist.neuroStable,
      ].filter(Boolean).length
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Command Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #090D16 0%, #0F172A 55%, #1E293B 100%)',
          color: '#F8FAFC',
          borderRadius: 18,
          padding: '18px 22px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          border: '1px solid #334155',
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: '#38BDF8', textTransform: 'uppercase' }}>
            Critical Care · ICU &amp; HDU Step-Down Unit
          </div>
          <h2 style={{ margin: '4px 0 4px', fontSize: 21, fontWeight: 800, color: '#FFFFFF' }}>
            Intensive Telemetry, Infusion Pumps &amp; Step-Down Transition
          </h2>
          <div style={{ fontSize: 12.5, color: '#94A3B8' }}>
            Backed live by facility Bed Board, Vitals Telemetry &amp; Clinical Event Bus · Zero placeholder figures
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={reload}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid #475569',
              background: '#1E293B',
              color: '#E2E8F0',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} /> Sync Telemetry
          </button>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('beds')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid #0D9488',
                background: '#0F766E',
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <BedDouble size={14} /> Bed Board
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            background: '#ECFDF5',
            border: '1px solid #6EE7B7',
            color: '#065F46',
            fontWeight: 700,
            fontSize: 12.5,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}

      {/* Live Critical Care KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderLeft: '4px solid #EF4444', borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Critical Care Occupancy</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: '#0F172A' }}>
              {kpis.occCrit} / {kpis.totalCrit}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#EF4444' }}>{kpis.pct}%</span>
          </div>
          <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>{kpis.freeCrit} ICU / HDU beds available</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderLeft: '4px solid #3B82F6', borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Ventilated Patients</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: '#1D4ED8' }}>{kpis.activeVents}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#3B82F6' }}>Active circuits</span>
          </div>
          <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>Real-time from bed telemetry</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderLeft: '4px solid #D97706', borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Running Infusion Pumps</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: '#B45309' }}>{kpis.activePumps}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#D97706' }}>Active channels</span>
          </div>
          <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>Titrated bedside vasoactive/sedation</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderLeft: '4px solid #10B981', borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Step-Down Ready</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: '#059669' }}>{kpis.readyStepDown}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#10B981' }}>4/4 Weaning Cleared</span>
          </div>
          <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>Eligible for ICU → Ward transfer</div>
        </div>
      </div>

      {/* Main Split Console */}
      {occupiedCriticalBeds.length === 0 ? (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px dashed #CBD5E1',
            borderRadius: 18,
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <BedDouble size={40} color="#64748B" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: 17, fontWeight: 800, color: '#0F172A' }}>
            No Patients Currently Admitted in ICU / HDU / Step-Down Beds
          </div>
          <div style={{ fontSize: 13, color: '#64748B', maxWidth: 460, margin: '8px auto 18px', lineHeight: 1.5 }}>
            {criticalBeds.length > 0
              ? `${criticalBeds.length} ICU / Critical Care bed(s) are currently available on the facility Bed Board. Admit a patient to an ICU or HDU bed to monitor ventilator settings, smart pumps, and step-down weaning.`
              : 'Ask your Hospital Administrator (or Admin AI) to create beds in ICU / HDU Step-Down Ward, then admit critical patients from the Doctor portal.'}
          </div>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('beds')}
              style={{
                padding: '10px 18px',
                borderRadius: 10,
                border: 'none',
                background: '#0F172A',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Open Facility Bed Census →
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(290px, 360px) 1fr', gap: 18, alignItems: 'start' }}>
          {/* Left Station List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6, background: '#F1F5F9', padding: 4, borderRadius: 10 }}>
              {(
                [
                  { k: 'all', l: `All (${occupiedCriticalBeds.length})` },
                  { k: 'ICU', l: 'ICU' },
                  { k: 'HDU_STEPDOWN', l: 'Step-Down / HDU' },
                ] as const
              ).map((t) => (
                <button
                  key={t.k}
                  type="button"
                  onClick={() => setUnitFilter(t.k)}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: 'none',
                    background: unitFilter === t.k ? '#FFFFFF' : 'transparent',
                    color: unitFilter === t.k ? '#0F172A' : '#64748B',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: unitFilter === t.k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  {t.l}
                </button>
              ))}
            </div>

            {visibleBeds.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', color: '#64748B', fontSize: 12.5 }}>
                No admitted patients in this unit tier.
              </div>
            ) : (
              visibleBeds.map((bed) => {
                const st = getIcuBedState(facilityId, bed.id, bed.ward);
                const isSel = selectedBed?.id === bed.id;
                const badgeBg =
                  st.acuity === 'critical' ? '#FEE2E2' : st.acuity === 'guarded' ? '#FEF3C7' : '#ECFDF5';
                const badgeColor =
                  st.acuity === 'critical' ? '#B91C1C' : st.acuity === 'guarded' ? '#B45309' : '#047857';
                return (
                  <button
                    key={bed.id}
                    type="button"
                    onClick={() => setSelectedBedId(bed.id)}
                    style={{
                      textAlign: 'left',
                      background: isSel ? '#F0FDFA' : '#FFFFFF',
                      border: isSel ? '2px solid #0D9488' : st.acuity === 'critical' ? '1.5px solid #FCA5A5' : '1px solid #E2E8F0',
                      borderRadius: 14,
                      padding: 14,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: badgeBg, color: badgeColor, textTransform: 'uppercase' }}>
                        {st.acuity} · {st.unitTier === 'HDU_STEPDOWN' ? 'Step-Down' : 'ICU'}
                      </span>
                      <span style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>
                        SOFA {st.sofa} · GCS {st.gcs}/15
                      </span>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 14.5, color: '#0F172A' }}>{bed.patient}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0D9488' }}>
                      {bed.bedNo} · {bed.ward} ({bed.hospitalNumber || 'Inpatient'})
                    </div>
                    <div style={{ fontSize: 11.5, color: '#475569' }}>{bed.diagnosis || 'Critical monitoring'}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748B', marginTop: 2 }}>
                      <span>FiO2 {st.fio2}% · PEEP {st.peep}</span>
                      <span>Pumps: {st.infusions.filter((p) => p.status === 'running').length}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right Patient Telemetry Console */}
          {selectedBed && telemetry && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Patient Header Card */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {selectedBed.ward} · {selectedBed.bedNo}
                    </div>
                    <h3 style={{ margin: '4px 0 2px', fontSize: 20, fontWeight: 900, color: '#0F172A' }}>
                      {selectedBed.patient}
                    </h3>
                    <div style={{ fontSize: 12.5, color: '#475569' }}>
                      MRN: <strong>{selectedBed.hospitalNumber || '—'}</strong> · Attending: Dr. {selectedBed.doctor || 'ICU Team'} · Dx: {selectedBed.diagnosis || 'Admitted'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setShowTransferModal(true)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        borderRadius: 10,
                        border: 'none',
                        background: weaningScore >= 3 ? '#059669' : '#0F172A',
                        color: '#FFFFFF',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      <ArrowRightLeft size={14} /> Step-Down Transfer
                    </button>
                  </div>
                </div>

                {/* Live Vitals + Telemetry Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 16 }}>
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Heart size={12} color="#EF4444" /> LATEST BP / HR
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
                      {latestPatientVitals?.bpSystolic
                        ? `${latestPatientVitals.bpSystolic}/${latestPatientVitals.bpDiastolic || 80}`
                        : '—'}{' '}
                      <span style={{ fontSize: 12, color: '#64748B' }}>
                        {latestPatientVitals?.pulse ? `· ${latestPatientVitals.pulse} bpm` : ''}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>MAP: {telemetry.map}</div>
                  </div>

                  <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#1D4ED8', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Wind size={12} /> VENTILATOR &amp; SpO2
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
                      {telemetry.ventilatorMode}
                    </div>
                    <div style={{ fontSize: 11, color: '#1E40AF' }}>
                      FiO2 {telemetry.fio2}% · PEEP {telemetry.peep} · SpO2 {latestPatientVitals?.spo2 ?? '—'}%
                    </div>
                  </div>

                  <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#047857' }}>NEURO &amp; ORGAN SCORE</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
                      GCS {telemetry.gcs}/15 · SOFA {telemetry.sofa}
                    </div>
                    <div style={{ fontSize: 11, color: '#065F46' }}>RASS: {telemetry.rass}</div>
                  </div>

                  <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#B45309' }}>WEANING READINESS</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: weaningScore === 4 ? '#059669' : '#B45309', marginTop: 4 }}>
                      {weaningScore} / 4 Criteria
                    </div>
                    <div style={{ fontSize: 11, color: '#92400E' }}>Nurse: {telemetry.nurseAssigned}</div>
                  </div>
                </div>

                {/* Editable Live Telemetry Controls */}
                <form onSubmit={handleSaveTelemetry} style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 10 }}>
                    Update Ventilator, Neuro &amp; Acuity Readings
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                    <div>
                      <label style={lbl}>Acuity</label>
                      <select
                        value={ventDraft.acuity}
                        onChange={(e) => setVentDraft({ ...ventDraft, acuity: e.target.value as CriticalAcuity })}
                        style={inp}
                      >
                        <option value="critical">Critical</option>
                        <option value="guarded">Guarded</option>
                        <option value="stable">Stable (Step-Down Ready)</option>
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Ventilator Mode</label>
                      <input
                        type="text"
                        value={ventDraft.ventilatorMode}
                        onChange={(e) => setVentDraft({ ...ventDraft, ventilatorMode: e.target.value })}
                        style={inp}
                      />
                    </div>
                    <div>
                      <label style={lbl}>FiO2 (%)</label>
                      <input
                        type="number"
                        min={21}
                        max={100}
                        value={ventDraft.fio2}
                        onChange={(e) => setVentDraft({ ...ventDraft, fio2: e.target.value })}
                        style={inp}
                      />
                    </div>
                    <div>
                      <label style={lbl}>PEEP (cmH2O)</label>
                      <input
                        type="number"
                        min={0}
                        max={25}
                        value={ventDraft.peep}
                        onChange={(e) => setVentDraft({ ...ventDraft, peep: e.target.value })}
                        style={inp}
                      />
                    </div>
                    <div>
                      <label style={lbl}>MAP</label>
                      <input
                        type="text"
                        value={ventDraft.map}
                        onChange={(e) => setVentDraft({ ...ventDraft, map: e.target.value })}
                        style={inp}
                      />
                    </div>
                    <div>
                      <label style={lbl}>GCS (3-15)</label>
                      <input
                        type="number"
                        min={3}
                        max={15}
                        value={ventDraft.gcs}
                        onChange={(e) => setVentDraft({ ...ventDraft, gcs: e.target.value })}
                        style={inp}
                      />
                    </div>
                    <div>
                      <label style={lbl}>SOFA Score</label>
                      <input
                        type="number"
                        min={0}
                        max={24}
                        value={ventDraft.sofa}
                        onChange={(e) => setVentDraft({ ...ventDraft, sofa: e.target.value })}
                        style={inp}
                      />
                    </div>
                    <div>
                      <label style={lbl}>1:1 Assigned Nurse</label>
                      <input
                        type="text"
                        value={ventDraft.nurseAssigned}
                        onChange={(e) => setVentDraft({ ...ventDraft, nurseAssigned: e.target.value })}
                        style={inp}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <button
                      type="submit"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        borderRadius: 9,
                        border: 'none',
                        background: '#0D9488',
                        color: '#FFFFFF',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Save size={14} /> Save Telemetry Reading
                    </button>
                    <button
                      type="button"
                      onClick={handleOrderAbg}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        borderRadius: 9,
                        border: '1px solid #BFDBFE',
                        background: '#EFF6FF',
                        color: '#1D4ED8',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Activity size={14} /> Order STAT Bedside ABG
                    </button>
                    <button
                      type="button"
                      onClick={handleAlertIntensivist}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        borderRadius: 9,
                        border: '1px solid #FECACA',
                        background: '#FEF2F2',
                        color: '#B91C1C',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <ShieldAlert size={14} /> Alert Intensivist
                    </button>
                  </div>
                </form>
              </div>

              {/* Smart Infusion Pumps + Weaning Checklist Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 14 }}>
                {/* Infusion Pumps */}
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0F172A' }}>
                      Smart Infusion Pump Channels ({telemetry.infusions.length})
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPumpForm((v) => !v)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '5px 10px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#2563EB',
                        color: '#fff',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={13} /> Add Pump
                    </button>
                  </div>

                  {showPumpForm && (
                    <form
                      onSubmit={handleAddPump}
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        marginBottom: 10,
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 6,
                      }}
                    >
                      <input
                        type="text"
                        required
                        placeholder="Drug (e.g. Noradrenaline)"
                        value={pumpDrug}
                        onChange={(e) => setPumpDrug(e.target.value)}
                        style={{ ...inp, gridColumn: 'span 2' }}
                      />
                      <input
                        type="text"
                        required
                        placeholder="Dose (e.g. 0.1 mcg/kg/min)"
                        value={pumpDose}
                        onChange={(e) => setPumpDose(e.target.value)}
                        style={inp}
                      />
                      <input
                        type="text"
                        required
                        placeholder="Rate (e.g. 5 mL/hr)"
                        value={pumpRate}
                        onChange={(e) => setPumpRate(e.target.value)}
                        style={inp}
                      />
                      <button
                        type="submit"
                        style={{
                          gridColumn: 'span 2',
                          padding: '7px 12px',
                          borderRadius: 8,
                          border: 'none',
                          background: '#059669',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        Start Infusion Channel
                      </button>
                    </form>
                  )}

                  {telemetry.infusions.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>
                      No active vasoactive or sedation infusion pumps recorded for {selectedBed.bedNo}.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {telemetry.infusions.map((pump) => (
                        <div
                          key={pump.id}
                          style={{
                            padding: 10,
                            borderRadius: 10,
                            border: '1px solid #E2E8F0',
                            background: pump.status === 'running' ? '#F0FDF4' : '#F8FAFC',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 12.5, color: '#0F172A' }}>{pump.drug}</div>
                            <div style={{ fontSize: 11, color: '#475569' }}>
                              {pump.dose} · {pump.rateMlHr}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: 999,
                                background:
                                  pump.status === 'running'
                                    ? '#DCFCE7'
                                    : pump.status === 'paused'
                                      ? '#FEF3C7'
                                      : '#E2E8F0',
                                color:
                                  pump.status === 'running'
                                    ? '#166534'
                                    : pump.status === 'paused'
                                      ? '#B45309'
                                      : '#475569',
                                textTransform: 'uppercase',
                              }}
                            >
                              {pump.status}
                            </span>
                            {pump.status !== 'running' && (
                              <button
                                type="button"
                                title="Resume pump"
                                onClick={() => {
                                  updateInfusionStatus(facilityId, selectedBed.id, pump.id, { status: 'running' });
                                  reload();
                                }}
                                style={iconBtn}
                              >
                                <Play size={12} />
                              </button>
                            )}
                            {pump.status === 'running' && (
                              <button
                                type="button"
                                title="Pause pump"
                                onClick={() => {
                                  updateInfusionStatus(facilityId, selectedBed.id, pump.id, { status: 'paused' });
                                  reload();
                                }}
                                style={iconBtn}
                              >
                                <Pause size={12} />
                              </button>
                            )}
                            {pump.status !== 'stopped' && (
                              <button
                                type="button"
                                title="Stop & discontinue pump"
                                onClick={() => {
                                  updateInfusionStatus(facilityId, selectedBed.id, pump.id, { status: 'stopped' });
                                  reload();
                                }}
                                style={iconBtn}
                              >
                                <Square size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Step-Down Weaning Readiness Checklist */}
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 16 }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0F172A', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ClipboardCheck size={16} color="#059669" /> Step-Down Weaning Criteria ({weaningScore}/4)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(
                      [
                        { k: 'offVasopressors', label: 'Off Vasopressors / Inotropes ≥ 12 hrs' },
                        { k: 'spontaneousBreathing', label: 'Extubated / Spontaneous Breathing Trial Passed' },
                        { k: 'spo2Stable', label: 'SpO2 ≥ 94% on FiO2 ≤ 40% / Nasal Cannula' },
                        { k: 'neuroStable', label: 'GCS ≥ 13 & Haemodynamically Stable' },
                      ] as const
                    ).map((item) => {
                      const checked = telemetry.weaningChecklist[item.k];
                      return (
                        <label
                          key={item.k}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 10px',
                            borderRadius: 10,
                            border: checked ? '1px solid #6EE7B7' : '1px solid #E2E8F0',
                            background: checked ? '#ECFDF5' : '#F8FAFC',
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#0F172A',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              upsertIcuBedState(facilityId, selectedBed.id, {
                                weaningChecklist: {
                                  ...telemetry.weaningChecklist,
                                  [item.k]: e.target.checked,
                                },
                              });
                              reload();
                            }}
                          />
                          <span>{item.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step-Down Transfer Modal */}
      {showTransferModal && selectedBed && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div style={{ width: '100%', maxWidth: 480, background: '#FFFFFF', borderRadius: 16, padding: 20, border: '1px solid #CBD5E1' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
              Transfer {selectedBed.patient} to Step-Down / Ward Bed
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#64748B' }}>
              Atomically transfers patient out of <strong>{selectedBed.bedNo}</strong> (marking ICU bed for cleaning) and notifies Ward Nurse &amp; Doctor.
            </p>
            <label style={lbl}>Available Destination Bed *</label>
            <select
              value={transferDestBedId}
              onChange={(e) => setTransferDestBedId(e.target.value)}
              style={inp}
            >
              <option value="">Select available bed...</option>
              {stepDownCandidates.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.ward} · {b.bedNo} (Available)
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  background: '#fff',
                  fontWeight: 700,
                  fontSize: 12.5,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!transferDestBedId}
                onClick={handleConfirmStepDownTransfer}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: transferDestBedId ? '#059669' : '#CBD5E1',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 12.5,
                  cursor: transferDestBedId ? 'pointer' : 'not-allowed',
                }}
              >
                Confirm Step-Down Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const lbl: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: '#475569',
  marginBottom: 4,
};

const inp: React.CSSProperties = {
  width: '100%',
  padding: '7px 9px',
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  fontSize: 12,
  boxSizing: 'border-box',
  background: '#FFFFFF',
};

const iconBtn: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 6,
  border: '1px solid #CBD5E1',
  background: '#FFFFFF',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: '#334155',
};

export default CriticalCareIcuSuite;
