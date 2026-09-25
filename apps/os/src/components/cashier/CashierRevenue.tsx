'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard, DollarSign, Receipt, Clock, CheckCircle2,
  AlertCircle, Search, Plus, Printer, X, Check, Trash2
} from 'lucide-react';

type BillStatus = 'pending' | 'paid' | 'insurance' | 'waived' | 'outstanding';

interface BillRecord {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  services: string[];
  totalNaira: number;
  status: BillStatus;
  paymentMethod?: string;
  nhia?: boolean;
  receiptNo?: string;
}

const STORAGE_KEY = 'ibom_os_cashier_bills';

const INITIAL_BILLS: BillRecord[] = [];

const STATUS_META: Record<BillStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#F59E0B' },
  paid: { label: 'Paid', color: '#10B981' },
  insurance: { label: 'AKSHIA/NHIA', color: '#3B82F6' },
  waived: { label: 'Waived', color: '#8B5CF6' },
  outstanding: { label: 'Outstanding', color: '#EF4444' },
};

const formatNaira = (n: number) => `₦${n.toLocaleString('en-NG')}`;

export const CashierRevenue: React.FC = () => {
  const [bills, setBills] = useState<BillRecord[]>(INITIAL_BILLS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BillStatus | 'all'>('all');

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<BillRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [patientName, setPatientName] = useState('');
  const [patientId, setPatientId] = useState('');
  const [serviceInput, setServiceInput] = useState('');
  const [servicesList, setServicesList] = useState<string[]>(['Clinical Consultation & Triage']);
  const [totalNaira, setTotalNaira] = useState('');
  const [status, setStatus] = useState<BillStatus>('pending');
  const [paymentMethod, setPaymentMethod] = useState('POS Terminal (Till 1)');
  const [nhia, setNhia] = useState(false);
  const [formError, setFormError] = useState('');

  // Load persisted bills
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setBills(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const saveBills = (newBills: BillRecord[]) => {
    setBills(newBills);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newBills));
    } catch {
      // ignore
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleAddServiceItem = () => {
    if (serviceInput.trim()) {
      setServicesList([...servicesList, serviceInput.trim()]);
      setServiceInput('');
    }
  };

  const handleRemoveServiceItem = (index: number) => {
    setServicesList(servicesList.filter((_, i) => i !== index));
  };

  const handleCreateBill = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!patientName.trim()) {
      setFormError('Please enter the patient name.');
      return;
    }
    const amount = parseFloat(totalNaira);
    if (!totalNaira || isNaN(amount) || amount <= 0) {
      setFormError('Please enter a valid bill amount.');
      return;
    }
    if (servicesList.length === 0) {
      setFormError('Please add at least one medical service / item.');
      return;
    }

    const nextIdNumber = 8832 + bills.length;
    const billId = `BL-${nextIdNumber}`;
    const pId = patientId.trim() || `PT-${Math.floor(4000 + Math.random() * 2000)}`;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const receiptNo = status === 'paid'
      ? `RCP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${nextIdNumber}`
      : status === 'insurance'
      ? `NHIA-${now.getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`
      : undefined;

    const newBill: BillRecord = {
      id: billId,
      patientId: pId,
      patientName: patientName.trim(),
      date: dateStr,
      services: servicesList,
      totalNaira: amount,
      status,
      paymentMethod: status === 'paid' ? paymentMethod : undefined,
      nhia,
      receiptNo,
    };

    const updated = [newBill, ...bills];
    saveBills(updated);
    setShowModal(false);
    showToast(`Bill ${billId} created successfully for ${patientName.trim()}!`);

    // Reset Form
    setPatientName('');
    setPatientId('');
    setTotalNaira('');
    setServicesList(['Clinical Consultation & Triage']);
    setStatus('pending');
  };

  const handleCollectPayment = (bill: BillRecord) => {
    const now = new Date();
    const receiptNo = `RCP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${bill.id.replace('BL-', '')}`;
    const updated = bills.map(b => {
      if (b.id === bill.id) {
        return {
          ...b,
          status: 'paid' as const,
          paymentMethod: 'POS Terminal (Till 1)',
          receiptNo,
        };
      }
      return b;
    });
    saveBills(updated);
    showToast(`Payment collected for ${bill.id}. Receipt #${receiptNo} generated.`);
  };

  const filtered = bills.filter(b => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (search && !b.patientName.toLowerCase().includes(search.toLowerCase()) && !b.id.toLowerCase().includes(search.toLowerCase()) && !b.patientId.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPaid = bills.filter(b => b.status === 'paid').reduce((a, b) => a + b.totalNaira, 0);
  const totalPending = bills.filter(b => b.status === 'pending').reduce((a, b) => a + b.totalNaira, 0);
  const totalInsurance = bills.filter(b => b.status === 'insurance').reduce((a, b) => a + b.totalNaira, 0);
  const totalOutstanding = bills.filter(b => b.status === 'outstanding').reduce((a, b) => a + b.totalNaira, 0);

  return (
    <div className="os-module-layout">
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 99999,
          background: '#0F172A',
          border: '1px solid #16A34A',
          borderRadius: 12,
          padding: '14px 20px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          color: '#F1F5F9',
          fontSize: '0.88rem',
          fontWeight: 600,
        }}>
          <CheckCircle2 size={18} color="#4ADE80" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="os-metrics-ribbon">
        <div className="metric-box alert-green">
          <span className="metric-label"><CheckCircle2 size={13} style={{ display: 'inline', marginRight: 4 }} />Revenue Collected</span>
          <span className="metric-val">{formatNaira(totalPaid)}</span>
          <span className="metric-sub">{bills.filter(b => b.status === 'paid').length} bills cleared</span>
        </div>
        <div className="metric-box">
          <span className="metric-label"><CreditCard size={13} style={{ display: 'inline', marginRight: 4 }} />AKSHIA / NHIA Claims</span>
          <span className="metric-val">{formatNaira(totalInsurance)}</span>
          <span className="metric-sub">{bills.filter(b => b.status === 'insurance').length} insurance-covered</span>
        </div>
        <div className="metric-box alert-yellow">
          <span className="metric-label"><Clock size={13} style={{ display: 'inline', marginRight: 4 }} />Pending Payment</span>
          <span className="metric-val">{formatNaira(totalPending)}</span>
          <span className="metric-sub">{bills.filter(b => b.status === 'pending').length} awaiting payment</span>
        </div>
        <div className="metric-box alert-red">
          <span className="metric-label"><AlertCircle size={13} style={{ display: 'inline', marginRight: 4 }} />Outstanding</span>
          <span className="metric-val">{formatNaira(totalOutstanding)}</span>
          <span className="metric-sub">{bills.filter(b => b.status === 'outstanding').length} uncleared</span>
        </div>
      </div>

      <div className="os-toolbar">
        <div className="os-search-wrap" style={{ flex: 1, minWidth: 220 }}>
          <Search size={14} />
          <input
            className="os-search-input"
            placeholder="Search patient, MRN or bill ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', 'pending', 'paid', 'insurance', 'outstanding', 'waived'] as const).map(st => {
            const active = statusFilter === st;
            const tone = st === 'all' ? '#0066FF' : STATUS_META[st].color;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className="os-ghost-btn"
                style={{
                  background: active ? `${tone}14` : undefined,
                  borderColor: active ? tone : undefined,
                  color: active ? tone : undefined,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '7px 12px',
                }}
              >
                {st === 'all' ? 'All' : STATUS_META[st].label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="os-action-btn-primary"
          onClick={() => setShowModal(true)}
          style={{
            background: 'linear-gradient(135deg, #EA580C 0%, #F59E0B 100%)',
            boxShadow: '0 4px 14px rgba(234, 88, 12, 0.28)',
          }}
        >
          <Plus size={16} /> New Bill
        </button>
      </div>

      <div className="os-table-wrap">
        <table className="os-table">
          <thead>
            <tr>
              <th>Bill No.</th>
              <th>Patient</th>
              <th>Date</th>
              <th>Services</th>
              <th>Total (₦)</th>
              <th>Status</th>
              <th>Payment / Reference</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px 12px', color: '#94A3B8' }}>
                  No bills match this filter. Click <strong>New Bill</strong> to issue one.
                </td>
              </tr>
            ) : (
              filtered.map(bill => {
                const meta = STATUS_META[bill.status];
                return (
                  <tr key={bill.id}>
                    <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.8rem', color: '#EA580C', fontWeight: 800 }}>
                      {bill.id}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.88rem' }}>{bill.patientName}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B', fontFamily: 'var(--os-font-mono)' }}>{bill.patientId}</div>
                    </td>
                    <td style={{ color: '#475569', fontSize: '0.82rem' }}>{bill.date}</td>
                    <td style={{ maxWidth: 220 }}>
                      <div style={{ fontSize: '0.78rem', color: '#334155', lineHeight: 1.45 }}>
                        {bill.services.slice(0, 2).join(', ')}
                        {bill.services.length > 2 ? ` +${bill.services.length - 2} more` : ''}
                      </div>
                      {bill.nhia && (
                        <span style={{ fontSize: '0.66rem', color: '#0066FF', fontWeight: 700, display: 'inline-block', marginTop: 3 }}>
                          AKSHIA / NHIA
                        </span>
                      )}
                    </td>
                    <td style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.92rem' }}>
                      {formatNaira(bill.totalNaira)}
                    </td>
                    <td>
                      <span style={{
                        background: `${meta.color}18`,
                        color: meta.color,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 9999,
                        border: `1px solid ${meta.color}30`,
                      }}>
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: '#475569' }}>
                      {bill.paymentMethod && <div style={{ fontWeight: 600 }}>{bill.paymentMethod}</div>}
                      {bill.receiptNo && (
                        <div style={{ fontFamily: 'var(--os-font-mono)', color: '#16A34A', fontSize: '0.7rem', fontWeight: 700 }}>
                          {bill.receiptNo}
                        </div>
                      )}
                      {!bill.paymentMethod && !bill.receiptNo && '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {bill.status === 'pending' && (
                          <button
                            type="button"
                            className="os-action-btn-primary"
                            style={{
                              fontSize: '0.72rem',
                              padding: '5px 12px',
                              background: 'linear-gradient(135deg, #16A34A, #00D4A8)',
                              boxShadow: '0 2px 8px rgba(22,163,74,0.25)',
                            }}
                            onClick={() => handleCollectPayment(bill)}
                          >
                            Collect
                          </button>
                        )}
                        <button
                          type="button"
                          className="os-ghost-btn"
                          style={{ padding: '5px 10px' }}
                          title="View & print receipt"
                          onClick={() => setSelectedReceipt(bill)}
                        >
                          <Printer size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── MODAL 1: ADD NEW CASHIER BILL ── */}
      {showModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(10, 25, 41, 0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: 16,
            width: '100%',
            maxWidth: 540,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden',
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #0A0F1C 0%, #0C1A32 55%, #0A2540 100%)',
              padding: '18px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#FFF',
              borderBottom: '1px solid rgba(0, 212, 168, 0.15)',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Receipt size={18} color="#FB923C" />
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
                    Issue New Cashier Bill
                  </span>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: 4 }}>
                  Revenue · POS / AKSHIA · MedCore OS
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFF',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleCreateBill} style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {formError && (
                <div style={{
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  color: '#991B1B',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: '0.82rem',
                }}>
                  ⚠️ {formError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                    Patient Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Victor Bassey"
                    value={patientName}
                    onChange={e => setPatientName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: '0.86rem',
                      fontWeight: 600,
                      color: '#0A2540',
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                    Patient ID / MRN
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PT-4910"
                    value={patientId}
                    onChange={e => setPatientId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: '0.86rem',
                      fontFamily: 'monospace',
                      color: '#0A2540',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Total Amount & Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                    Total Bill Amount (₦) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 18500"
                    value={totalNaira}
                    onChange={e => setTotalNaira(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: '0.9rem',
                      fontWeight: 800,
                      color: '#0A2540',
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                    Initial Bill Status *
                  </label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as BillStatus)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: '0.86rem',
                      color: '#0A2540',
                      outline: 'none',
                      background: '#FFF',
                    }}
                  >
                    <option value="pending">Pending (Awaiting Payment)</option>
                    <option value="paid">Paid (Collected at Till)</option>
                    <option value="insurance">AKSHIA / NHIA Insurance</option>
                    <option value="outstanding">Outstanding Balance</option>
                    <option value="waived">Waived / Compassionate</option>
                  </select>
                </div>
              </div>

              {/* Payment Method */}
              {status === 'paid' && (
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                    Payment Terminal / Method *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: '0.86rem',
                      color: '#0A2540',
                      outline: 'none',
                      background: '#FFF',
                    }}
                  >
                    <option>POS Terminal (Till 1 - Main GOPD)</option>
                    <option>POS Terminal (Till 2 - A&E Emergency)</option>
                    <option>POS Terminal (Till 3 - Pharmacy)</option>
                    <option>Cash Collected at Desk</option>
                    <option>Direct Bank Transfer (State TSA)</option>
                  </select>
                </div>
              )}

              {/* Services List Builder */}
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                  Medical Services / Items
                </label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    placeholder="Add service (e.g. Ultrasound, Pharmacy, Suture...)"
                    value={serviceInput}
                    onChange={e => setServiceInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddServiceItem();
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: '0.82rem',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddServiceItem}
                    style={{
                      padding: '8px 14px',
                      background: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      color: '#1D4ED8',
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {servicesList.map((svc, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '0.74rem',
                        background: '#F1F5F9',
                        border: '1px solid #CBD5E1',
                        borderRadius: 6,
                        padding: '3px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: '#1E293B',
                      }}
                    >
                      {svc}
                      {servicesList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveServiceItem(i)}
                          style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0 }}
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              {/* NHIA Checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <input
                  type="checkbox"
                  id="nhia-checkbox"
                  checked={nhia}
                  onChange={e => setNhia(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#0052D4' }}
                />
                <label htmlFor="nhia-checkbox" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  Patient is covered under AKSHIA or National Health Insurance (NHIA)
                </label>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  className="os-ghost-btn"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '10px 18px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 22px',
                    background: 'linear-gradient(135deg, #0A2540 0%, #0D4F8B 100%)',
                    color: '#FFF',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Receipt size={15} /> Save & Issue Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: CASHIER RECEIPT PREVIEW ── */}
      {selectedReceipt && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(10, 25, 41, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: 16,
            width: '100%',
            maxWidth: 480,
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: 24 }}>
              <div style={{ textAlign: 'center', borderBottom: '2px solid #0A2540', paddingBottom: 12, marginBottom: 14 }}>
                <div style={{ fontSize: '0.68rem', letterSpacing: '0.08em', color: '#0D4F8B', fontWeight: 800 }}>
                  IBOM SPECIALIST HOSPITAL, UYO
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0A2540', fontFamily: 'Outfit, sans-serif' }}>
                  Official Cashier Revenue Receipt
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                  Receipt Reference: {selectedReceipt.receiptNo || selectedReceipt.id}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.82rem', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Patient Name:</span>
                  <span style={{ fontWeight: 700, color: '#0A2540' }}>{selectedReceipt.patientName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Patient MRN:</span>
                  <span style={{ fontFamily: 'monospace', color: '#0D4F8B', fontWeight: 700 }}>{selectedReceipt.patientId}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Date:</span>
                  <span>{selectedReceipt.date}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Status:</span>
                  <span style={{ fontWeight: 800, color: selectedReceipt.status === 'paid' ? '#059669' : '#D97706' }}>
                    {selectedReceipt.status.toUpperCase()}
                  </span>
                </div>
                {selectedReceipt.paymentMethod && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Payment Method:</span>
                    <span>{selectedReceipt.paymentMethod}</span>
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px dashed #CBD5E1', borderBottom: '1px dashed #CBD5E1', padding: '8px 0', margin: '10px 0' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Services Rendered:</span>
                <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '0.8rem', color: '#334155' }}>
                  {selectedReceipt.services.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10 }}>
                <span style={{ fontWeight: 700, color: '#64748B', fontSize: '0.9rem' }}>TOTAL AMOUNT:</span>
                <span style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0A2540' }}>
                  {formatNaira(selectedReceipt.totalNaira)}
                </span>
              </div>
            </div>

            <div style={{ background: '#F8FAFC', borderTop: '1px solid #E2E8F0', padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="os-ghost-btn"
                onClick={() => setSelectedReceipt(null)}
                style={{ padding: '6px 14px' }}
              >
                Close
              </button>
              <button
                type="button"
                className="os-action-btn-primary"
                onClick={() => window.print()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 16px',
                  background: 'linear-gradient(135deg, #0A2540 0%, #0D4F8B 100%)',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Printer size={14} /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
