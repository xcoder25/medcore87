'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  BedDouble,
  UserPlus,
  X,
  CheckCircle2,
  ArrowRight,
  Clock,
  FileText,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import {
  listBeds,
  listWards,
  occupiedBeds,
  availableBeds,
  ensureDefaultBeds,
  admitToBed,
  transferPatient,
  dischargeBed,
  setExpectedDischarge,
  wardCapacitySummary,
  subscribeBeds,
  losDays,
  type BedRecord,
} from '../../lib/bedBoardStore';
import { listPatients, subscribePatients, type FacilityPatient } from '../../lib/patientRegistryStore';
import { VerifiedPatientField } from '../common/VerifiedPatientField';
import { verifyPatientExists, formatFullPatientName } from '../../lib/patientVerification';
import { updateVisitStatus } from '../../lib/receptionOpsStore';
import { broadcastOpdStage } from '../../hooks/useOpdSync';
import { placeOrder } from '../../lib/clinicalEventBus';
import { pushNotification } from '../../lib/notificationEngine';
import { sendPaymentRequestToAccounts } from '../../lib/frontDeskAccountsBridge';
import { appendAudit } from '../../lib/auditLogStore';
import { emitLiveAction } from '../../lib/liveActions';

export interface AdmitPatientSeed {
  id?: string;
  name: string;
  hospitalNumber?: string;
  diagnosis?: string;
  visitId?: string;
}

interface AdmitModalProps {
  facilityId: string;
  facilityName?: string;
  doctorName: string;
  doctorBadge?: string;
  initialPatient?: AdmitPatientSeed | null;
  initialWard?: string;
  onClose: () => void;
  onAdmitted?: (bed: BedRecord) => void;
}

export const AdmitToBedModal: React.FC<AdmitModalProps> = ({
  facilityId,
  facilityName = 'Hospital Facility',
  doctorName,
  doctorBadge,
  initialPatient,
  initialWard,
  onClose,
  onAdmitted,
}) => {
  const [patients, setPatients] = useState<FacilityPatient[]>([]);
  const [wardsList, setWardsList] = useState<string[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatient?.id || '');
  const [patientName, setPatientName] = useState(initialPatient?.name || '');
  const [hospitalNumber, setHospitalNumber] = useState(initialPatient?.hospitalNumber || '');
  const [selectedWard, setSelectedWard] = useState(initialWard || '');
  const [selectedBedId, setSelectedBedId] = useState('');
  const [diagnosis, setDiagnosis] = useState(initialPatient?.diagnosis || '');
  const [expectedDischarge, setEdd] = useState('');
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'emergency'>('routine');
  const [isolation, setIsolation] = useState(false);
  const [nursingOrders, setNursingOrders] = useState('');
  const [billDeposit, setBillDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState('25000');
  const [error, setError] = useState('');

  useEffect(() => {
    ensureDefaultBeds(facilityId);
    const loadData = () => {
      const pts = listPatients(facilityId);
      setPatients(pts);
      const ws = listWards(facilityId);
      setWardsList(ws);
      if (!selectedWard && ws.length > 0) {
        // Pick first ward that has available beds, else first ward
        const firstAvail = ws.find((w) => availableBeds(facilityId, w).length > 0) || ws[0];
        setSelectedWard(firstAvail);
      }
    };
    loadData();
    const u1 = subscribePatients(loadData);
    const u2 = subscribeBeds(loadData);
    return () => {
      u1();
      u2();
    };
  }, [facilityId, selectedWard]);

  const wardAvailableBeds = useMemo(() => {
    if (!selectedWard) return [];
    return availableBeds(facilityId, selectedWard);
  }, [facilityId, selectedWard, wardsList]);

  useEffect(() => {
    if (wardAvailableBeds.length > 0) {
      if (!wardAvailableBeds.some((b) => b.id === selectedBedId)) {
        setSelectedBedId(wardAvailableBeds[0].id);
      }
    } else {
      setSelectedBedId('');
    }
  }, [wardAvailableBeds, selectedBedId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanDx = diagnosis.trim();
    const verif = verifyPatientExists(facilityId, {
      patientId: selectedPatientId || undefined,
      hospitalNumber: hospitalNumber.trim() || undefined,
      patientName: patientName.trim() || undefined,
    });
    if (!verif.valid || !verif.patient) {
      setError(verif.error || 'Select or verify a registered patient before admitting.');
      return;
    }
    if (!selectedBedId) {
      setError('Select a ward with an available bed before admitting.');
      return;
    }
    if (!cleanDx) {
      setError('Enter an admitting / working diagnosis.');
      return;
    }

    const verified = verif.patient;
    const cleanName = formatFullPatientName(verified);
    const resolvedHospNo = verified.hospitalNumber || verified.id;
    const resolvedPid = verified.id;

    admitToBed(selectedBedId, {
      patient: cleanName,
      patientId: resolvedPid,
      hospitalNumber: resolvedHospNo,
      doctor: doctorName,
      diagnosis: cleanDx,
      expectedDischarge: expectedDischarge || undefined,
      isolation,
      actor: doctorName,
    });

    const updatedBed = listBeds(facilityId).find((b) => b.id === selectedBedId);

    // 1. Transition active OPD consultation visit out of clinic queue
    if (initialPatient?.visitId) {
      try {
        updateVisitStatus(initialPatient.visitId, 'completed');
        broadcastOpdStage('medcore_reception', {
          facilityId,
          patientId: resolvedPid || '',
          visitId: initialPatient.visitId,
          stage: 'completed',
          patientName: cleanName,
        });
      } catch {
        /* ignore */
      }
    }

    // 2. Place admission nursing / clinical protocol order when specified
    if (nursingOrders.trim()) {
      try {
        placeOrder({
          facilityId,
          patientId: resolvedPid || cleanName,
          patientName: cleanName,
          hospitalNumber: resolvedHospNo || 'INPATIENT',
          type: 'procedure',
          code: 'ADM-CARE',
          name: `Inpatient Ward Care (${selectedWard} · ${updatedBed?.bedNo || ''}): ${nursingOrders.trim()}`,
          orderedBy: doctorName,
          orderedByBadge: doctorBadge,
          priority: priority === 'emergency' ? 'stat' : priority,
          notes: `Admitting Dx: ${cleanDx}`,
        });
      } catch {
        /* ignore */
      }
    }

    // 3. Optional admission deposit invoice to Accounts
    const depNgn = Math.max(0, Number(depositAmount) || 0);
    if (billDeposit && depNgn > 0) {
      try {
        sendPaymentRequestToAccounts({
          facilityId,
          facilityName,
          patientId: resolvedPid || resolvedHospNo || cleanName,
          hospitalNumber: resolvedHospNo || 'INPATIENT',
          patientName: cleanName,
          amountNgn: depNgn,
          purpose: `Inpatient Admission Deposit · ${selectedWard} (${updatedBed?.bedNo || ''})`,
          source: 'billing_office',
          sentBy: doctorName,
          sentByBadge: doctorBadge,
        });
      } catch {
        /* ignore */
      }
    }

    // 4. Notify Nursing & Ward station
    try {
      pushNotification({
        facilityId,
        level: priority === 'emergency' ? 'critical' : 'important',
        title: `New Ward Admission · ${selectedWard} (${updatedBed?.bedNo || 'Bed'})`,
        body:
          `${cleanName}${resolvedHospNo ? ` (${resolvedHospNo})` : ''} admitted by ${doctorName}.\n` +
          `Diagnosis: ${cleanDx}${isolation ? ' · ISOLATION PRECAUTIONS' : ''}` +
          (nursingOrders.trim() ? `\nWard Orders: ${nursingOrders.trim()}` : ''),
        module: 'beds',
        patientId: resolvedPid,
        roleHint: 'nurse',
      });
    } catch {
      /* ignore */
    }

    // 5. Audit & Live Stream
    try {
      appendAudit({
        facilityId,
        actor: doctorName,
        actorBadge: doctorBadge,
        category: 'clinical',
        severity: priority === 'emergency' ? 'critical' : 'normal',
        action: 'DOCTOR_ADMIT_TO_BED',
        entity: 'bed_board',
        entityId: selectedBedId,
        detail: `Admitted ${cleanName} (${resolvedHospNo || 'N/A'}) to ${selectedWard} · ${updatedBed?.bedNo || selectedBedId} · Dx: ${cleanDx}`,
      });
    } catch {
      /* ignore */
    }

    emitLiveAction(
      `Dr ${doctorName} admitted ${cleanName} → ${updatedBed?.bedNo || ''} (${selectedWard})`,
      { module: 'doctor-portal' }
    );

    if (updatedBed && onAdmitted) onAdmitted(updatedBed);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Admit Patient to Inpatient Bed"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          borderRadius: 18,
          width: '100%',
          maxWidth: 540,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 24px 64px rgba(15, 23, 42, 0.3)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #0052D4 0%, #0D9488 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BedDouble size={20} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Admit Patient to Inpatient Ward &amp; Bed</div>
              <div style={{ fontSize: 11.5, opacity: 0.85 }}>
                Admitting Clinician: {doctorName} · Syncs live to Nursing &amp; Bed Census
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close admit modal"
            style={{ background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: 8, padding: 6, color: '#fff', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <VerifiedPatientField
            facilityId={facilityId}
            selectedPatientId={selectedPatientId}
            initialName={initialPatient?.name}
            initialHospitalNumber={initialPatient?.hospitalNumber}
            required
            label="Patient Name or Hospital No."
            onSelect={(p) => {
              if (p) {
                setSelectedPatientId(p.id);
                setPatientName(formatFullPatientName(p));
                setHospitalNumber(p.hospitalNumber || p.id);
                setError('');
              } else {
                setSelectedPatientId('');
                setPatientName('');
                setHospitalNumber('');
              }
            }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={labelStyle}>
              Target Ward *
              <select
                value={selectedWard}
                onChange={(e) => setSelectedWard(e.target.value)}
                style={inputStyle}
                required
              >
                {wardsList.map((w) => {
                  const avail = availableBeds(facilityId, w).length;
                  return (
                    <option key={w} value={w}>
                      {w} ({avail} available)
                    </option>
                  );
                })}
              </select>
            </label>

            <label style={labelStyle}>
              Assign Bed *
              <select
                value={selectedBedId}
                onChange={(e) => setSelectedBedId(e.target.value)}
                style={inputStyle}
                required
              >
                {wardAvailableBeds.length === 0 ? (
                  <option value="">No available beds in {selectedWard}</option>
                ) : (
                  wardAvailableBeds.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bedNo} ({b.ward})
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>

          <label style={labelStyle}>
            Admitting / Working Diagnosis *
            <input
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              required
              placeholder="e.g. Severe Falciparum Malaria with Dehydration"
              style={inputStyle}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={labelStyle}>
              Admission Priority
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'routine' | 'urgent' | 'emergency')}
                style={inputStyle}
              >
                <option value="routine">Routine Ward Admission</option>
                <option value="urgent">Urgent Admission</option>
                <option value="emergency">Emergency / Resuscitation</option>
              </select>
            </label>
            <label style={labelStyle}>
              Expected Discharge Date (EDD)
              <input
                type="date"
                value={expectedDischarge}
                onChange={(e) => setEdd(e.target.value)}
                style={inputStyle}
              />
            </label>
          </div>

          <label style={labelStyle}>
            Initial Nursing &amp; Ward Orders
            <textarea
              rows={2}
              value={nursingOrders}
              onChange={(e) => setNursingOrders(e.target.value)}
              placeholder="e.g. Q4H vital signs, IV 0.9% Normal Saline 1L 8hrly, Strict I/O chart, NPO"
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </label>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 14,
              alignItems: 'center',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 10,
              padding: '10px 12px',
            }}
          >
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: '#6D28D9', cursor: 'pointer' }}>
              <input type="checkbox" checked={isolation} onChange={(e) => setIsolation(e.target.checked)} />
              Isolation Bed Precautions
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: '#0369A1', cursor: 'pointer' }}>
              <input type="checkbox" checked={billDeposit} onChange={(e) => setBillDeposit(e.target.checked)} />
              Send Admission Deposit to Accounts
            </label>
            {billDeposit && (
              <input
                type="number"
                min={500}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                style={{ width: 110, padding: '5px 8px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 12.5, fontWeight: 700 }}
                aria-label="Admission deposit NGN"
              />
            )}
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, fontWeight: 700 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid #CBD5E1', background: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', color: '#334155' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedBedId}
              style={{
                padding: '9px 18px',
                borderRadius: 10,
                border: 'none',
                background: selectedBedId ? 'linear-gradient(135deg, #0052D4 0%, #0D9488 100%)' : '#94A3B8',
                color: '#fff',
                fontWeight: 800,
                fontSize: 13,
                cursor: selectedBedId ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <CheckCircle2 size={15} /> Admit Patient to Bed
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export const DoctorAdmissionSuite: React.FC<{
  session?: UserSession;
  onNavigate?: (key: string) => void;
}> = ({ session, onNavigate }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';
  const doctorName = session?.name || 'Clinician';
  const [tick, setTick] = useState(0);
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [preselectedWard, setPreselectedWard] = useState<string | undefined>();
  const [transferTarget, setTransferTarget] = useState<Record<string, string>>({});
  const [flashMsg, setFlashMsg] = useState<string | null>(null);

  const reload = () => setTick((t) => t + 1);

  useEffect(() => {
    ensureDefaultBeds(facilityId);
    reload();
    return subscribeBeds(reload);
  }, [facilityId]);

  const wardSummary = useMemo(() => {
    void tick;
    return wardCapacitySummary(facilityId);
  }, [facilityId, tick]);

  const inpatients = useMemo(() => {
    void tick;
    return occupiedBeds(facilityId);
  }, [facilityId, tick]);

  const availList = useMemo(() => {
    void tick;
    return availableBeds(facilityId);
  }, [facilityId, tick]);

  const flash = (m: string) => {
    setFlashMsg(m);
    setTimeout(() => setFlashMsg(null), 4000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {flashMsg && (
        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', borderRadius: 12, padding: '10px 14px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} />
          <span>{flashMsg}</span>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 16,
          border: '1px solid #E2E8F0',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
            <BedDouble size={20} color="#0052D4" /> Inpatient Admissions &amp; Bed Allocation
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#64748B' }}>
            Admit sick clinic / A&amp;E patients directly onto ward beds, issue nursing orders, manage bed transfers, and discharge.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setPreselectedWard(undefined);
            setShowAdmitModal(true);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(135deg, #0052D4 0%, #0D9488 100%)',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: 13,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0, 82, 212, 0.25)',
          }}
        >
          <UserPlus size={16} /> Admit Patient to Bed
        </button>
      </div>

      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        {[
          { label: 'Currently Admitted', value: inpatients.length, color: '#EA580C', bg: '#FFF7ED' },
          { label: 'Available Beds', value: availList.length, color: '#16A34A', bg: '#F0FDF4' },
          { label: 'Active Wards', value: wardSummary.length, color: '#0284C7', bg: '#EFF6FF' },
          { label: 'Total Bed Capacity', value: wardSummary.reduce((s, w) => s + w.total, 0), color: '#0F172A', bg: '#F8FAFC' },
        ].map((k) => (
          <div key={k.label} style={{ background: k.bg, borderRadius: 14, border: '1px solid #E2E8F0', padding: '12px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: k.color, marginTop: 2 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Ward Availability Strip */}
      <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0F172A', marginBottom: 10 }}>
          Ward Bed Availability (Click a ward to admit)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {wardSummary.map((w) => (
            <button
              key={w.ward}
              type="button"
              onClick={() => {
                setPreselectedWard(w.ward);
                setShowAdmitModal(true);
              }}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 12,
                border: w.available > 0 ? '1px solid #BBF7D0' : '1px solid #FECACA',
                background: w.available > 0 ? '#F0FDF4' : '#FEF2F2',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A' }}>{w.ward}</div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: w.available > 0 ? '#15803D' : '#B91C1C', marginTop: 3 }}>
                {w.available} free / {w.total} total
              </div>
              <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>
                {w.occupied + w.isolation} occupied{w.cleaning ? ` · ${w.cleaning} turnover` : ''}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Active Inpatients Roster */}
      <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>
            Current Inpatients on Beds ({inpatients.length})
          </div>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('beds')}
              style={{ border: '1px solid #CBD5E1', background: '#F8FAFC', borderRadius: 8, padding: '5px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', color: '#334155' }}
            >
              Full Ward Bed Board →
            </button>
          )}
        </div>

        {inpatients.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
            No inpatients are currently occupying a bed. Click <strong>Admit Patient to Bed</strong> above to assign a bed.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 800 }}>Ward &amp; Bed</th>
                  <th style={{ padding: '10px 14px', fontWeight: 800 }}>Patient</th>
                  <th style={{ padding: '10px 14px', fontWeight: 800 }}>Diagnosis</th>
                  <th style={{ padding: '10px 14px', fontWeight: 800 }}>Doctor</th>
                  <th style={{ padding: '10px 14px', fontWeight: 800 }}>Admitted / LOS</th>
                  <th style={{ padding: '10px 14px', fontWeight: 800 }}>Transfer / Discharge</th>
                </tr>
              </thead>
              <tbody>
                {inpatients.map((b) => {
                  const los = losDays(b) ?? 0;
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 800, color: '#0052D4' }}>{b.bedNo}</div>
                        <div style={{ fontSize: 11, color: '#64748B' }}>{b.ward}</div>
                        {b.status === 'isolation' && (
                          <span style={{ fontSize: 9.5, fontWeight: 800, color: '#7C3AED', background: '#F5F3FF', padding: '1px 6px', borderRadius: 4 }}>
                            ISOLATION
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 700, color: '#0F172A' }}>{b.patient}</div>
                        <div style={{ fontSize: 11, color: '#64748B' }}>{b.hospitalNumber || '—'}</div>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#334155', maxWidth: 220 }}>{b.diagnosis || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{b.doctor || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>
                        <div>{b.admitDate || 'Today'}</div>
                        <div style={{ fontSize: 11, color: '#0D9488', fontWeight: 700 }}>LOS: {los}d</div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <select
                            value={transferTarget[b.id] || ''}
                            onChange={(e) => setTransferTarget((prev) => ({ ...prev, [b.id]: e.target.value }))}
                            style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid #CBD5E1', fontSize: 11 }}
                          >
                            <option value="">Transfer bed…</option>
                            {availList.map((ab) => (
                              <option key={ab.id} value={ab.id}>
                                {ab.bedNo} ({ab.ward})
                              </option>
                            ))}
                          </select>
                          {transferTarget[b.id] && (
                            <button
                              type="button"
                              onClick={() => {
                                const res = transferPatient(b.id, transferTarget[b.id], doctorName);
                                flash(res.message);
                                setTransferTarget((prev) => ({ ...prev, [b.id]: '' }));
                                reload();
                              }}
                              style={{ padding: '5px 8px', borderRadius: 7, border: 'none', background: '#0284C7', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                            >
                              Move
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              dischargeBed(b.id, doctorName);
                              flash(`Discharged ${b.patient} from ${b.bedNo} (now in turnover)`);
                              reload();
                            }}
                            style={{ padding: '5px 10px', borderRadius: 7, border: 'none', background: '#0F172A', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                          >
                            Discharge
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

      {showAdmitModal && (
        <AdmitToBedModal
          facilityId={facilityId}
          facilityName={session?.facility}
          doctorName={doctorName}
          doctorBadge={session?.badgeId}
          initialWard={preselectedWard}
          onClose={() => setShowAdmitModal(false)}
          onAdmitted={(bed) => {
            flash(`Admitted ${bed.patient || 'patient'} to ${bed.bedNo} (${bed.ward})`);
            reload();
          }}
        />
      )}
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#334155',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  borderRadius: 10,
  border: '1px solid #CBD5E1',
  fontSize: 13,
  boxSizing: 'border-box',
};

export default DoctorAdmissionSuite;
