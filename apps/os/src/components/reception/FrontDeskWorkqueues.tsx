'use client';

/**
 * Epic Cadence / Cerner front-desk workqueues:
 * Provider schedule grid · No-show/recall · Referral intake · Estimates · Print pack
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  Calendar, Phone, UserPlus, Printer, Wallet, AlertTriangle, CheckCircle2,
  RefreshCw, Search, Clock, Ban, Layers,
} from 'lucide-react';
import { getActiveFacilityId } from '../../lib/adminRealtimeStore';
import { listPatients, searchPatients, type FacilityPatient } from '../../lib/patientRegistryStore';
import { listAppointments, listVisits, todayVisits } from '../../lib/receptionOpsStore';
import {
  ensureDayGrid,
  listSlots,
  bookSlot,
  blockSlot,
  openSlot,
  formatSlotTime,
  markNoShowAndRecall,
  markVisitNoShow,
  listRecalls,
  updateRecall,
  createReferral,
  listReferrals,
  convertReferralToVisit,
  buildEstimate,
  listEstimates,
  openPrintWindow,
  subscribeFrontDeskWq,
  RECEPTION_DEPTS,
  type ScheduleSlot,
  type RecallItem,
  type ReferralIntake,
  type VisitEstimate,
} from '../../lib/frontDeskWorkqueues';

type Tab = 'grid' | 'recall' | 'referral' | 'estimate' | 'print';

const C = {
  navy: '#0B1220',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  blue: '#2563EB',
  teal: '#0D9488',
  green: '#059669',
  red: '#DC2626',
  amber: '#D97706',
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export const FrontDeskWorkqueues: React.FC<{ session?: UserSession }> = ({ session }) => {
  const facilityId = getActiveFacilityId() || session?.hospitalId || 'IGH-EKT';
  const [tab, setTab] = useState<Tab>('grid');
  const [day, setDay] = useState(todayStr());
  const [dept, setDept] = useState('General OPD');
  const [doctor, setDoctor] = useState('Dr. Duty');
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [recalls, setRecalls] = useState<RecallItem[]>([]);
  const [referrals, setReferrals] = useState<ReferralIntake[]>([]);
  const [estimates, setEstimates] = useState<VisitEstimate[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [patientQ, setPatientQ] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<FacilityPatient | null>(null);
  const [overbook, setOverbook] = useState(false);

  // Referral form
  const [refForm, setRefForm] = useState({
    patientName: '',
    hospitalNumber: '',
    phone: '',
    fromFacility: '',
    fromClinician: '',
    toDepartment: 'General OPD',
    reason: '',
    urgency: 'routine' as 'routine' | 'urgent' | 'emergency',
  });

  const flash = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const reload = useCallback(() => {
    setSlots(listSlots(facilityId, day, doctor, dept));
    setRecalls(listRecalls(facilityId));
    setReferrals(listReferrals(facilityId));
    setEstimates(listEstimates(facilityId));
  }, [facilityId, day, doctor, dept]);

  useEffect(() => {
    reload();
    return subscribeFrontDeskWq(reload);
  }, [reload]);

  const patientHits = useMemo(() => {
    if (!patientQ.trim()) return [] as FacilityPatient[];
    try {
      return searchPatients(facilityId, patientQ, 8);
    } catch {
      return listPatients(facilityId)
        .filter((p) => {
          const q = patientQ.toLowerCase();
          return (
            p.firstName.toLowerCase().includes(q) ||
            p.lastName.toLowerCase().includes(q) ||
            p.hospitalNumber.toLowerCase().includes(q) ||
            (p.phone || '').includes(q)
          );
        })
        .slice(0, 8);
    }
  }, [patientQ, facilityId]);

  const ensureGrid = () => {
    ensureDayGrid({ facilityId, department: dept, doctor, day });
    reload();
    flash(`Grid ready · ${doctor} · ${dept} · ${day}`);
  };

  const onBook = (slot: ScheduleSlot) => {
    if (!selectedPatient) {
      flash('Select a patient first (search above)');
      return;
    }
    const res = bookSlot(slot.id, selectedPatient, overbook);
    if (!res) {
      flash(slot.status === 'blocked' ? 'Slot blocked' : 'Slot already booked — enable overbook');
      return;
    }
    flash(`Booked ${formatSlotTime(slot.startMin)} · ${selectedPatient.hospitalNumber}`);
    reload();
  };

  const onBlock = (slot: ScheduleSlot) => {
    const reason = 'Meeting / administrative hold';
    if (!blockSlot(slot.id, reason)) {
      flash('Cannot block a booked slot');
      return;
    }
    flash('Slot blocked');
    reload();
  };

  const todaysAppts = useMemo(() => listAppointments(facilityId, day), [facilityId, day, slots, recalls]);
  const todaysVisits = useMemo(() => todayVisits(facilityId), [facilityId, recalls]);

  const card: React.CSSProperties = {
    background: '#fff',
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
  };

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'grid', label: 'Provider grid', icon: Calendar },
    { key: 'recall', label: 'No-show / recall', icon: Phone },
    { key: 'referral', label: 'Referral intake', icon: UserPlus },
    { key: 'estimate', label: 'Estimate & clearance', icon: Wallet },
    { key: 'print', label: 'Print pack', icon: Printer },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: '100%' }}>
      <div
        style={{
          borderRadius: 18,
          padding: '18px 20px',
          background: 'linear-gradient(135deg,#0B1220 0%,#1E3A5F 55%,#0D9488 140%)',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.75, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Epic / Cerner workqueues
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 4 }}>
            Front desk command tools
          </div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
            Schedule grid · recall · referrals · estimates · print packs
          </div>
        </div>
        <button
          type="button"
          onClick={reload}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(255,255,255,0.1)',
            color: '#fff',
            borderRadius: 10,
            padding: '9px 14px',
            fontWeight: 700,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: active ? 'none' : `1px solid ${C.border}`,
                background: active ? 'linear-gradient(135deg,#0D9488,#0F766E)' : '#fff',
                color: active ? '#fff' : C.text,
                borderRadius: 999,
                padding: '9px 14px',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <Icon size={14} />
              {t.label}
              {t.key === 'recall' && recalls.filter((r) => r.status === 'open').length > 0 && (
                <span
                  style={{
                    background: active ? 'rgba(0,0,0,0.2)' : '#FEE2E2',
                    color: active ? '#fff' : '#B91C1C',
                    borderRadius: 999,
                    padding: '1px 7px',
                    fontSize: 10,
                    fontWeight: 800,
                  }}
                >
                  {recalls.filter((r) => r.status === 'open').length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Patient picker shared */}
      <div style={{ ...card, padding: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Patient context</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#94A3B8' }} />
            <input
              value={patientQ}
              onChange={(e) => setPatientQ(e.target.value)}
              placeholder="Search name, hospital no, phone…"
              style={{
                width: '100%',
                padding: '9px 12px 9px 32px',
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                fontSize: 13,
              }}
            />
          </div>
          {selectedPatient && (
            <div
              style={{
                background: '#ECFDF5',
                color: '#047857',
                borderRadius: 10,
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Selected: {selectedPatient.firstName} {selectedPatient.lastName} · {selectedPatient.hospitalNumber}
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                style={{ marginLeft: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#047857', fontWeight: 800 }}
              >
                ×
              </button>
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: C.muted }}>
            <input type="checkbox" checked={overbook} onChange={(e) => setOverbook(e.target.checked)} />
            Allow overbook
          </label>
        </div>
        {patientHits.length > 0 && !selectedPatient && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8, marginTop: 10 }}>
            {patientHits.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedPatient(p);
                  setPatientQ('');
                }}
                style={{
                  textAlign: 'left',
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: 10,
                  background: '#F8FAFC',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 13 }}>
                  {p.firstName} {p.lastName}
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>{p.hospitalNumber}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'grid' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ ...card, padding: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
            <label style={lab}>
              Day
              <input type="date" value={day} onChange={(e) => setDay(e.target.value)} style={inp} />
            </label>
            <label style={lab}>
              Clinic
              <select value={dept} onChange={(e) => setDept(e.target.value)} style={inp}>
                {RECEPTION_DEPTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label style={lab}>
              Provider
              <input value={doctor} onChange={(e) => setDoctor(e.target.value)} style={inp} placeholder="Dr. Name" />
            </label>
            <button type="button" onClick={ensureGrid} style={btnPrimary}>
              <Layers size={14} /> Build / load grid
            </button>
          </div>
          <div style={{ ...card, overflow: 'hidden' }}>
            {slots.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: C.muted }}>
                No slots — choose clinic/provider/day and click <strong>Build / load grid</strong>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8, padding: 14 }}>
                {slots.map((s) => {
                  const bg =
                    s.status === 'open'
                      ? '#ECFDF5'
                      : s.status === 'booked'
                        ? '#EFF6FF'
                        : s.status === 'overbook'
                          ? '#FEF3C7'
                          : '#F1F5F9';
                  const color =
                    s.status === 'open'
                      ? '#047857'
                      : s.status === 'booked'
                        ? '#1D4ED8'
                        : s.status === 'overbook'
                          ? '#B45309'
                          : '#64748B';
                  return (
                    <div
                      key={s.id}
                      style={{
                        borderRadius: 12,
                        border: `1px solid ${C.border}`,
                        background: bg,
                        padding: 10,
                        minHeight: 88,
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: 13, color }}>{formatSlotTime(s.startMin)}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', marginTop: 2 }}>{s.status}</div>
                      {s.patientName && (
                        <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: C.text }}>
                          {s.patientName}
                          <div style={{ fontWeight: 500, color: C.muted }}>{s.hospitalNumber}</div>
                        </div>
                      )}
                      {s.blockReason && <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{s.blockReason}</div>}
                      <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                        {(s.status === 'open' || (s.status === 'booked' && overbook)) && (
                          <button type="button" onClick={() => onBook(s)} style={btnTiny}>
                            Book
                          </button>
                        )}
                        {s.status === 'open' && (
                          <button type="button" onClick={() => onBlock(s)} style={btnTiny}>
                            Block
                          </button>
                        )}
                        {(s.status === 'blocked' || s.status === 'booked') && (
                          <button
                            type="button"
                            onClick={() => {
                              openSlot(s.id);
                              reload();
                              flash('Slot opened');
                            }}
                            style={btnTiny}
                          >
                            Open
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'recall' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ ...card, padding: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Mark no-show from today&apos;s appointments</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {todaysAppts.filter((a) => a.status === 'booked' || a.status === 'arrived').length === 0 && (
                <div style={{ color: C.muted, fontSize: 13 }}>No open appointments for {day}</div>
              )}
              {todaysAppts
                .filter((a) => a.status === 'booked' || a.status === 'arrived')
                .slice(0, 12)
                .map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1px solid ${C.border}`,
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{a.patientName}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>
                        {a.hospitalNumber} · {a.department} · {new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        markNoShowAndRecall(a.id, facilityId);
                        flash('No-show · added to recall queue');
                        reload();
                      }}
                      style={{ ...btnTiny, background: '#FEE2E2', color: '#B91C1C', border: 'none' }}
                    >
                      No-show
                    </button>
                  </div>
                ))}
            </div>
            {todaysVisits.filter((v) => v.status === 'waiting' || v.status === 'called').length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 800, marginBottom: 8, fontSize: 13 }}>Waiting visits → no-show</div>
                {todaysVisits
                  .filter((v) => v.status === 'waiting' || v.status === 'called')
                  .slice(0, 8)
                  .map((v) => (
                    <div
                      key={v.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderBottom: `1px solid ${C.border}`,
                        fontSize: 13,
                      }}
                    >
                      <span>
                        {v.patientName} · {v.queueNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          markVisitNoShow(v.id, facilityId);
                          flash('Visit no-show · recall opened');
                          reload();
                        }}
                        style={btnTiny}
                      >
                        No-show
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
          <div style={{ ...card, padding: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Recall workqueue</div>
            {recalls.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>No recalls yet</div>}
            {recalls.map((r) => (
              <div
                key={r.id}
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 8,
                  borderLeft: `4px solid ${r.status === 'open' ? C.red : C.green}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{r.patientName}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>
                      {r.hospitalNumber} · {r.department} · {r.doctor} · {r.reason.replace('_', ' ')}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase' }}>{r.status}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {r.status === 'open' && (
                    <button type="button" onClick={() => { updateRecall(r.id, { status: 'contacted' }); reload(); flash('Marked contacted'); }} style={btnTiny}>
                      Mark contacted
                    </button>
                  )}
                  {(r.status === 'open' || r.status === 'contacted') && (
                    <button type="button" onClick={() => { updateRecall(r.id, { status: 'rescheduled' }); reload(); flash('Rescheduled'); }} style={btnTiny}>
                      Rescheduled
                    </button>
                  )}
                  {r.status !== 'closed' && (
                    <button type="button" onClick={() => { updateRecall(r.id, { status: 'closed' }); reload(); }} style={btnTiny}>
                      Close
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'referral' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>
          <form
            style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!refForm.patientName.trim() || !refForm.fromFacility.trim() || !refForm.reason.trim()) {
                flash('Name, from facility, and reason required');
                return;
              }
              createReferral({
                patientId: selectedPatient?.id,
                patientName: refForm.patientName || `${selectedPatient?.firstName || ''} ${selectedPatient?.lastName || ''}`.trim(),
                hospitalNumber: refForm.hospitalNumber || selectedPatient?.hospitalNumber,
                phone: refForm.phone || selectedPatient?.phone,
                fromFacility: refForm.fromFacility,
                fromClinician: refForm.fromClinician,
                toDepartment: refForm.toDepartment,
                reason: refForm.reason,
                urgency: refForm.urgency,
                facilityId,
              });
              setRefForm({
                patientName: '',
                hospitalNumber: '',
                phone: '',
                fromFacility: '',
                fromClinician: '',
                toDepartment: 'General OPD',
                reason: '',
                urgency: 'routine',
              });
              flash('Referral intake saved');
              reload();
            }}
          >
            <div style={{ fontWeight: 800 }}>New referral intake</div>
            <input
              style={inp}
              placeholder="Patient name *"
              value={refForm.patientName}
              onChange={(e) => setRefForm({ ...refForm, patientName: e.target.value })}
            />
            <input
              style={inp}
              placeholder="Hospital number"
              value={refForm.hospitalNumber}
              onChange={(e) => setRefForm({ ...refForm, hospitalNumber: e.target.value })}
            />
            <input
              style={inp}
              placeholder="Phone"
              value={refForm.phone}
              onChange={(e) => setRefForm({ ...refForm, phone: e.target.value })}
            />
            <input
              style={inp}
              placeholder="Referring facility *"
              value={refForm.fromFacility}
              onChange={(e) => setRefForm({ ...refForm, fromFacility: e.target.value })}
            />
            <input
              style={inp}
              placeholder="Referring clinician"
              value={refForm.fromClinician}
              onChange={(e) => setRefForm({ ...refForm, fromClinician: e.target.value })}
            />
            <select style={inp} value={refForm.toDepartment} onChange={(e) => setRefForm({ ...refForm, toDepartment: e.target.value })}>
              {RECEPTION_DEPTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              style={inp}
              value={refForm.urgency}
              onChange={(e) => setRefForm({ ...refForm, urgency: e.target.value as typeof refForm.urgency })}
            >
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="emergency">Emergency</option>
            </select>
            <textarea
              style={{ ...inp, minHeight: 72 }}
              placeholder="Clinical reason *"
              value={refForm.reason}
              onChange={(e) => setRefForm({ ...refForm, reason: e.target.value })}
            />
            <button type="submit" style={btnPrimary}>
              Save referral
            </button>
          </form>
          <div style={{ ...card, padding: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Referral workqueue</div>
            {referrals.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>No referrals</div>}
            {referrals.map((r) => (
              <div key={r.id} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>{r.patientName}</div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  {r.fromFacility} → {r.toDepartment} · {r.urgency} · {r.status}
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>{r.reason}</div>
                {r.status !== 'converted' && r.status !== 'declined' && (
                  <button
                    type="button"
                    onClick={() => {
                      const res = convertReferralToVisit(referralIdSafe(r), selectedPatient, doctor);
                      if (res) {
                        flash(`Converted to visit ${res.visit.queueNumber}`);
                        reload();
                      } else flash('Convert failed');
                    }}
                    style={{ ...btnPrimary, marginTop: 8, width: '100%' }}
                  >
                    Convert to visit / queue
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'estimate' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ ...card, padding: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Pre-visit estimate & clearance</div>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: C.muted }}>
              Select patient, choose clinic, generate estimate (consult fee + optional extras). HMO patients → hmo_pending clearance.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
              <label style={lab}>
                Clinic
                <select value={dept} onChange={(e) => setDept(e.target.value)} style={inp}>
                  {RECEPTION_DEPTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  if (!selectedPatient) {
                    flash('Select a patient first');
                    return;
                  }
                  const est = buildEstimate({
                    facilityId,
                    patient: selectedPatient,
                    department: dept,
                    hmo: !!(selectedPatient.insuranceProvider && selectedPatient.insuranceProvider !== 'NONE'),
                  });
                  flash(`Estimate ₦${est.total.toLocaleString()} · ${est.clearance}`);
                  reload();
                }}
                style={btnPrimary}
              >
                Generate estimate
              </button>
            </div>
          </div>
          {estimates.map((e) => (
            <div key={e.id} style={{ ...card, padding: 14, borderLeft: `4px solid ${e.clearance === 'clear' ? C.green : e.clearance === 'hmo_pending' ? C.blue : C.amber}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{e.patientName}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>
                    {e.hospitalNumber} · {e.department}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>₦{e.total.toLocaleString()}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: C.muted }}>{e.clearance.replace('_', ' ')}</div>
                </div>
              </div>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, color: C.text }}>
                {e.lineItems.map((li, i) => (
                  <li key={i}>
                    {li.label} — ₦{li.amount.toLocaleString()}
                  </li>
                ))}
              </ul>
              {e.depositRequired > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: C.amber }}>
                  Deposit due: ₦{e.depositRequired.toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'print' && (
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Print pack</div>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: C.muted }}>
            Queue ticket · specimen/folder label · route slip (Cadence-style paper replacement)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {todaysVisits.slice(0, 15).map((v) => (
              <div
                key={v.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>
                    {v.patientName} · {v.queueNumber}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    {v.hospitalNumber} · {v.department}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() =>
                      openPrintWindow({
                        kind: 'queue_ticket',
                        patientName: v.patientName,
                        hospitalNumber: v.hospitalNumber,
                        department: v.department,
                        doctor: v.doctor,
                        queueNumber: v.queueNumber,
                        visitId: v.id,
                        checkedInAt: v.checkedInAt,
                        reason: v.reason,
                      })
                    }
                    style={btnTiny}
                  >
                    Ticket
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openPrintWindow({
                        kind: 'label',
                        patientName: v.patientName,
                        hospitalNumber: v.hospitalNumber,
                        department: v.department,
                        barcode: v.hospitalNumber,
                      })
                    }
                    style={btnTiny}
                  >
                    Label
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openPrintWindow({
                        kind: 'route_slip',
                        patientName: v.patientName,
                        hospitalNumber: v.hospitalNumber,
                        department: v.department,
                        doctor: v.doctor,
                        reason: v.reason,
                        checkedInAt: v.checkedInAt,
                      })
                    }
                    style={btnTiny}
                  >
                    Route slip
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openPrintWindow({
                        kind: 'full_pack',
                        patientName: v.patientName,
                        hospitalNumber: v.hospitalNumber,
                        department: v.department,
                        doctor: v.doctor,
                        queueNumber: v.queueNumber,
                        visitId: v.id,
                        barcode: v.hospitalNumber,
                        checkedInAt: v.checkedInAt,
                        reason: v.reason,
                      })
                    }
                    style={{ ...btnTiny, background: C.teal, color: '#fff', border: 'none' }}
                  >
                    Full pack
                  </button>
                </div>
              </div>
            ))}
            {todaysVisits.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>No visits today to print</div>}
          </div>
        </div>
      )}

      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 99999,
            background: '#0F766E',
            color: '#fff',
            padding: '12px 16px',
            borderRadius: 12,
            fontWeight: 600,
            fontSize: 13,
            boxShadow: '0 12px 32px rgba(15,118,110,0.35)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
};

function referralIdSafe(r: ReferralIntake) {
  return r.id;
}

const lab: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 11,
  fontWeight: 700,
  color: '#64748B',
};
const inp: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid #E2E8F0',
  fontSize: 13,
  fontWeight: 500,
  color: '#0F172A',
  minWidth: 140,
};
const btnPrimary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  background: 'linear-gradient(135deg,#0D9488,#0F766E)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '10px 14px',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
};
const btnTiny: React.CSSProperties = {
  border: '1px solid #E2E8F0',
  background: '#fff',
  borderRadius: 8,
  padding: '5px 9px',
  fontWeight: 700,
  fontSize: 11,
  cursor: 'pointer',
  color: '#334155',
};

export default FrontDeskWorkqueues;
