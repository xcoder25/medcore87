'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Pill,
  AlertTriangle,
  CheckCircle2,
  Package,
  Clock,
  Barcode,
  UserSearch,
  ChevronDown,
  ChevronUp,
  Stethoscope,
  Building2,
  X,
  PauseCircle,
  RotateCcw,
  ClipboardList,
} from 'lucide-react';
import type { PrescriptionOrder } from '@medcore/types';
import { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';
import {
  listOrders,
  updateOrderStatus,
  subscribeOrders,
  dispenseOrder,
  canReleaseOrder,
  setOrderDeferredForPayment,
  type ClinicalOrder,
} from '../../lib/clinicalEventBus';
import { getActiveFacilityId } from '../../lib/adminRealtimeStore';
import { emitLiveAction } from '../../lib/liveActions';
import { liveAlert } from '../../lib/manualActions';
import {
  canDispenseOrder,
  markOrderPaid,
  markLinePaid,
  getLineForOrder,
  deferPharmacyBillLine,
  restoreDeferredPharmacyBillLine,
  subscribeBills,
} from '../../lib/patientBillingStore';
import { AksEmlFormularyPanel } from '../pharmacy/AksEmlFormularyPanel';
import {
  depleteStockDetailed,
  seedDefaultFormulary,
  stockQty,
  listFormulary,
  listBatches,
  subscribeFormulary,
  formularyStats,
  type FormularyDrug,
} from '../../lib/formularyInventory';
import {
  forecastFormularyStockouts,
  forecastNearExpiryBatches,
} from '../../lib/predictiveOpsEngine';
import { appendAudit } from '../../lib/auditLogStore';
import { parseRxNotes } from '../../lib/rxSigParse';
import { listPatients, subscribePatients } from '../../lib/patientRegistryStore';
import { parseScannedEmrQr } from '../../lib/qrPayload';
import {
  evaluatePrescriptionSafetyGuard,
  type PrescriptionSafetyReport,
} from '../../lib/clinicalSafetyEngine';
import {
  listWardMedRequests,
  subscribeWardMedRequests,
  updateWardMedRequestStatus,
  type WardMedRequest,
} from '../../lib/wardMedRequestStore';

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
  hospitalNumber: string;
  patientName: string;
  doctorName: string;
  facilityId: string;
  diagnosis: string;
  drugs: LiveDrug[];
  status: 'ACTIVE' | 'DISPENSED' | 'DEFERRED';
  routedToPharmacyName?: string;
  notes?: string;
  createdAt: string;
}

interface StableRxRow extends PrescriptionOrder {
  hospitalNumber: string;
  deferredForPayment?: boolean;
}

const statusStyle = (status: string) => {
  const map: Record<string, { bg: string; color: string }> = {
    ACTIVE: { bg: 'rgba(234,88,12,0.14)', color: '#C2410C' },
    DEFERRED: { bg: '#F3E8FF', color: '#7E22CE' },
    DISPENSED: { bg: '#DCFCE7', color: '#15803D' },
  };
  return map[status] || map.ACTIVE;
};

function orderToStableRow(o: ClinicalOrder): StableRxRow {
  const sig = parseRxNotes(o.notes, o.name);
  const line = getLineForOrder(o.id);
  const deferred = line?.status === 'deferred' || Boolean(o.deferredForPayment);
  const isDispensed = o.status === 'resulted' || Boolean(o.dispensedAt);
  const status: PrescriptionOrder['status'] = isDispensed
    ? 'dispensed'
    : o.status === 'accepted'
      ? 'verified'
      : 'pending';
  return {
    id: o.id,
    patientName: o.patientName,
    patientId: o.patientId || o.hospitalNumber,
    hospitalNumber: o.hospitalNumber || o.patientId,
    medication: o.name,
    dosage: sig.dose,
    frequency: sig.frequency,
    route: sig.route,
    duration: sig.duration,
    prescribingDoctor: o.orderedBy || 'Clinician',
    status,
    orderedAt: o.createdAt,
    deferredForPayment: deferred,
  };
}

export const PharmacyDispensingSuite: React.FC = () => {
  const facilityId = (typeof window !== 'undefined' && getActiveFacilityId()) || 'IGH-EKT';
  const [tick, setTick] = useState(0);
  const [activeTab, setActiveTab] = useState<'scan' | 'queue' | 'ward-requests' | 'formulary'>('scan');
  const [search, setSearch] = useState('');
  const [lookupId, setLookupId] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [scanQueryTerm, setScanQueryTerm] = useState<string>('');
  const [scanError, setScanError] = useState('');
  const [expandedRx, setExpandedRx] = useState<string | null>(null);
  const [invDrugs, setInvDrugs] = useState<FormularyDrug[]>([]);
  const [invStats, setInvStats] = useState({
    items: 0,
    lowStock: 0,
    expiringBatches: 0,
    controlled: 0,
    totalUnits: 0,
  });
  const [safetyConfirmRxId, setSafetyConfirmRxId] = useState<string | null>(null);
  const [safetyOverrideReason, setSafetyOverrideReason] = useState('');

  const reload = () => setTick((t) => t + 1);

  const facilityPatients = useMemo(() => listPatients(facilityId), [facilityId, tick]);

  const getRxSafetyReport = (rx: {
    id: string;
    patientId: string;
    hospitalNumber?: string;
    medication: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
  }): PrescriptionSafetyReport => {
    const pt = facilityPatients.find(
      (p) =>
        p.id === rx.patientId ||
        (rx.hospitalNumber && p.hospitalNumber === rx.hospitalNumber)
    );
    const activeOtherDrugs = prescriptions
      .filter(
        (other) =>
          other.id !== rx.id &&
          other.status !== 'dispensed' &&
          (other.patientId === rx.patientId ||
            (rx.hospitalNumber && other.hospitalNumber === rx.hospitalNumber)) &&
          other.medication.toLowerCase() !== rx.medication.toLowerCase()
      )
      .map((other) => other.medication);

    const recentLabs = listOrders(facilityId, { patientId: pt?.id || rx.patientId }).filter(
      (o) => o.type === 'lab' && o.resultSummary
    );
    let egfr: number | undefined;
    let creatinineMgDl: number | undefined;
    for (const lab of recentLabs) {
      const txt = lab.resultSummary || '';
      const egfrMatch = txt.match(/egfr\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
      if (egfrMatch && egfr === undefined) egfr = Number(egfrMatch[1]);
      const crMatch = txt.match(/creat(?:inine)?\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
      if (crMatch && creatinineMgDl === undefined) creatinineMgDl = Number(crMatch[1]);
    }

    return evaluatePrescriptionSafetyGuard({
      drugName: `${rx.medication} ${rx.dosage || ''}`.trim(),
      notes: [rx.frequency, rx.duration].filter(Boolean).join(' '),
      allergies: pt?.allergies,
      otherDrugs: Array.from(new Set([...(pt?.currentMedications || []), ...activeOtherDrugs])),
      dob: pt?.dob,
      sex: pt?.sex,
      chronicConditions: pt?.chronicConditions,
      genotype: pt?.genotype,
      egfr,
      creatinineMgDl,
    });
  };

  useEffect(() => {
    seedDefaultFormulary(facilityId);
    const pullInv = () => {
      setInvDrugs(listFormulary(facilityId));
      setInvStats(formularyStats(facilityId));
    };
    pullInv();
    const u1 = subscribeFormulary(() => {
      pullInv();
      reload();
    });
    const u2 = subscribeOrders(reload);
    const u3 = subscribeBills(reload);
    const u4 = subscribePatients(reload);
    const u5 = subscribeWardMedRequests(reload);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
    };
  }, [facilityId]);

  const rawOrders = useMemo(
    () =>
      listOrders(facilityId)
        .filter((o) => o.type === 'rx')
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [facilityId, tick]
  );

  const prescriptions = useMemo<StableRxRow[]>(
    () => rawOrders.map(orderToStableRow),
    [rawOrders]
  );

  const stockoutForecast = useMemo(
    () => forecastFormularyStockouts(invDrugs, listBatches(facilityId), rawOrders),
    [invDrugs, facilityId, rawOrders, tick]
  );

  const nearExpiryAlerts = useMemo(
    () => forecastNearExpiryBatches(invDrugs, listBatches(facilityId)),
    [invDrugs, facilityId, tick]
  );

  const wardRequests = useMemo<WardMedRequest[]>(
    () => listWardMedRequests(facilityId),
    [facilityId, tick]
  );

  // Full facility KPIs — never read from filteredPrescriptions so search never destabilizes readings
  const kpiCounts = useMemo(() => {
    let pending = 0;
    let deferred = 0;
    let dispensed = 0;
    for (const rx of prescriptions) {
      if (rx.status === 'dispensed') dispensed += 1;
      else if (rx.deferredForPayment) deferred += 1;
      else pending += 1;
    }
    const pendingWard = wardRequests.filter((w) => w.status === 'pending' || w.status === 'approved').length;
    return { pending, deferred, dispensed, pendingWard, totalRx: prescriptions.length };
  }, [prescriptions, wardRequests]);

  const pharmacySuggestions: SearchSuggestion[] = useMemo(() => {
    if (activeTab === 'queue') {
      return prescriptions.slice(0, 25).map((q) => ({
        id: q.id,
        label: q.patientName,
        sub: `${q.hospitalNumber} · ${q.medication} (${q.dosage})`,
        category: 'QUEUE',
        icon: Pill,
        onClick: () => setSearch(q.patientName),
      }));
    }
    return invDrugs.slice(0, 25).map((d) => ({
      id: d.id,
      label: d.name,
      sub: `${d.genericName} · ${d.category} · Stock: ${stockQty(facilityId, d.id)}`,
      category: 'FORMULARY',
      icon: Package,
      onClick: () => setSearch(d.name),
    }));
  }, [activeTab, prescriptions, invDrugs, facilityId]);

  const handleLegacyDispense = (
    id: string,
    opts?: { emergency?: boolean; safetyOverride?: boolean; overrideReason?: string }
  ) => {
    const rx = prescriptions.find((p) => p.id === id);
    if (rx) {
      const safetyReport = getRxSafetyReport(rx);
      if (safetyReport.hardStopCount > 0 && !opts?.safetyOverride) {
        setSafetyConfirmRxId(id);
        setSafetyOverrideReason('');
        liveAlert(
          `Clinical Safety Guard HARD STOP: ${safetyReport.alerts.find((a) => a.level === 'hard_stop')?.title || 'Review alert before dispensing'}. Confirm explicit pharmacist override below.`,
          'pharmacy',
          facilityId
        );
        return;
      }
      if (safetyReport.hardStopCount > 0 && opts?.safetyOverride) {
        const reason = (opts.overrideReason || safetyOverrideReason || 'Pharmacist confirmed clinical override with prescriber').trim();
        appendAudit({
          facilityId,
          actor: 'Pharmacist',
          action: 'pharmacy_safety_override',
          entity: 'rx',
          entityId: id,
          detail: `Safety Guard override for ${rx.medication}: ${reason} (${safetyReport.alerts.map((a) => a.code).join(', ')})`,
        });
        setSafetyConfirmRxId(null);
        setSafetyOverrideReason('');
      }
    }

    const gate = canDispenseOrder(id);
    if (gate.line?.status === 'deferred' && !opts?.emergency) {
      liveAlert(
        'This medication is Held for Later Payment. Restore it to bill or pay at Pharmacy Payment Desk first.',
        'pharmacy',
        facilityId
      );
      return;
    }
    const payGate = canReleaseOrder(id);
    if (!payGate.ok && !opts?.emergency) {
      liveAlert(
        (payGate.reason || 'Awaiting payment') + ' · Or Emergency override',
        'pharmacy',
        facilityId
      );
      return;
    }
    if (!gate.ok && !opts?.emergency) {
      liveAlert(gate.reason + ' · Or use Emergency override', 'pharmacy', facilityId);
      return;
    }
    if (opts?.emergency && gate.line) {
      markLinePaid(gate.line.id, {
        via: 'waiver',
        status: 'waived',
        paidBy: 'Emergency override',
        paymentRef: 'EMERG',
      });
    }
    const drugName = rx?.medication || '';
    const dep = drugName
      ? depleteStockDetailed(facilityId, drugName, 1, {
          actor: 'Pharmacist',
          patientRef: rx?.hospitalNumber || rx?.patientId || rx?.patientName,
          rxId: id,
        })
      : { ok: false, depleted: [], remaining: 0, lowStock: false, controlled: false, reason: 'No drug name' };

    const d = dispenseOrder(id, 'Pharmacist');
    if (!d) {
      updateOrderStatus(id, 'resulted', {
        resultSummary: dep.ok
          ? `Dispensed · FEFO ${dep.depleted.map((x) => x.batchNo).join('+')} · remaining ${dep.remaining}`
          : `Dispensed · stock issue: ${dep.reason || 'no match'}`,
        resultedBy: 'Pharmacist',
      });
    }
    if (dep.ok) {
      appendAudit({
        facilityId,
        actor: 'Pharmacist',
        action: dep.controlled ? 'controlled_dispense' : 'pharmacy_dispense',
        entity: 'rx',
        entityId: id,
        detail: `${drugName} · ${dep.depleted.map((x) => `${x.batchNo}×${x.qty}`).join('; ')}${dep.lowStock ? ' · LOW STOCK' : ''}`,
      });
    }
    emitLiveAction(
      `Dispensed ${id}${dep.ok ? ' · stock −1 (FEFO)' : ` · ${dep.reason || 'no stock'}`}${dep.controlled ? ' · CONTROLLED' : ''}${dep.lowStock ? ' · LOW' : ''}`,
      { module: 'pharmacy' }
    );
    liveAlert(
      dep.ok
        ? `Dispensed${dep.controlled ? ' (controlled logged)' : ''} · remaining ${dep.remaining}${dep.lowStock ? ' · REORDER' : ''}`
        : `Dispense recorded · stock: ${dep.reason || 'not matched'}`,
      'pharmacy',
      facilityId
    );
    reload();
  };

  const handleToggleDefer = (rx: StableRxRow) => {
    const nextDefer = !rx.deferredForPayment;
    if (nextDefer) {
      deferPharmacyBillLine(rx.id, {
        actor: 'Pharmacist',
        reason: 'Patient requested hold — will pay later',
      });
      setOrderDeferredForPayment(rx.id, facilityId, true, 'Patient requested hold at Dispensary');
      liveAlert(`Held “${rx.medication}” — excluded from immediate payable total`, 'pharmacy', facilityId);
    } else {
      restoreDeferredPharmacyBillLine(rx.id);
      setOrderDeferredForPayment(rx.id, facilityId, false);
      liveAlert(`Restored “${rx.medication}” to active bill & dispense queue`, 'pharmacy', facilityId);
    }
    reload();
  };

  const handleWardReqAction = (req: WardMedRequest, nextStatus: 'approved' | 'dispensed' | 'rejected') => {
    if (nextStatus === 'dispensed') {
      const dep = depleteStockDetailed(facilityId, req.drugName, Math.max(1, req.quantity), {
        actor: 'Pharmacist',
        patientRef: req.hospitalNumber || req.ward,
        rxId: req.id,
      });
      const note = dep.ok
        ? `Dispensed FEFO ${dep.depleted.map((b) => `${b.batchNo}×${b.qty}`).join(', ')}`
        : `Dispensed (${dep.reason || 'manual floor stock'})`;
      updateWardMedRequestStatus(req.id, facilityId, 'dispensed', 'Pharmacist', note);
      liveAlert(`Ward Med Request dispensed to ${req.ward}: ${req.drugName}`, 'pharmacy', facilityId);
    } else {
      updateWardMedRequestStatus(req.id, facilityId, nextStatus, 'Pharmacist');
      liveAlert(`Ward Med Request ${nextStatus}: ${req.drugName}`, 'pharmacy', facilityId);
    }
    reload();
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('medcore-order-paid', { detail: { orderId } }));
    }
    liveAlert(`Paid at pharmacy ₦${line.amountNgn.toLocaleString()} — ready to dispense`, 'pharmacy', facilityId);
    emitLiveAction(`Pharmacy payment ${orderId}`, { module: 'pharmacy-pos' });
    reload();
  };

  const q = (lookupId || search || scanInput).trim().toLowerCase();
  const filteredPrescriptions = useMemo(() => {
    if (!q) return prescriptions;
    return prescriptions.filter(
      (p) =>
        p.patientName.toLowerCase().includes(q) ||
        String(p.patientId || '').toLowerCase().includes(q) ||
        String(p.hospitalNumber || '').toLowerCase().includes(q) ||
        p.medication.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
    );
  }, [prescriptions, q]);

  const registryHint = q
    ? listPatients(facilityId)
        .filter(
          (p) =>
            p.hospitalNumber.toLowerCase().includes(q) ||
            `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
        )
        .slice(0, 5)
    : [];

  const handleScan = () => {
    const raw = scanInput.trim();
    if (!raw) return;
    const parsedQr = parseScannedEmrQr(raw);
    const resolvedQuery =
      parsedQr?.id ||
      parsedQr?.hospitalNo ||
      parsedQr?.payload?.sub ||
      raw;

    setScanError('');
    setLookupId(resolvedQuery);
    setSearch(resolvedQuery);
    setScanQueryTerm(resolvedQuery);

    const lower = resolvedQuery.toLowerCase();
    const hits = rawOrders.filter(
      (o) =>
        o.patientName.toLowerCase().includes(lower) ||
        o.hospitalNumber.toLowerCase().includes(lower) ||
        o.patientId.toLowerCase().includes(lower) ||
        o.id.toLowerCase().includes(lower)
    );

    if (hits.length === 0) {
      setScanError(`No prescriptions on clinical bus for “${resolvedQuery}”. Confirm prescriber sent Rx.`);
    } else {
      setExpandedRx(hits[0].id);
      liveAlert(`Loaded ${hits.length} Rx from clinical bus for ${hits[0].patientName}`, 'pharmacy', facilityId);
    }
  };

  const scanResult = useMemo<LivePrescription[] | null>(() => {
    if (!scanQueryTerm) return null;
    const lower = scanQueryTerm.toLowerCase();
    return rawOrders
      .filter(
        (o) =>
          o.patientName.toLowerCase().includes(lower) ||
          o.hospitalNumber.toLowerCase().includes(lower) ||
          o.patientId.toLowerCase().includes(lower) ||
          o.id.toLowerCase().includes(lower)
      )
      .map((o) => {
        const sig = parseRxNotes(o.notes, o.name);
        const line = getLineForOrder(o.id);
        const deferred = line?.status === 'deferred' || Boolean(o.deferredForPayment);
        const isDisp = o.status === 'resulted' || Boolean(o.dispensedAt);
        return {
          id: o.id,
          patientId: o.patientId,
          hospitalNumber: o.hospitalNumber,
          patientName: o.patientName,
          doctorName: o.orderedBy || 'Clinician',
          facilityId: o.facilityId,
          diagnosis: o.notes || 'Active outpatient / inpatient order',
          status: isDisp ? 'DISPENSED' : deferred ? 'DEFERRED' : 'ACTIVE',
          createdAt: o.createdAt,
          drugs: [
            {
              id: `${o.id}-d`,
              name: o.name,
              dosage: sig.dose,
              frequency: sig.frequency,
              duration: sig.duration,
              route: sig.route,
              quantity: 1,
              instructions: o.notes || '',
              dispensed: isDisp,
              dispensedAt: o.dispensedAt,
              dispensedBy: o.dispensedBy,
            },
          ],
        };
      });
  }, [rawOrders, scanQueryTerm]);

  const clearScan = () => {
    setScanInput('');
    setLookupId('');
    setSearch('');
    setScanQueryTerm('');
    setScanError('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", margin: '-8px -4px 0' }}>
      <div style={{ background: 'linear-gradient(135deg, #064E3B 0%, #0E3A5C 55%, #047857 130%)', color: '#fff', padding: '16px 20px 14px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Pill size={20} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', opacity: 0.78, textTransform: 'uppercase' }}>Pharmacy · Dispensing</div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Verify · Dispense · Ward Meds · Stock</div>
              <div style={{ fontSize: 12, opacity: 0.82 }}>Clinical bus realtime · pay-before-service & deferred hold control</div>
            </div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.35)', padding: '6px 10px', borderRadius: 6 }}>
            ● LIVE FACILITY SYNC ({kpiCounts.totalRx} RX)
          </div>
        </div>

        {/* Stabilized Full-Dataset MPI KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginTop: 14 }}>
          {[
            { l: 'Pending Rx', v: kpiCounts.pending, s: 'Active in queue' },
            { l: 'Held / Deferred', v: kpiCounts.deferred, s: 'Patient return later' },
            { l: 'Ward Med Reqs', v: kpiCounts.pendingWard, s: 'Inpatient / Labour' },
            { l: 'Low Stock', v: invStats.lowStock, s: 'Below reorder' },
            { l: 'Units on Hand', v: invStats.totalUnits, s: `${invStats.items} items in catalogue` },
          ].map((k) => (
            <div key={k.l} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', opacity: 0.75 }}>{k.l}</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{k.v}</div>
              <div style={{ fontSize: 10, opacity: 0.72 }}>{k.s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '0 12px', boxShadow: '0 1px 3px rgba(26,35,50,0.05)' }}>
        <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
          {[
            { id: 'scan', label: 'Patient lookup / QR', Icon: UserSearch },
            { id: 'queue', label: `Dispense queue (${kpiCounts.totalRx})`, Icon: Clock },
            { id: 'ward-requests', label: `Ward Med Requests (${kpiCounts.pendingWard})`, Icon: ClipboardList },
            { id: 'formulary', label: 'Stock snapshot', Icon: Package },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id as typeof activeTab)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '12px 14px',
                border: 'none',
                borderBottom: activeTab === id ? '2px solid #047857' : '2px solid transparent',
                background: 'transparent',
                color: activeTab === id ? '#047857' : '#718096',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        {activeTab === 'queue' && (
          <div style={{ minWidth: 260, margin: '4px 0' }}>
            <InteractiveSearchBar
              value={search}
              onChange={(val) => {
                setSearch(val);
                if (!val.trim()) setLookupId('');
              }}
              onClear={() => {
                setSearch('');
                setLookupId('');
              }}
              placeholder="Search patient, doctor, drug…"
              suggestions={pharmacySuggestions}
              resultsCount={filteredPrescriptions.length}
              size="sm"
              aria-label="Search pharmacy records"
            />
          </div>
        )}
      </div>

      <div style={{ padding: '16px 14px 24px', background: '#F0F4F8', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* -- SCAN / QR TAB -- */}
        {activeTab === 'scan' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="os-card" style={{ padding: '24px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(5,150,105,0.12)', border: '1px solid rgba(5,150,105,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserSearch size={18} style={{ color: '#059669' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0A2540' }}>Patient Prescription & QR Lookup</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--os-text-muted)' }}>
                    Scan Digital Health Card QR, enter Hospital Number, SHID, or Patient Name
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                  <Barcode size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--os-text-dim)' }} />
                  <input
                    className="os-form-input"
                    style={{ paddingLeft: 42, fontSize: '0.96rem', fontWeight: 700 }}
                    placeholder="Scan QR link, HN (IGH-PT-...), SHID or Name"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                  />
                </div>
                <button
                  type="button"
                  className="os-action-btn-primary"
                  onClick={handleScan}
                  disabled={!scanInput.trim()}
                  style={{ minWidth: 130, background: '#059669' }}
                >
                  <UserSearch size={14} /> Lookup Patient
                </button>
                {(scanResult || scanError) && (
                  <button type="button" className="os-ghost-btn" onClick={clearScan}>
                    <X size={14} /> Clear
                  </button>
                )}
              </div>

              {registryHint.length > 0 && !scanResult?.length && (
                <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {registryHint.map((pt) => (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => {
                        setScanInput(pt.hospitalNumber);
                        setScanQueryTerm(pt.hospitalNumber);
                      }}
                      style={{ fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 999, border: '1px solid #CBD5E1', background: '#F8FAFC', cursor: 'pointer' }}
                    >
                      {pt.firstName} {pt.lastName} ({pt.hospitalNumber})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {scanError && (
              <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'center', color: '#991B1B', fontSize: '0.85rem', fontWeight: 600 }}>
                <AlertTriangle size={16} style={{ color: '#EF4444', flexShrink: 0 }} />
                {scanError}
              </div>
            )}

            {scanResult !== null && scanResult.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <CheckCircle2 size={18} style={{ color: '#059669' }} />
                  <span style={{ fontWeight: 700, color: '#0A2540' }}>
                    {scanResult.length} prescription(s) found for {scanResult[0]?.patientName}
                  </span>
                </div>

                {scanResult.map((rx) => {
                  const st = statusStyle(rx.status);
                  const isExpanded = expandedRx === rx.id;
                  return (
                    <div key={rx.id} className="os-card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
                      <div
                        style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                        onClick={() => setExpandedRx(isExpanded ? null : rx.id)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '3px 10px', borderRadius: 6, background: st.bg, color: st.color }}>
                            {rx.status}
                          </span>
                          <div>
                            <div style={{ fontWeight: 800, color: '#0A2540', fontSize: '0.95rem' }}>{rx.id} · {rx.drugs[0]?.name}</div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--os-text-muted)', marginTop: 2 }}>
                              <Stethoscope size={11} style={{ display: 'inline', marginRight: 4 }} />
                              {rx.doctorName} · HN: {rx.hospitalNumber}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {rx.routedToPharmacyName && (
                            <span style={{ fontSize: 11, color: '#0284C7', background: '#E0F2FE', padding: '2px 8px', borderRadius: 6 }}>
                              <Building2 size={11} style={{ display: 'inline', marginRight: 3 }} /> {rx.routedToPharmacyName}
                            </span>
                          )}
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ borderTop: '1px solid #E2E8F0', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {rx.drugs.map((drug) => (
                            <div key={drug.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 10, background: drug.dispensed ? '#F0FDF4' : '#FFFFFF', border: '1px solid #E2E8F0' }}>
                              <div>
                                <div style={{ fontWeight: 800, color: '#0A2540', fontSize: '0.92rem' }}>{drug.name} · {drug.dosage}</div>
                                <div style={{ fontSize: '0.76rem', color: '#475569' }}>{drug.frequency} · {drug.route} · {drug.duration}</div>
                              </div>
                              <div>
                                {drug.dispensed ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#15803D', fontWeight: 700 }}>
                                    <CheckCircle2 size={16} /> Dispensed
                                  </span>
                                ) : (
                                  <button type="button" className="os-action-btn-primary" onClick={() => handleLegacyDispense(rx.id)} style={{ fontSize: '0.8rem', padding: '7px 14px' }}>
                                    <Barcode size={12} /> Dispense
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

        {/* -- DISPENSE QUEUE TAB -- */}
        {activeTab === 'queue' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredPrescriptions.length === 0 ? (
              <div className="os-card" style={{ padding: 36, textAlign: 'center', color: '#64748B' }}>
                No prescriptions match this filter right now.
              </div>
            ) : (
              filteredPrescriptions.map((rx) => {
                const safety = rx.status !== 'dispensed' ? getRxSafetyReport(rx) : null;
                const needsSafetyBanner = Boolean(
                  safety && (safety.hardStopCount > 0 || safety.warningCount > 0)
                );
                const awaitingOverride = safetyConfirmRxId === rx.id;
                return (
                <div key={rx.id} className="os-card" style={{ padding: '16px 20px', borderLeft: safety?.hardStopCount ? '4px solid #DC2626' : rx.deferredForPayment ? '4px solid #9333EA' : undefined }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: rx.status === 'dispensed' ? '#DCFCE7' : rx.deferredForPayment ? '#F3E8FF' : '#FEF3C7',
                            color: rx.status === 'dispensed' ? '#15803D' : rx.deferredForPayment ? '#7E22CE' : '#B45309',
                          }}
                        >
                          {rx.status === 'dispensed' ? 'DISPENSED' : rx.deferredForPayment ? 'HELD FOR LATER' : rx.status.toUpperCase()}
                        </span>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0A2540' }}>{rx.patientName}</span>
                        <span style={{ fontSize: '0.74rem', color: '#64748B' }}>({rx.hospitalNumber || rx.patientId})</span>
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#065F46', marginTop: 4 }}>
                        {rx.medication} · {rx.dosage}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 2 }}>
                        Regimen: <strong>{rx.frequency}</strong> via <strong>{rx.route}</strong> for <strong>{rx.duration}</strong>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: 4 }}>
                        Prescriber: {rx.prescribingDoctor} · {new Date(rx.orderedAt).toLocaleString()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <span style={{ fontSize: '0.74rem', color: '#64748B' }}>Rx ID: {rx.id}</span>
                      {rx.status !== 'dispensed' ? (
                        <>
                          {(() => {
                            const gate = canDispenseOrder(rx.id);
                            const line = gate.line;
                            return (
                              <>
                                <span style={{ fontSize: 11, fontWeight: 700, color: gate.ok ? '#059669' : rx.deferredForPayment ? '#7E22CE' : '#D97706' }}>
                                  {line ? `${line.status.toUpperCase()} · ₦${line.amountNgn.toLocaleString()}` : 'No bill line'}
                                </span>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleDefer(rx)}
                                    style={{
                                      padding: '6px 10px',
                                      borderRadius: 8,
                                      border: rx.deferredForPayment ? '1px solid #A7F3D0' : '1px solid #DDD6FE',
                                      background: rx.deferredForPayment ? '#ECFDF5' : '#FAF5FF',
                                      color: rx.deferredForPayment ? '#065F46' : '#7E22CE',
                                      fontWeight: 700,
                                      fontSize: 11,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    {rx.deferredForPayment ? <RotateCcw size={12} /> : <PauseCircle size={12} />}
                                    {rx.deferredForPayment ? 'Restore to Bill' : 'Hold for Later'}
                                  </button>

                                  {!gate.ok && !rx.deferredForPayment && (
                                    <button
                                      type="button"
                                      onClick={() => payAtPharmacy(rx.id)}
                                      style={{
                                        padding: '6px 10px',
                                        borderRadius: 8,
                                        border: 'none',
                                        background: '#059669',
                                        color: '#fff',
                                        fontWeight: 700,
                                        fontSize: 12,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Pay at Pharmacy
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

                                  {!gate.ok && !rx.deferredForPayment && (
                                    <button
                                      type="button"
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
                                </div>
                              </>
                            );
                          })()}
                        </>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#15803D', fontWeight: 700 }}>
                          <CheckCircle2 size={16} /> Dispensed & FEFO Logged
                        </span>
                      )}
                    </div>
                  </div>
                  {needsSafetyBanner && safety && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: `1px solid ${safety.hardStopCount > 0 ? '#FECACA' : '#FDE68A'}`,
                        background: safety.hardStopCount > 0 ? '#FEF2F2' : '#FFFBEB',
                        fontSize: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, color: safety.hardStopCount > 0 ? '#B91C1C' : '#B45309', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <AlertTriangle size={14} />
                          {safety.hardStopCount > 0 ? 'CLINICAL SAFETY HARD STOP' : 'SAFETY ADVISORY'}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>
                          {safety.alerts.filter((a) => a.level !== 'info').map((a) => a.code).join(' · ')}
                        </span>
                      </div>
                      <ul style={{ margin: '6px 0 0', paddingLeft: 16, color: '#334155' }}>
                        {safety.alerts
                          .filter((a) => a.level !== 'info')
                          .slice(0, 3)
                          .map((a) => (
                            <li key={a.id} style={{ marginBottom: 2 }}>
                              <strong>{a.title}:</strong> {a.detail}
                            </li>
                          ))}
                      </ul>
                      {awaitingOverride && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #FECACA', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <input
                            type="text"
                            placeholder="Document clinical override rationale (or confirm with prescriber)..."
                            value={safetyOverrideReason}
                            onChange={(e) => setSafetyOverrideReason(e.target.value)}
                            style={{ flex: 1, minWidth: 220, padding: '6px 10px', borderRadius: 8, border: '1px solid #FCA5A5', fontSize: 12 }}
                          />
                          <button
                            type="button"
                            onClick={() => handleLegacyDispense(rx.id, { safetyOverride: true, overrideReason: safetyOverrideReason })}
                            style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#B91C1C', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
                          >
                            Confirm Clinical Override & Dispense
                          </button>
                          <button
                            type="button"
                            onClick={() => { setSafetyConfirmRxId(null); setSafetyOverrideReason(''); }}
                            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#fff', color: '#475569', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                );
              })
            )}
          </div>
        )}

        {/* -- WARD MED REQUESTS TAB -- */}
        {activeTab === 'ward-requests' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {wardRequests.length === 0 ? (
              <div className="os-card" style={{ padding: 36, textAlign: 'center', color: '#64748B' }}>
                No ward medication requests from Nursing / Maternity yet.
              </div>
            ) : (
              wardRequests.map((req) => (
                <div
                  key={req.id}
                  className="os-card"
                  style={{
                    padding: '14px 18px',
                    borderLeft: req.priority === 'stat' ? '4px solid #DC2626' : '4px solid #059669',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: req.priority === 'stat' ? '#FEE2E2' : req.priority === 'urgent' ? '#FEF3C7' : '#E0F2FE',
                          color: req.priority === 'stat' ? '#991B1B' : req.priority === 'urgent' ? '#92400E' : '#075985',
                        }}
                      >
                        {req.priority.toUpperCase()}
                      </span>
                      <strong style={{ fontSize: 14, color: '#0F172A' }}>{req.drugName} ({req.dosage}) × {req.quantity}</strong>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>[{req.status.toUpperCase()}]</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                      {req.ward} · Bed {req.bedNumber || 'Ward Store'} · {req.patientName ? `${req.patientName} (${req.hospitalNumber || ''})` : 'Ward Stock Replenishment'}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                      Requested by {req.requestedBy} · {new Date(req.requestedAt).toLocaleString()}
                      {req.pharmacyNotes ? ` · Note: ${req.pharmacyNotes}` : ''}
                    </div>
                  </div>
                  {(req.status === 'pending' || req.status === 'approved') && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {req.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleWardReqAction(req, 'approved')}
                          style={{ padding: '7px 11px', borderRadius: 8, border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                        >
                          Approve
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleWardReqAction(req, 'dispensed')}
                        style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: '#059669', color: '#FFFFFF', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
                      >
                        Dispense to Ward (FEFO)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleWardReqAction(req, 'rejected')}
                        style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* -- FORMULARY TAB -- */}
        {activeTab === 'formulary' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
              {[
                { l: 'Formulary items', v: invStats.items },
                { l: 'Units on hand', v: invStats.totalUnits },
                { l: 'Low stock', v: invStats.lowStock },
                { l: 'Expiring ≤90d', v: invStats.expiringBatches },
              ].map((x) => (
                <div key={x.l} style={{ background: '#FFFFFF', borderRadius: 12, padding: '12px 14px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>{x.l}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>{x.v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 12 }}>
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#92400E', marginBottom: 6 }}>
                  Seasonal Stockout Radar (Antimalarials · Antihypertensives · Antibiotics)
                </div>
                {stockoutForecast.filter((s) => s.urgency !== 'healthy').length === 0 ? (
                  <div style={{ fontSize: 12, color: '#065F46' }}>
                    All tracked therapeutic classes hold &gt;14 days seasonal safety stock.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {stockoutForecast
                      .filter((s) => s.urgency !== 'healthy')
                      .slice(0, 4)
                      .map((s) => (
                        <div key={s.drugId} style={{ fontSize: 12, background: '#FFFFFF', padding: '6px 9px', borderRadius: 8, border: '1px solid #FDE68A' }}>
                          <strong style={{ color: '#0F172A' }}>{s.name}</strong> ({s.drugClass})
                          <div style={{ color: s.urgency === 'critical' ? '#B91C1C' : '#B45309', fontWeight: 700 }}>
                            {s.daysUntilStockout}d runway ({s.seasonalityNote}) · Reorder {s.recommendedReorderQty} units
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#991B1B', marginBottom: 6 }}>
                  Near-Expiry Batch Loss Prevention ({nearExpiryAlerts.length} flagged)
                </div>
                {nearExpiryAlerts.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#065F46' }}>
                    Zero batches expiring within 90 days.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {nearExpiryAlerts.slice(0, 4).map((b) => (
                      <div key={b.batchId} style={{ fontSize: 12, background: '#FFFFFF', padding: '6px 9px', borderRadius: 8, border: '1px solid #FECACA' }}>
                        <strong style={{ color: '#0F172A' }}>{b.drugName}</strong> · Batch {b.batchNo} ({b.qty} units)
                        <div style={{ color: '#B91C1C', fontWeight: 700 }}>
                          {b.daysToExpiry <= 0 ? 'EXPIRED' : `${b.daysToExpiry}d left (${b.expiry})`} · ₦{b.estimatedLossNgn.toLocaleString()} at risk
                        </div>
                        <div style={{ fontSize: 11, color: '#475569' }}>{b.recommendedAction}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ fontSize: 13, color: '#475569' }}>
              Live facility stock (realtime). Open <strong>Formulary & stock</strong> in the sidebar for full inventory, receive stock, and AKS EML reference.
            </div>
            <div style={{ maxHeight: 360, overflow: 'auto', borderRadius: 12, border: '1px solid #E2E8F0', background: '#FFFFFF' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ textAlign: 'left', padding: 10 }}>Medicine</th>
                    <th style={{ textAlign: 'left', padding: 10 }}>Stock</th>
                    <th style={{ textAlign: 'left', padding: 10 }}>Reorder</th>
                    <th style={{ textAlign: 'left', padding: 10 }}>₦</th>
                  </tr>
                </thead>
                <tbody>
                  {invDrugs.map((d) => {
                    const qty = stockQty(facilityId, d.id);
                    const low = qty <= d.reorderLevel;
                    return (
                      <tr key={d.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                        <td style={{ padding: 10 }}>
                          <div style={{ fontWeight: 700, color: '#0F172A' }}>{d.name}</div>
                          <div style={{ fontSize: 11, color: '#64748B' }}>{d.genericName}</div>
                        </td>
                        <td style={{ padding: 10, fontWeight: 800, color: low ? '#D97706' : '#059669' }}>{qty}</td>
                        <td style={{ padding: 10 }}>{d.reorderLevel}</td>
                        <td style={{ padding: 10 }}>{d.unitPriceNgn.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  {invDrugs.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: 20, color: '#64748B' }}>No formulary items yet</td>
                    </tr>
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
