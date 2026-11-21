'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pill,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  BedDouble,
  Send,
  Package,
} from 'lucide-react';
import type { UserSession } from '../auth/AuthScreen';
import {
  listWardMedRequests,
  createWardMedRequest,
  subscribeWardMedRequests,
  type WardMedRequestPriority,
  type WardMedRequestType,
} from '../../lib/wardMedRequestStore';
import { listFormulary, stockQty, subscribeFormulary } from '../../lib/formularyInventory';
import { listWards } from '../../lib/bedBoardStore';
import { VerifiedPatientField } from '../common/VerifiedPatientField';
import { verifyPatientExists, formatFullPatientName } from '../../lib/patientVerification';
import { emitLiveAction } from '../../lib/liveActions';

interface Props {
  session?: UserSession;
  onNavigate?: (moduleKey: string) => void;
}

const PRIORITY_BADGES: Record<WardMedRequestPriority, { bg: string; color: string; label: string }> = {
  stat: { bg: '#FEE2E2', color: '#B91C1C', label: 'STAT EMERGENCY' },
  urgent: { bg: '#FEF3C7', color: '#B45309', label: 'URGENT' },
  routine: { bg: '#EFF6FF', color: '#1D4ED8', label: 'ROUTINE' },
};

const STATUS_BADGES = {
  pending: { bg: '#FEF3C7', color: '#B45309', label: 'Pending Pharmacy' },
  approved: { bg: '#DBEAFE', color: '#1D4ED8', label: 'Approved · Preparing' },
  dispensed: { bg: '#ECFDF5', color: '#047857', label: 'Dispensed to Ward' },
  rejected: { bg: '#FEE2E2', color: '#B91C1C', label: 'Declined' },
} as const;

export const WardMedRequestsSuite: React.FC<Props> = ({ session }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';
  const requester = `${session?.name || 'Duty Nurse'} (${session?.badgeId || 'NUR'})`;

  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const u1 = subscribeWardMedRequests(reload);
    const u2 = subscribeFormulary(reload);
    return () => {
      u1();
      u2();
    };
  }, [reload]);

  const requests = useMemo(() => listWardMedRequests(facilityId), [facilityId, tick]);
  const formulary = useMemo(() => listFormulary(facilityId), [facilityId, tick]);
  const wards = useMemo(() => {
    const w = listWards(facilityId);
    return w.length > 0 ? w : ['Male Medical', 'Female Medical', 'Surgical', 'Maternity', 'Paediatrics', 'ICU'];
  }, [facilityId, tick]);

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'dispensed' | 'rejected'>('all');
  const [requestType, setRequestType] = useState<WardMedRequestType>('patient_dose');
  const [priority, setPriority] = useState<WardMedRequestPriority>('routine');
  const [ward, setWard] = useState(wards[0] || 'Male Medical');
  const [bedNumber, setBedNumber] = useState('');
  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [hospitalNumber, setHospitalNumber] = useState('');
  const [drugName, setDrugName] = useState('');
  const [dosage, setDosage] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const selectedFormularyDrug = useMemo(
    () => formulary.find((d) => d.name.toLowerCase() === drugName.trim().toLowerCase()),
    [formulary, drugName]
  );

  const stats = useMemo(
    () => ({
      total: requests.length,
      pending: requests.filter((r) => r.status === 'pending').length,
      approved: requests.filter((r) => r.status === 'approved').length,
      dispensed: requests.filter((r) => r.status === 'dispensed').length,
      statOpen: requests.filter((r) => r.priority === 'stat' && r.status === 'pending').length,
    }),
    [requests]
  );

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') return requests;
    return requests.filter((r) => r.status === statusFilter);
  }, [requests, statusFilter]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!ward.trim() || !drugName.trim() || !dosage.trim()) {
      setFormError('Ward, Drug Name, and Dosage / Strength are required.');
      return;
    }
    const qty = Math.max(1, parseInt(quantity, 10) || 1);

    let verifiedPid: string | undefined;
    let verifiedName: string | undefined;
    let verifiedHn: string | undefined;

    if (requestType === 'patient_dose') {
      const check = verifyPatientExists(facilityId, {
        patientId: patientId || undefined,
        patientName: patientName || undefined,
        hospitalNumber: hospitalNumber || undefined,
      });
      if (!check.valid || !check.patient) {
        setFormError(check.error || 'Verify an enrolled patient for Patient-Dose requests.');
        return;
      }
      verifiedPid = check.patient.id;
      verifiedName = formatFullPatientName(check.patient);
      verifiedHn = check.patient.hospitalNumber || check.patient.id;
    }

    const row = createWardMedRequest({
      facilityId,
      ward: ward.trim(),
      bedNumber: bedNumber.trim() || (requestType === 'ward_stock' ? 'Ward Store' : 'Ward Bed'),
      patientId: verifiedPid,
      patientName: verifiedName,
      hospitalNumber: verifiedHn,
      requestType,
      drugName: drugName.trim(),
      dosage: dosage.trim(),
      quantity: qty,
      priority,
      requestedBy: requester,
      notes: notes.trim() || undefined,
    });

    setDrugName('');
    setDosage('');
    setQuantity('1');
    setNotes('');
    setPatientId('');
    setPatientName('');
    setHospitalNumber('');
    setBedNumber('');
    reload();
    setToast(`Ward med request ${row.id} sent to Pharmacy (${row.priority.toUpperCase()}).`);
    emitLiveAction(`Ward Med Request: ${row.drugName} (${row.ward})`, { module: 'pharmacy' });
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 60%, #0D9488 140%)',
          color: '#FFFFFF',
          borderRadius: 16,
          padding: '18px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', opacity: 0.85, textTransform: 'uppercase' }}>
            Inpatient Nursing · Pharmacy Bridge
          </div>
          <h2 style={{ margin: '4px 0 4px', fontSize: 20, fontWeight: 800 }}>
            Ward Medication Requests & Stock Requisition
          </h2>
          <div style={{ fontSize: 12.5, opacity: 0.9 }}>
            Request STAT bedside doses or ward floor stock directly from Pharmacy with live dispatch tracking.
          </div>
        </div>
        <button
          type="button"
          onClick={reload}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(255,255,255,0.1)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
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

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {[
          { label: 'Pending Pharmacy', val: stats.pending, color: '#D97706' },
          { label: 'Approved / Picking', val: stats.approved, color: '#2563EB' },
          { label: 'Dispensed to Ward', val: stats.dispensed, color: '#059669' },
          { label: 'STAT Open', val: stats.statOpen, color: '#DC2626' },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderTop: `3px solid ${k.color}`,
              borderRadius: 12,
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>{k.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 410px) 1fr', gap: 16, alignItems: 'start' }}>
        {/* Left: Request Form */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 14,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 14.5, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={16} color="#2563EB" /> New Ward Medication Request
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {(
              [
                { k: 'patient_dose', l: 'Patient Dose' },
                { k: 'ward_stock', l: 'Ward Stock' },
                { k: 'stat_emergency', l: 'STAT Crash' },
              ] as const
            ).map((t) => (
              <button
                key={t.k}
                type="button"
                onClick={() => {
                  setRequestType(t.k);
                  if (t.k === 'stat_emergency') setPriority('stat');
                }}
                style={{
                  padding: '7px 8px',
                  borderRadius: 8,
                  border: requestType === t.k ? '1.5px solid #2563EB' : '1px solid #E2E8F0',
                  background: requestType === t.k ? '#EFF6FF' : '#F8FAFC',
                  color: requestType === t.k ? '#1D4ED8' : '#475569',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {t.l}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={lbl}>Ward *</label>
              <select value={ward} onChange={(e) => setWard(e.target.value)} required style={inp}>
                {wards.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Bed / Bay</label>
              <input
                type="text"
                value={bedNumber}
                onChange={(e) => setBedNumber(e.target.value)}
                placeholder={requestType === 'ward_stock' ? 'Ward Store' : 'e.g. MM-04'}
                style={inp}
              />
            </div>
          </div>

          {requestType === 'patient_dose' && (
            <div>
              <VerifiedPatientField
                facilityId={facilityId}
                label="Verified Patient *"
                required
                selectedPatientId={patientId}
                initialName={patientName}
                initialHospitalNumber={hospitalNumber}
                onSelect={(p) => {
                  if (p) {
                    setPatientId(p.id);
                    setPatientName(formatFullPatientName(p));
                    setHospitalNumber(p.hospitalNumber || p.id);
                  } else {
                    setPatientId('');
                    setPatientName('');
                    setHospitalNumber('');
                  }
                }}
              />
            </div>
          )}

          <div>
            <label style={lbl}>Medication / Fluid (Live Formulary) *</label>
            <input
              type="text"
              list="ward-med-formulary-list"
              required
              value={drugName}
              onChange={(e) => {
                const v = e.target.value;
                setDrugName(v);
                const hit = formulary.find((d) => d.name.toLowerCase() === v.toLowerCase());
                if (hit && !dosage) setDosage(hit.strength || hit.form);
              }}
              placeholder="Type or pick medication..."
              style={inp}
            />
            <datalist id="ward-med-formulary-list">
              {formulary.slice(0, 120).map((d) => (
                <option key={d.id} value={d.name}>
                  {d.strength} · {stockQty(facilityId, d.id)} in store
                </option>
              ))}
            </datalist>
            {selectedFormularyDrug && (
              <div style={{ fontSize: 11, color: '#059669', fontWeight: 700, marginTop: 4 }}>
                Store Balance: {stockQty(facilityId, selectedFormularyDrug.id)} units ({selectedFormularyDrug.form})
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px', gap: 8 }}>
            <div>
              <label style={lbl}>Strength / Dose *</label>
              <input
                type="text"
                required
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder="e.g. 1g IV / 500mL"
                style={inp}
              />
            </div>
            <div>
              <label style={lbl}>Qty *</label>
              <input
                type="number"
                min={1}
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                style={inp}
              />
            </div>
            <div>
              <label style={lbl}>Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as WardMedRequestPriority)}
                style={inp}
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="stat">STAT</option>
              </select>
            </div>
          </div>

          <div>
            <label style={lbl}>Clinical / Ward Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Indication, infusion line, or shift delivery note..."
              style={inp}
            />
          </div>

          {formError && (
            <div style={{ padding: '8px 10px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 12, fontWeight: 600 }}>
              {formError}
            </div>
          )}

          <button
            type="submit"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '10px 14px',
              borderRadius: 10,
              border: 'none',
              background: priority === 'stat' ? '#DC2626' : '#2563EB',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <Send size={14} /> Dispatch Request to Pharmacy
          </button>
        </form>

        {/* Right: Live Tracking Table */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 14,
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 14.5, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Package size={16} color="#0D9488" /> Live Ward Requisitions ({filteredRequests.length})
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(['all', 'pending', 'approved', 'dispensed', 'rejected'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    border: statusFilter === f ? '1px solid #2563EB' : '1px solid #E2E8F0',
                    background: statusFilter === f ? '#EFF6FF' : '#F8FAFC',
                    color: statusFilter === f ? '#1D4ED8' : '#64748B',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {filteredRequests.length === 0 ? (
            <div style={{ padding: 36, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
              No ward medication requests matching this filter. Submit one on the left to notify Pharmacy live.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredRequests.map((r) => {
                const pMeta = PRIORITY_BADGES[r.priority] || PRIORITY_BADGES.routine;
                const sMeta = STATUS_BADGES[r.status] || STATUS_BADGES.pending;
                return (
                  <div
                    key={r.id}
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: 12,
                      padding: 12,
                      background: r.priority === 'stat' && r.status === 'pending' ? '#FEF2F2' : '#F8FAFC',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: pMeta.bg, color: pMeta.color }}>
                          {pMeta.label}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A' }}>
                          {r.ward} · {r.bedNumber}
                        </span>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748B' }}>{r.id}</span>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0F172A' }}>
                        <Pill size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />
                        {r.drugName} — {r.dosage} (Qty: {r.quantity})
                      </div>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                        {r.patientName
                          ? `Patient: ${r.patientName} (${r.hospitalNumber || 'MPI'})`
                          : 'Ward Floor Stock Replenishment'}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>
                        Requested by {r.requestedBy} · {new Date(r.requestedAt).toLocaleString()}
                      </div>
                      {r.pharmacyNotes && (
                        <div style={{ fontSize: 11.5, color: '#065F46', marginTop: 4, fontWeight: 600 }}>
                          Pharmacy note: {r.pharmacyNotes}
                        </div>
                      )}
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 10px',
                          borderRadius: 999,
                          background: sMeta.bg,
                          color: sMeta.color,
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        {r.status === 'dispensed' && <CheckCircle2 size={12} />}
                        {r.status === 'rejected' && <XCircle size={12} />}
                        {r.status === 'pending' && <Clock size={12} />}
                        {r.status === 'approved' && <AlertTriangle size={12} />}
                        {sMeta.label}
                      </span>
                      {r.reviewedBy && (
                        <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 4 }}>
                          {r.reviewedBy}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const lbl: React.CSSProperties = {
  display: 'block',
  fontSize: 11.5,
  fontWeight: 700,
  color: '#475569',
  marginBottom: 4,
};

const inp: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  fontSize: 12.5,
  boxSizing: 'border-box',
  background: '#FFFFFF',
};

export default WardMedRequestsSuite;
