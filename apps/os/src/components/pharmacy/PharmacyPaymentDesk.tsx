'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Pill,
  CreditCard,
  Receipt,
  PauseCircle,
  RotateCcw,
  Plus,
  Printer,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Search,
  Landmark,
  Banknote,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { UserSession } from '../auth/AuthScreen';
import {
  listPharmacyBillLines,
  markLinePaid,
  deferPharmacyBillLine,
  restoreDeferredPharmacyBillLine,
  createPharmacyCounterBillLine,
  subscribeBills,
  type PatientBillLine,
} from '../../lib/patientBillingStore';
import {
  setOrderDeferredForPayment,
  releaseOrdersForPatient,
} from '../../lib/clinicalEventBus';
import {
  issuePaymentReceipt,
  listPaymentReceipts,
  reprintPaymentReceipt,
  type PaymentReceiptRecord,
} from '../../lib/paymentReceiptModule';
import { listFormulary, subscribeFormulary } from '../../lib/formularyInventory';
import { VerifiedPatientField } from '../common/VerifiedPatientField';
import type { FacilityPatient } from '../../lib/patientRegistryStore';
import { formatFullPatientName } from '../../lib/patientVerification';
import { ScannableQrCode } from '../common/ScannableQrCode';
import { buildVerifyUrl } from '../../lib/qrPayload';
import { liveAlert } from '../../lib/manualActions';
import { getActiveFacilityId } from '../../lib/facilityContext';

interface Props {
  session?: UserSession;
  onNavigate?: (key: string) => void;
}

type PayMethod = 'cash' | 'akwaremit_pos' | 'direct_akwaremit' | 'hmo';

export const PharmacyPaymentDesk: React.FC<Props> = ({ session, onNavigate }) => {
  const facilityId = session?.hospitalId || getActiveFacilityId() || 'IGH-EKT';
  const facilityName = session?.facility || 'MedCore Facility';
  const actor = session?.name || 'Pharmacist';
  const actorBadge = session?.badgeId || 'PHARM';

  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedPatientKey, setSelectedPatientKey] = useState<string>('');
  const [payMethod, setPayMethod] = useState<PayMethod>('cash');
  const [payRef, setPayRef] = useState('');
  const [deferredOpen, setDeferredOpen] = useState(true);
  const [openReceipt, setOpenReceipt] = useState<PaymentReceiptRecord | null>(null);

  // Quick OTC / Counter Sale modal state
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [counterPatient, setCounterPatient] = useState<FacilityPatient | null>(null);
  const [counterDrugName, setCounterDrugName] = useState('');
  const [counterQty, setCounterQty] = useState('1');
  const [counterUnitNgn, setCounterUnitNgn] = useState('1500');
  const [counterSubmitErr, setCounterSubmitErr] = useState(false);

  const reload = () => setTick((t) => t + 1);

  useEffect(() => {
    const u1 = subscribeBills(reload);
    const u2 = subscribeFormulary(reload);
    const onRcpt = () => reload();
    if (typeof window !== 'undefined') {
      window.addEventListener('medcore-payment-receipts', onRcpt);
    }
    return () => {
      u1();
      u2();
      if (typeof window !== 'undefined') {
        window.removeEventListener('medcore-payment-receipts', onRcpt);
      }
    };
  }, [facilityId]);

  const drugs = useMemo(() => listFormulary(facilityId), [facilityId, tick]);
  const allPharmLines = useMemo(() => listPharmacyBillLines(facilityId), [facilityId, tick]);

  const todayPrefix = new Date().toISOString().slice(0, 10);
  const todayReceipts = useMemo(
    () =>
      listPaymentReceipts(facilityId, { day: todayPrefix }).filter(
        (r) => r.category === 'pharmacy_desk' || r.source === 'pharmacy'
      ),
    [facilityId, todayPrefix, tick]
  );

  // Group pharmacy lines by patient
  const patientGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        patientKey: string;
        patientId: string;
        patientName: string;
        hospitalNumber: string;
        payableLines: PatientBillLine[];
        deferredLines: PatientBillLine[];
        paidLines: PatientBillLine[];
      }
    >();

    for (const line of allPharmLines) {
      const key = line.patientId || line.hospitalNumber;
      if (!map.has(key)) {
        map.set(key, {
          patientKey: key,
          patientId: line.patientId,
          patientName: line.patientName,
          hospitalNumber: line.hospitalNumber,
          payableLines: [],
          deferredLines: [],
          paidLines: [],
        });
      }
      const g = map.get(key)!;
      if (line.status === 'unpaid' || line.status === 'partial') {
        g.payableLines.push(line);
      } else if (line.status === 'deferred') {
        g.deferredLines.push(line);
      } else if (line.status === 'paid' || line.status === 'hmo' || line.status === 'waived') {
        g.paidLines.push(line);
      }
    }

    const q = search.trim().toLowerCase();
    return Array.from(map.values())
      .filter((g) => g.payableLines.length > 0 || g.deferredLines.length > 0)
      .filter(
        (g) =>
          !q ||
          g.patientName.toLowerCase().includes(q) ||
          g.hospitalNumber.toLowerCase().includes(q) ||
          g.payableLines.some((l) => l.description.toLowerCase().includes(q))
      );
  }, [allPharmLines, search]);

  const activeGroup = useMemo(
    () =>
      patientGroups.find((g) => g.patientKey === selectedPatientKey) ||
      patientGroups[0] ||
      null,
    [patientGroups, selectedPatientKey]
  );

  const kpis = useMemo(() => {
    const unpaid = allPharmLines.filter((l) => l.status === 'unpaid' || l.status === 'partial');
    const deferred = allPharmLines.filter((l) => l.status === 'deferred');
    const collectedToday = todayReceipts.reduce((s, r) => s + r.amountNgn, 0);
    return {
      payableTotalNgn: unpaid.reduce((s, l) => s + l.amountNgn, 0),
      payableCount: unpaid.length,
      deferredTotalNgn: deferred.reduce((s, l) => s + l.amountNgn, 0),
      deferredCount: deferred.length,
      collectedTodayNgn: collectedToday,
      receiptCount: todayReceipts.length,
    };
  }, [allPharmLines, todayReceipts]);

  const handleHoldLine = (line: PatientBillLine) => {
    deferPharmacyBillLine(line.id, {
      actor,
      reason: 'Patient requested hold — will purchase when funds are available',
    });
    if (line.orderId) {
      setOrderDeferredForPayment(
        line.orderId,
        facilityId,
        true,
        'Held at Pharmacy Payment Desk for later pickup'
      );
    }
    liveAlert(
      `Held “${line.description}” for later — removed from immediate payable bill`,
      'pharmacy',
      facilityId
    );
    reload();
  };

  const handleRestoreLine = (line: PatientBillLine) => {
    restoreDeferredPharmacyBillLine(line.id);
    if (line.orderId) {
      setOrderDeferredForPayment(line.orderId, facilityId, false);
    }
    liveAlert(`Restored “${line.description}” to active Pharmacy bill`, 'pharmacy', facilityId);
    reload();
  };

  const handleCollectPayment = () => {
    if (!activeGroup || activeGroup.payableLines.length === 0) return;
    const totalNgn = activeGroup.payableLines.reduce((s, l) => s + l.amountNgn, 0);
    const ref =
      payRef.trim() ||
      (payMethod === 'direct_akwaremit'
        ? `RRR-RX-${Date.now().toString(36).toUpperCase()}`
        : `RXP-${Date.now().toString(36).toUpperCase()}`);

    const paidVia =
      payMethod === 'hmo' ? 'hmo' : payMethod === 'direct_akwaremit' ? 'akwaremit' : 'pharmacy';
    const methodLabel =
      payMethod === 'cash'
        ? 'cash'
        : payMethod === 'akwaremit_pos'
          ? 'akwaremit_pos'
          : payMethod === 'direct_akwaremit'
            ? 'direct_akwaremit'
            : 'hmo';
    const channelLabel =
      payMethod === 'cash'
        ? 'Pharmacy Cash Till'
        : payMethod === 'akwaremit_pos'
          ? 'Pharmacy AkwaRemit POS'
          : payMethod === 'direct_akwaremit'
            ? 'Direct AkwaRemit RRR'
            : 'HMO / NHIA Coverage';

    for (const line of activeGroup.payableLines) {
      markLinePaid(line.id, {
        via: paidVia,
        status: payMethod === 'hmo' ? 'hmo' : 'paid',
        paidBy: actor,
        paymentRef: ref,
      });
      if (line.orderId && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('medcore-order-paid', { detail: { orderId: line.orderId } }));
      }
    }

    releaseOrdersForPatient(facilityId, activeGroup.patientId);
    if (activeGroup.hospitalNumber) {
      releaseOrdersForPatient(facilityId, activeGroup.hospitalNumber);
    }

    const receipt = issuePaymentReceipt(
      {
        facilityId,
        facilityName,
        patientId: activeGroup.patientId,
        patientName: activeGroup.patientName,
        hospitalNumber: activeGroup.hospitalNumber,
        amountNgn: totalNgn,
        method: methodLabel,
        channel: channelLabel,
        source: 'pharmacy',
        purpose: activeGroup.payableLines.map((l) => l.description).slice(0, 3).join('; '),
        reference: ref,
        cashier: actor,
        cashierBadge: actorBadge,
        akwaRemitRrr: payMethod === 'direct_akwaremit' ? ref : undefined,
      },
      { print: false }
    );

    setPayRef('');
    setOpenReceipt(receipt);
    liveAlert(
      `Collected ₦${totalNgn.toLocaleString()} at Pharmacy Till · Orders released to Dispense Queue`,
      'pharmacy',
      facilityId
    );
    reload();
  };

  const handleAddCounterBill = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Math.max(1, Number(counterQty) || 1);
    const unit = Math.max(0, Number(counterUnitNgn) || 0);
    if (!counterPatient || !counterDrugName.trim() || unit <= 0) {
      setCounterSubmitErr(true);
      return;
    }
    setCounterSubmitErr(false);
    const fullName = formatFullPatientName(counterPatient);
    const line = createPharmacyCounterBillLine({
      facilityId,
      patientId: counterPatient.id,
      hospitalNumber: counterPatient.hospitalNumber,
      patientName: fullName,
      description: `Counter Dispense · ${counterDrugName.trim()} × ${qty}`,
      amountNgn: qty * unit,
      actor,
    });
    setSelectedPatientKey(line.patientId || line.hospitalNumber);
    setShowCounterModal(false);
    setCounterDrugName('');
    setCounterQty('1');
    reload();
  };

  const receiptQrValue = useMemo(() => {
    if (!openReceipt) return '';
    return buildVerifyUrl({
      k: 'receipt',
      id: openReceipt.receiptNo,
      mrn: openReceipt.hospitalNumber,
      f: facilityId,
      fn: facilityName,
      sub: `Pharmacy Receipt · ₦${openReceipt.amountNgn.toLocaleString()}`,
    });
  }, [openReceipt, facilityId, facilityName]);

  const activeTotal = activeGroup
    ? activeGroup.payableLines.reduce((s, l) => s + l.amountNgn, 0)
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'var(--os-font-sans, system-ui)' }}>
      {/* Distinct Emerald Pharmacy POS Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #064E3B 0%, #047857 55%, #0D9488 100%)',
          color: '#FFFFFF',
          borderRadius: 18,
          padding: '20px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 14,
          boxShadow: '0 14px 32px rgba(4, 120, 87, 0.25)',
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#A7F3D0' }}>
            Dedicated Pharmacy Till · Medication Revenue Only (Isolated from Hospital Main POS)
          </div>
          <h1 style={{ margin: '4px 0 4px', fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em' }}>
            Pharmacy Payment Desk
          </h1>
          <div style={{ fontSize: 13, color: '#D1FAE5' }}>
            Collect strictly for prescribed or OTC medicines · Hold/Defer unavailable funds drugs · AkwaRemit compliant
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowCounterModal(true)}
            style={{
              background: '#FFFFFF',
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
            <Plus size={15} /> Counter / OTC Drug Bill
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('pharmacy')}
            style={{
              background: 'rgba(255,255,255,0.16)',
              color: '#FFFFFF',
              border: '1px solid rgba(255,255,255,0.32)',
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
            <Pill size={15} /> Dispense Queue
          </button>
        </div>
      </div>

      {/* Scoped KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #A7F3D0', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#047857', textTransform: 'uppercase' }}>
            Open Pharmacy Bills
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#064E3B', marginTop: 4 }}>
            ₦{kpis.payableTotalNgn.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: '#64748B' }}>{kpis.payableCount} active Rx bill lines</div>
        </div>

        <div style={{ background: '#FAF5FF', border: '1px solid #E9D5FF', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7E22CE', textTransform: 'uppercase' }}>
            Held / Deferred by Patients
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#6B21A8', marginTop: 4 }}>
            ₦{kpis.deferredTotalNgn.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: '#64748B' }}>{kpis.deferredCount} held item(s) excluded from totals</div>
        </div>

        <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#047857', textTransform: 'uppercase' }}>
            Collected at Pharmacy Today
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#065F46', marginTop: 4 }}>
            ₦{kpis.collectedTodayNgn.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: '#047857' }}>{kpis.receiptCount} Pharmacy receipt(s)</div>
        </div>
      </div>

      {/* Main Split: Patient Queue & Checkout | Held Panel + Today's Pharmacy Receipts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(270px, 340px) minmax(0, 1.35fr) minmax(280px, 340px)', gap: 16, alignItems: 'start' }}>
        {/* Left: Patients with Pharmacy Items Only */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A', marginBottom: 10 }}>
            Patients with Pharmacy Bills
          </div>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search size={14} color="#64748B" style={{ position: 'absolute', left: 10, top: 10 }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient, HN or drug..."
              style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: 9, border: '1px solid #CBD5E1', fontSize: 12 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 460, overflowY: 'auto' }}>
            {patientGroups.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#64748B', background: '#F8FAFC', borderRadius: 10 }}>
                No pending or held pharmacy bills right now.
              </div>
            ) : (
              patientGroups.map((g) => {
                const selected = activeGroup?.patientKey === g.patientKey;
                const due = g.payableLines.reduce((s, l) => s + l.amountNgn, 0);
                return (
                  <button
                    key={g.patientKey}
                    type="button"
                    onClick={() => setSelectedPatientKey(g.patientKey)}
                    style={{
                      textAlign: 'left',
                      padding: 11,
                      borderRadius: 11,
                      border: selected ? '2px solid #059669' : '1px solid #E2E8F0',
                      background: selected ? '#ECFDF5' : '#FFFFFF',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <strong style={{ fontSize: 13, color: '#0F172A' }}>{g.patientName}</strong>
                      <strong style={{ fontSize: 13, color: '#047857' }}>₦{due.toLocaleString()}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>
                      {g.hospitalNumber} · {g.payableLines.length} payable
                      {g.deferredLines.length > 0 ? ` · ${g.deferredLines.length} held` : ''}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Center: Checkout + Per-Drug Hold/Restore */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 18 }}>
            {!activeGroup ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>
                <CreditCard size={34} color="#10B981" style={{ marginBottom: 8 }} />
                <div style={{ fontWeight: 800, color: '#0F172A', fontSize: 15 }}>Select a patient to settle Pharmacy bill</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Only prescribed drugs & OTC items billed to Pharmacy appear on this desk.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, borderBottom: '1px solid #F1F5F9', paddingBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#047857', textTransform: 'uppercase' }}>
                      Active Pharmacy Basket
                    </div>
                    <h2 style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 900, color: '#0F172A' }}>
                      {activeGroup.patientName} <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>({activeGroup.hospitalNumber})</span>
                    </h2>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>PAYABLE NOW</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#065F46' }}>
                      ₦{activeTotal.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Active Payable Drugs */}
                {activeGroup.payableLines.length === 0 ? (
                  <div style={{ padding: 18, borderRadius: 10, background: '#FAF5FF', color: '#6B21A8', fontSize: 12, fontWeight: 600 }}>
                    All drugs for this patient are currently on Hold. Restore an item below when ready to pay.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {activeGroup.payableLines.map((line) => (
                      <div
                        key={line.id}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 11,
                          border: '1px solid #E2E8F0',
                          background: '#F8FAFC',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 10,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A' }}>{line.description}</div>
                          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                            {line.orderId ? `Rx: ${line.orderId}` : 'Counter item'} · Added {new Date(line.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <strong style={{ fontSize: 14, color: '#065F46' }}>₦{line.amountNgn.toLocaleString()}</strong>
                          <button
                            type="button"
                            onClick={() => handleHoldLine(line)}
                            title="Remove from immediate bill and hold for patient return"
                            style={{
                              padding: '5px 10px',
                              borderRadius: 8,
                              border: '1px solid #DDD6FE',
                              background: '#FAF5FF',
                              color: '#7E22CE',
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <PauseCircle size={13} /> Hold for Later
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Collapsible Held / Deferred Drugs Section */}
                {activeGroup.deferredLines.length > 0 && (
                  <div style={{ border: '1px solid #E9D5FF', borderRadius: 12, overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => setDeferredOpen((v) => !v)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: '#FAF5FF',
                        border: 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        color: '#6B21A8',
                        fontWeight: 800,
                        fontSize: 12,
                      }}
                    >
                      <span>Held / Deferred Drugs ({activeGroup.deferredLines.length}) — Patient Will Return Later</span>
                      {deferredOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                    {deferredOpen && (
                      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, background: '#FFFFFF' }}>
                        {activeGroup.deferredLines.map((line) => (
                          <div
                            key={line.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 10,
                              padding: '8px 10px',
                              borderRadius: 9,
                              background: '#FDF4FF',
                              border: '1px dashed #D8B4FE',
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 12, color: '#581C87' }}>{line.description}</div>
                              <div style={{ fontSize: 11, color: '#7E22CE' }}>
                                Held {line.deferredAt ? new Date(line.deferredAt).toLocaleTimeString() : ''} · ₦{line.amountNgn.toLocaleString()}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRestoreLine(line)}
                              style={{
                                padding: '5px 10px',
                                borderRadius: 8,
                                border: '1px solid #A7F3D0',
                                background: '#ECFDF5',
                                color: '#065F46',
                                fontSize: 11,
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <RotateCcw size={12} /> Restore to Bill
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Collection Bar (NO separate Mark-as-Paid shortcut) */}
                {activeGroup.payableLines.length > 0 && (
                  <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                      {(
                        [
                          ['cash', 'Cash Till', Banknote],
                          ['akwaremit_pos', 'AkwaRemit POS', CreditCard],
                          ['direct_akwaremit', 'Direct RRR / Transfer', Landmark],
                          ['hmo', 'HMO / NHIA', ShieldCheck],
                        ] as [PayMethod, string, React.ComponentType<{ size?: number }>][]
                      ).map(([k, lbl, Icon]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setPayMethod(k)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 9,
                            border: payMethod === k ? '2px solid #047857' : '1px solid #A7F3D0',
                            background: payMethod === k ? '#047857' : '#FFFFFF',
                            color: payMethod === k ? '#FFFFFF' : '#065F46',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 5,
                          }}
                        >
                          <Icon size={13} /> {lbl}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        value={payRef}
                        onChange={(e) => setPayRef(e.target.value)}
                        placeholder={
                          payMethod === 'cash'
                            ? 'Optional till voucher / ARN'
                            : payMethod === 'direct_akwaremit'
                              ? 'Enter AkwaRemit RRR reference'
                              : 'POS / HMO authorization ref'
                        }
                        style={{ flex: 1, minWidth: 180, padding: '9px 12px', borderRadius: 9, border: '1px solid #A7F3D0', fontSize: 13 }}
                      />
                      <button
                        type="button"
                        onClick={handleCollectPayment}
                        style={{
                          padding: '10px 18px',
                          borderRadius: 10,
                          border: 'none',
                          background: '#065F46',
                          color: '#FFFFFF',
                          fontWeight: 800,
                          fontSize: 13,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <CheckCircle2 size={15} /> Collect ₦{activeTotal.toLocaleString()} & Issue Receipt
                      </button>
                    </div>
                    {payMethod === 'cash' && (
                      <div style={{ fontSize: 11, color: '#065F46' }}>
                        Cash collected at Pharmacy Till stays marked <strong>Pending Accountant TSA Remittance</strong> until Accountant remits shift cash.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Today's Pharmacy Receipts Only */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Receipt size={16} color="#059669" />
              <strong style={{ fontSize: 14, color: '#0F172A' }}>Today’s Pharmacy Receipts</strong>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#065F46', background: '#ECFDF5', padding: '2px 8px', borderRadius: 999 }}>
              {todayReceipts.length}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 460, overflowY: 'auto' }}>
            {todayReceipts.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#64748B', background: '#F8FAFC', borderRadius: 10 }}>
                No pharmacy receipts issued today.
              </div>
            ) : (
              todayReceipts.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setOpenReceipt(r)}
                  style={{
                    textAlign: 'left',
                    padding: 10,
                    borderRadius: 10,
                    border: '1px solid #E2E8F0',
                    background: '#F8FAFC',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 12, color: '#0F172A' }}>{r.patientName}</strong>
                    <strong style={{ fontSize: 12, color: '#047857' }}>₦{r.amountNgn.toLocaleString()}</strong>
                  </div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{r.receiptNo} · {r.channel || r.method}</div>
                  <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
                    {new Date(r.issuedAt).toLocaleTimeString()} · Click to open & print
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Counter / OTC Bill Modal */}
      {showCounterModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <form
            noValidate
            onSubmit={handleAddCounterBill}
            style={{ background: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 460, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0F172A' }}>New Pharmacy Counter / OTC Bill</h3>
              <button type="button" onClick={() => setShowCounterModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <VerifiedPatientField
              facilityId={facilityId}
              label="Verified Patient *"
              required
              value={counterPatient}
              onSelect={(p) => setCounterPatient(p)}
              error={counterSubmitErr && !counterPatient ? 'Select a verified patient' : null}
            />
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                Medication (Formulary Auto-Price) *
              </label>
              <input
                required
                list="pharm-pos-drugs"
                value={counterDrugName}
                onChange={(e) => {
                  const val = e.target.value;
                  setCounterDrugName(val);
                  const hit = drugs.find((d) => d.name.toLowerCase() === val.trim().toLowerCase());
                  if (hit) setCounterUnitNgn(String(hit.unitPriceNgn));
                }}
                className={counterSubmitErr && !counterDrugName.trim() ? 'mc-field-invalid' : undefined}
                placeholder="Type drug name from live formulary..."
                style={{ width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid #CBD5E1', fontSize: 13 }}
              />
              <datalist id="pharm-pos-drugs">
                {drugs.map((d) => (
                  <option key={d.id} value={d.name}>
                    ₦{d.unitPriceNgn.toLocaleString()} · {d.strength}
                  </option>
                ))}
              </datalist>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Qty *</label>
                <input
                  required
                  type="number"
                  min={1}
                  value={counterQty}
                  onChange={(e) => setCounterQty(e.target.value)}
                  style={{ width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid #CBD5E1', fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Unit Price (₦) *</label>
                <input
                  required
                  type="number"
                  min={1}
                  value={counterUnitNgn}
                  onChange={(e) => setCounterUnitNgn(e.target.value)}
                  style={{ width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid #CBD5E1', fontSize: 13 }}
                />
              </div>
            </div>
            <button
              type="submit"
              style={{ marginTop: 6, padding: '10px 16px', borderRadius: 10, border: 'none', background: '#059669', color: '#FFFFFF', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
            >
              Add to Pharmacy Bill
            </button>
          </form>
        </div>
      )}

      {/* Openable & Printable Pharmacy Receipt Modal */}
      {openReceipt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div style={{ background: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 430, padding: 22, boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#065F46', background: '#ECFDF5', padding: '3px 9px', borderRadius: 999 }}>
                OFFICIAL PHARMACY RECEIPT
              </span>
              <button type="button" onClick={() => setOpenReceipt(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #CBD5E1', paddingBottom: 12, marginBottom: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 16, color: '#0F172A' }}>{openReceipt.facilityName}</div>
              <div style={{ fontSize: 12, color: '#047857', fontWeight: 700 }}>Dispensary Payment Desk</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#064E3B', marginTop: 6 }}>
                ₦{openReceipt.amountNgn.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: '#64748B' }}>{openReceipt.receiptNo}</div>
            </div>
            <div style={{ fontSize: 12, color: '#334155', display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
              <div><strong>Patient:</strong> {openReceipt.patientName} ({openReceipt.hospitalNumber})</div>
              <div><strong>Items:</strong> {openReceipt.purpose}</div>
              <div><strong>Method:</strong> {openReceipt.channel || openReceipt.method}</div>
              <div><strong>Reference:</strong> {openReceipt.reference}</div>
              <div><strong>Cashier / RPh:</strong> {openReceipt.cashier || actor}</div>
              <div><strong>Issued:</strong> {new Date(openReceipt.issuedAt).toLocaleString()}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <ScannableQrCode value={receiptQrValue} size={96} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => reprintPaymentReceipt(openReceipt.receiptNo)}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: 'none', background: '#059669', color: '#FFFFFF', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Printer size={15} /> Print Official Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
