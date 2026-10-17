'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  listAkwaRemitPayments,
  listAkwaRemitBatches,
  listAkwaRemitShifts,
  getAkwaRemitDailySummary,
  recordAkwaRemitPayment,
  executeAkwaRemitBatch,
  closeCashierShiftDualControl,
  AKWAREMIT_EVENT,
  type AkwaRemitPaymentRecord,
  type AkwaRemitBatchRecord,
  type AkwaRemitShiftCloseRecord,
  type AkwaRemitMethod,
  type AkwaRemitRemittanceStatus,
} from '../../lib/akwaRemitStore';
import {
  Landmark,
  Banknote,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  FileText,
  Printer,
  Search,
  Plus,
  RefreshCw,
  Users,
  Building2,
  DollarSign,
  Lock,
} from 'lucide-react';

interface Props {
  session: UserSession;
}

type TabType = 'report' | 'remit' | 'shift' | 'batches';

export const AkwaRemitRevenueSuite: React.FC<Props> = ({ session }) => {
  const facilityId = session.hospitalId || 'IGH-EKT';
  const facilityName = session.facility || 'Immanuel General Hospital, Eket';

  const [activeTab, setActiveTab] = useState<TabType>('report');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<AkwaRemitMethod | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AkwaRemitRemittanceStatus | 'all'>('all');

  const [payments, setPayments] = useState<AkwaRemitPaymentRecord[]>([]);
  const [batches, setBatches] = useState<AkwaRemitBatchRecord[]>([]);
  const [shifts, setShifts] = useState<AkwaRemitShiftCloseRecord[]>([]);

  // Selection state for batch remittance
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const [showRemitModal, setShowRemitModal] = useState(false);
  const [batchRrr, setBatchRrr] = useState('');
  const [bankTellerRef, setBankTellerRef] = useState('');
  const [bankName, setBankName] = useState('Zenith Bank (Akwa Ibom State Revenue Acct)');
  const [witnessName, setWitnessName] = useState('');
  const [witnessBadge, setWitnessBadge] = useState('');
  const [batchNotes, setBatchNotes] = useState('');
  const [remitSuccessMsg, setRemitSuccessMsg] = useState<string | null>(null);

  // Dual-control shift close state
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftWitnessName, setShiftWitnessName] = useState('');
  const [shiftWitnessBadge, setShiftWitnessBadge] = useState('');
  const [countedCash, setCountedCash] = useState<number | ''>('');
  const [n1000, setN1000] = useState<number | ''>('');
  const [n500, setN500] = useState<number | ''>('');
  const [n200, setN200] = useState<number | ''>('');
  const [shiftSuccessMsg, setShiftSuccessMsg] = useState<string | null>(null);

  // New Payment Modal state
  const [showNewPaymentModal, setShowNewPaymentModal] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newHospitalNo, setNewHospitalNo] = useState('');
  const [newAmount, setNewAmount] = useState<number | ''>('');
  const [newMethod, setNewMethod] = useState<AkwaRemitMethod>('cash');
  const [newCategory, setNewCategory] = useState<any>('consultation');
  const [newPurpose, setNewPurpose] = useState('');
  const [newPaystackRef, setNewPaystackRef] = useState('');
  const [newDirectRrr, setNewDirectRrr] = useState('');

  const reloadData = () => {
    setPayments(listAkwaRemitPayments(facilityId));
    setBatches(listAkwaRemitBatches(facilityId));
    setShifts(listAkwaRemitShifts(facilityId));
  };

  useEffect(() => {
    reloadData();
    const onUpdate = () => reloadData();
    window.addEventListener(AKWAREMIT_EVENT, onUpdate);
    window.addEventListener('medcore-payment-receipts', onUpdate);
    return () => {
      window.removeEventListener(AKWAREMIT_EVENT, onUpdate);
      window.removeEventListener('medcore-payment-receipts', onUpdate);
    };
  }, [facilityId]);

  const summary = useMemo(
    () => getAkwaRemitDailySummary(facilityId, selectedDate),
    [facilityId, selectedDate, payments]
  );

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (selectedDate && !p.createdAt.startsWith(selectedDate)) return false;
      if (methodFilter !== 'all' && p.method !== methodFilter) return false;
      if (statusFilter !== 'all' && p.remittanceStatus !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase().trim();
        return (
          p.patientName.toLowerCase().includes(q) ||
          p.hospitalNumber.toLowerCase().includes(q) ||
          p.receiptNo.toLowerCase().includes(q) ||
          (p.akwaRemitRrr && p.akwaRemitRrr.toLowerCase().includes(q)) ||
          (p.paystackRef && p.paystackRef.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [payments, selectedDate, methodFilter, statusFilter, search]);

  const pendingPaymentsForRemit = useMemo(() => {
    return payments.filter((p) => p.remittanceStatus === 'pending');
  }, [payments]);

  const toggleSelectPayment = (id: string) => {
    setSelectedPaymentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllPending = () => {
    if (selectedPaymentIds.length === pendingPaymentsForRemit.length) {
      setSelectedPaymentIds([]);
    } else {
      setSelectedPaymentIds(pendingPaymentsForRemit.map((p) => p.id));
    }
  };

  const handleExecuteRemit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchRrr.trim()) {
      alert('Official AkwaRemit RRR is required for state remittance');
      return;
    }
    if (!witnessName.trim()) {
      alert('Dual-control second witness name is required for compliance sign-off');
      return;
    }

    try {
      const batch = executeAkwaRemitBatch({
        facilityId,
        facilityName,
        batchType: 'cash_bulk',
        paymentIds: selectedPaymentIds,
        akwaRemitRrr: batchRrr.trim(),
        bankName: bankName.trim(),
        bankTellerRef: bankTellerRef.trim() || undefined,
        remittedBy: session.name || 'Head of Accounts',
        remittedByBadge: session.badgeId || 'ADM-00001',
        witnessedBy: witnessName.trim(),
        witnessedByBadge: witnessBadge.trim() || 'WITNESS',
        notes: batchNotes.trim(),
      });

      setRemitSuccessMsg(
        `Successfully remitted ₦${batch.totalAmountNgn.toLocaleString()} into AkwaRemit under RRR ${batch.akwaRemitRrr} (Batch ${batch.batchNumber}).`
      );
      setSelectedPaymentIds([]);
      setBatchRrr('');
      setBankTellerRef('');
      setWitnessName('');
      setShowRemitModal(false);
      reloadData();
      setTimeout(() => setRemitSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Remittance execution failed');
    }
  };

  const handleShiftClose = (e: React.FormEvent) => {
    e.preventDefault();
    if (countedCash === '') {
      alert('Please enter total physical cash counted');
      return;
    }
    if (!shiftWitnessName.trim()) {
      alert('Dual-control witness supervisor sign-off is mandatory');
      return;
    }

    const rec = closeCashierShiftDualControl({
      shiftId: `SHIFT-${selectedDate}-${new Date().getHours() < 14 ? 'MORNING' : 'AFTERNOON'}`,
      facilityId,
      cashierName: session.name || 'Cashier',
      cashierBadge: session.badgeId || 'RCP-01208',
      witnessName: shiftWitnessName.trim(),
      witnessBadge: shiftWitnessBadge.trim() || 'SUPERVISOR',
      shiftStart: `${selectedDate}T08:00:00Z`,
      shiftEnd: new Date().toISOString(),
      physicalCashCountedNgn: Number(countedCash),
      denominations: {
        n1000: Number(n1000) || 0,
        n500: Number(n500) || 0,
        n200: Number(n200) || 0,
        n100: 0,
        n50: 0,
      },
    });

    setShiftSuccessMsg(
      `Shift closed with variance: ₦${rec.cashVarianceNgn.toLocaleString()} (${rec.cashVarianceNgn === 0 ? 'BALANCED' : rec.cashVarianceNgn > 0 ? 'SURPLUS' : 'DEFICIT'}).`
    );
    setShowShiftModal(false);
    reloadData();
    setTimeout(() => setShiftSuccessMsg(null), 6000);
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName.trim() || !newAmount || Number(newAmount) <= 0) {
      alert('Patient name and valid amount are required');
      return;
    }
    if (newMethod === 'paystack_terminal' && !newPaystackRef.trim()) {
      alert('Paystack Terminal Transaction Reference / RRN is required for terminal collections');
      return;
    }
    if (newMethod === 'direct_akwaremit' && !newDirectRrr.trim()) {
      alert('AkwaRemit RRR / Receipt number is required for direct remittances');
      return;
    }

    const receiptNo = `RCP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    recordAkwaRemitPayment({
      receiptNo,
      facilityId,
      facilityName,
      patientId: `P-${Date.now().toString().slice(-4)}`,
      patientName: newPatientName.trim(),
      hospitalNumber: newHospitalNo.trim() || 'MRN-NEW',
      amountNgn: Number(newAmount),
      method: newMethod,
      serviceCategory: newCategory,
      description: newPurpose.trim() || 'Hospital Clinical Service',
      cashierName: session.name || 'Cashier Desk',
      cashierBadge: session.badgeId || 'RCP-01208',
      shiftId: `SHIFT-${selectedDate}-ACTIVE`,
      paystackRef: newMethod === 'paystack_terminal' ? newPaystackRef.trim() : undefined,
      akwaRemitRrr: newMethod === 'direct_akwaremit' ? newDirectRrr.trim() : undefined,
    });

    setShowNewPaymentModal(false);
    setNewPatientName('');
    setNewHospitalNo('');
    setNewAmount('');
    setNewPaystackRef('');
    setNewDirectRrr('');
    setNewPurpose('');
    reloadData();
  };

  const selectedTotalAmount = useMemo(() => {
    return payments
      .filter((p) => selectedPaymentIds.includes(p.id))
      .reduce((s, p) => s + p.amountNgn, 0);
  }, [payments, selectedPaymentIds]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 60 }}>
      {/* ─── Top Header with Official State Seal Banner ─── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0A2540 0%, #0F172A 100%)',
          borderRadius: 20,
          padding: '24px 28px',
          color: '#FFFFFF',
          boxShadow: '0 12px 32px rgba(10, 37, 64, 0.18)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #0052D4 0%, #00BFA5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 16px rgba(0, 191, 165, 0.35)',
            }}
          >
            <Landmark size={28} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 900, letterSpacing: -0.5 }}>
                AkwaRemit Central State Revenue Hub
              </h1>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: 'rgba(0, 191, 165, 0.2)',
                  color: '#34D399',
                  border: '1px solid rgba(52, 211, 153, 0.4)',
                }}
              >
                OFFICIAL STATE REVENUE PLATFORM
              </span>
            </div>
            <p style={{ margin: '4px 0 0', color: '#94A3B8', fontSize: '0.85rem' }}>
              Central treasury destination for all hospital revenue · Cash, Paystack Terminal & Direct AkwaRemit RRR
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => setShowNewPaymentModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #0052D4 0%, #00BFA5 100%)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0, 82, 212, 0.3)',
            }}
          >
            <Plus size={16} />
            <span>Record Payment</span>
          </button>
          <button
            type="button"
            onClick={() => setShowShiftModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.08)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            <Lock size={15} color="#38BDF8" />
            <span>Dual-Control Shift Close</span>
          </button>
        </div>
      </div>

      {/* ─── Success Alerts ─── */}
      {remitSuccessMsg && (
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            color: '#15803D',
            fontSize: '0.85rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <CheckCircle2 size={18} />
          <span>{remitSuccessMsg}</span>
        </div>
      )}
      {shiftSuccessMsg && (
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            color: '#1D4ED8',
            fontSize: '0.85rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <ShieldCheck size={18} />
          <span>{shiftSuccessMsg}</span>
        </div>
      )}

      {/* ─── 4 Executive KPI Cards ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {/* KPI 1: Total Collections */}
        <div className="os-card" style={{ padding: 18, borderLeft: '4px solid #0052D4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
              Total Revenue ({selectedDate})
            </span>
            <DollarSign size={18} color="#0052D4" />
          </div>
          <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#0F172A', marginTop: 8 }}>
            ₦{summary.totalCollectionsNgn.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: 4 }}>
            {summary.receiptsCount} total receipts issued
          </div>
        </div>

        {/* KPI 2: Reached AkwaRemit (Remitted + Direct) */}
        <div className="os-card" style={{ padding: 18, borderLeft: '4px solid #10B981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>
              Reached AkwaRemit
            </span>
            <CheckCircle2 size={18} color="#10B981" />
          </div>
          <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#047857', marginTop: 8 }}>
            ₦{summary.alreadyInAkwaRemitNgn.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#059669', fontWeight: 700, marginTop: 4 }}>
            {summary.complianceRatePercent}% Remittance Compliance
          </div>
        </div>

        {/* KPI 3: Pending Remittance */}
        <div className="os-card" style={{ padding: 18, borderLeft: '4px solid #F59E0B' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#D97706', textTransform: 'uppercase' }}>
              Pending Remittance
            </span>
            <Clock size={18} color="#F59E0B" />
          </div>
          <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#B45309', marginTop: 8 }}>
            ₦{summary.pendingRemittanceNgn.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#B45309', marginTop: 4 }}>
            {summary.pendingReceiptsCount} receipts awaiting bulk RRR
          </div>
        </div>

        {/* KPI 4: Direct AkwaRemit Collections */}
        <div className="os-card" style={{ padding: 18, borderLeft: '4px solid #0284C7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0284C7', textTransform: 'uppercase' }}>
              Direct AkwaRemit RRR
            </span>
            <Landmark size={18} color="#0284C7" />
          </div>
          <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#0369A1', marginTop: 8 }}>
            ₦{summary.directAkwaRemitTotalNgn.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: 4 }}>
            Paid directly on State portal
          </div>
        </div>
      </div>

      {/* ─── Tabs Navigation Bar ─── */}
      <div style={{ display: 'flex', gap: 10, borderBottom: '2px solid #E2E8F0', paddingBottom: 6 }}>
        <button
          type="button"
          onClick={() => setActiveTab('report')}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'report' ? '#0052D4' : 'transparent',
            color: activeTab === 'report' ? '#FFFFFF' : '#64748B',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          1. Daily Remittance Report
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('remit')}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'remit' ? '#0052D4' : 'transparent',
            color: activeTab === 'remit' ? '#FFFFFF' : '#64748B',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>2. Remit to AkwaRemit</span>
          {pendingPaymentsForRemit.length > 0 && (
            <span
              style={{
                background: '#F59E0B',
                color: '#fff',
                fontSize: '0.65rem',
                padding: '1px 6px',
                borderRadius: 10,
              }}
            >
              {pendingPaymentsForRemit.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('batches')}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'batches' ? '#0052D4' : 'transparent',
            color: activeTab === 'batches' ? '#FFFFFF' : '#64748B',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          3. Remittance Audit Batches ({batches.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('shift')}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'shift' ? '#0052D4' : 'transparent',
            color: activeTab === 'shift' ? '#FFFFFF' : '#64748B',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          4. Cashier Shift Closes ({shifts.length})
        </button>
      </div>

      {/* ─── TAB 1: DAILY REMITTANCE REPORT ─── */}
      {activeTab === 'report' && (
        <div className="os-card" style={{ padding: 20 }}>
          {/* Controls Bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                }}
              />
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value as any)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: '0.82rem',
                }}
              >
                <option value="all">All Methods</option>
                <option value="cash">Cash Collections</option>
                <option value="paystack_terminal">Paystack Terminal</option>
                <option value="direct_akwaremit">Direct AkwaRemit</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: '0.82rem',
                }}
              >
                <option value="all">All Remittance Statuses</option>
                <option value="remitted">Remitted to AkwaRemit</option>
                <option value="direct_akwaremit">Direct AkwaRemit</option>
                <option value="pending">Pending Remittance</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Search size={14} style={{ position: 'absolute', left: 10, color: '#94A3B8' }} />
                <input
                  type="text"
                  placeholder="Search receipt, patient, RRR, ref…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    padding: '7px 12px 7px 32px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: '0.82rem',
                    width: 240,
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="os-ghost-btn"
                style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Printer size={14} />
                <span>Print State Audit Report</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 800, color: '#475569' }}>Receipt No</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800, color: '#475569' }}>Patient & Hospital No</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800, color: '#475569' }}>Method</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800, color: '#475569' }}>Audit Reference</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800, color: '#475569' }}>Amount</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800, color: '#475569' }}>Cashier</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800, color: '#475569' }}>AkwaRemit Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 36, color: '#94A3B8' }}>
                      No payment records found for {selectedDate}.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p) => {
                    const isRemitted = p.remittanceStatus === 'remitted';
                    const isDirect = p.remittanceStatus === 'direct_akwaremit';

                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0F172A' }}>
                          {p.receiptNo}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 700, color: '#0F172A' }}>{p.patientName}</div>
                          <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{p.hospitalNumber}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {p.method === 'cash' ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: '#FEF3C7',
                                color: '#92400E',
                                fontWeight: 700,
                                fontSize: '0.72rem',
                              }}
                            >
                              <Banknote size={12} /> Cash
                            </span>
                          ) : p.method === 'paystack_terminal' ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: '#E0F2FE',
                                color: '#0369A1',
                                fontWeight: 700,
                                fontSize: '0.72rem',
                              }}
                            >
                              <CreditCard size={12} /> Paystack Terminal
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: '#DCFCE7',
                                color: '#166534',
                                fontWeight: 700,
                                fontSize: '0.72rem',
                              }}
                            >
                              <Landmark size={12} /> Direct AkwaRemit
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                          {p.method === 'paystack_terminal' ? (
                            <div>
                              <div>Ref: {p.paystackRef || 'N/A'}</div>
                              {p.rrn && <div style={{ color: '#64748B' }}>RRN: {p.rrn}</div>}
                            </div>
                          ) : p.method === 'direct_akwaremit' ? (
                            <div style={{ color: '#047857', fontWeight: 700 }}>RRR: {p.akwaRemitRrr}</div>
                          ) : (
                            <div style={{ color: '#64748B' }}>Physical Cash Desk</div>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0F172A' }}>
                          ₦{p.amountNgn.toLocaleString()}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#475569' }}>
                          <div>{p.cashierName}</div>
                          <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>{p.shiftId}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {isRemitted ? (
                            <div>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  background: '#DCFCE7',
                                  color: '#15803D',
                                  fontWeight: 800,
                                  fontSize: '0.72rem',
                                }}
                              >
                                <CheckCircle2 size={12} /> Remitted to AkwaRemit
                              </span>
                              <div style={{ fontSize: '0.68rem', color: '#047857', marginTop: 2, fontFamily: 'monospace' }}>
                                {p.akwaRemitRrr}
                              </div>
                            </div>
                          ) : isDirect ? (
                            <div>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  background: '#EFF6FF',
                                  color: '#1D4ED8',
                                  fontWeight: 800,
                                  fontSize: '0.72rem',
                                }}
                              >
                                <CheckCircle2 size={12} /> Direct AkwaRemit
                              </span>
                              <div style={{ fontSize: '0.68rem', color: '#1E40AF', marginTop: 2, fontFamily: 'monospace' }}>
                                RRR: {p.akwaRemitRrr}
                              </div>
                            </div>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '3px 8px',
                                borderRadius: 6,
                                background: '#FEF3C7',
                                color: '#B45309',
                                fontWeight: 800,
                                fontSize: '0.72rem',
                              }}
                            >
                              <Clock size={12} /> Pending Remittance
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 2: REMIT TO AKWAREMIT (BATCH PROCESSOR) ─── */}
      {activeTab === 'remit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="os-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
                  Select Collections for AkwaRemit Bulk Remittance
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748B' }}>
                  Group verified Cash collections or Paystack settlements into an official state treasury remittance batch with an AkwaRemit RRR.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  type="button"
                  className="os-ghost-btn"
                  onClick={selectAllPending}
                  style={{ fontSize: '0.8rem' }}
                >
                  {selectedPaymentIds.length === pendingPaymentsForRemit.length ? 'Deselect All' : 'Select All Pending'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRemitModal(true)}
                  disabled={selectedPaymentIds.length === 0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 18px',
                    borderRadius: 10,
                    border: 'none',
                    background: selectedPaymentIds.length === 0 ? '#94A3B8' : 'linear-gradient(135deg, #0052D4 0%, #00BFA5 100%)',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: selectedPaymentIds.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Landmark size={15} />
                  <span>Execute AkwaRemit Remittance ({selectedPaymentIds.length})</span>
                </button>
              </div>
            </div>

            {selectedPaymentIds.length > 0 && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  marginBottom: 14,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1E40AF' }}>
                  {selectedPaymentIds.length} payments selected for bulk remittance
                </span>
                <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1D4ED8' }}>
                  Total: ₦{selectedTotalAmount.toLocaleString()}
                </span>
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', width: 40 }}>Select</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#475569' }}>Receipt No</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#475569' }}>Patient</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#475569' }}>Method</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#475569' }}>Amount</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#475569' }}>Cashier</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#475569' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingPaymentsForRemit.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 36, color: '#10B981', fontWeight: 700 }}>
                        All collections have reached AkwaRemit! No pending remittances.
                      </td>
                    </tr>
                  ) : (
                    pendingPaymentsForRemit.map((p) => {
                      const isSelected = selectedPaymentIds.includes(p.id);
                      return (
                        <tr
                          key={p.id}
                          onClick={() => toggleSelectPayment(p.id)}
                          style={{
                            borderBottom: '1px solid #F1F5F9',
                            background: isSelected ? 'rgba(0, 82, 212, 0.05)' : undefined,
                            cursor: 'pointer',
                          }}
                        >
                          <td style={{ padding: '10px 12px' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectPayment(p.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 700 }}>{p.receiptNo}</td>
                          <td style={{ padding: '10px 12px' }}>{p.patientName}</td>
                          <td style={{ padding: '10px 12px' }}>
                            {p.method === 'cash' ? 'Cash' : 'Paystack Terminal'}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 800 }}>₦{p.amountNgn.toLocaleString()}</td>
                          <td style={{ padding: '10px 12px' }}>{p.cashierName}</td>
                          <td style={{ padding: '10px 12px', color: '#64748B' }}>
                            {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: AUDIT BATCHES ─── */}
      {activeTab === 'batches' && (
        <div className="os-card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
            AkwaRemit Official Remittance Audit Ledger
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Batch No</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Official AkwaRemit RRR</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Type</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Amount</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Receipts</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Remitted By</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Dual-Control Witness</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Date Remitted</th>
                </tr>
              </thead>
              <tbody>
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 36, color: '#94A3B8' }}>
                      No remittance batches recorded yet.
                    </td>
                  </tr>
                ) : (
                  batches.map((b) => (
                    <tr key={b.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700 }}>{b.batchNumber}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#0052D4', fontWeight: 800 }}>
                        {b.akwaRemitRrr}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {b.batchType === 'cash_bulk' ? 'Cash Total' : 'Paystack Settlement'}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: '#047857' }}>
                        ₦{b.totalAmountNgn.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 12px' }}>{b.itemCount} receipts</td>
                      <td style={{ padding: '10px 12px' }}>{b.remittedBy}</td>
                      <td style={{ padding: '10px 12px', color: '#64748B' }}>
                        <ShieldCheck size={13} style={{ display: 'inline', marginRight: 4, color: '#10B981' }} />
                        {b.witnessedBy}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748B' }}>
                        {new Date(b.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 4: CASHIER SHIFT CLOSES ─── */}
      {activeTab === 'shift' && (
        <div className="os-card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
            Dual-Controlled Cashier Shift Closures
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Shift ID</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Cashier</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Dual-Control Witness</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>System Cash</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Physical Counted</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Variance</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Terminal Total</th>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Closed At</th>
                </tr>
              </thead>
              <tbody>
                {shifts.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 36, color: '#94A3B8' }}>
                      No shifts closed yet for this facility.
                    </td>
                  </tr>
                ) : (
                  shifts.map((s) => {
                    const isBalanced = s.cashVarianceNgn === 0;
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>{s.shiftId}</td>
                        <td style={{ padding: '10px 12px' }}>{s.cashierName}</td>
                        <td style={{ padding: '10px 12px', color: '#0369A1', fontWeight: 700 }}>
                          {s.witnessName} ({s.witnessBadge})
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                          ₦{s.systemCashNgn.toLocaleString()}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0F172A' }}>
                          ₦{s.physicalCashCountedNgn.toLocaleString()}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {isBalanced ? (
                            <span style={{ color: '#16A34A', fontWeight: 800 }}>₦0 (Balanced)</span>
                          ) : (
                            <span style={{ color: '#DC2626', fontWeight: 800 }}>
                              {s.cashVarianceNgn > 0 ? '+' : ''}₦{s.cashVarianceNgn.toLocaleString()}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#64748B' }}>
                          ₦{s.systemPaystackNgn.toLocaleString()}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#64748B' }}>
                          {new Date(s.closedAt).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── MODAL: EXECUTE AKWAREMIT REMITTANCE ─── */}
      {showRemitModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              width: '100%',
              maxWidth: 500,
              padding: 24,
              boxShadow: '0 20px 40px rgba(15,23,42,0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Landmark size={24} color="#0052D4" />
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>
                Remit to AkwaRemit (State Treasury)
              </h3>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '0.8rem', color: '#64748B' }}>
              Remitting {selectedPaymentIds.length} collections totaling{' '}
              <strong>₦{selectedTotalAmount.toLocaleString()}</strong>.
            </p>

            <form onSubmit={handleExecuteRemit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Official AkwaRemit RRR (Remita / Retrieval Ref) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. RRR-2401-9984-2103"
                  value={batchRrr}
                  onChange={(e) => setBatchRrr(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Bank / Destination Account
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Bank Deposit Teller No / Settlement Ref
                </label>
                <input
                  type="text"
                  placeholder="e.g. TELL-AKW-991204"
                  value={bankTellerRef}
                  onChange={(e) => setBankTellerRef(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Dual-Control Witness Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pharm. Ibrahim Musa"
                    value={witnessName}
                    onChange={(e) => setWitnessName(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Witness Staff Badge ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PHR-00733"
                    value={witnessBadge}
                    onChange={(e) => setWitnessBadge(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Notes / Audit Remarks
                </label>
                <input
                  type="text"
                  placeholder="Optional remittance details"
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setShowRemitModal(false)}
                  className="os-ghost-btn"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 2,
                    padding: '10px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'linear-gradient(135deg, #0052D4 0%, #00BFA5 100%)',
                    color: '#fff',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Confirm & Post to AkwaRemit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: DUAL-CONTROL SHIFT CLOSE ─── */}
      {showShiftModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              width: '100%',
              maxWidth: 480,
              padding: 24,
              boxShadow: '0 20px 40px rgba(15,23,42,0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Lock size={22} color="#0052D4" />
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                Dual-Control Cashier Shift Close
              </h3>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '0.8rem', color: '#64748B' }}>
              Two officers must count physical cash, verify against system receipts, and sign off.
            </p>

            <form onSubmit={handleShiftClose} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                  <span style={{ color: '#64748B' }}>System Recorded Cash:</span>
                  <span style={{ fontWeight: 800 }}>₦{summary.cashTotalNgn.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: '#64748B' }}>System Recorded Paystack:</span>
                  <span style={{ fontWeight: 800 }}>₦{summary.paystackTerminalTotalNgn.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Total Physical Cash Counted (₦) *
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 50000"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value === '' ? '' : Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.9rem', fontWeight: 800 }}
                />
              </div>

              {countedCash !== '' && (
                <div
                  style={{
                    padding: 8,
                    borderRadius: 6,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    background: Number(countedCash) === summary.cashTotalNgn ? '#F0FDF4' : '#FEF2F2',
                    color: Number(countedCash) === summary.cashTotalNgn ? '#16A34A' : '#DC2626',
                  }}
                >
                  Variance: ₦{(Number(countedCash) - summary.cashTotalNgn).toLocaleString()}{' '}
                  {Number(countedCash) === summary.cashTotalNgn ? '(BALANCED)' : '(DISCREPANCY DETECTED)'}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Witness Supervisor Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mr. Chinedu Okoro"
                    value={shiftWitnessName}
                    onChange={(e) => setShiftWitnessName(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Witness Staff Badge ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ADM-00001"
                    value={shiftWitnessBadge}
                    onChange={(e) => setShiftWitnessBadge(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button type="button" onClick={() => setShowShiftModal(false)} className="os-ghost-btn" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 2,
                    padding: '10px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#0F172A',
                    color: '#fff',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Sign Off & Lock Shift Cash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: RECORD NEW PAYMENT ─── */}
      {showNewPaymentModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              width: '100%',
              maxWidth: 480,
              padding: 24,
              boxShadow: '0 20px 40px rgba(15,23,42,0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Plus size={22} color="#0052D4" />
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                Record Hospital Payment
              </h3>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '0.8rem', color: '#64748B' }}>
              Every payment is logged under AkwaRemit state revenue accountability.
            </p>

            <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Patient Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mrs. Amaka Okafor"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Hospital MRN No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MRN-20-14321"
                    value={newHospitalNo}
                    onChange={(e) => setNewHospitalNo(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Amount (₦) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 8500"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 800 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Collection Method *
                </label>
                <select
                  value={newMethod}
                  onChange={(e) => setNewMethod(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                >
                  <option value="cash">1. Cash (To be remitted in bulk to AkwaRemit)</option>
                  <option value="paystack_terminal">2. Paystack Terminal (POS Card / USSD / Transfer)</option>
                  <option value="direct_akwaremit">3. Direct AkwaRemit (Patient paid on State Portal with RRR)</option>
                </select>
              </div>

              {newMethod === 'paystack_terminal' && (
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0369A1', display: 'block', marginBottom: 4 }}>
                    Paystack Terminal Ref / RRN *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. pstk_pos_99182310192 or slip RRN"
                    value={newPaystackRef}
                    onChange={(e) => setNewPaystackRef(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #38BDF8', fontSize: '0.85rem', fontFamily: 'monospace' }}
                  />
                </div>
              )}

              {newMethod === 'direct_akwaremit' && (
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#047857', display: 'block', marginBottom: 4 }}>
                    AkwaRemit RRR / Receipt Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RRR-AKW-9812-7462-09"
                    value={newDirectRrr}
                    onChange={(e) => setNewDirectRrr(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #34D399', fontSize: '0.85rem', fontFamily: 'monospace' }}
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Purpose / Service Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Pharmacy Dispense / Ultrasound / Registration"
                  value={newPurpose}
                  onChange={(e) => setNewPurpose(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button type="button" onClick={() => setShowNewPaymentModal(false)} className="os-ghost-btn" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 2,
                    padding: '10px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'linear-gradient(135deg, #0052D4 0%, #00BFA5 100%)',
                    color: '#fff',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Issue Receipt & Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
