'use client';

import React, { useState, useEffect } from 'react';
import {
  Pill, AlertTriangle, CheckCircle2, Search, Package,
  Clock, Barcode, UserSearch, RefreshCw, ChevronDown, ChevronUp,
  Stethoscope, Building2, X,
} from 'lucide-react';
import type { PrescriptionOrder, FormularyItem } from '@medcore/types';

// --- Types --------------------------------------------------------------------
interface LiveDrug {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  quantity: number;
  instructions: string;
  dispensed: boolean;
  dispensedAt?: string;
  dispensedBy?: string;
}

interface LivePrescription {
  id: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  facilityId: string;
  diagnosis: string;
  drugs: LiveDrug[];
  status: 'ACTIVE' | 'DISPENSED' | 'PARTIAL' | 'CANCELLED';
  routedToPharmacyName?: string;
  notes?: string;
  createdAt: string;
}

// --- Legacy Mock Prescriptions Queue -----------------------------------------
const INITIAL_PRESCRIPTIONS: PrescriptionOrder[] = [];

const INITIAL_FORMULARY: FormularyItem[] = [];

const API = 'http://localhost:4000/api/v1/clinical';

// --- Status badge style helper ------------------------------------------------
const statusStyle = (status: string) => {
  const map: Record<string, { bg: string; color: string }> = {
    ACTIVE: { bg: 'rgba(234,88,12,0.15)', color: 'var(--ak-orange-light)' },
    PARTIAL: { bg: 'rgba(250,204,21,0.15)', color: '#FDE047' },
    DISPENSED: { bg: 'rgba(5,150,105,0.1)', color: '#34D399' },
    CANCELLED: { bg: 'rgba(239,68,68,0.15)', color: '#F87171' },
  };
  return map[status] || map.ACTIVE;
};

import {
  listOrders,
  updateOrderStatus,
  subscribeOrders,
  dispenseOrder,
  canReleaseOrder,
} from '../../lib/clinicalEventBus';
import { getActiveFacilityId } from '../../lib/adminRealtimeStore';
import { emitLiveAction } from '../../lib/liveActions';
import { liveAlert } from '../../lib/manualActions';
import {
  canDispenseOrder,
  markOrderPaid,
  markLinePaid,
  getLineForOrder,
  listBillLines,
  subscribeBills,
  type PatientBillLine,
} from '../../lib/patientBillingStore';
import { AksEmlFormularyPanel } from '../pharmacy/AksEmlFormularyPanel';
import { depleteStock, seedDefaultFormulary, stockQty, listFormulary, subscribeFormulary, formularyStats, type FormularyDrug } from '../../lib/formularyInventory';
import { parseRxNotes } from '../../lib/rxSigParse';
import { listPatients } from '../../lib/patientRegistryStore';

export const PharmacyDispensingSuite: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'scan' | 'queue' | 'formulary'>('scan');
  const [prescriptions, setPrescriptions] = useState<PrescriptionOrder[]>(INITIAL_PRESCRIPTIONS);
  const [formulary] = useState<FormularyItem[]>(INITIAL_FORMULARY);
  const [search, setSearch] = useState('');
  const [lookupId, setLookupId] = useState('');

  // Patient scanner state
  const [scanInput, setScanInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<LivePrescription[] | null>(null);
  const [scanError, setScanError] = useState('');
  const [dispensingId, setDispensingId] = useState<string | null>(null);
  const [expandedRx, setExpandedRx] = useState<string | null>(null);

  const facilityId = (typeof window !== 'undefined' && getActiveFacilityId()) || 'IGH-EKT';
  const [invDrugs, setInvDrugs] = useState<FormularyDrug[]>([]);
  const [invStats, setInvStats] = useState({ items: 0, lowStock: 0, expiringBatches: 0, controlled: 0, totalUnits: 0 });

  useEffect(() => {
    seedDefaultFormulary(facilityId);
    const pullInv = () => {
      setInvDrugs(listFormulary(facilityId));
      setInvStats(formularyStats(facilityId));
    };
    pullInv();
    return subscribeFormulary(pullInv);
  }, [facilityId]);

  useEffect(() => {
    seedDefaultFormulary(facilityId);
    const pull = () => {
      const rx = listOrders(facilityId).filter((o) => o.type === 'rx');
      setPrescriptions((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        const extra: PrescriptionOrder[] = rx
          .filter((o) => !ids.has(o.id))
          .map((o) => {
            const sig = parseRxNotes(o.notes, o.name);
            return {
              id: o.id,
              patientName: o.patientName,
              patientId: o.patientId || o.hospitalNumber,
              medication: o.name,
              dosage: sig.dose,
              frequency: sig.frequency,
              route: sig.route,
              duration: sig.duration,
              prescribingDoctor: o.orderedBy || 'Clinician',
              status: (o.status === 'resulted' || o.status === 'accepted' ? 'dispensed' : 'pending') as PrescriptionOrder['status'],
              orderedAt: o.createdAt,
            };
          });
        // Prefer bus truth: refresh statuses for known ids
        const byBus = new Map(rx.map((o) => [o.id, o]));
        const merged: PrescriptionOrder[] = prev.map((p) => {
          const o = byBus.get(p.id);
          if (!o) return p;
          const sig = parseRxNotes(o.notes, o.name);
          const status: PrescriptionOrder['status'] =
            o.status === 'resulted' || o.status === 'accepted'
              ? 'dispensed'
              : p.status === 'dispensed'
                ? 'dispensed'
                : 'pending';
          return {
            ...p,
            medication: o.name,
            dosage: sig.dose,
            frequency: sig.frequency,
            route: sig.route,
            duration: sig.duration,
            status,
          };
        });
        return extra.length ? [...extra, ...merged] : merged;
      });
    };
    pull();
    return subscribeOrders(pull);
  }, [facilityId]);

  const handleLegacyDispense = (id: string, opts?: { emergency?: boolean }) => {
    const payGate = canReleaseOrder(id);
    const gate = canDispenseOrder(id);
    if (!payGate.ok && !opts?.emergency) {
      liveAlert((payGate.reason || 'Awaiting Accounts payment') + ' · Or Emergency override', 'pharmacy', facilityId);
      return;
    }
    if (!gate.ok && !opts?.emergency) {
      liveAlert(gate.reason + ' · Or use Emergency override', 'pharmacy', facilityId);
      return;
    }
    if (opts?.emergency && gate.line) {
      markLinePaid(gate.line.id, { via: 'waiver', status: 'waived', paidBy: 'Emergency override', paymentRef: 'EMERG' });
    }
    const rx = prescriptions.find((p) => p.id === id);
    const drugName = rx?.medication || '';
    const stockOk = drugName ? depleteStock(facilityId, drugName, 1) : false;
    setPrescriptions(prev => prev.map(p => p.id === id ? { ...p, status: 'dispensed' } : p));
    const d = dispenseOrder(id, 'Pharmacist');
    if (!d) {
      updateOrderStatus(id, 'resulted', {
        resultSummary: stockOk
          ? `Dispensed at pharmacy · stock decremented`
          : `Dispensed at pharmacy · stock not matched (check formulary)`,
        resultedBy: 'Pharmacist',
      });
    }
    emitLiveAction(`Dispensed ${id}${stockOk ? ' · stock −1' : ' · no stock match'}`, { module: 'pharmacy' });
    liveAlert(
      stockOk
        ? 'Dispensed — stock updated — visible on clinical desk'
        : 'Dispensed — formulary stock not found for this drug name',
      'pharmacy',
      facilityId
    );
  };

  const runPatientLookup = () => {
    const q = (scanInput || lookupId || search).trim();
    if (!q) {
      liveAlert('Enter hospital number or patient name', 'pharmacy', facilityId);
      return;
    }
    setLookupId(q);
    setSearch(q);
    const hits = listOrders(facilityId).filter(
      (o) =>
        o.type === 'rx' &&
        (o.hospitalNumber.toLowerCase().includes(q.toLowerCase()) ||
          o.patientName.toLowerCase().includes(q.toLowerCase()) ||
          o.patientId.toLowerCase().includes(q.toLowerCase()))
    );
    liveAlert(
      hits.length
        ? `Found ${hits.length} Rx for “${q}” on clinical bus`
        : `No Rx on bus for “${q}” — confirm doctor sent prescription`,
      'pharmacy',
      facilityId
    );
    setActiveTab('queue');
  };

  const payAtPharmacy = (orderId: string) => {
    const line = getLineForOrder(orderId);
    if (!line) {
      liveAlert('No bill line for this Rx', 'pharmacy', facilityId);
      return;
    }
    markOrderPaid(orderId, {
      via: 'pharmacy',
      paidBy: 'Pharmacy till',
      paymentRef: `PHARM-${Date.now().toString(36).toUpperCase()}`,
      status: 'paid',
    });
    liveAlert(`Paid at pharmacy ₦${line.amountNgn.toLocaleString()} — ready to dispense`, 'pharmacy', facilityId);
    emitLiveAction(`Pharmacy payment ${orderId}`, { module: 'cashier' });
  };

  const q = (lookupId || search || scanInput).trim().toLowerCase();
  const filteredPrescriptions = q
    ? prescriptions.filter(
        (p) =>
          p.patientName.toLowerCase().includes(q) ||
          String(p.patientId || '').toLowerCase().includes(q) ||
          p.medication.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q)
      )
    : prescriptions;
  const registryHint = q
    ? listPatients(facilityId).filter(
        (p) =>
          p.hospitalNumber.toLowerCase().includes(q) ||
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
      ).slice(0, 5)
    : [];
  const pendingCount = filteredPrescriptions.filter((p) => p.status === 'pending').length;
  const lowStockCount = invStats.lowStock;

  // --- Live Patient Scan ----------------------------------------------------
  const handleScan = async () => {
    const query = scanInput.trim();
    if (!query) return;
    setLookupId(query);
    setSearch(query);
    setScanning(true);
    setScanError('');
    setScanResult(null);
    try {
      const res = await fetch(`${API}/prescriptions/patient/${encodeURIComponent(query)}`);
      const json = await res.json();
      if (json.success) {
        setScanResult(json.data);
        if (json.data.length > 0) setExpandedRx(json.data[0].id);
      } else {
        setScanError(json.error || 'No prescriptions found');
      }
    } catch {
      // Offline / no API — use clinical Rx orders bus
      const rx = listOrders(facilityId).filter(
        (o) =>
          o.type === 'rx' &&
          (o.patientName.toLowerCase().includes(query.toLowerCase()) ||
            o.hospitalNumber.toLowerCase().includes(query.toLowerCase()) ||
            o.patientId.toLowerCase().includes(query.toLowerCase()))
      );
      if (rx.length) {
        setScanResult(
          rx.map((o) => ({
            id: o.id,
            patientName: o.patientName,
            status: o.status === 'resulted' ? 'DISPENSED' : 'ACTIVE',
            drugs: [
              {
                id: o.id + '-d',
                name: o.name,
                dispensed: o.status === 'resulted',
              },
            ],
          })) as any
        );
        setExpandedRx(rx[0].id);
        liveAlert(`Loaded ${rx.length} Rx from clinical bus (offline)`, 'pharmacy', facilityId);
      } else {
        setScanError('No prescriptions on clinical bus for this patient. Orders appear when a doctor places Rx.');
      }
    } finally {
      setScanning(false);
    }
  };

  const handleDispenseDrug = async (rxId: string, drugId: string) => {
    setDispensingId(`${rxId}:${drugId}`);
    try {
      const res = await fetch(`${API}/prescriptions/${rxId}/dispense`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drugId, dispensedBy: 'Pharmacist on Duty' }),
      });
      const json = await res.json();
      if (json.success) {
        setScanResult(prev => prev ? prev.map(rx => rx.id === rxId ? json.data : rx) : prev);
      }
    } catch {
      handleLegacyDispense(rxId);
    } finally {
      setDispensingId(null);
    }
  };

  const clearScan = () => {
    setScanInput('');
    setScanResult(null);
    setScanError('');
  };

  // --- Metrics -------------------------------------------------------------
  const pendingRx = scanResult?.filter(r => r.status === 'ACTIVE' || r.status === 'PARTIAL').length ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", margin: '-8px -4px 0' }}>
      <div style={{ background: 'linear-gradient(135deg, #1B4F72 0%, #0E3A5C 50%, #0E7490 130%)', color: '#fff', padding: '16px 20px 14px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Pill size={20} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', opacity: 0.75, textTransform: 'uppercase' }}>Pharmacy · Dispensing</div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Verify · Dispense · Stock</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Clinical bus realtime · pay-before-service gate</div>
            </div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.35)', padding: '6px 10px', borderRadius: 6 }}>
            ● LIVE AUDIT
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginTop: 14 }}>
          {[
            { l: 'Pending Rx', v: pendingCount, s: 'Awaiting verification' },
            { l: 'Low stock', v: lowStockCount, s: 'Below reorder' },
            { l: 'Formulary items', v: invStats.items, s: 'Facility catalogue' },
            { l: 'Units on hand', v: invStats.totalUnits, s: 'All batches' },
          ].map((k) => (
            <div key={k.l} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', opacity: 0.7 }}>{k.l}</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{k.v}</div>
              <div style={{ fontSize: 10, opacity: 0.65 }}>{k.s}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '0 12px', boxShadow: '0 1px 3px rgba(26,35,50,0.05)' }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {[
            { id: 'scan', label: 'Patient lookup', Icon: UserSearch },
            { id: 'queue', label: `Dispense queue (${filteredPrescriptions.length})`, Icon: Clock },
            { id: 'formulary', label: 'Stock snapshot', Icon: Package },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id as any)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '12px 14px',
                border: 'none',
                borderBottom: activeTab === id ? '2px solid #1B4F72' : '2px solid transparent',
                background: 'transparent',
                color: activeTab === id ? '#1B4F72' : '#718096',
                fontWeight: 650,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        {activeTab !== 'scan' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 240, margin: '6px 0', padding: '6px 10px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#F7FAFC' }}>
            <Search size={14} color="#718096" />
            <input
              placeholder={activeTab === 'queue' ? 'Search patient, doctor, drug…' : 'Search medicine…'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: 13, fontFamily: 'inherit' }}
            />
          </div>
        )}
      </div>

      <div style={{ padding: '16px 14px 24px', background: '#F0F4F8', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* -- SCAN TAB -- */}
      {activeTab === 'scan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Scanner Input */}
          <div className="os-card" style={{ padding: '24px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(234,88,12,0.12)', border: '1px solid rgba(234,88,12,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <UserSearch size={18} style={{ color: 'var(--ak-orange-light)' }} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0A2540' }}>Patient Prescription Lookup</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--os-text-muted)' }}>
                  Enter or scan patient ID number to view all active prescriptions
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Barcode size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--os-text-dim)' }} />
                <input
                  className="os-form-input"
                  style={{ paddingLeft: 42, fontSize: '1rem', fontWeight: 700, letterSpacing: '0.05em' }}
                  placeholder="e.g. PAT-849201"
                  value={scanInput}
                  onChange={e => setScanInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleScan()}
                  autoFocus
                />
              </div>
              <button
                type="button"
                className="os-action-btn-primary"
                onClick={handleScan}
                disabled={scanning || !scanInput.trim()}
                style={{ minWidth: 130 }}
              >
                {scanning ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <UserSearch size={14} />}
                {scanning ? 'Scanning...' : 'Lookup Patient'}
              </button>
              {scanResult && (
                <button type="button" className="os-ghost-btn" onClick={clearScan}>
                  <X size={14} /> Clear
                </button>
              )}
            </div>

            {/* Quick patient buttons */}
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', alignSelf: 'center' }}>Quick load:</span>
              {['PAT-849201', 'PAT-620194'].map(pid => (
                <button
                  key={pid}
                  type="button"
                  className="os-ghost-btn"
                  style={{ fontSize: '0.72rem', padding: '3px 10px' }}
                  onClick={() => { setScanInput(pid); }}
                >
                  {pid}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {scanError && (
            <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'center', color: '#FCA5A5', fontSize: '0.85rem' }}>
              <AlertTriangle size={16} style={{ color: '#EF4444', flexShrink: 0 }} />
              {scanError}
            </div>
          )}

          {/* Results */}
          {scanResult !== null && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <CheckCircle2 size={18} style={{ color: '#34D399' }} />
                <span style={{ fontWeight: 700, color: '#0A2540' }}>
                  {scanResult.length === 0
                    ? 'No prescriptions on record for this patient.'
                    : `${scanResult.length} prescription(s) found for ${scanResult[0]?.patientName}`}
                </span>
              </div>

              {scanResult.map(rx => {
                const st = statusStyle(rx.status);
                const isExpanded = expandedRx === rx.id;
                const pendingDrugs = rx.drugs.filter(d => !d.dispensed);
                return (
                  <div key={rx.id} className="os-card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
                    {/* Prescription Header */}
                    <div
                      style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}
                      onClick={() => setExpandedRx(isExpanded ? null : rx.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '3px 10px', borderRadius: 6, background: st.bg, color: st.color }}>
                          {rx.status}
                        </span>
                        <div>
                          <div style={{ fontWeight: 800, color: '#0A2540', fontSize: '0.95rem' }}>
                            {rx.id}
                          </div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--os-text-muted)', marginTop: 2 }}>
                            <Stethoscope size={11} style={{ display: 'inline', marginRight: 4 }} />
                            {rx.doctorName} � {rx.diagnosis}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        {rx.routedToPharmacyName && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: '#60A5FA', background: 'rgba(96,165,250,0.1)', padding: '3px 8px', borderRadius: 6 }}>
                            <Building2 size={11} /> Routed: {rx.routedToPharmacyName}
                          </div>
                        )}
                        <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)' }}>
                          {rx.drugs.length} drug(s) � {pendingDrugs.length} pending
                        </span>
                        {isExpanded ? <ChevronUp size={16} style={{ color: 'var(--os-text-dim)' }} /> : <ChevronDown size={16} style={{ color: 'var(--os-text-dim)' }} />}
                      </div>
                    </div>

                    {/* Expanded Drug List */}
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid var(--os-border)', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {rx.notes && (
                          <div style={{ fontSize: '0.78rem', color: '#FDE047', background: 'rgba(250,204,21,0.08)', borderRadius: 8, padding: '8px 12px', marginBottom: 4 }}>
                            ?? Clinical note: {rx.notes}
                          </div>
                        )}
                        {rx.drugs.map(drug => (
                          <div key={drug.id} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '12px 16px', borderRadius: 10,
                            background: drug.dispensed ? 'rgba(34,197,94,0.06)' : '#FFFFFF',
                            border: `1px solid ${drug.dispensed ? 'rgba(5,150,105,0.12)' : 'var(--os-border)'}`,
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <Pill size={13} style={{ color: drug.dispensed ? '#34D399' : 'var(--ak-orange-light)' }} />
                                <span style={{ fontWeight: 800, color: '#0A2540', fontSize: '0.92rem' }}>
                                  {drug.name} {drug.dosage}
                                </span>
                                <span style={{ fontSize: '0.68rem', color: 'var(--os-text-dim)', background: '#FFFFFF', borderRadius: 4, padding: '1px 6px' }}>
                                  {drug.route}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.76rem', color: 'var(--os-text-muted)' }}>
                                {drug.frequency} � {drug.duration} � Qty: {drug.quantity}
                              </div>
                              {drug.instructions && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', marginTop: 3 }}>
                                  Instructions: {drug.instructions}
                                </div>
                              )}
                              {drug.dispensed && drug.dispensedAt && (
                                <div style={{ fontSize: '0.7rem', color: '#34D399', marginTop: 4, fontWeight: 600 }}>
                                  ? Dispensed {new Date(drug.dispensedAt).toLocaleString()} by {drug.dispensedBy}
                                </div>
                              )}
                            </div>
                            <div style={{ marginLeft: 16, flexShrink: 0 }}>
                              {drug.dispensed ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#34D399', fontWeight: 700 }}>
                                  <CheckCircle2 size={16} /> Dispensed
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="os-action-btn-primary"
                                  disabled={dispensingId === `${rx.id}:${drug.id}`}
                                  onClick={() => handleDispenseDrug(rx.id, drug.id)}
                                  style={{ fontSize: '0.8rem', padding: '7px 14px' }}
                                >
                                  {dispensingId === `${rx.id}:${drug.id}` ? (
                                    <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                                  ) : (
                                    <Barcode size={12} />
                                  )}
                                  Dispense
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* -- QUEUE TAB -- */}
      {activeTab === 'queue' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredPrescriptions.map(rx => (
              <div key={rx.id} className="os-card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                        background: rx.status === 'dispensed' ? 'rgba(5,150,105,0.1)' : rx.status === 'verified' ? 'rgba(59,130,246,0.15)' : 'rgba(234,88,12,0.15)',
                        color: rx.status === 'dispensed' ? '#34D399' : rx.status === 'verified' ? '#60A5FA' : 'var(--ak-orange-light)',
                      }}>
                        {rx.status.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0A2540' }}>{rx.patientName}</span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--os-text-dim)' }}>({rx.patientId})</span>
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--ak-orange-light)', marginTop: 4 }}>
                      {rx.medication} � {rx.dosage}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--os-text-muted)', marginTop: 2 }}>
                      Regimen: <strong>{rx.frequency}</strong> via <strong>{rx.route}</strong> for <strong>{rx.duration}</strong>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--os-text-dim)', marginTop: 4 }}>
                      {rx.prescribingDoctor} � {rx.orderedAt}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <span style={{ fontSize: '0.74rem', color: 'var(--os-text-dim)' }}>Rx ID: {rx.id}</span>
                    {rx.status !== 'dispensed' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                        {(() => {
                          const gate = canDispenseOrder(rx.id);
                          const line = gate.line;
                          return (
                            <>
                              <span style={{ fontSize: 11, fontWeight: 700, color: gate.ok ? '#059669' : '#D97706' }}>
                                {line
                                  ? `${line.status.toUpperCase()} · ₦${line.amountNgn.toLocaleString()}`
                                  : 'No bill line'}
                              </span>
                              {!gate.ok && (
                                <button
                                  type="button"
                                  className="mc-btn-live"
                                  onClick={() => payAtPharmacy(rx.id)}
                                  style={{
                                    padding: '6px 10px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: '#2563EB',
                                    color: '#fff',
                                    fontWeight: 700,
                                    fontSize: 12,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Pay at pharmacy
                                </button>
                              )}
                              <button
                                type="button"
                                className="os-action-btn-primary"
                                onClick={() => handleLegacyDispense(rx.id)}
                                style={{ opacity: gate.ok ? 1 : 0.55 }}
                              >
                                <Barcode size={14} /> {gate.ok ? 'Dispense drug' : 'Dispense (needs payment)'}
                              </button>
                              {!gate.ok && (
                                <button
                                  type="button"
                                  className="mc-btn-live"
                                  onClick={() => handleLegacyDispense(rx.id, { emergency: true })}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: 6,
                                    border: '1px solid #FECACA',
                                    background: '#FEF2F2',
                                    color: '#B91C1C',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Emergency override
                                </button>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#34D399', fontWeight: 700 }}>
                        <CheckCircle2 size={16} /> Dispensed & Label Printed
                      </span>
                    )}
                  </div>
                </div>
                {rx.interactionAlert && (
                  <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: '#FCA5A5' }}>
                    <AlertTriangle size={14} style={{ color: '#EF4444', flexShrink: 0 }} />
                    <span><strong>Clinical Precaution:</strong> {rx.interactionAlert}</span>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* -- FORMULARY TAB -- */}
      {/* -- FORMULARY / AKS EML TAB -- */}
      {activeTab === 'formulary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
            {[
              { l: 'Formulary items', v: invStats.items },
              { l: 'Units on hand', v: invStats.totalUnits },
              { l: 'Low stock', v: invStats.lowStock },
              { l: 'Expiring ≤90d', v: invStats.expiringBatches },
            ].map((x) => (
              <div key={x.l} style={{ background: 'rgba(15,23,42,0.04)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(148,163,184,0.25)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8' }}>{x.l}</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{x.v}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 13, color: '#94A3B8' }}>
            Live facility stock (realtime). Open <strong>Formulary & stock</strong> in the sidebar for full inventory, receive stock, and AKS EML reference.
          </div>
          <div style={{ maxHeight: 360, overflow: 'auto', borderRadius: 12, border: '1px solid rgba(148,163,184,0.2)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(15,23,42,0.5)' }}>
                  <th style={{ textAlign: 'left', padding: 10 }}>Medicine</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>Stock</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>Reorder</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>₦</th>
                </tr>
              </thead>
              <tbody>
                {invDrugs.map((d) => {
                  const q = stockQty(facilityId, d.id);
                  const low = q <= d.reorderLevel;
                  return (
                    <tr key={d.id} style={{ borderTop: '1px solid rgba(148,163,184,0.15)' }}>
                      <td style={{ padding: 10 }}>
                        <div style={{ fontWeight: 700 }}>{d.name}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>{d.genericName}</div>
                      </td>
                      <td style={{ padding: 10, fontWeight: 800, color: low ? '#FBBF24' : '#34D399' }}>{q}</td>
                      <td style={{ padding: 10 }}>{d.reorderLevel}</td>
                      <td style={{ padding: 10 }}>{d.unitPriceNgn.toLocaleString()}</td>
                    </tr>
                  );
                })}
                {invDrugs.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 20, color: '#94A3B8' }}>No formulary items yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <AksEmlFormularyPanel />
        </div>
      )}

      </div>
    </div>
  );
};