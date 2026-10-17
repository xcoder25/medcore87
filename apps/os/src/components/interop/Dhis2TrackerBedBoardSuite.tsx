'use client';

/**
 * Dhis2TrackerBedBoardSuite
 *
 * Implements Part 2 of the Technical Guide:
 * - Color-coded physical ward grid:
 *     • Green (Available): Bed ID is empty in active patient list
 *     • Red (Occupied): Bed ID matches active trackedEntityInstance
 *     • Yellow (Dirty / Turnover): Bed ID matches patient discharged within the last 2 hours
 * - Standardized string convention: WARD-ROOM-BED (e.g. ICU-RM102-B1)
 * - Stage journey visualizer: Stage 1 Admission -> Stage 2 Clinical Care -> Stage 3 Discharge
 * - Instant actions: Admit via Tracker, Transfer Bed, Discharge Patient (COMPLETED), Mark Clean
 * - 1-Click DHIS2 Metadata Package JSON Export
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  calculateSimulatedBedBoard,
  admitPatientTracker,
  transferPatientBedTracker,
  dischargePatientTracker,
  clearBedTurnover,
  subscribeDhis2Tracker,
  buildDhis2MetadataPackage,
  type SimulatedBedStatus,
} from '../../lib/dhis2TrackerBedBridge';
import {
  BedDouble, CheckCircle2, AlertTriangle, Clock, RefreshCw,
  Download, Plus, ArrowRight, UserCheck, Stethoscope, FileText, Sparkles, X, Activity, User
} from 'lucide-react';

interface Props {
  facilityId?: string;
  facilityName?: string;
  onNavigatePatient?: (patientId: string) => void;
}

export const Dhis2TrackerBedBoardSuite: React.FC<Props> = ({
  facilityId = 'IGH-EKT',
  facilityName = 'General Hospital',
  onNavigatePatient,
}) => {
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [selectedBed, setSelectedBed] = useState<SimulatedBedStatus | null>(null);
  const [showAdmitModal, setShowAdmitModal] = useState<boolean>(false);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [showDischargeModal, setShowDischargeModal] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  // Forms
  const [admitForm, setAdmitForm] = useState({
    patientName: '',
    hospitalNumber: '',
    diagnosis: '',
    priority: 'routine' as 'routine' | 'urgent' | 'emergency',
  });

  const [transferForm, setTransferForm] = useState({
    newWard: 'Male Medical',
    newRoom: 'RM02',
    newBed: 'B1',
  });

  const [dischargeOutcome, setDischargeOutcome] = useState<'discharged' | 'referred' | 'deceased'>('discharged');

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    const unsub = subscribeDhis2Tracker(reload);
    const interval = setInterval(reload, 30000); // 30s auto-refresh for turnover countdowns
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  const beds = useMemo(() => {
    return calculateSimulatedBedBoard(facilityId, 2);
  }, [facilityId, version]);

  const filteredBeds = useMemo(() => {
    if (selectedWard === 'all') return beds;
    return beds.filter((b) => b.ward.toLowerCase().includes(selectedWard.toLowerCase()));
  }, [beds, selectedWard]);

  // Counts
  const availableCount = beds.filter((b) => b.state === 'available').length;
  const occupiedCount = beds.filter((b) => b.state === 'occupied').length;
  const cleaningCount = beds.filter((b) => b.state === 'cleaning').length;

  const handleDownloadMetadata = () => {
    const pkg = buildDhis2MetadataPackage();
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dhis2_inpatient_tracker_metadata_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    flash('DHIS2 Inpatient Tracker Metadata JSON exported.');
  };

  const handleAdmitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBed || !admitForm.patientName.trim()) return;

    admitPatientTracker({
      facilityId,
      patientName: admitForm.patientName.trim(),
      hospitalNumber: admitForm.hospitalNumber.trim() || `GH-${Date.now().toString().slice(-4)}`,
      ward: selectedBed.ward,
      room: selectedBed.room,
      bed: selectedBed.bed,
      diagnosis: admitForm.diagnosis.trim() || 'General Inpatient Observation',
      priority: admitForm.priority,
    });

    setShowAdmitModal(false);
    setAdmitForm({ patientName: '', hospitalNumber: '', diagnosis: '', priority: 'routine' });
    reload();
    flash(`Patient admitted to ${selectedBed.bedKey} via DHIS2 Tracker.`);
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBed?.patient) return;

    transferPatientBedTracker(
      selectedBed.patient.enrollmentId,
      transferForm.newWard,
      transferForm.newRoom,
      transferForm.newBed
    );

    setShowTransferModal(false);
    setSelectedBed(null);
    reload();
    flash(`Patient transferred to ${transferForm.newWard}-${transferForm.newRoom}-${transferForm.newBed}.`);
  };

  const handleDischargeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBed?.patient) return;

    dischargePatientTracker(selectedBed.patient.enrollmentId, dischargeOutcome);
    setShowDischargeModal(false);
    setSelectedBed(null);
    reload();
    flash(`Patient discharged. Bed placed in 2-hour Turnover / Cleaning state (Yellow).`);
  };

  const handleClearTurnover = (bedKey: string) => {
    clearBedTurnover(bedKey);
    reload();
    flash(`Bed ${bedKey} marked cleaned and sanitized. State updated to Available (Green).`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toast Notification */}
      {notice && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 99999,
          background: '#0F172A', color: '#F8FAFC', border: '1px solid #10B981',
          borderRadius: 12, padding: '12px 18px', boxShadow: '0 12px 30px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.86rem', fontWeight: 600
        }}>
          <CheckCircle2 size={18} color="#10B981" />
          <span>{notice}</span>
        </div>
      )}

      {/* Header & Architecture Overview Bar */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: 16,
        border: '1px solid #E2E8F0',
        padding: '18px 22px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 14,
        boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: '#EFF6FF', border: '1px solid #BFDBFE',
            color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <BedDouble size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', letterSpacing: -0.3 }}>
                DHIS2 Tracker · Simulated Bed Board
              </span>
              <span style={{
                background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0',
                borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700
              }}>
                WARD-ROOM-BED Standard Active
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
              Patient-level Tracker Programs cross-referenced with physical bed inventory for real-time ward logistics
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleDownloadMetadata}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '8px 14px',
              borderRadius: 10, fontSize: 12, fontWeight: 700, color: '#0F172A', cursor: 'pointer'
            }}
          >
            <Download size={14} color="#2563EB" /> Export DHIS2 Metadata JSON
          </button>
          <button
            type="button"
            onClick={reload}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#2563EB', border: 'none', padding: '8px 14px',
              borderRadius: 10, fontSize: 12, fontWeight: 700, color: '#FFFFFF', cursor: 'pointer'
            }}
          >
            <RefreshCw size={13} /> Refresh Board
          </button>
        </div>
      </div>

      {/* Real-time State Indicators / KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
      }}>
        <div style={{
          background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0',
          padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: '#DC262615',
            color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <User size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Occupied Beds</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#DC2626' }}>{occupiedCount}</div>
            <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 600 }}>Active Inpatient Enrollment</div>
          </div>
        </div>

        <div style={{
          background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0',
          padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: '#EAB30815',
            color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Cleaning / Turnover</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#B45309' }}>{cleaningCount}</div>
            <div style={{ fontSize: 11, color: '#B45309', fontWeight: 600 }}>Discharged within &lt; 2 hrs</div>
          </div>
        </div>

        <div style={{
          background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0',
          padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: '#16A34A15',
            color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Available Beds</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#16A34A' }}>{availableCount}</div>
            <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>Ready for Admission</div>
          </div>
        </div>

        <div style={{
          background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0',
          padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: '#EFF6FF',
            color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Activity size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Total Ward Capacity</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A' }}>{beds.length}</div>
            <div style={{ fontSize: 11, color: '#2563EB', fontWeight: 600 }}>
              {Math.round((occupiedCount / beds.length) * 100)}% Census
            </div>
          </div>
        </div>
      </div>

      {/* Ward Filter Bar & Legend */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: 16,
        border: '1px solid #E2E8F0',
        padding: '14px 18px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['all', 'ICU', 'Male Medical', 'Female Medical', 'Surgical', 'Paediatrics', 'Maternity'].map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setSelectedWard(w)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: `1px solid ${selectedWard === w ? '#2563EB' : '#E2E8F0'}`,
                background: selectedWard === w ? '#EFF6FF' : '#FFF',
                color: selectedWard === w ? '#2563EB' : '#334155',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {w === 'all' ? 'All Wards' : w}
            </button>
          ))}
        </div>

        {/* Color Legend */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontSize: 12, fontWeight: 700 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#16A34A' }} />
            <span style={{ color: '#16A34A' }}>Green: Available</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#DC2626' }} />
            <span style={{ color: '#DC2626' }}>Red: Occupied</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#EAB308' }} />
            <span style={{ color: '#B45309' }}>Yellow: Dirty (&lt; 2h Turnover)</span>
          </div>
        </div>
      </div>

      {/* Physical Ward Visual Grid */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: 16,
        border: '1px solid #E2E8F0',
        padding: 20,
      }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
            Hospital Ward Physical Bed Map
          </div>
          <div style={{ fontSize: 12, color: '#64748B' }}>
            Click an available bed to admit via Tracker, or an occupied bed to view stages, transfer, or discharge
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
          gap: 12,
        }}>
          {filteredBeds.map((bed) => {
            const isOcc = bed.state === 'occupied';
            const isClean = bed.state === 'cleaning';
            const isAvail = bed.state === 'available';

            return (
              <div
                key={bed.bedKey}
                onClick={() => {
                  setSelectedBed(bed);
                  if (isAvail) setShowAdmitModal(true);
                }}
                style={{
                  border: `2px solid ${isOcc ? '#DC2626' : isClean ? '#EAB308' : '#16A34A'}`,
                  borderRadius: 14,
                  padding: '14px',
                  background: isOcc ? '#FEF2F2' : isClean ? '#FEFCE8' : '#F0FDF4',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 10,
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                        {bed.bedKey}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        {bed.ward} · {bed.room}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: isOcc ? '#DC2626' : isClean ? '#EAB308' : '#16A34A',
                      color: '#FFFFFF',
                      textTransform: 'uppercase',
                    }}>
                      {bed.stateLabel}
                    </span>
                  </div>

                  {/* Bed Details */}
                  {isOcc && bed.patient && (
                    <div style={{
                      marginTop: 8,
                      background: 'rgba(255,255,255,0.85)',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: '1px solid #FECACA',
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A' }}>
                        {bed.patient.patientName}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        {bed.patient.hospitalNumber} · {bed.patient.diagnosis || 'Inpatient'}
                      </div>
                      <div style={{ fontSize: 10, color: '#DC2626', marginTop: 4, fontWeight: 700 }}>
                        DHIS2 TEI: {bed.patient.teiId.slice(0, 10)}...
                      </div>
                    </div>
                  )}

                  {isClean && bed.discharge && (
                    <div style={{
                      marginTop: 8,
                      background: 'rgba(255,255,255,0.85)',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: '1px solid #FEF08A',
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#B45309' }}>
                        Discharged {bed.discharge.minutesSinceDischarge}m ago
                      </div>
                      <div style={{ fontSize: 10, color: '#64748B' }}>
                        Outcome: {bed.discharge.outcome.toUpperCase()}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearTurnover(bed.bedKey);
                        }}
                        style={{
                          marginTop: 6,
                          width: '100%',
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: 'none',
                          background: '#16A34A',
                          color: '#FFF',
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        ✓ Mark Clean & Ready
                      </button>
                    </div>
                  )}

                  {isAvail && (
                    <div style={{
                      marginTop: 8,
                      padding: '8px 0',
                      fontSize: 11,
                      color: '#16A34A',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <Plus size={13} /> Click to Admit Patient
                    </div>
                  )}
                </div>

                <div style={{
                  paddingTop: 8,
                  borderTop: '1px solid rgba(0,0,0,0.06)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 10,
                  color: '#64748B',
                }}>
                  <span>DHIS2 Code: {bed.bed}</span>
                  <span style={{ fontWeight: 700, color: bed.color }}>
                    {isOcc ? 'View Profile →' : isClean ? 'Turnover Active' : 'Unallocated'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MODAL: PATIENT DHIS2 TRACKER PROFILE & ACTIONS ─────────────────────────── */}
      {selectedBed && selectedBed.state === 'occupied' && selectedBed.patient && (
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
                  DHIS2 Tracker · Inpatient Profile
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>
                  TEI: {selectedBed.patient.teiId} · Enrollment: {selectedBed.patient.enrollmentId}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBed(null)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Patient Banner */}
              <div style={{
                background: '#F8FAFC', padding: 14, borderRadius: 12, border: '1px solid #E2E8F0',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
                    {selectedBed.patient.patientName}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    Hospital No: <strong>{selectedBed.patient.hospitalNumber}</strong> · Priority: {selectedBed.patient.priority?.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 12, color: '#334155', marginTop: 2 }}>
                    Diagnosis: <strong>{selectedBed.patient.diagnosis}</strong>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#64748B' }}>Assigned Location</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#2563EB' }}>
                    {selectedBed.bedKey}
                  </div>
                </div>
              </div>

              {/* 3-Stage Patient Journey Visualizer */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>
                  DHIS2 Tracker Stages (Longitudinal Patient Journey)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <div style={{
                    background: '#ECFDF5', border: '1px solid #A7F3D0', padding: 10, borderRadius: 8
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#047857' }}>Stage 1: Admission</div>
                    <div style={{ fontSize: 10, color: '#065F46', marginTop: 2 }}>COMPLETED ✓</div>
                    <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{selectedBed.bedKey}</div>
                  </div>
                  <div style={{
                    background: '#EFF6FF', border: '1px solid #BFDBFE', padding: 10, borderRadius: 8
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#1D4ED8' }}>Stage 2: Clinical Care</div>
                    <div style={{ fontSize: 10, color: '#1E40AF', marginTop: 2 }}>REPEATABLE · ACTIVE</div>
                    <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>Daily Vitals & Meds</div>
                  </div>
                  <div style={{
                    background: '#F1F5F9', border: '1px solid #CBD5E1', padding: 10, borderRadius: 8
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#475569' }}>Stage 3: Discharge</div>
                    <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>PENDING</div>
                    <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>Frees Bed on Complete</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid #E2E8F0' }}>
                <button
                  type="button"
                  onClick={() => setShowTransferModal(true)}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: '1px solid #CBD5E1',
                    background: '#FFF', color: '#0F172A', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  🔄 Transfer Bed / Ward (PUT /events)
                </button>
                <button
                  type="button"
                  onClick={() => setShowDischargeModal(true)}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: 'none',
                    background: '#DC2626', color: '#FFF', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  🚪 Discharge & Free Bed (COMPLETED)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ADMIT PATIENT TRACKER (STAGE 1) ─────────────────────────────────── */}
      {showAdmitModal && selectedBed && (
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
              <div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>
                  Enroll Patient: Inpatient Tracker
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>
                  Assigning to {selectedBed.bedKey} ({selectedBed.ward})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdmitModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAdmitSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>
                  Patient Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samuel Archibong"
                  value={admitForm.patientName}
                  onChange={(e) => setAdmitForm({ ...admitForm, patientName: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>
                  Hospital Number (MRN)
                </label>
                <input
                  type="text"
                  placeholder="e.g. GH-2026-0891"
                  value={admitForm.hospitalNumber}
                  onChange={(e) => setAdmitForm({ ...admitForm, hospitalNumber: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>
                  Admitting Diagnosis *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Severe Malaria with Anaemia"
                  value={admitForm.diagnosis}
                  onChange={(e) => setAdmitForm({ ...admitForm, diagnosis: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>
                  Triage Priority
                </label>
                <select
                  value={admitForm.priority}
                  onChange={(e) => setAdmitForm({ ...admitForm, priority: e.target.value as any })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                >
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency / Resus</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setShowAdmitModal(false)}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: '1px solid #CBD5E1',
                    background: '#FFF', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px', borderRadius: 8, border: 'none',
                    background: '#16A34A', color: '#FFF', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6
                  }}
                >
                  <CheckCircle2 size={14} /> Enroll & Occupy Bed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: TRANSFER BED (UPDATE LOCATION EVENT) ─────────────────────────────── */}
      {showTransferModal && selectedBed?.patient && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100000,
          background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 440,
            boxShadow: '0 24px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
          }}>
            <div style={{
              background: '#0B1220', color: '#FFF', padding: '16px 20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>
                Transfer Inpatient Bed (PUT /events)
              </div>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, color: '#64748B' }}>
                Transferring <strong>{selectedBed.patient.patientName}</strong> from <strong>{selectedBed.bedKey}</strong>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>
                  Target Ward *
                </label>
                <select
                  value={transferForm.newWard}
                  onChange={(e) => setTransferForm({ ...transferForm, newWard: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                >
                  <option>Male Medical</option>
                  <option>Female Medical</option>
                  <option>Surgical</option>
                  <option>ICU</option>
                  <option>Paediatrics</option>
                  <option>Maternity</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>
                    Room Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={transferForm.newRoom}
                    onChange={(e) => setTransferForm({ ...transferForm, newRoom: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>
                    Bed Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={transferForm.newBed}
                    onChange={(e) => setTransferForm({ ...transferForm, newBed: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: '1px solid #CBD5E1',
                    background: '#FFF', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px', borderRadius: 8, border: 'none',
                    background: '#2563EB', color: '#FFF', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: DISCHARGE PATIENT & TRIGGER 2-HOUR TURNOVER ─────────────────────── */}
      {showDischargeModal && selectedBed?.patient && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100000,
          background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 440,
            boxShadow: '0 24px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
          }}>
            <div style={{
              background: '#0B1220', color: '#FFF', padding: '16px 20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>
                Discharge Patient & Free Bed
              </div>
              <button
                type="button"
                onClick={() => setShowDischargeModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleDischargeSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                background: '#FEF3C7', border: '1px solid #FDE68A', padding: 10, borderRadius: 8,
                fontSize: 12, color: '#B45309', lineHeight: 1.4
              }}>
                Completing Stage 3: Discharge closes the DHIS2 enrollment (status: COMPLETED) and automatically transitions <strong>{selectedBed.bedKey}</strong> into a 2-hour Turnover / Cleaning state (Yellow).
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>
                  Discharge Outcome *
                </label>
                <select
                  value={dischargeOutcome}
                  onChange={(e) => setDischargeOutcome(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                >
                  <option value="discharged">Discharged Home (Stable)</option>
                  <option value="referred">Referred to Tertiary Hospital</option>
                  <option value="deceased">Deceased</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setShowDischargeModal(false)}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: '1px solid #CBD5E1',
                    background: '#FFF', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px', borderRadius: 8, border: 'none',
                    background: '#DC2626', color: '#FFF', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Complete Discharge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dhis2TrackerBedBoardSuite;
