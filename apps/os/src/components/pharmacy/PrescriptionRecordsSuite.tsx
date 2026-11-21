'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Search,
  Pill,
  AlertTriangle,
  CheckCircle2,
  Clock,
  PauseCircle,
  Printer,
  User,
  Calendar,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';
import type { UserSession } from '../auth/AuthScreen';
import {
  listOrders,
  subscribeOrders,
  type ClinicalOrder,
} from '../../lib/clinicalEventBus';
import {
  listPatients,
  subscribePatients,
  type FacilityPatient,
} from '../../lib/patientRegistryStore';
import {
  getLineForOrder,
  subscribeBills,
  type PatientBillLine,
} from '../../lib/patientBillingStore';
import {
  findFormularyPrice,
  listControlledDispenses,
  subscribeFormulary,
} from '../../lib/formularyInventory';
import { ScannableQrCode } from '../common/ScannableQrCode';
import { buildVerifyUrl } from '../../lib/qrPayload';

interface Props {
  session?: UserSession;
  onNavigate?: (key: string) => void;
}

type FilterMode = 'all' | 'dispensed' | 'pending' | 'deferred';

interface EnrichedRxRecord {
  order: ClinicalOrder;
  patient?: FacilityPatient;
  billLine?: PatientBillLine;
  unitPriceNgn: number;
  stateLabel: 'Dispensed' | 'Held for Later' | 'Paid · Ready' | 'Awaiting Payment';
  stateBg: string;
  stateColor: string;
  allergies: string[];
}

export const PrescriptionRecordsSuite: React.FC<Props> = ({ session, onNavigate }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';
  const facilityName = session?.facility || 'MedCore Hospital';
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');

  const reload = () => setTick((t) => t + 1);

  useEffect(() => {
    const u1 = subscribeOrders(reload);
    const u2 = subscribePatients(reload);
    const u3 = subscribeBills(reload);
    const u4 = subscribeFormulary(reload);
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [facilityId]);

  const records = useMemo<EnrichedRxRecord[]>(() => {
    const pts = listPatients(facilityId);
    const byId = new Map(pts.map((p) => [p.id, p]));
    const byHn = new Map(pts.map((p) => [(p.hospitalNumber || '').toUpperCase(), p]));

    return listOrders(facilityId)
      .filter((o) => o.type === 'rx')
      .map((o) => {
        const patient = byId.get(o.patientId) || byHn.get((o.hospitalNumber || '').toUpperCase());
        const billLine = getLineForOrder(o.id);
        const unitPriceNgn = billLine?.amountNgn ?? findFormularyPrice(facilityId, o.name, 2500);
        const isDispensed = o.status === 'resulted' || Boolean(o.dispensedAt);
        const isDeferred = billLine?.status === 'deferred' || Boolean(o.deferredForPayment);
        const isPaid =
          Boolean(o.paymentCleared) ||
          billLine?.status === 'paid' ||
          billLine?.status === 'hmo' ||
          billLine?.status === 'waived';

        let stateLabel: EnrichedRxRecord['stateLabel'] = 'Awaiting Payment';
        let stateBg = '#FEF3C7';
        let stateColor = '#B45309';

        if (isDispensed) {
          stateLabel = 'Dispensed';
          stateBg = '#DCFCE7';
          stateColor = '#15803D';
        } else if (isDeferred) {
          stateLabel = 'Held for Later';
          stateBg = '#F3E8FF';
          stateColor = '#7E22CE';
        } else if (isPaid) {
          stateLabel = 'Paid · Ready';
          stateBg = '#E0F2FE';
          stateColor = '#0369A1';
        }

        const allergies = (patient?.allergies || []).filter(
          (a) => a && a.toLowerCase() !== 'none known'
        );

        return {
          order: o,
          patient,
          billLine,
          unitPriceNgn,
          stateLabel,
          stateBg,
          stateColor,
          allergies,
        };
      })
      .sort((a, b) => (b.order.createdAt || '').localeCompare(a.order.createdAt || ''));
  }, [facilityId, tick]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (filter === 'dispensed' && r.stateLabel !== 'Dispensed') return false;
      if (filter === 'pending' && (r.stateLabel === 'Dispensed' || r.stateLabel === 'Held for Later')) return false;
      if (filter === 'deferred' && r.stateLabel !== 'Held for Later') return false;
      if (!q) return true;
      return (
        r.order.patientName.toLowerCase().includes(q) ||
        r.order.hospitalNumber.toLowerCase().includes(q) ||
        r.order.name.toLowerCase().includes(q) ||
        (r.order.orderedBy || '').toLowerCase().includes(q) ||
        r.order.id.toLowerCase().includes(q)
      );
    });
  }, [records, search, filter]);

  const selected = useMemo(
    () => records.find((r) => r.order.id === selectedOrderId) || filtered[0] || records[0] || null,
    [records, filtered, selectedOrderId]
  );

  const controlledLogForSelected = useMemo(() => {
    if (!selected) return null;
    try {
      return listControlledDispenses(facilityId).find((l) => l.rxId === selected.order.id) || null;
    } catch {
      return null;
    }
  }, [facilityId, selected, tick]);

  const stats = useMemo(
    () => ({
      total: records.length,
      dispensed: records.filter((r) => r.stateLabel === 'Dispensed').length,
      readyOrPending: records.filter(
        (r) => r.stateLabel === 'Paid · Ready' || r.stateLabel === 'Awaiting Payment'
      ).length,
      deferred: records.filter((r) => r.stateLabel === 'Held for Later').length,
    }),
    [records]
  );

  const selectedQrValue = useMemo(() => {
    if (!selected) return '';
    return buildVerifyUrl({
      k: 'rx',
      id: selected.order.id,
      mrn: selected.order.hospitalNumber,
      f: facilityId,
      fn: facilityName,
      sub: selected.order.name,
    });
  }, [selected, facilityId, facilityName]);

  const handlePrintDossier = () => {
    if (typeof window !== 'undefined') window.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'var(--os-font-sans, system-ui)' }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #064E3B 0%, #0F766E 55%, #065F46 100%)',
          color: '#FFFFFF',
          borderRadius: 18,
          padding: '20px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          boxShadow: '0 12px 28px rgba(6, 78, 59, 0.22)',
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#A7F3D0' }}>
            Clinical Pharmacy Archive · Longitudinal e-Prescribing Audit
          </div>
          <h1 style={{ margin: '4px 0 4px', fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em' }}>
            Prescription Records & Medication Dossiers
          </h1>
          <div style={{ fontSize: 13, color: '#D1FAE5' }}>
            Complete Rx regimen history, FEFO dispense provenance, payment status & deferred holds
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onNavigate?.('pharmacy')}
            style={{
              background: 'rgba(255,255,255,0.16)',
              color: '#FFFFFF',
              border: '1px solid rgba(255,255,255,0.28)',
              borderRadius: 10,
              padding: '9px 14px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Pill size={15} /> Open Dispense Queue
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('pharmacy-pos')}
            style={{
              background: '#ECFDF5',
              color: '#065F46',
              border: 'none',
              borderRadius: 10,
              padding: '9px 14px',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <CreditCard size={15} /> Pharmacy Payment Desk
          </button>
        </div>
      </div>

      {/* KPI Strip (from full dataset) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {[
          { label: 'Total Rx Records', value: stats.total, tone: '#0F172A', bg: '#FFFFFF', accent: '#059669' },
          { label: 'Completed / Dispensed', value: stats.dispensed, tone: '#15803D', bg: '#F0FDF4', accent: '#16A34A' },
          { label: 'Active / Pending', value: stats.readyOrPending, tone: '#0369A1', bg: '#F0F9FF', accent: '#0284C7' },
          { label: 'Held by Patient (Deferred)', value: stats.deferred, tone: '#7E22CE', bg: '#FAF5FF', accent: '#9333EA' },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              background: k.bg,
              border: '1px solid #E2E8F0',
              borderLeft: `4px solid ${k.accent}`,
              borderRadius: 14,
              padding: '14px 16px',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: k.tone, marginTop: 4 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Master-Detail View */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 400px) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
        {/* Left Master List */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 16,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ position: 'relative' }}>
            <Search size={15} color="#64748B" style={{ position: 'absolute', left: 11, top: 11 }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient, HN, drug, prescriber..."
              style={{
                width: '100%',
                padding: '9px 12px 9px 34px',
                borderRadius: 10,
                border: '1px solid #CBD5E1',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(
              [
                ['all', `All (${records.length})`],
                ['pending', `Pending (${stats.readyOrPending})`],
                ['dispensed', `Dispensed (${stats.dispensed})`],
                ['deferred', `Held (${stats.deferred})`],
              ] as [FilterMode, string][]
            ).map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 999,
                  border: filter === k ? '1px solid #059669' : '1px solid #CBD5E1',
                  background: filter === k ? '#ECFDF5' : '#F8FAFC',
                  color: filter === k ? '#065F46' : '#475569',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {lbl}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 560, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
                No matching prescription records found.
              </div>
            ) : (
              filtered.map((item) => {
                const active = selected?.order.id === item.order.id;
                return (
                  <button
                    key={item.order.id}
                    type="button"
                    onClick={() => setSelectedOrderId(item.order.id)}
                    style={{
                      textAlign: 'left',
                      padding: 12,
                      borderRadius: 12,
                      border: active ? '2px solid #059669' : '1px solid #E2E8F0',
                      background: active ? '#F0FDF4' : '#FFFFFF',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <strong style={{ fontSize: 13, color: '#0F172A' }}>{item.order.patientName}</strong>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 7px',
                          borderRadius: 999,
                          background: item.stateBg,
                          color: item.stateColor,
                        }}
                      >
                        {item.stateLabel}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#065F46' }}>{item.order.name}</div>
                    <div style={{ fontSize: 11, color: '#64748B', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{item.order.hospitalNumber} · Dr. {item.order.orderedBy || 'Physician'}</span>
                      <span>₦{item.unitPriceNgn.toLocaleString()}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Detail Dossier */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 16,
            padding: 22,
          }}
        >
          {!selected ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: '#64748B' }}>
              <FileText size={36} color="#94A3B8" style={{ marginBottom: 10 }} />
              <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A' }}>No prescription record selected</div>
              <p style={{ fontSize: 13, marginTop: 4 }}>
                Doctor e-prescriptions appear here in real time with dispensing and payment lineage.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', borderBottom: '1px solid #F1F5F9', paddingBottom: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '3px 10px',
                        borderRadius: 999,
                        background: selected.stateBg,
                        color: selected.stateColor,
                      }}
                    >
                      {selected.stateLabel}
                    </span>
                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#64748B' }}>
                      Rx ID: {selected.order.id}
                    </span>
                  </div>
                  <h2 style={{ margin: '8px 0 4px', fontSize: 20, fontWeight: 900, color: '#0F172A' }}>
                    {selected.order.name}
                  </h2>
                  <div style={{ fontSize: 13, color: '#475569', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <User size={14} color="#059669" /> <strong>{selected.order.patientName}</strong> ({selected.order.hospitalNumber})
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Calendar size={14} color="#059669" /> {new Date(selected.order.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ textAlign: 'center', background: '#F8FAFC', padding: 6, borderRadius: 10, border: '1px solid #E2E8F0' }}>
                    <ScannableQrCode value={selectedQrValue} size={64} />
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#64748B', marginTop: 2 }}>RX VERIFY QR</div>
                  </div>
                  <button
                    type="button"
                    onClick={handlePrintDossier}
                    style={{
                      padding: '9px 14px',
                      borderRadius: 10,
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      fontWeight: 700,
                      fontSize: 12,
                      color: '#0F172A',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Printer size={14} /> Print Dossier / Label
                  </button>
                </div>
              </div>

              {/* Allergy Alert */}
              {selected.allergies.length > 0 ? (
                <div
                  style={{
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: 12,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    color: '#991B1B',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  <AlertTriangle size={17} color="#DC2626" />
                  Documented Allergies: {selected.allergies.join(', ')} — verify before dispensing.
                </div>
              ) : (
                <div
                  style={{
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: 12,
                    padding: '9px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: '#166534',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <ShieldCheck size={16} color="#16A34A" />
                  No drug allergies recorded in MPI profile.
                </div>
              )}

              {/* Clinical Dossier Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
                <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 14, border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Prescriber & Priority</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>{selected.order.orderedBy || 'Attending Doctor'}</div>
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>Priority: {(selected.order.priority || 'routine').toUpperCase()}</div>
                  {selected.order.notes && <div style={{ fontSize: 12, color: '#334155', marginTop: 6 }}>Sig / Notes: {selected.order.notes}</div>}
                </div>

                <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 14, border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Billing & Payment Status</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#065F46', marginTop: 4 }}>
                    ₦{selected.unitPriceNgn.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                    Ledger: {selected.billLine ? `${selected.billLine.status.toUpperCase()} (${selected.billLine.paidVia || 'pending'})` : 'Formulary estimate'}
                  </div>
                  {selected.stateLabel === 'Held for Later' && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#7E22CE', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <PauseCircle size={12} /> Held for patient return — excluded from immediate total
                    </div>
                  )}
                </div>

                <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 14, border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Dispensing Provenance</div>
                  {selected.order.dispensedAt ? (
                    <>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#15803D', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <CheckCircle2 size={15} /> Dispensed by {selected.order.dispensedBy || 'Pharmacist'}
                      </div>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                        {new Date(selected.order.dispensedAt).toLocaleString()}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#B45309', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Clock size={15} /> Not yet dispensed
                    </div>
                  )}
                  {controlledLogForSelected && (
                    <div style={{ fontSize: 11, color: '#0F172A', marginTop: 4 }}>
                      Controlled Ledger Batch: <strong>{controlledLogForSelected.batchNo}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
