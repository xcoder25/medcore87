'use client';

import React, { useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Search, Filter,
  Barcode, Zap, Clock, ShieldAlert, FileText, FlaskConical,
  Plus, X, Edit3, Send
} from 'lucide-react';
import type { LabOrder } from '@medcore/types';

const INITIAL_LAB_ORDERS: LabOrder[] = [
  {
    id: 'LAB-2026-5510',
    patientId: 'PAT-AK-1029',
    patientName: 'Edidiong Sunday Udosen',
    testName: 'Full Blood Count (FBC + Diff)',
    specimenType: 'Blood',
    barcode: 'BC-889104',
    status: 'critical',
    orderedAt: '08:45',
    result: 'Hb: 5.4 g/dL (CRITICAL LOW), WBC: 22.4k/µL, Plt: 88k',
    referenceRange: 'Hb: 12.0–16.0 g/dL, WBC: 4.0–11.0k',
    isPanicValue: true,
  },
  {
    id: 'LAB-2026-5511',
    patientId: 'PAT-AK-3392',
    patientName: 'Comfort Aniefiok Ekanem',
    testName: 'Serum Electrolytes, Urea & Creatinine (E/U/Cr)',
    specimenType: 'Blood',
    barcode: 'BC-889105',
    status: 'analyzing',
    orderedAt: '09:00',
    result: 'Potassium: 6.2 mmol/L (HIGH), Creatinine: 2.1 mg/dL',
    referenceRange: 'K+: 3.5–5.0 mmol/L, Cr: 0.6–1.2 mg/dL',
    isPanicValue: true,
  },
  {
    id: 'LAB-2026-5512',
    patientId: 'PAT-AK-4421',
    patientName: 'Idongesit Aniefiok Udo',
    testName: 'Blood Culture & Sensitivity (Aerobic/Anaerobic)',
    specimenType: 'Blood',
    barcode: 'BC-889106',
    status: 'analyzing',
    orderedAt: '09:10',
    result: 'Bactec Automated Incubator: Flagged Positive at 4.2 hrs',
    referenceRange: 'Negative at 7 days',
  },
  {
    id: 'LAB-2026-5513',
    patientId: 'PAT-AK-8874',
    patientName: 'Nsikak Monday Inyang',
    testName: 'Urinalysis (Microscopy & Culture)',
    specimenType: 'Urine',
    barcode: 'BC-889107',
    status: 'completed',
    orderedAt: '08:15',
    result: 'Protein 1+, Leucocyte esterase ++, Nitrites Positive',
    referenceRange: 'Normal dipstick negative',
  },
  {
    id: 'LAB-2026-5514',
    patientId: 'PAT-AK-9921',
    patientName: 'Iniobong Victor',
    testName: 'Coagulation Profile (PT / INR / aPTT)',
    specimenType: 'Blood',
    barcode: 'BC-889108',
    status: 'ordered',
    orderedAt: '09:35',
  },
];

const ANALYZER_FEEDS = [
  { name: 'Sysmex XN-1000 (Automated Hematology)', status: 'ONLINE', sampleThroughput: '100 tests/hr', lastCalibrated: 'Today 06:00' },
  { name: 'Roche Cobas 6000 (Clinical Chemistry)', status: 'ONLINE', sampleThroughput: '180 tests/hr', lastCalibrated: 'Today 05:30' },
  { name: 'BD BACTEC FX (Blood Culture System)', status: 'ACTIVE BATCH', sampleThroughput: '48 bottles', lastCalibrated: 'Yesterday' },
  { name: 'Stago Compact Max (Coagulation Analyzer)', status: 'ONLINE', sampleThroughput: '50 tests/hr', lastCalibrated: 'Today 07:00' },
];

export const LaboratorySuite: React.FC = () => {
  const [orders, setOrders] = useState<LabOrder[]>(INITIAL_LAB_ORDERS);
  const [selectedId, setSelectedId] = useState<string>(INITIAL_LAB_ORDERS[0].id);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  // Modal States
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);

  // New Lab Order Form
  const [newPatient, setNewPatient] = useState('');
  const [newTest, setNewTest] = useState('Full Blood Count (FBC + Diff)');
  const [newSpecimen, setNewSpecimen] = useState('Blood');

  // Edit Result Form
  const [resultInput, setResultInput] = useState('');
  const [isPanicToggle, setIsPanicToggle] = useState(false);

  const showNotification = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const selectedOrder = orders.find(o => o.id === selectedId) || orders[0];

  const handleAcknowledgePanic = (id: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, isPanicValue: false, status: 'completed' } : o));
    showNotification(`Panic value acknowledged and phoned to MD.`);
  };

  const handleValidateEHR = (id: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'completed' } : o));
    showNotification(`Lab report for ${selectedOrder.testName} validated and committed to EHR.`);
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatient.trim()) return;

    const nextId = `LAB-2026-${5515 + orders.length}`;
    const nextBc = `BC-${889109 + orders.length}`;
    const newOrder: LabOrder = {
      id: nextId,
      patientId: `PAT-AK-${Math.floor(1000 + Math.random() * 9000)}`,
      patientName: newPatient.trim(),
      testName: newTest,
      specimenType: newSpecimen as any,
      barcode: nextBc,
      status: 'ordered',
      orderedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setOrders([newOrder, ...orders]);
    setSelectedId(newOrder.id);
    setShowOrderModal(false);
    setNewPatient('');
    showNotification(`Lab Order ${nextId} created for ${newOrder.patientName}! Barcode: ${nextBc}`);
  };

  const handleSaveResult = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resultInput.trim()) return;

    setOrders(prev => prev.map(o => {
      if (o.id === selectedOrder.id) {
        return {
          ...o,
          result: resultInput.trim(),
          isPanicValue: isPanicToggle,
          status: isPanicToggle ? 'critical' : 'completed',
        };
      }
      return o;
    }));

    setShowResultModal(false);
    showNotification(`Results updated and validated for ${selectedOrder.patientName}.`);
  };

  const filteredOrders = orders.filter(o => {
    if (search && !o.patientName.toLowerCase().includes(search.toLowerCase()) && !o.testName.toLowerCase().includes(search.toLowerCase()) && !o.barcode?.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const panicCount = orders.filter(o => o.isPanicValue).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toast Notification */}
      {notice && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 99999, background: '#0F2236',
          border: '1px solid #10B981', borderRadius: 10, padding: '14px 20px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
          gap: 12, color: '#F1F5F9', fontSize: '0.88rem', fontWeight: 600
        }}>
          <CheckCircle2 size={18} color="#10B981" />
          <span>{notice}</span>
        </div>
      )}

      {/* Top Telemetry */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid #EF4444' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Panic / Critical Values</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#EF4444' }}>{panicCount} Alerts</span>
            <span style={{ fontSize: '0.75rem', color: '#F87171' }}>Stat Physician Notice</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Immediate Phone Notification Mandated</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid var(--ak-orange)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Specimens Analyzing</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--ak-orange-light)' }}>
              {orders.filter(o => o.status === 'analyzing' || o.status === 'ordered').length} Active
            </span>
            <span style={{ fontSize: '0.75rem', color: '#60A5FA' }}>Barcode Tracked</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Roche & Sysmex Analyzers Connected</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Turnaround Time (TAT)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34D399' }}>26 Mins</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>Target &lt; 45m</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Direct EHR Auto-Validation</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Analyzers Interfaced</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#60A5FA' }}>4 / 4</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>LIS Synced</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>ASTM / HL7 Bidirectional Drivers</span>
        </div>
      </div>

      {/* Main Two Column */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 20 }}>
        {/* Left: Specimen Queue */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--os-text-muted)', textTransform: 'uppercase' }}>
              LIS Specimen Processing Queue
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="os-search-wrap" style={{ minWidth: 200 }}>
                <Search size={14} />
                <input
                  className="os-search-input"
                  placeholder="Search test, patient, barcode..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="os-action-btn-primary"
                onClick={() => setShowOrderModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', padding: '6px 14px' }}
              >
                <Plus size={14} /> New Lab Order
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredOrders.map(order => {
              const isSelected = order.id === selectedId;
              const isPanic = order.isPanicValue;
              return (
                <div
                  key={order.id}
                  className="os-card"
                  onClick={() => setSelectedId(order.id)}
                  style={{
                    cursor: 'pointer',
                    borderColor: isSelected ? (isPanic ? '#EF4444' : 'var(--ak-orange)') : (isPanic ? 'rgba(239,68,68,0.3)' : undefined),
                    background: isSelected ? (isPanic ? 'rgba(239,68,68,0.08)' : 'rgba(234,88,12,0.08)') : undefined,
                    padding: '14px 18px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                        background: order.status === 'completed' ? '#10B981' : isPanic ? '#EF4444' : '#F59E0B',
                        color: '#FFF',
                      }}>
                        {order.status.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0A2540' }}>{order.patientName}</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--os-text-dim)' }}>
                      {order.barcode}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#D97706', marginBottom: 2 }}>
                    {order.testName} • Specimen: <span style={{ color: '#0A2540' }}>{order.specimenType}</span>
                  </div>

                  {order.result && (
                    <div style={{ fontSize: '0.82rem', color: isPanic ? '#DC2626' : '#334155', fontWeight: 600, marginBottom: 4 }}>
                      <strong>Result:</strong> {order.result}
                    </div>
                  )}

                  <div style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Ordered: {order.orderedAt}</span>
                    <span>Ref: {order.referenceRange || 'Standard reference'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Analyzer Telemetry & Result Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Selected Order Result Card */}
          <div className="os-card" style={{ padding: 20, borderColor: selectedOrder.isPanicValue ? '#EF4444' : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--os-text-dim)', textTransform: 'uppercase' }}>
                LIS Specimen Analysis
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontFamily: 'monospace' }}>{selectedOrder.barcode}</span>
            </div>

            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', color: '#0A2540' }}>{selectedOrder.patientName}</h3>
            <span style={{ fontSize: '0.8rem', color: '#D97706', fontWeight: 700 }}>{selectedOrder.testName}</span>

            <div style={{ margin: '14px 0', padding: 12, background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--os-text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>Reported Value</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: selectedOrder.isPanicValue ? '#DC2626' : '#0A2540' }}>
                {selectedOrder.result || 'Analysis in progress on automated instrument...'}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--os-text-muted)', marginTop: 4 }}>
                Reference Range: {selectedOrder.referenceRange || 'Pending baseline'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button
                type="button"
                className="os-ghost-btn"
                style={{ flex: 1, fontSize: '0.78rem', justifyContent: 'center' }}
                onClick={() => {
                  setResultInput(selectedOrder.result || '');
                  setIsPanicToggle(!!selectedOrder.isPanicValue);
                  setShowResultModal(true);
                }}
              >
                <Edit3 size={13} /> Enter / Edit Result
              </button>
            </div>

            {selectedOrder.isPanicValue ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: '8px 10px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6, fontSize: '0.74rem', color: '#991B1B' }}>
                  ⚠️ Critical panic limit exceeded. Laboratory policy requires immediate telephone verbal notification to attending physician.
                </div>
                <button
                  type="button"
                  className="os-action-btn-primary"
                  style={{ background: '#DC2626', justifyContent: 'center' }}
                  onClick={() => handleAcknowledgePanic(selectedOrder.id)}
                >
                  <ShieldAlert size={14} /> Telephoned MD & Acknowledge Panic
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="os-action-btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => handleValidateEHR(selectedOrder.id)}
              >
                <CheckCircle2 size={14} /> Validate & Transmit to EHR
              </button>
            )}
          </div>

          {/* Automated Instruments Telemetry */}
          <div className="os-card" style={{ padding: 18 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--os-text-dim)', textTransform: 'uppercase', marginBottom: 12 }}>
              Automated Instrument Telemetry
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ANALYZER_FEEDS.map((a, i) => (
                <div key={i} style={{ padding: '8px 10px', background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.76rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: '#0A2540' }}>{a.name}</span>
                    <span style={{ color: '#059669', fontWeight: 800, fontSize: '0.68rem' }}>{a.status}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--os-text-dim)', marginTop: 4, fontSize: '0.7rem' }}>
                    <span>Rate: {a.sampleThroughput}</span>
                    <span>QC: {a.lastCalibrated}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal 1: New Lab Order */}
      {showOrderModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(10,25,41,0.7)',
          backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#FFF', borderRadius: 14, width: '100%', maxWidth: 460, padding: 24,
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0A2540' }}>
                Log Laboratory Specimen & Test Order
              </h3>
              <button className="os-ghost-btn" style={{ padding: 4 }} onClick={() => setShowOrderModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Patient Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. David Bassey"
                  value={newPatient}
                  onChange={e => setNewPatient(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Laboratory Test Panel *
                </label>
                <select
                  value={newTest}
                  onChange={e => setNewTest(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', background: '#FFF' }}
                >
                  <option>Full Blood Count (FBC + Diff)</option>
                  <option>Serum Electrolytes, Urea & Creatinine (E/U/Cr)</option>
                  <option>Liver Function Test (LFT)</option>
                  <option>Lipid Profile Panel</option>
                  <option>Blood Culture & Sensitivity</option>
                  <option>Urinalysis (Microscopy & Culture)</option>
                  <option>Coagulation Profile (PT / INR)</option>
                  <option>Malaria RDT + Blood Film</option>
                  <option>HbA1c Glycated Hemoglobin</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Specimen Type *
                </label>
                <select
                  value={newSpecimen}
                  onChange={e => setNewSpecimen(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', background: '#FFF' }}
                >
                  <option>Blood</option>
                  <option>Urine</option>
                  <option>CSF</option>
                  <option>Sputum</option>
                  <option>Stool</option>
                  <option>Swab</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="os-ghost-btn" onClick={() => setShowOrderModal(false)}>Cancel</button>
                <button type="submit" className="os-action-btn-primary">Generate Barcode & Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Enter / Edit Lab Result */}
      {showResultModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(10,25,41,0.7)',
          backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#FFF', borderRadius: 14, width: '100%', maxWidth: 480, padding: 24,
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0A2540' }}>
                Enter Result: {selectedOrder.testName}
              </h3>
              <button className="os-ghost-btn" style={{ padding: 4 }} onClick={() => setShowResultModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSaveResult} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: '0.82rem', color: '#64748B' }}>
                Patient: <strong style={{ color: '#0A2540' }}>{selectedOrder.patientName}</strong> • Barcode: <span style={{ fontFamily: 'monospace' }}>{selectedOrder.barcode}</span>
              </div>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Clinical Result Finding *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Hb: 13.8 g/dL, WBC: 6.8k/µL, Platelets: 240k/µL. Normal morphology."
                  value={resultInput}
                  onChange={e => setResultInput(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: isPanicToggle ? '#FEF2F2' : '#F8FAFC', borderRadius: 8, border: `1px solid ${isPanicToggle ? '#FCA5A5' : '#E2E8F0'}` }}>
                <input
                  type="checkbox"
                  id="panic-toggle"
                  checked={isPanicToggle}
                  onChange={e => setIsPanicToggle(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#DC2626' }}
                />
                <label htmlFor="panic-toggle" style={{ fontSize: '0.82rem', fontWeight: 700, color: isPanicToggle ? '#DC2626' : '#334155', cursor: 'pointer' }}>
                  Mark as Panic / Critical Value (Triggers Stat Alert to MD)
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="os-ghost-btn" onClick={() => setShowResultModal(false)}>Cancel</button>
                <button type="submit" className="os-action-btn-primary">Commit Result to LIS</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
