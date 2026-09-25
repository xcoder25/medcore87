'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard, FileText, CheckCircle2, AlertTriangle,
  Search, ShieldCheck, Download, Plus, Printer, X,
  Trash2, RefreshCw, Check, ArrowRight, DollarSign,
  Building2, User, Calendar, Receipt
} from 'lucide-react';
import type { BillingInvoice } from '@medcore/types';

interface ExtendedInvoice extends BillingInvoice {
  department?: string;
  paymentMethod?: string;
  items?: Array<{ name: string; cost: number }>;
}

const STORAGE_KEY = 'ibom_os_billing_invoices';

const INITIAL_INVOICES: ExtendedInvoice[] = [
  {
    id: 'INV-01',
    invoiceNumber: 'ISH-INV-2026-901',
    patientId: 'PAT-AK-4421',
    patientName: 'Idongesit Aniefiok Udo',
    admissionDate: '2026-09-12',
    dischargeDate: '2026-09-16',
    department: 'Inpatient Medical Ward',
    totalChargesNgn: 184500,
    hmoCoveredNgn: 147600,
    patientCopayNgn: 36900,
    amountPaidNgn: 36900,
    status: 'settled',
    paymentMethod: 'POS Terminal (Till 1)',
    items: [
      { name: 'Ward Bed Charge (4 nights)', cost: 60000 },
      { name: 'Physician Inpatient Consultations', cost: 35000 },
      { name: 'Inpatient Pharmacy & IV Infusions', cost: 54500 },
      { name: 'Laboratory Panels (FBC, Chem-12)', cost: 35000 },
    ],
  },
  {
    id: 'INV-02',
    invoiceNumber: 'ISH-INV-2026-902',
    patientId: 'PAT-AK-1029',
    patientName: 'Edidiong Sunday Udosen',
    admissionDate: '2026-09-14',
    department: 'Surgical Theatre & Recovery',
    totalChargesNgn: 495000,
    hmoCoveredNgn: 396000,
    patientCopayNgn: 99000,
    amountPaidNgn: 0,
    status: 'pending_payment',
    paymentMethod: 'Pending Patient Copay',
    items: [
      { name: 'Major Surgical Theatre Fee', cost: 250000 },
      { name: 'Anaesthetist & Surgical Team', cost: 120000 },
      { name: 'Post-Op PACU Monitoring', cost: 45000 },
      { name: 'Antibiotics & Wound Care Pack', cost: 80000 },
    ],
  },
  {
    id: 'INV-03',
    invoiceNumber: 'ISH-INV-2026-903',
    patientId: 'PAT-AK-3109',
    patientName: 'Ekaette Nsikak Peters',
    admissionDate: '2026-09-15',
    dischargeDate: '2026-09-16',
    department: 'Obstetrics & Labour Ward',
    totalChargesNgn: 240000,
    hmoCoveredNgn: 192000,
    patientCopayNgn: 48000,
    amountPaidNgn: 48000,
    status: 'settled',
    paymentMethod: 'Direct Bank Transfer',
    items: [
      { name: 'Normal Spontaneous Delivery Package', cost: 120000 },
      { name: 'Neonatal Assessment & APGAR Care', cost: 40000 },
      { name: 'Postnatal Ward & Nursing Care', cost: 50000 },
      { name: 'Essential Obstetric Medicines', cost: 30000 },
    ],
  },
  {
    id: 'INV-04',
    invoiceNumber: 'ISH-INV-2026-904',
    patientId: 'PAT-AK-7721',
    patientName: 'Aniefiok Ekong',
    admissionDate: '2026-09-16',
    department: 'Accident & Emergency (A&E)',
    totalChargesNgn: 320000,
    hmoCoveredNgn: 256000,
    patientCopayNgn: 64000,
    amountPaidNgn: 0,
    status: 'hmo_dispute',
    paymentMethod: 'Under Pre-Authorization Review',
    items: [
      { name: 'Trauma Bay Resuscitation & Oxygen', cost: 110000 },
      { name: 'Emergency Whole Body CT Scan', cost: 95000 },
      { name: 'Emergency Blood Transfusion (2 Units)', cost: 65000 },
      { name: 'Suture & Orthopaedic Stabilization', cost: 50000 },
    ],
  },
];

export const BillingInvoicingSuite: React.FC = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'settled' | 'pending_payment' | 'hmo_dispute'>('all');

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ExtendedInvoice | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State for New Bill
  const [formPatientId, setFormPatientId] = useState('');
  const [formPatientName, setFormPatientName] = useState('');
  const [formAdmissionDate, setFormAdmissionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formDepartment, setFormDepartment] = useState('Inpatient Medical Ward');
  const [formHmoScheme, setFormHmoScheme] = useState('AKSHIA (State Scheme) - 80% Cover');
  const [formPaymentMethod, setFormPaymentMethod] = useState('POS Terminal (Till 1)');
  const [formStatus, setFormStatus] = useState<'pending_payment' | 'settled'>('pending_payment');
  const [formItems, setFormItems] = useState<Array<{ name: string; cost: number }>>([
    { name: 'Ward / Bed Care', cost: 45000 },
    { name: 'Physician Consultation', cost: 20000 },
  ]);
  const [formCustomTotal, setFormCustomTotal] = useState('');
  const [formError, setFormError] = useState('');

  // Load from LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setInvoices(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const saveInvoices = (newInvoices: ExtendedInvoice[]) => {
    setInvoices(newInvoices);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newInvoices));
    } catch {
      // ignore
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Calculated items total
  const calculatedItemsTotal = formItems.reduce((acc, it) => acc + (Number(it.cost) || 0), 0);
  const activeFormTotal = formCustomTotal ? parseFloat(formCustomTotal) || 0 : calculatedItemsTotal;

  // HMO split calculation
  let hmoPercent = 0.8;
  if (formHmoScheme.includes('0%') || formHmoScheme.includes('Self-Pay')) {
    hmoPercent = 0;
  } else if (formHmoScheme.includes('85%')) {
    hmoPercent = 0.85;
  } else if (formHmoScheme.includes('100%')) {
    hmoPercent = 1;
  }
  const formHmoCovered = Math.round(activeFormTotal * hmoPercent);
  const formPatientCopay = activeFormTotal - formHmoCovered;

  const handleAddItem = () => {
    setFormItems([...formItems, { name: '', cost: 0 }]);
  };

  const handleRemoveItem = (idx: number) => {
    if (formItems.length <= 1) return;
    setFormItems(formItems.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: 'name' | 'cost', value: any) => {
    const updated = [...formItems];
    if (field === 'cost') {
      updated[idx].cost = parseFloat(value) || 0;
    } else {
      updated[idx].name = value;
    }
    setFormItems(updated);
  };

  const handleCreateBill = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formPatientName.trim()) {
      setFormError('Please provide the patient full name.');
      return;
    }
    if (activeFormTotal <= 0) {
      setFormError('Total bill amount must be greater than zero.');
      return;
    }

    const nextIdNumber = 905 + invoices.length;
    const invNum = `ISH-INV-2026-${nextIdNumber}`;
    const pId = formPatientId.trim() || `PAT-AK-${Math.floor(1000 + Math.random() * 9000)}`;

    const newInvoice: ExtendedInvoice = {
      id: `INV-${Date.now().toString().slice(-4)}`,
      invoiceNumber: invNum,
      patientId: pId,
      patientName: formPatientName.trim(),
      admissionDate: formAdmissionDate,
      department: formDepartment,
      totalChargesNgn: activeFormTotal,
      hmoCoveredNgn: formHmoCovered,
      patientCopayNgn: formPatientCopay,
      amountPaidNgn: formStatus === 'settled' ? formPatientCopay : 0,
      status: formStatus,
      paymentMethod: formPaymentMethod,
      items: formItems.filter(it => it.name.trim().length > 0),
    };

    const updated = [newInvoice, ...invoices];
    saveInvoices(updated);
    setShowAddModal(false);
    showToast(`Invoice ${invNum} created successfully for ${formPatientName}!`);

    // Reset Form
    setFormPatientId('');
    setFormPatientName('');
    setFormCustomTotal('');
    setFormItems([
      { name: 'Ward / Bed Care', cost: 45000 },
      { name: 'Physician Consultation', cost: 20000 },
    ]);
  };

  const handleMarkSettled = (inv: ExtendedInvoice) => {
    const updated = invoices.map(item => {
      if (item.id === inv.id) {
        return {
          ...item,
          status: 'settled' as const,
          amountPaidNgn: item.patientCopayNgn,
          paymentMethod: 'POS Terminal (Till 1) - Cleared',
        };
      }
      return item;
    });
    saveInvoices(updated);
    showToast(`Discharge Clearance Issued: ${inv.invoiceNumber} has been marked as fully SETTLED.`);
  };

  const handleDeleteInvoice = (invId: string, invNum: string) => {
    if (window.confirm(`Are you sure you want to void and remove invoice ${invNum}?`)) {
      const updated = invoices.filter(item => item.id !== invId);
      saveInvoices(updated);
      showToast(`Invoice ${invNum} voided.`);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNum = inv.invoiceNumber.toLowerCase().includes(q);
      const matchName = inv.patientName.toLowerCase().includes(q);
      const matchId = inv.patientId.toLowerCase().includes(q);
      const matchDept = (inv.department || '').toLowerCase().includes(q);
      if (!matchNum && !matchName && !matchId && !matchDept) return false;
    }
    return true;
  });

  const totalBilled = invoices.reduce((sum, inv) => sum + inv.totalChargesNgn, 0);
  const totalSettled = invoices.filter(inv => inv.status === 'settled').reduce((sum, inv) => sum + inv.totalChargesNgn, 0);
  const totalPendingCopay = invoices.filter(inv => inv.status === 'pending_payment').reduce((sum, inv) => sum + (inv.patientCopayNgn - inv.amountPaidNgn), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 99999,
          background: '#0F2236',
          border: '1px solid #10B981',
          borderRadius: 10,
          padding: '14px 20px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          color: '#F1F5F9',
          fontSize: '0.88rem',
          fontWeight: 600,
        }}>
          <CheckCircle2 size={18} color="#10B981" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Telemetry Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid var(--ak-orange)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
            Total Inpatient Billing
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--ak-orange-light)' }}>
              ₦{totalBilled.toLocaleString()}
            </span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>
            {invoices.length} Active Ledger Entries
          </span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
            Discharge Clearance Rate
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.7rem', fontWeight: 800, color: '#34D399' }}>
              ₦{totalSettled.toLocaleString()}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>
              ({Math.round((totalSettled / (totalBilled || 1)) * 100)}%)
            </span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>
            Fully Settled & Cleared at Discharge
          </span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
            80/20 HMO Co-Pay Splitting
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.7rem', fontWeight: 800, color: '#60A5FA' }}>80% HMO</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--os-text-dim)' }}>20% Patient</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>
            AKSHIA & NHIA Capitation Integrated
          </span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #EF4444' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
            Pending Patient Co-Pay
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.7rem', fontWeight: 800, color: '#EF4444' }}>
              ₦{totalPendingCopay.toLocaleString()}
            </span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>
            Discharge Desk Clearance Flagged
          </span>
        </div>
      </div>

      {/* Invoice Table Card */}
      <div className="os-card" style={{ padding: 20 }}>
        {/* Header & Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0A2540', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Patient Billing Ledger & Itemized Invoices
            </span>
            <div style={{ fontSize: '0.74rem', color: 'var(--os-text-dim)', marginTop: 2 }}>
              Accountant Billing Hub • Ministry of Health Integrated Revenue System
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search */}
            <div className="os-search-wrap" style={{ minWidth: 260 }}>
              <Search size={14} />
              <input
                className="os-search-input"
                placeholder="Search invoice, patient, dept..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Status Filter Buttons */}
            <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', padding: 3, borderRadius: 8, border: '1px solid #E2E8F0' }}>
              {(['all', 'settled', 'pending_payment', 'hmo_dispute'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: '5px 10px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    background: statusFilter === st ? '#0052D4' : 'transparent',
                    color: statusFilter === st ? '#FFF' : '#64748B',
                  }}
                >
                  {st === 'all' ? 'All' : st === 'settled' ? 'Settled' : st === 'pending_payment' ? 'Pending' : 'Disputed'}
                </button>
              ))}
            </div>

            {/* PRIMARY: Add New Bill Button */}
            <button
              type="button"
              className="os-action-btn-primary"
              onClick={() => setShowAddModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                fontSize: '0.82rem',
                fontWeight: 700,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
                boxShadow: '0 4px 12px rgba(217, 119, 6, 0.25)',
                color: '#FFF',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Plus size={16} />
              <span>Add New Bill</span>
            </button>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="os-table-wrap">
          <table className="os-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Patient Details</th>
                <th>Admission / Dept</th>
                <th>Total Charges</th>
                <th>HMO Share (80%)</th>
                <th>Patient Co-Pay</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px 12px', color: '#94A3B8' }}>
                    No matching invoices found. Click <strong>"Add New Bill"</strong> to record a new hospital charge.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.76rem', color: '#D97706', fontWeight: 800 }}>
                      {inv.invoiceNumber}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.88rem' }}>{inv.patientName}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B', fontFamily: 'monospace' }}>{inv.patientId}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.76rem', color: '#334155', fontWeight: 600 }}>{inv.department || 'Inpatient Ward'}</div>
                      <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{inv.admissionDate}</div>
                    </td>
                    <td style={{ fontWeight: 800, color: '#0A2540', fontSize: '0.9rem' }}>
                      ₦{inv.totalChargesNgn.toLocaleString()}
                    </td>
                    <td style={{ color: '#2563EB', fontWeight: 600 }}>
                      ₦{inv.hmoCoveredNgn.toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 700, color: inv.amountPaidNgn >= inv.patientCopayNgn ? '#059669' : '#DC2626' }}>
                      ₦{inv.patientCopayNgn.toLocaleString()}
                      {inv.amountPaidNgn < inv.patientCopayNgn && (
                        <div style={{ fontSize: '0.68rem', color: '#DC2626' }}>
                          Unpaid: ₦{(inv.patientCopayNgn - inv.amountPaidNgn).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 4,
                        background: inv.status === 'settled' ? 'rgba(5,150,105,0.12)' : inv.status === 'hmo_dispute' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                        color: inv.status === 'settled' ? '#059669' : inv.status === 'hmo_dispute' ? '#DC2626' : '#D97706',
                      }}>
                        {inv.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {inv.status !== 'settled' && (
                          <button
                            type="button"
                            onClick={() => handleMarkSettled(inv)}
                            style={{
                              padding: '4px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              borderRadius: 6,
                              background: '#ECFDF5',
                              border: '1px solid #A7F3D0',
                              color: '#059669',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            title="Clear Patient Copay & Discharge"
                          >
                            <Check size={12} /> Clear
                          </button>
                        )}
                        <button
                          type="button"
                          className="os-ghost-btn"
                          style={{ padding: '4px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => setSelectedReceipt(inv)}
                        >
                          <Printer size={12} /> Receipt
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteInvoice(inv.id, inv.invoiceNumber)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94A3B8',
                            cursor: 'pointer',
                            padding: 4,
                            borderRadius: 4,
                          }}
                          title="Void Invoice"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL 1: ADD NEW BILL (ACCOUNTANT WORKER INTERACTIVE SUITE) ── */}
      {showAddModal && (
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
            border: '1px solid #E2E8F0',
            borderRadius: 16,
            width: '100%',
            maxWidth: 620,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden',
          }}>
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #0A2540 0%, #0D4F8B 100%)',
              padding: '18px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#FFF',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CreditCard size={20} color="#F59E0B" />
                  <span style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
                    Create New Hospital Bill / Invoice
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: 3 }}>
                  Ibom HealthOS • Accountant Revenue & Discharge Clearance Registry
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
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

            {/* Modal Body */}
            <form onSubmit={handleCreateBill} style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {formError && (
                <div style={{
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  color: '#991B1B',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <AlertTriangle size={15} color="#DC2626" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Patient Identification */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                    Patient Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Nsikak Sunday Udoh"
                    value={formPatientName}
                    onChange={e => setFormPatientName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      color: '#0A2540',
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                    Patient ID / MRN (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PAT-AK-5521"
                    value={formPatientId}
                    onChange={e => setFormPatientId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: '0.88rem',
                      fontFamily: 'monospace',
                      color: '#0A2540',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Department & Admission Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                    Clinical Ward / Department *
                  </label>
                  <select
                    value={formDepartment}
                    onChange={e => setFormDepartment(e.target.value)}
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
                    <option>Inpatient Medical Ward</option>
                    <option>Surgical Theatre & Recovery</option>
                    <option>Obstetrics & Labour Ward</option>
                    <option>Accident & Emergency (A&E)</option>
                    <option>Intensive Care Unit (ICU)</option>
                    <option>Paediatrics & NICU</option>
                    <option>Outpatient GOPD Clinic</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                    Admission / Service Date *
                  </label>
                  <input
                    type="date"
                    value={formAdmissionDate}
                    onChange={e => setFormAdmissionDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: '0.86rem',
                      color: '#0A2540',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Line Items Builder */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block' }}>
                    Itemized Clinical Charges & Services *
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    style={{
                      background: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      color: '#1D4ED8',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      borderRadius: 6,
                      padding: '3px 8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Plus size={12} /> Add Item
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {formItems.map((it, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="e.g. Ward Bed, Surgery, Pharmacy, Lab..."
                        value={it.name}
                        onChange={e => handleItemChange(idx, 'name', e.target.value)}
                        style={{
                          flex: 2,
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: '1px solid #CBD5E1',
                          fontSize: '0.82rem',
                          color: '#0A2540',
                        }}
                      />
                      <div style={{ position: 'relative', flex: 1 }}>
                        <span style={{ position: 'absolute', left: 8, top: 8, fontSize: '0.82rem', color: '#64748B', fontWeight: 700 }}>₦</span>
                        <input
                          type="number"
                          placeholder="Cost"
                          value={it.cost || ''}
                          onChange={e => handleItemChange(idx, 'cost', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 8px 8px 24px',
                            borderRadius: 8,
                            border: '1px solid #CBD5E1',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            color: '#0A2540',
                          }}
                        />
                      </div>
                      {formItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          style={{
                            background: '#FEE2E2',
                            border: '1px solid #FCA5A5',
                            color: '#DC2626',
                            borderRadius: 6,
                            padding: 6,
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* HMO Insurance Scheme & Co-Pay Split Preview */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                      Insurance / Billing Scheme
                    </label>
                    <select
                      value={formHmoScheme}
                      onChange={e => setFormHmoScheme(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: 8,
                        border: '1px solid #CBD5E1',
                        fontSize: '0.8rem',
                        color: '#0A2540',
                        background: '#FFF',
                      }}
                    >
                      <option>AKSHIA (State Scheme) - 80% Cover</option>
                      <option>NHIA National Scheme - 80% Cover</option>
                      <option>Private HMO Corporate - 85% Cover</option>
                      <option>Out-of-Pocket / Self-Pay - 0% HMO</option>
                      <option>Indigent / Exemption - 100% Subsidized</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                      Payment Status
                    </label>
                    <select
                      value={formStatus}
                      onChange={e => setFormStatus(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: 8,
                        border: '1px solid #CBD5E1',
                        fontSize: '0.8rem',
                        color: '#0A2540',
                        background: '#FFF',
                      }}
                    >
                      <option value="pending_payment">Pending Payment (Discharge Held)</option>
                      <option value="settled">Settled (Paid in Full & Cleared)</option>
                    </select>
                  </div>
                </div>

                {/* Calculation Summary Box */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  padding: 10,
                  background: '#FFFFFF',
                  borderRadius: 8,
                  border: '1px solid #E2E8F0',
                  textAlign: 'center',
                }}>
                  <div>
                    <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700 }}>TOTAL CHARGES</span>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0A2540' }}>
                      ₦{activeFormTotal.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.68rem', color: '#2563EB', fontWeight: 700 }}>HMO COVER ({Math.round(hmoPercent * 100)}%)</span>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#2563EB' }}>
                      ₦{formHmoCovered.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.68rem', color: '#D97706', fontWeight: 700 }}>PATIENT CO-PAY</span>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#D97706' }}>
                      ₦{formPatientCopay.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                  Payment Method / Till Destination
                </label>
                <select
                  value={formPaymentMethod}
                  onChange={e => setFormPaymentMethod(e.target.value)}
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
                  <option>POS Terminal (Till 1 - GOPD)</option>
                  <option>POS Terminal (Till 2 - A&E Emergency)</option>
                  <option>Direct Bank Transfer (State TSA Account)</option>
                  <option>Cash at Cashier Desk</option>
                  <option>AKSHIA / NHIA Direct Capitation Settlement</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  className="os-ghost-btn"
                  onClick={() => setShowAddModal(false)}
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
                  <CreditCard size={15} /> Save & Issue Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: PRINT OFFICIAL RECEIPT / BILLING SLIP ── */}
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
            maxWidth: 560,
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Printable Paper Slip */}
            <div style={{ padding: 28, background: '#FFF' }}>
              {/* Slip Header */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid #0A2540', paddingBottom: 16, marginBottom: 16 }}>
                <div style={{ fontSize: '0.72rem', letterSpacing: '0.08em', color: '#0D4F8B', fontWeight: 800 }}>
                  GOVERNMENT OF AKWA IBOM STATE OF NIGERIA
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0A2540', fontFamily: 'Outfit, sans-serif', margin: '4px 0' }}>
                  IBOM SPECIALIST HOSPITAL, UYO
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  Official Inpatient Billing Statement & Discharge Clearance Slip
                </div>
              </div>

              {/* Key Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '0.82rem', marginBottom: 16 }}>
                <div>
                  <span style={{ color: '#94A3B8', fontSize: '0.72rem' }}>INVOICE NUMBER</span>
                  <div style={{ fontWeight: 800, color: '#0A2540', fontFamily: 'monospace' }}>{selectedReceipt.invoiceNumber}</div>
                </div>
                <div>
                  <span style={{ color: '#94A3B8', fontSize: '0.72rem' }}>DATE ISSUED</span>
                  <div style={{ fontWeight: 700, color: '#0A2540' }}>{selectedReceipt.admissionDate}</div>
                </div>
                <div>
                  <span style={{ color: '#94A3B8', fontSize: '0.72rem' }}>PATIENT NAME</span>
                  <div style={{ fontWeight: 800, color: '#0A2540' }}>{selectedReceipt.patientName}</div>
                </div>
                <div>
                  <span style={{ color: '#94A3B8', fontSize: '0.72rem' }}>PATIENT ID / MRN</span>
                  <div style={{ fontWeight: 700, color: '#0D4F8B', fontFamily: 'monospace' }}>{selectedReceipt.patientId}</div>
                </div>
                <div>
                  <span style={{ color: '#94A3B8', fontSize: '0.72rem' }}>DEPARTMENT</span>
                  <div style={{ fontWeight: 600, color: '#334155' }}>{selectedReceipt.department || 'Inpatient Care'}</div>
                </div>
                <div>
                  <span style={{ color: '#94A3B8', fontSize: '0.72rem' }}>SETTLEMENT STATUS</span>
                  <div>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      background: selectedReceipt.status === 'settled' ? '#DCFCE7' : '#FEF3C7',
                      color: selectedReceipt.status === 'settled' ? '#15803D' : '#B45309',
                    }}>
                      {selectedReceipt.status === 'settled' ? 'CLEARED FOR DISCHARGE' : 'PAYMENT PENDING'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Breakdown */}
              <div style={{ borderTop: '1px dashed #CBD5E1', borderBottom: '1px dashed #CBD5E1', padding: '12px 0', margin: '14px 0' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                  Itemized Charges
                </span>
                {(selectedReceipt.items || [
                  { name: 'Clinical Ward & Physician Services', cost: selectedReceipt.totalChargesNgn }
                ]).map((it, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '3px 0' }}>
                    <span style={{ color: '#334155' }}>{it.name}</span>
                    <span style={{ fontWeight: 700, color: '#0A2540' }}>₦{it.cost.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Totals Calculation */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>Gross Hospital Charges:</span>
                  <span style={{ fontWeight: 700, color: '#0A2540' }}>₦{selectedReceipt.totalChargesNgn.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2563EB' }}>
                  <span>HMO / AKSHIA Contribution:</span>
                  <span style={{ fontWeight: 700 }}>- ₦{selectedReceipt.hmoCoveredNgn.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.92rem', color: '#0A2540', borderTop: '1px solid #E2E8F0', paddingTop: 6 }}>
                  <span>Patient Co-Pay Obligation:</span>
                  <span style={{ color: '#D97706' }}>₦{selectedReceipt.patientCopayNgn.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#059669' }}>
                  <span>Amount Paid / Remitted:</span>
                  <span>₦{selectedReceipt.amountPaidNgn.toLocaleString()}</span>
                </div>
              </div>

              {/* Official Stamp & Sign */}
              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: 12 }}>
                <div>
                  <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>VERIFIED BY ACCOUNTING DESK:</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0D4F8B' }}>Chief Hospital Accountant</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Ministry of Health TSA Ref: AKW-ISH-2026</div>
                </div>
                <div style={{
                  border: '2px dashed #059669',
                  borderRadius: 8,
                  padding: '4px 10px',
                  color: '#059669',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  transform: 'rotate(-4deg)',
                }}>
                  AUTHENTICATED RECORD
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{
              background: '#F8FAFC',
              borderTop: '1px solid #E2E8F0',
              padding: '14px 20px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
            }}>
              <button
                type="button"
                className="os-ghost-btn"
                onClick={() => setSelectedReceipt(null)}
                style={{ padding: '8px 16px' }}
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
                  gap: 8,
                  padding: '8px 18px',
                  background: 'linear-gradient(135deg, #0A2540 0%, #0D4F8B 100%)',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Printer size={15} /> Print Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
