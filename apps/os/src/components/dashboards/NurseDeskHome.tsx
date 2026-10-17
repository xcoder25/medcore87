'use client';

/**
 * NurseDeskHome — Realtime Clinical Nursing Office Desk.
 * Office desk workflow: Zero hero banner · Quick actions at top · Live telemetry KPIs · Realtime clinical tools.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  Heart, Activity, CheckCircle2, Clock, Pill,
  FileText, Search, User, ShieldCheck, AlertTriangle, Plus, X,
  BedDouble, Users, RefreshCw, Stethoscope, ChevronRight,
  TrendingUp, Send, Check, Sparkles, Brain, Eye, UserCheck, Flame, PhoneCall, Thermometer, Wind, AlertCircle, ArrowRight
} from 'lucide-react';
import { InBasketPanel } from '../clinical-core/InBasketPanel';
import { SharedBedStrip } from '../beds/SharedBedStrip';
import { NursingTriageStation } from '../clinical-core/NursingTriageStation';
import {
  todayVisits,
  subscribeReceptionOps,
  updateVisitStatus,
  type ReceptionVisit,
} from '../../lib/receptionOpsStore';
import {
  listOrders,
  subscribeOrders,
  updateOrderStatus,
  type ClinicalOrder,
} from '../../lib/clinicalEventBus';
import {
  listVitals,
  saveVitals,
  subscribeVitals,
  type VitalsRecord,
} from '../../lib/nursingVitalsStore';
import {
  listBeds,
  occupiedBeds,
  availableBeds,
  type BedRecord,
  upsertBed,
} from '../../lib/bedBoardStore';
import {
  listNursingCareItems,
  addNursingCareItem,
  signMedicationAdministration,
  subscribeNursingKardex,
  listSbarHandoffs,
  addSbarHandoff,
  subscribeSbar,
  type NursingCareItem,
  type NursingSbarHandoff,
} from '../../lib/nursingKardexStore';
import { listPatients } from '../../lib/patientRegistryStore';
import { emitLiveAction } from '../../lib/liveActions';
import { useOpdSync, broadcastOpdStage } from '../../hooks/useOpdSync';

interface Props {
  session: UserSession;
  onNavigate: (moduleKey: string) => void;
}

const C = {
  navy: '#0B1220',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  blue: '#2563EB',
  blueLight: '#EFF6FF',
  teal: '#0D9488',
  tealLight: '#F0FDFA',
  green: '#10B981',
  greenLight: '#ECFDF5',
  amber: '#D97706',
  amberLight: '#FEF3C7',
  red: '#DC2626',
  redLight: '#FEE2E2',
  cardBg: '#FFFFFF',
};

function waitMins(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

function calculateNews2(sys: number, hr: number, rr: number, temp: number, spo2: number): {
  score: number;
  risk: 'Low' | 'Medium' | 'High';
  color: string;
} {
  let score = 0;
  if (rr <= 8 || rr >= 25) score += 3;
  else if (rr >= 21) score += 2;
  else if (rr >= 9 && rr <= 11) score += 1;

  if (spo2 <= 91) score += 3;
  else if (spo2 <= 93) score += 2;
  else if (spo2 <= 95) score += 1;

  if (sys <= 90 || sys >= 220) score += 3;
  else if (sys <= 100) score += 2;
  else if (sys <= 110) score += 1;

  if (hr <= 40 || hr >= 131) score += 3;
  else if (hr >= 111) score += 2;
  else if (hr >= 91 || hr <= 50) score += 1;

  if (temp <= 35.0) score += 3;
  else if (temp >= 39.1) score += 2;
  else if (temp <= 36.0 || temp >= 38.1) score += 1;

  if (score >= 7) return { score, risk: 'High', color: '#DC2626' };
  if (score >= 5) return { score, risk: 'Medium', color: '#D97706' };
  return { score, risk: 'Low', color: '#10B981' };
}

export const NurseDeskHome: React.FC<Props> = ({ session, onNavigate }) => {
  const facilityId = session.hospitalId || 'IGH-EKT';
  const nurseName = session.name || 'Duty Nurse';
  const nurseBadge = session.badgeId || 'NUR-01';

  // Active workspace tool tab
  const [activeTool, setActiveTool] = useState<'queue' | 'emar' | 'beds' | 'orders' | 'sbar' | 'triage_station'>('queue');
  const [kardexFilter, setKardexFilter] = useState<'all' | 'pending' | 'overdue' | 'completed'>('all');
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [notice, setNotice] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date>(new Date());

  // Realtime tick sync via OPD synchronization
  const { tick } = useOpdSync({ heartbeatMs: 15_000 });
  const [dataVersion, setDataVersion] = useState(0);
  const reload = useCallback(() => {
    setDataVersion((v) => v + 1);
    setLastSync(new Date());
  }, []);

  useEffect(() => {
    const u1 = subscribeReceptionOps(reload);
    const u2 = subscribeOrders(reload);
    const u3 = subscribeVitals(reload);
    const u4 = subscribeNursingKardex(reload);
    const u5 = subscribeSbar(reload);

    const onBedBoard = () => reload();
    window.addEventListener('medcore-bed-board', onBedBoard);
    window.addEventListener('medcore-vitals', onBedBoard);
    window.addEventListener('medcore-reception-ops', onBedBoard);
    window.addEventListener('storage', onBedBoard);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('medcore_triage');
      bc.onmessage = () => reload();
    } catch { /* ignore */ }

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      window.removeEventListener('medcore-bed-board', onBedBoard);
      window.removeEventListener('medcore-vitals', onBedBoard);
      window.removeEventListener('medcore-reception-ops', onBedBoard);
      window.removeEventListener('storage', onBedBoard);
      bc?.close();
    };
  }, [reload]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  // Live Data Queries
  const visits = useMemo(() => todayVisits(facilityId), [facilityId, tick, dataVersion]);
  const orders = useMemo(() => listOrders(facilityId), [facilityId, tick, dataVersion]);
  const beds = useMemo(() => listBeds(facilityId), [facilityId, tick, dataVersion]);
  const careItems = useMemo(() => listNursingCareItems(facilityId), [facilityId, tick, dataVersion]);
  const allVitals = useMemo(() => listVitals(facilityId), [facilityId, tick, dataVersion]);
  const sbars = useMemo(() => listSbarHandoffs(facilityId), [facilityId, tick, dataVersion]);

  // Derived Metrics
  const waitingVisits = useMemo(() => {
    return visits.filter((v) => v.status === 'waiting' || v.status === 'called');
  }, [visits]);

  const occBeds = useMemo(() => {
    return beds.filter((b) => b.status === 'occupied' || b.status === 'isolation');
  }, [beds]);

  const pendingCareItems = useMemo(() => {
    return careItems.filter((i) => i.status === 'pending');
  }, [careItems]);

  const overdueCareItems = useMemo(() => {
    return careItems.filter((i) => i.status === 'overdue');
  }, [careItems]);

  const activeDoctorOrders = useMemo(() => {
    return orders.filter((o) => o.status === 'ordered' || o.status === 'in_progress');
  }, [orders]);

  // Modals state
  const [triageModalPatient, setTriageModalPatient] = useState<ReceptionVisit | null>(null);
  const [vitalsForm, setVitalsForm] = useState({
    bpSystolic: '120',
    bpDiastolic: '80',
    pulse: '76',
    tempC: '36.8',
    spo2: '98',
    respRate: '16',
    weightKg: '68',
    heightCm: '170',
    glucose: '95',
    notes: '',
  });

  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTask, setNewTask] = useState({
    bedNumber: 'Bed 08',
    ward: 'Male Medical',
    patientName: '',
    hospitalNumber: '',
    careActivity: '',
    dose: '',
    route: 'Oral',
    frequency: 'Q8H',
    nextScheduledTime: '14:00',
    notes: '',
  });

  const [showSbarModal, setShowSbarModal] = useState(false);
  const [sbarForm, setSbarForm] = useState({
    ward: 'Male Medical',
    shift: 'Morning (08:00–16:00)' as NursingSbarHandoff['shift'],
    incomingNurse: '',
    situation: '',
    background: '',
    assessment: '',
    recommendation: '',
  });

  // Calculate live NEWS2 preview
  const liveNews2 = useMemo(() => {
    return calculateNews2(
      Number(vitalsForm.bpSystolic) || 120,
      Number(vitalsForm.pulse) || 76,
      Number(vitalsForm.respRate) || 16,
      Number(vitalsForm.tempC) || 36.8,
      Number(vitalsForm.spo2) || 98
    );
  }, [vitalsForm]);

  // Action handlers
  const handleCallPatient = (visit: ReceptionVisit) => {
    updateVisitStatus(visit.id, 'called');
    reload();
    emitLiveAction(`Called patient ${visit.patientName} (${visit.queueNumber}) to Nursing Station`, {
      module: 'nursing',
    });
    flash(`Called ${visit.patientName} (${visit.queueNumber}) to Nursing Station.`);
  };

  const handleOpenTriage = (visit: ReceptionVisit) => {
    setTriageModalPatient(visit);
    // Pre-populate if recent vitals exist
    const past = allVitals.find((v) => v.patientId === visit.patientId);
    if (past) {
      setVitalsForm({
        bpSystolic: past.bpSystolic ? String(past.bpSystolic) : '120',
        bpDiastolic: past.bpDiastolic ? String(past.bpDiastolic) : '80',
        pulse: past.pulse ? String(past.pulse) : '76',
        tempC: past.tempC ? String(past.tempC) : '36.8',
        spo2: past.spo2 ? String(past.spo2) : '98',
        respRate: '16',
        weightKg: past.weightKg ? String(past.weightKg) : '68',
        heightCm: '170',
        glucose: '95',
        notes: past.notes || '',
      });
    } else {
      setVitalsForm({
        bpSystolic: '120',
        bpDiastolic: '80',
        pulse: '76',
        tempC: '36.8',
        spo2: '98',
        respRate: '16',
        weightKg: '68',
        heightCm: '170',
        glucose: '95',
        notes: '',
      });
    }
  };

  const handleSaveVitals = (e: React.FormEvent) => {
    e.preventDefault();
    if (!triageModalPatient) return;

    const saved = saveVitals({
      facilityId,
      patientId: triageModalPatient.patientId,
      hospitalNumber: triageModalPatient.hospitalNumber,
      patientName: triageModalPatient.patientName,
      bpSystolic: Number(vitalsForm.bpSystolic) || undefined,
      bpDiastolic: Number(vitalsForm.bpDiastolic) || undefined,
      pulse: Number(vitalsForm.pulse) || undefined,
      tempC: Number(vitalsForm.tempC) || undefined,
      spo2: Number(vitalsForm.spo2) || undefined,
      weightKg: Number(vitalsForm.weightKg) || undefined,
      notes: vitalsForm.notes.trim() || `NEWS2 Score: ${liveNews2.score} (${liveNews2.risk} Risk)`,
      recordedBy: `${nurseName} (${nurseBadge})`,
    });

    // Notify doctor desk & update OPD stage
    broadcastOpdStage('medcore_doctor', {
      facilityId,
      patientId: triageModalPatient.patientId,
      hospitalNumber: triageModalPatient.hospitalNumber,
      patientName: triageModalPatient.patientName,
      queueNumber: triageModalPatient.queueNumber,
      department: triageModalPatient.department,
      stage: 'vitals_done',
      urgency: saved.urgency,
      vitalsSummary: saved.urgency,
      vitals: {
        bp: `${vitalsForm.bpSystolic}/${vitalsForm.bpDiastolic}`,
        hr: vitalsForm.pulse,
        temp: vitalsForm.tempC,
        spo2: vitalsForm.spo2,
      },
    });

    updateVisitStatus(triageModalPatient.id, 'waiting');
    reload();

    emitLiveAction(
      `Vitals logged for ${triageModalPatient.patientName} · BP ${vitalsForm.bpSystolic}/${vitalsForm.bpDiastolic} · SpO2 ${vitalsForm.spo2}%`,
      { module: 'triage' }
    );

    setTriageModalPatient(null);
    flash(`Vitals saved for ${triageModalPatient.patientName}. Routed to Doctor consult queue.`);
  };

  const handleSignAdministration = (item: NursingCareItem) => {
    signMedicationAdministration(item.id, facilityId, `${nurseName} (${nurseBadge})`);
    reload();
    emitLiveAction(`e-MAR dose signed: ${item.careActivity} for ${item.patientName} (${item.bedNumber})`, {
      module: 'nursing',
    });
    flash(`Signed & verified: ${item.careActivity} administered to ${item.patientName}.`);
  };

  const handleCreateCareTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.patientName.trim() || !newTask.careActivity.trim()) return;

    addNursingCareItem({
      facilityId,
      bedNumber: newTask.bedNumber,
      ward: newTask.ward,
      patientName: newTask.patientName.trim(),
      hospitalNumber: newTask.hospitalNumber.trim() || `GH-${Date.now().toString().slice(-4)}`,
      careActivity: newTask.careActivity.trim(),
      dose: newTask.dose.trim() || undefined,
      route: newTask.route,
      frequency: newTask.frequency,
      nextScheduledTime: newTask.nextScheduledTime,
      status: 'pending',
      assignedNurse: `${nurseName} (${nurseBadge})`,
      notes: newTask.notes.trim() || undefined,
    });

    setShowAddTaskModal(false);
    setNewTask({
      bedNumber: 'Bed 08',
      ward: 'Male Medical',
      patientName: '',
      hospitalNumber: '',
      careActivity: '',
      dose: '',
      route: 'Oral',
      frequency: 'Q8H',
      nextScheduledTime: '14:00',
      notes: '',
    });
    reload();
    flash(`Care task added to e-MAR Kardex.`);
  };

  const handleSaveSbar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sbarForm.situation.trim() || !sbarForm.incomingNurse.trim()) return;

    addSbarHandoff({
      facilityId,
      ward: sbarForm.ward,
      shift: sbarForm.shift,
      outgoingNurse: `${nurseName} (${nurseBadge})`,
      incomingNurse: sbarForm.incomingNurse.trim(),
      situation: sbarForm.situation.trim(),
      background: sbarForm.background.trim(),
      assessment: sbarForm.assessment.trim(),
      recommendation: sbarForm.recommendation.trim(),
    });

    setShowSbarModal(false);
    setSbarForm({
      ward: 'Male Medical',
      shift: 'Morning (08:00–16:00)',
      incomingNurse: '',
      situation: '',
      background: '',
      assessment: '',
      recommendation: '',
    });
    reload();
    flash(`SBAR Shift Handoff recorded.`);
  };

  const filteredKardex = useMemo(() => {
    return careItems.filter((item) => {
      if (kardexFilter === 'all') return true;
      return item.status === kardexFilter;
    });
  }, [careItems, kardexFilter]);

  const filteredBeds = useMemo(() => {
    if (selectedWard === 'all') return beds;
    return beds.filter((b) => b.ward.toLowerCase().includes(selectedWard.toLowerCase()));
  }, [beds, selectedWard]);

  // If user opens the deep telemetry triage station view:
  if (activeTool === 'triage_station') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#fff', padding: '12px 18px', borderRadius: 14, border: `1px solid ${C.border}`
        }}>
          <button
            type="button"
            onClick={() => setActiveTool('queue')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#F1F5F9', border: 'none', padding: '8px 14px',
              borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', color: C.text
            }}
          >
            ← Return to Nursing Office Desk
          </button>
          <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>
            Deep OPD Triage Console · Realtime Telemetry
          </div>
        </div>
        <NursingTriageStation session={session} onClose={() => setActiveTool('queue')} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 32 }}>
      {/* Toast Notification */}
      {notice && (
        <div style={{
          position: 'fixed', top: 22, right: 22, zIndex: 99999,
          background: '#0F172A', color: '#F8FAFC', border: '1px solid #10B981',
          borderRadius: 12, padding: '12px 18px', boxShadow: '0 12px 30px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.86rem', fontWeight: 600
        }}>
          <CheckCircle2 size={18} color="#10B981" />
          <span>{notice}</span>
        </div>
      )}

      {/* 1. Realtime Office Desk Header Bar (NO HERO BANNER!) */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: 16,
        border: `1px solid ${C.border}`,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            color: '#16A34A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Stethoscope size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: -0.3 }}>
                Nursing Office Desk
              </span>
              <span style={{
                background: '#ECFDF5',
                color: '#065F46',
                border: '1px solid #A7F3D0',
                borderRadius: 999,
                padding: '2px 10px',
                fontSize: 11,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                Realtime Station Online
              </span>
              <span style={{
                background: '#F1F5F9',
                color: '#475569',
                borderRadius: 6,
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 600,
              }}>
                {session.hospitalId || 'IGH-EKT'} · Inpatient & OPD
              </span>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              Duty Nurse: <strong style={{ color: C.text }}>{nurseName}</strong> ({nurseBadge}) · Station Ward Roster Synchronized
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ textAlign: 'right', display: 'none', md: 'block' } as any}>
            <div style={{ fontSize: 11, color: C.muted }}>Last Bus Pulse</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
              {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
          <button
            type="button"
            className="mc-btn-live"
            onClick={reload}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#F8FAFC',
              border: `1px solid ${C.border}`,
              padding: '8px 14px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 700,
              color: C.text,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} color={C.blue} /> Sync Desk
          </button>
        </div>
      </div>

      {/* 2. InBasket Emergency / Stat Banner */}
      <InBasketPanel
        facilityId={facilityId}
        roleKey={session.roleKey}
        staffName={session.name}
        onNavigate={onNavigate}
      />

      {/* 3. QUICK ACTIONS COMES UP RIGHT AT THE TOP */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: 16,
        border: `1px solid ${C.border}`,
        padding: '18px 20px',
        boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Quick Actions</div>
            <div style={{ fontSize: 12, color: C.muted }}>Instant access to nurse workstation tools</div>
          </div>
          <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Realtime Desk Triggers</span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
          gap: 10,
        }}>
          {/* Action 1: Triage Vitals */}
          <button
            type="button"
            className="mc-btn-live"
            onClick={() => {
              setActiveTool('queue');
              if (waitingVisits.length > 0) {
                handleOpenTriage(waitingVisits[0]);
              } else {
                flash('Select a patient from the OPD Queue below to log vitals.');
              }
            }}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              background: '#F8FAFC',
              padding: '14px 10px',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: '#FEE2E2', color: '#DC2626',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 8px',
            }}>
              <Heart size={20} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Triage / Vitals</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Log OPD Patient</div>
          </button>

          {/* Action 2: e-MAR Medication Pass */}
          <button
            type="button"
            className="mc-btn-live"
            onClick={() => setActiveTool('emar')}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              background: '#F8FAFC',
              padding: '14px 10px',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: '#EFF6FF', color: C.blue,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 8px',
            }}>
              <Pill size={20} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>e-MAR Pass</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Administer Meds</div>
          </button>

          {/* Action 3: Ward Beds Census */}
          <button
            type="button"
            className="mc-btn-live"
            onClick={() => setActiveTool('beds')}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              background: '#F8FAFC',
              padding: '14px 10px',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: '#F0FDF4', color: '#16A34A',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 8px',
            }}>
              <BedDouble size={20} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Ward Bed Board</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{occBeds.length} Occupied Beds</div>
          </button>

          {/* Action 4: Call Next Patient */}
          <button
            type="button"
            className="mc-btn-live"
            onClick={() => {
              if (waitingVisits.length > 0) {
                handleCallPatient(waitingVisits[0]);
              } else {
                flash('No patients currently waiting in OPD triage queue.');
              }
            }}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              background: '#F8FAFC',
              padding: '14px 10px',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: '#FEF3C7', color: '#D97706',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 8px',
            }}>
              <PhoneCall size={20} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Call Next OPD</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
              {waitingVisits.length} in Queue
            </div>
          </button>

          {/* Action 5: Add Care Task */}
          <button
            type="button"
            className="mc-btn-live"
            onClick={() => setShowAddTaskModal(true)}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              background: '#F8FAFC',
              padding: '14px 10px',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: '#F5F3FF', color: '#7C3AED',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 8px',
            }}>
              <Plus size={20} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Add Care Task</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Schedule Care / Med</div>
          </button>

          {/* Action 6: SBAR Shift Handover */}
          <button
            type="button"
            className="mc-btn-live"
            onClick={() => {
              setActiveTool('sbar');
              setShowSbarModal(true);
            }}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              background: '#F8FAFC',
              padding: '14px 10px',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: '#ECFEFF', color: '#0891B2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 8px',
            }}>
              <UserCheck size={20} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Shift SBAR</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Handover Report</div>
          </button>

          {/* Action 7: Doctor Orders on Bus */}
          <button
            type="button"
            className="mc-btn-live"
            onClick={() => setActiveTool('orders')}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              background: '#F8FAFC',
              padding: '14px 10px',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: '#FFF1F2', color: '#E11D48',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 8px',
            }}>
              <Activity size={20} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Doctor Orders</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{activeDoctorOrders.length} On Bus</div>
          </button>

          {/* Action 8: Celestia AI Nursing */}
          <button
            type="button"
            className="mc-btn-live"
            onClick={() => onNavigate('m87-ai')}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              background: '#F5F3FF',
              padding: '14px 10px',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: '#EDE9FE', color: '#7C3AED',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 8px',
            }}>
              <Brain size={20} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Celestia AI</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Nursing Assistant</div>
          </button>
        </div>
      </div>

      {/* 4. Realtime KPI Telemetry Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
      }}>
        <div style={{
          background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`,
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10, background: '#EFF6FF',
            color: C.blue, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Waiting for Triage</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{waitingVisits.length}</div>
            <div style={{ fontSize: 11, color: waitingVisits.length > 0 ? '#2563EB' : C.muted, fontWeight: 600 }}>
              {waitingVisits.length > 0 ? 'OPD intake active' : 'Queue clear'}
            </div>
          </div>
        </div>

        <div style={{
          background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`,
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10, background: '#ECFDF5',
            color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <BedDouble size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Inpatient Bed Census</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>
              {occBeds.length} <span style={{ fontSize: 14, fontWeight: 500, color: C.muted }}>/ {beds.length}</span>
            </div>
            <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>
              {beds.length > 0 ? `${Math.round((occBeds.length / beds.length) * 100)}% Occupancy` : 'Active Wards'}
            </div>
          </div>
        </div>

        <div style={{
          background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`,
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: overdueCareItems.length > 0 ? '#FEE2E2' : '#FEF3C7',
            color: overdueCareItems.length > 0 ? '#DC2626' : '#D97706',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Pill size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>e-MAR Med Passes</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: overdueCareItems.length > 0 ? '#DC2626' : C.text }}>
              {pendingCareItems.length} <span style={{ fontSize: 13, color: C.muted }}>Due</span>
            </div>
            <div style={{ fontSize: 11, color: overdueCareItems.length > 0 ? '#DC2626' : '#D97706', fontWeight: 600 }}>
              {overdueCareItems.length > 0 ? `${overdueCareItems.length} Overdue Attention` : 'All on schedule'}
            </div>
          </div>
        </div>

        <div style={{
          background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`,
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10, background: '#F5F3FF',
            color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Activity size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Doctor Orders on Bus</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{activeDoctorOrders.length}</div>
            <div style={{ fontSize: 11, color: '#7C3AED', fontWeight: 600 }}>
              Stat Meds & Lab Draws
            </div>
          </div>
        </div>

        <div style={{
          background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`,
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10, background: '#F0FDFA',
            color: '#0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Heart size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Vitals Taken Today</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{allVitals.length}</div>
            <div style={{ fontSize: 11, color: '#0D9488', fontWeight: 600 }}>
              Logged into EMR
            </div>
          </div>
        </div>
      </div>

      {/* 5. WORKSTATION TOOLS FOR THEIR WORK (Interactive clinical tab strip) */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        border: `1px solid ${C.border}`,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
      }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveTool('queue')}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              border: 'none',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              background: activeTool === 'queue' ? C.blue : '#F8FAFC',
              color: activeTool === 'queue' ? '#fff' : C.text,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s ease',
            }}
          >
            <Users size={16} />
            OPD Triage Queue
            <span style={{
              background: activeTool === 'queue' ? 'rgba(255,255,255,0.25)' : '#E2E8F0',
              padding: '2px 7px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
            }}>
              {waitingVisits.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('emar')}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              border: 'none',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              background: activeTool === 'emar' ? '#2563EB' : '#F8FAFC',
              color: activeTool === 'emar' ? '#fff' : C.text,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Pill size={16} />
            e-MAR & Care Kardex
            <span style={{
              background: activeTool === 'emar' ? 'rgba(255,255,255,0.25)' : overdueCareItems.length > 0 ? '#FEE2E2' : '#E2E8F0',
              color: activeTool === 'emar' ? '#fff' : overdueCareItems.length > 0 ? '#DC2626' : C.text,
              padding: '2px 7px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
            }}>
              {pendingCareItems.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('beds')}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              border: 'none',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              background: activeTool === 'beds' ? '#16A34A' : '#F8FAFC',
              color: activeTool === 'beds' ? '#fff' : C.text,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <BedDouble size={16} />
            Ward Beds & Board
            <span style={{
              background: activeTool === 'beds' ? 'rgba(255,255,255,0.25)' : '#E2E8F0',
              padding: '2px 7px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
            }}>
              {occBeds.length}/{beds.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('orders')}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              border: 'none',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              background: activeTool === 'orders' ? '#7C3AED' : '#F8FAFC',
              color: activeTool === 'orders' ? '#fff' : C.text,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Activity size={16} />
            Doctor Orders
            <span style={{
              background: activeTool === 'orders' ? 'rgba(255,255,255,0.25)' : '#E2E8F0',
              padding: '2px 7px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
            }}>
              {activeDoctorOrders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('sbar')}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              border: 'none',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              background: activeTool === 'sbar' ? '#0891B2' : '#F8FAFC',
              color: activeTool === 'sbar' ? '#fff' : C.text,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <UserCheck size={16} />
            Shift SBAR Log
            <span style={{
              background: activeTool === 'sbar' ? 'rgba(255,255,255,0.25)' : '#E2E8F0',
              padding: '2px 7px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
            }}>
              {sbars.length}
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setActiveTool('triage_station')}
          style={{
            padding: '7px 14px',
            borderRadius: 8,
            border: `1px solid #CBD5E1`,
            background: '#FFF',
            fontWeight: 700,
            fontSize: 12,
            color: '#0F172A',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Sparkles size={14} color="#7C3AED" /> Deep Waveform Console
        </button>
      </div>

      {/* ── TOOL VIEW 1: OPD TRIAGE & LIVE VITALS QUEUE ────────────────────────────────── */}
      {activeTool === 'queue' && (
        <div style={{
          background: '#fff',
          borderRadius: 16,
          border: `1px solid ${C.border}`,
          padding: 20,
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 10,
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>
                Live OPD Triage Queue
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>
                Patients checked in at Reception awaiting vital signs and NEWS2 assessment
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {waitingVisits.length > 0 && (
                <button
                  type="button"
                  className="mc-btn-live"
                  onClick={() => handleCallPatient(waitingVisits[0])}
                  style={{
                    background: '#FEF3C7',
                    border: '1px solid #FDE68A',
                    color: '#B45309',
                    padding: '8px 14px',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <PhoneCall size={14} /> Call Next: {waitingVisits[0].patientName}
                </button>
              )}
            </div>
          </div>

          {waitingVisits.length === 0 ? (
            <div style={{
              padding: '48px 24px',
              textAlign: 'center',
              background: '#F8FAFC',
              borderRadius: 12,
              border: `1px dashed ${C.border}`,
            }}>
              <Users size={36} color={C.muted} style={{ margin: '0 auto 10px', opacity: 0.6 }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                OPD Triage Queue is Clear
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                New reception check-ins appear here automatically in real time.
              </div>
            </div>
          ) : (
            <div className="os-table-wrap">
              <table className="os-table">
                <thead>
                  <tr>
                    <th>Queue #</th>
                    <th>Patient Name</th>
                    <th>Hospital Number</th>
                    <th>Department</th>
                    <th>Wait Time</th>
                    <th>Assigned Clinician</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Nursing Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {waitingVisits.map((v) => {
                    const mins = waitMins(v.checkedInAt);
                    const isLongWait = mins >= 15;
                    const hasVitals = allVitals.some((vit) => vit.patientId === v.patientId);

                    return (
                      <tr key={v.id}>
                        <td>
                          <span style={{
                            background: '#EFF6FF',
                            color: C.blue,
                            padding: '4px 8px',
                            borderRadius: 6,
                            fontWeight: 800,
                            fontSize: 12,
                          }}>
                            {v.queueNumber}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: C.text }}>{v.patientName}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{v.visitType}</div>
                        </td>
                        <td style={{ fontWeight: 600, color: '#334155' }}>{v.hospitalNumber}</td>
                        <td>
                          <span style={{
                            background: '#F1F5F9',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                          }}>
                            {v.department}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: isLongWait ? '#DC2626' : C.text,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}>
                            <Clock size={12} color={isLongWait ? '#DC2626' : C.muted} />
                            {mins} mins
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: '#334155' }}>
                          {v.doctor || 'General Pool'}
                        </td>
                        <td>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: v.status === 'called' ? '#ECFDF5' : hasVitals ? '#F0FDF4' : '#EFF6FF',
                            color: v.status === 'called' ? '#047857' : hasVitals ? '#16A34A' : '#1D4ED8',
                          }}>
                            {v.status === 'called' ? 'Called to Triage' : hasVitals ? 'Vitals Recorded' : 'Waiting for Vitals'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              type="button"
                              className="mc-btn-live"
                              onClick={() => handleCallPatient(v)}
                              style={{
                                padding: '5px 10px',
                                borderRadius: 8,
                                border: '1px solid #CBD5E1',
                                background: '#FFF',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                                color: C.text,
                              }}
                            >
                              Call
                            </button>
                            <button
                              type="button"
                              className="mc-btn-live"
                              onClick={() => handleOpenTriage(v)}
                              style={{
                                padding: '5px 12px',
                                borderRadius: 8,
                                border: 'none',
                                background: '#2563EB',
                                color: '#FFF',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <Heart size={12} /> Log Vitals
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TOOL VIEW 2: e-MAR & WARD CARE KARDEX ───────────────────────────────────── */}
      {activeTool === 'emar' && (
        <div style={{
          background: '#fff',
          borderRadius: 16,
          border: `1px solid ${C.border}`,
          padding: 20,
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 10,
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>
                Electronic Medication Administration Record (e-MAR) & Digital Kardex
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>
                Scheduled drug rounds, bedside care checklists, and nurse administration verifications
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', padding: 3, borderRadius: 8 }}>
                {(['all', 'pending', 'overdue', 'completed'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setKardexFilter(filter)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: 'none',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: kardexFilter === filter ? '#FFF' : 'transparent',
                      color: kardexFilter === filter ? C.blue : C.muted,
                      boxShadow: kardexFilter === filter ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                      textTransform: 'capitalize',
                    }}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="mc-btn-live"
                onClick={() => setShowAddTaskModal(true)}
                style={{
                  background: '#2563EB',
                  color: '#fff',
                  border: 'none',
                  padding: '7px 14px',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Plus size={14} /> Add Task
              </button>
            </div>
          </div>

          <div className="os-table-wrap">
            <table className="os-table">
              <thead>
                <tr>
                  <th>Bed / Ward</th>
                  <th>Patient Name</th>
                  <th>Prescribed Care / Medication</th>
                  <th>Dose & Route</th>
                  <th>Frequency</th>
                  <th>Scheduled Time</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Verification</th>
                </tr>
              </thead>
              <tbody>
                {filteredKardex.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 800, color: '#D97706' }}>{item.bedNumber}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{item.ward || 'Inpatient'}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: C.text }}>{item.patientName}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{item.hospitalNumber}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#1E293B' }}>{item.careActivity}</div>
                      {item.notes && <div style={{ fontSize: 11, color: '#64748B' }}>{item.notes}</div>}
                    </td>
                    <td style={{ fontSize: 12, color: '#334155' }}>
                      {item.dose || '—'} {item.route ? `(${item.route})` : ''}
                    </td>
                    <td style={{ color: C.muted, fontSize: 12, fontWeight: 600 }}>{item.frequency}</td>
                    <td>
                      <span style={{
                        fontWeight: 800,
                        fontSize: 12,
                        color: item.status === 'overdue' ? '#DC2626' : C.text,
                      }}>
                        {item.nextScheduledTime}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background:
                          item.status === 'completed'
                            ? '#ECFDF5'
                            : item.status === 'overdue'
                              ? '#FEE2E2'
                              : '#EFF6FF',
                        color:
                          item.status === 'completed'
                            ? '#047857'
                            : item.status === 'overdue'
                              ? '#DC2626'
                              : '#1D4ED8',
                      }}>
                        {item.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {item.status !== 'completed' ? (
                        <button
                          type="button"
                          className="mc-btn-live"
                          onClick={() => handleSignAdministration(item)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: 'none',
                            background: '#10B981',
                            color: '#FFF',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <CheckCircle2 size={13} /> Sign Administered
                        </button>
                      ) : (
                        <div style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>
                          <CheckCircle2 size={13} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
                          Verified by {item.administeredBy || 'Duty Nurse'}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TOOL VIEW 3: WARD BED BOARD & CENSUS ───────────────────────────────────── */}
      {activeTool === 'beds' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SharedBedStrip
            facilityId={facilityId}
            wardFilter={['Male Medical', 'Female Medical', 'Surgical', 'ICU', 'Paediatrics', 'Maternity']}
            title="Shared Realtime Bed Board (Synced with Operating Theatre & Maternity)"
          />

          <div style={{
            background: '#fff',
            borderRadius: 16,
            border: `1px solid ${C.border}`,
            padding: 20,
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              flexWrap: 'wrap',
              gap: 10,
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>
                  Clinical Bed Occupancy & Inpatient Census
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>
                  Realtime ward bed placements, patient admissions, and discharge tracking
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['all', 'Male Medical', 'Female Medical', 'Surgical', 'ICU', 'Paediatrics'].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setSelectedWard(w)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 8,
                      border: `1px solid ${selectedWard === w ? '#2563EB' : C.border}`,
                      background: selectedWard === w ? '#EFF6FF' : '#FFF',
                      color: selectedWard === w ? '#2563EB' : C.text,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {w === 'all' ? 'All Wards' : w}
                  </button>
                ))}
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 12,
            }}>
              {filteredBeds.map((bed) => {
                const isOccupied = bed.status === 'occupied' || bed.status === 'isolation';
                return (
                  <div
                    key={bed.id}
                    style={{
                      border: `1px solid ${isOccupied ? '#CBD5E1' : '#E2E8F0'}`,
                      borderRadius: 12,
                      padding: 14,
                      background: isOccupied ? '#FFFFFF' : '#F8FAFC',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: C.text }}>{bed.bedNo}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{bed.ward}</div>
                      </div>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background:
                          bed.status === 'occupied'
                            ? '#EFF6FF'
                            : bed.status === 'available'
                              ? '#ECFDF5'
                              : bed.status === 'isolation'
                                ? '#FEF3C7'
                                : '#F1F5F9',
                        color:
                          bed.status === 'occupied'
                            ? '#1D4ED8'
                            : bed.status === 'available'
                              ? '#047857'
                              : bed.status === 'isolation'
                                ? '#B45309'
                                : '#475569',
                        textTransform: 'uppercase',
                      }}>
                        {bed.status}
                      </span>
                    </div>

                    {isOccupied && bed.patient ? (
                      <div style={{ background: '#F1F5F9', padding: '8px 10px', borderRadius: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: C.text }}>{bed.patient}</div>
                        <div style={{ fontSize: 10, color: C.muted }}>
                          {bed.hospitalNumber || 'No MRN'} · Dr. {bed.doctor || 'Attending'}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#10B981', fontWeight: 600, padding: '8px 0' }}>
                        Ready for Admission
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 10, color: C.muted }}>
                        {bed.updatedAt ? new Date(bed.updatedAt).toLocaleDateString() : 'Active'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (isOccupied) {
                            flash(`Bed ${bed.bedNo}: ${bed.patient} chart opened.`);
                          } else {
                            flash(`Bed ${bed.bedNo} ready for patient transfer.`);
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: C.blue,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {isOccupied ? 'View Chart' : 'Assign'} →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TOOL VIEW 4: DOCTOR ORDERS ON CLINICAL BUS ──────────────────────────────── */}
      {activeTool === 'orders' && (
        <div style={{
          background: '#fff',
          borderRadius: 16,
          border: `1px solid ${C.border}`,
          padding: 20,
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 10,
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>
                Physician Orders on Clinical Event Bus
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>
                Live orders requiring nursing action: Stat meds, IV fluid orders, lab specimen collections, vitals frequency
              </div>
            </div>
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>
              {activeDoctorOrders.length} Pending Nursing Action
            </span>
          </div>

          {activeDoctorOrders.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: C.muted, fontSize: 13, background: '#F8FAFC', borderRadius: 12 }}>
              No active doctor orders pending on the clinical bus right now.
            </div>
          ) : (
            <div className="os-table-wrap">
              <table className="os-table">
                <thead>
                  <tr>
                    <th>Priority</th>
                    <th>Patient Name</th>
                    <th>Order Type</th>
                    <th>Prescription / Procedure</th>
                    <th>Ordered By</th>
                    <th>Time Placed</th>
                    <th>Payment</th>
                    <th style={{ textAlign: 'right' }}>Nurse Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeDoctorOrders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: o.priority === 'stat' ? '#FEE2E2' : o.priority === 'urgent' ? '#FEF3C7' : '#EFF6FF',
                          color: o.priority === 'stat' ? '#DC2626' : o.priority === 'urgent' ? '#B45309' : '#1D4ED8',
                          textTransform: 'uppercase',
                        }}>
                          {o.priority}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: C.text }}>{o.patientName}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{o.hospitalNumber}</div>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          background: '#F1F5F9',
                          padding: '2px 8px',
                          borderRadius: 6,
                          textTransform: 'uppercase',
                        }}>
                          {o.type}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0F172A' }}>{o.name}</div>
                        {o.notes && <div style={{ fontSize: 11, color: C.muted }}>{o.notes}</div>}
                      </td>
                      <td style={{ fontSize: 12, color: '#334155' }}>
                        {o.orderedBy}
                      </td>
                      <td style={{ fontSize: 11, color: C.muted }}>
                        {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: o.paymentCleared ? '#10B981' : '#D97706',
                        }}>
                          {o.paymentCleared ? 'Cleared' : 'Pending Pay'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="mc-btn-live"
                          onClick={() => {
                            updateOrderStatus(o.id, 'in_progress');
                            reload();
                            flash(`Order ${o.name} acknowledged for ${o.patientName}.`);
                          }}
                          style={{
                            padding: '5px 12px',
                            borderRadius: 8,
                            border: 'none',
                            background: '#7C3AED',
                            color: '#FFF',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Acknowledge & Act
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TOOL VIEW 5: SHIFT SBAR & HANDOVER LOG ─────────────────────────────────── */}
      {activeTool === 'sbar' && (
        <div style={{
          background: '#fff',
          borderRadius: 16,
          border: `1px solid ${C.border}`,
          padding: 20,
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 10,
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>
                Nursing Shift Handover Reports (SBAR Protocol)
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>
                Standardized Situation · Background · Assessment · Recommendation clinical shift transitions
              </div>
            </div>

            <button
              type="button"
              className="mc-btn-live"
              onClick={() => setShowSbarModal(true)}
              style={{
                background: '#0891B2',
                color: '#fff',
                border: 'none',
                padding: '7px 14px',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Plus size={14} /> New Shift Handoff
            </button>
          </div>

          {sbars.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: C.muted, fontSize: 13, background: '#F8FAFC', borderRadius: 12 }}>
              No shift handovers logged yet for today. Click &quot;New Shift Handoff&quot; to submit SBAR.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sbars.map((s) => (
                <div
                  key={s.id}
                  style={{
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                    padding: 16,
                    background: '#F8FAFC',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <span style={{ fontWeight: 800, color: C.text, fontSize: 14 }}>{s.ward}</span>
                      <span style={{ margin: '0 8px', color: C.muted }}>•</span>
                      <span style={{ fontSize: 12, color: '#0891B2', fontWeight: 700 }}>{s.shift}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      Outgoing: <strong>{s.outgoingNurse}</strong> → Incoming: <strong>{s.incomingNurse}</strong> •{' '}
                      {new Date(s.recordedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, fontSize: 12 }}>
                    <div style={{ background: '#FFF', padding: 10, borderRadius: 8, border: `1px solid ${C.border}` }}>
                      <div style={{ fontWeight: 800, color: '#DC2626', marginBottom: 2 }}>S - Situation</div>
                      <div style={{ color: '#334155', lineHeight: 1.4 }}>{s.situation}</div>
                    </div>
                    <div style={{ background: '#FFF', padding: 10, borderRadius: 8, border: `1px solid ${C.border}` }}>
                      <div style={{ fontWeight: 800, color: '#D97706', marginBottom: 2 }}>B - Background</div>
                      <div style={{ color: '#334155', lineHeight: 1.4 }}>{s.background}</div>
                    </div>
                    <div style={{ background: '#FFF', padding: 10, borderRadius: 8, border: `1px solid ${C.border}` }}>
                      <div style={{ fontWeight: 800, color: '#2563EB', marginBottom: 2 }}>A - Assessment</div>
                      <div style={{ color: '#334155', lineHeight: 1.4 }}>{s.assessment}</div>
                    </div>
                    <div style={{ background: '#FFF', padding: 10, borderRadius: 8, border: `1px solid ${C.border}` }}>
                      <div style={{ fontWeight: 800, color: '#16A34A', marginBottom: 2 }}>R - Recommendation</div>
                      <div style={{ color: '#334155', lineHeight: 1.4 }}>{s.recommendation}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: RAPID VITALS & OPD TRIAGE ENTRY ─────────────────────────────────── */}
      {triageModalPatient && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 580,
            boxShadow: '0 24px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
          }}>
            <div style={{
              background: '#0B1220', color: '#FFF', padding: '16px 20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>
                  OPD Triage & Vital Signs Entry
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>
                  {triageModalPatient.patientName} · Queue {triageModalPatient.queueNumber} · {triageModalPatient.hospitalNumber}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTriageModalPatient(null)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveVitals} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* NEWS2 Score Ribbon */}
              <div style={{
                background: `${liveNews2.color}15`,
                border: `1px solid ${liveNews2.color}40`,
                padding: '10px 14px',
                borderRadius: 10,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Activity size={18} color={liveNews2.color} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: liveNews2.color }}>
                      National Early Warning Score (NEWS2): {liveNews2.score}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      Clinical Risk: {liveNews2.risk}
                    </div>
                  </div>
                </div>
                <span style={{
                  background: liveNews2.color, color: '#FFF',
                  padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                }}>
                  {liveNews2.risk.toUpperCase()} RISK
                </span>
              </div>

              {/* Vitals Input Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>
                    BP Systolic (mmHg)
                  </label>
                  <input
                    type="number"
                    required
                    value={vitalsForm.bpSystolic}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, bpSystolic: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>
                    BP Diastolic (mmHg)
                  </label>
                  <input
                    type="number"
                    required
                    value={vitalsForm.bpDiastolic}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, bpDiastolic: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>
                    Heart Rate (bpm)
                  </label>
                  <input
                    type="number"
                    required
                    value={vitalsForm.pulse}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, pulse: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>
                    Temp (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={vitalsForm.tempC}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, tempC: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>
                    SpO2 (%)
                  </label>
                  <input
                    type="number"
                    required
                    value={vitalsForm.spo2}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, spo2: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>
                    Resp Rate (/min)
                  </label>
                  <input
                    type="number"
                    required
                    value={vitalsForm.respRate}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, respRate: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    value={vitalsForm.weightKg}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, weightKg: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>
                    Blood Glucose (mg/dL)
                  </label>
                  <input
                    type="number"
                    value={vitalsForm.glucose}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, glucose: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>
                    Duty Nurse
                  </label>
                  <input
                    type="text"
                    disabled
                    value={nurseName}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#F1F5F9', fontSize: 12 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>
                  Triage Notes / Observations
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Patient alert, oriented x3, complains of severe fever since last night"
                  value={vitalsForm.notes}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setTriageModalPatient(null)}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.border}`,
                    background: '#FFF', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 20px', borderRadius: 8, border: 'none',
                    background: '#2563EB', color: '#FFF', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <CheckCircle2 size={16} /> Save Vitals & Forward to Doctor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD CARE / MEDICATION TASK ───────────────────────────────────────── */}
      {showAddTaskModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 480,
            boxShadow: '0 24px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
          }}>
            <div style={{
              background: '#0B1220', color: '#FFF', padding: '16px 20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>
                Schedule Care / Medication Task
              </div>
              <button
                type="button"
                onClick={() => setShowAddTaskModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateCareTask} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>
                  Patient Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samuel Archibong"
                  value={newTask.patientName}
                  onChange={(e) => setNewTask({ ...newTask, patientName: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>
                    Ward *
                  </label>
                  <select
                    value={newTask.ward}
                    onChange={(e) => setNewTask({ ...newTask, ward: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }}
                  >
                    <option>Male Medical</option>
                    <option>Female Medical</option>
                    <option>Surgical Ward</option>
                    <option>ICU</option>
                    <option>Paediatrics</option>
                    <option>Maternity</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>
                    Bed Location *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bed 08"
                    value={newTask.bedNumber}
                    onChange={(e) => setNewTask({ ...newTask, bedNumber: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>
                  Care Activity / Drug Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. IV Ceftriaxone 1g in 100ml NS"
                  value={newTask.careActivity}
                  onChange={(e) => setNewTask({ ...newTask, careActivity: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>
                    Route
                  </label>
                  <select
                    value={newTask.route}
                    onChange={(e) => setNewTask({ ...newTask, route: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }}
                  >
                    <option>Oral</option>
                    <option>IV Push</option>
                    <option>IV Infusion</option>
                    <option>IM Injection</option>
                    <option>Subcutaneous</option>
                    <option>Topical / Dressing</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>
                    Scheduled Time
                  </label>
                  <input
                    type="time"
                    value={newTask.nextScheduledTime}
                    onChange={(e) => setNewTask({ ...newTask, nextScheduledTime: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowAddTaskModal(false)}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.border}`,
                    background: '#FFF', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px', borderRadius: 8, border: 'none',
                    background: '#2563EB', color: '#FFF', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Add to Kardex
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: SBAR SHIFT HANDOVER ─────────────────────────────────────────────── */}
      {showSbarModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 540,
            boxShadow: '0 24px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
          }}>
            <div style={{
              background: '#0B1220', color: '#FFF', padding: '16px 20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>
                Record SBAR Shift Handover
              </div>
              <button
                type="button"
                onClick={() => setShowSbarModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSbar} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>
                    Ward *
                  </label>
                  <select
                    value={sbarForm.ward}
                    onChange={(e) => setSbarForm({ ...sbarForm, ward: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }}
                  >
                    <option>Male Medical</option>
                    <option>Female Medical</option>
                    <option>Surgical Ward</option>
                    <option>ICU</option>
                    <option>Paediatrics</option>
                    <option>Maternity</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>
                    Incoming Nurse *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Nurse Blessing (NO II)"
                    value={sbarForm.incomingNurse}
                    onChange={(e) => setSbarForm({ ...sbarForm, incomingNurse: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', display: 'block', marginBottom: 2 }}>
                  S - Situation *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Total patients on ward, unstable patients, pending admissions..."
                  value={sbarForm.situation}
                  onChange={(e) => setSbarForm({ ...sbarForm, situation: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, resize: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#D97706', display: 'block', marginBottom: 2 }}>
                  B - Background
                </label>
                <textarea
                  rows={2}
                  placeholder="Key diagnoses, surgeries done today, antibiotic courses..."
                  value={sbarForm.background}
                  onChange={(e) => setSbarForm({ ...sbarForm, background: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, resize: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', display: 'block', marginBottom: 2 }}>
                  A - Assessment
                </label>
                <textarea
                  rows={2}
                  placeholder="Vitals stability, high NEWS2 alerts, drain outputs, IV lines..."
                  value={sbarForm.assessment}
                  onChange={(e) => setSbarForm({ ...sbarForm, assessment: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, resize: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', display: 'block', marginBottom: 2 }}>
                  R - Recommendation
                </label>
                <textarea
                  rows={2}
                  placeholder="Tasks due for incoming shift, stat meds, lab follow-ups..."
                  value={sbarForm.recommendation}
                  onChange={(e) => setSbarForm({ ...sbarForm, recommendation: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowSbarModal(false)}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.border}`,
                    background: '#FFF', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 20px', borderRadius: 8, border: 'none',
                    background: '#0891B2', color: '#FFF', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Save SBAR Handoff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NurseDeskHome;
