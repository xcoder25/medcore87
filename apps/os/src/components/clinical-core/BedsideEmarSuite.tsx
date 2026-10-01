'use client';

import React, { useState } from 'react';
import {
  Pill, QrCode, CheckCircle2, AlertTriangle, ShieldAlert,
  Clock, User, Stethoscope, FileCheck, Lock, Activity, Eye
} from 'lucide-react';
import type { EmarOrder, EmarAdminRecord, ControlledSubstanceRegisterEntry } from '@medcore/types';

const INITIAL_EMAR_ORDERS: EmarOrder[] = [
  {
    id: 'EMAR-001',
    prescriptionId: 'RX-901',
    patientId: 'PAT-849201',
    patientName: 'Amina Bello',
    mrn: 'MRN-78401',
    bedNumber: 'Ward A - Bed 04',
    drugName: 'IV Ceftriaxone',
    dosage: '2g',
    route: 'IV Infusion in 100mL Saline',
    frequency: 'Once Daily',
    instructions: 'Infuse over 30 mins. Monitor for hypersensitivity.',
    isControlledSubstance: false,
    scheduledTime: '12:00',
    status: 'DUE',
    prescribedBy: 'Dr. Fatima Sanusi',
  },
  {
    id: 'EMAR-002',
    prescriptionId: 'RX-902',
    patientId: 'PAT-849201',
    patientName: 'Amina Bello',
    mrn: 'MRN-78401',
    bedNumber: 'Ward A - Bed 04',
    drugName: 'IV Morphine Sulfate',
    dosage: '5mg',
    route: 'Slow IV Push',
    frequency: 'Q4H PRN Severe Pain',
    instructions: 'Controlled Substance: Requires dual nurse sign-off & respiratory rate check.',
    isControlledSubstance: true,
    scheduledTime: '13:00',
    status: 'DUE',
    prescribedBy: 'Dr. Fatima Sanusi',
  },
  {
    id: 'EMAR-003',
    prescriptionId: 'RX-903',
    patientId: 'PAT-620194',
    patientName: 'Emeka Okafor',
    mrn: 'MRN-99201',
    bedNumber: 'ICU - Bed 01',
    drugName: 'Amlodipine Besylate',
    dosage: '10mg',
    route: 'Oral',
    frequency: 'Once Daily',
    instructions: 'Hold if Systolic BP < 100 mmHg.',
    isControlledSubstance: false,
    scheduledTime: '14:00',
    status: 'DUE',
    prescribedBy: 'Dr. K. Bassey',
  },
];

export const BedsideEmarSuite: React.FC = () => {
  const [orders, setOrders] = useState<EmarOrder[]>(INITIAL_EMAR_ORDERS);
  const [selectedOrder, setSelectedOrder] = useState<EmarOrder | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedWristband, setScannedWristband] = useState('');
  const [scannedDrugBarcode, setScannedDrugBarcode] = useState('');
  
  // Controlled substance dual-sign modal
  const [showNarcoticModal, setShowNarcoticModal] = useState(false);
  const [witnessBadge, setWitnessBadge] = useState('');
  const [witnessPin, setWitnessPin] = useState('');
  const [witnessName, setWitnessName] = useState('');
  const [narcoticBatch, setNarcoticBatch] = useState('BATCH-MOR-2026-X8');
  const [remainingAmpoules, setRemainingAmpoules] = useState(24);

  // Vitals at administration check
  const [preAdminSystolic, setPreAdminSystolic] = useState('122');
  const [preAdminHeartRate, setPreAdminHeartRate] = useState('78');
  const [preAdminRespRate, setPreAdminRespRate] = useState('16');

  // Logs
  const [adminHistory, setAdminHistory] = useState<EmarAdminRecord[]>([]);
  const [ddrLedger, setDdrLedger] = useState<ControlledSubstanceRegisterEntry[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleStartAdministration = (order: EmarOrder) => {
    setSelectedOrder(order);
    setScannedWristband('');
    setScannedDrugBarcode('');
    setIsScanning(true);
  };

  const simulateWristbandScan = () => {
    if (!selectedOrder) return;
    setScannedWristband(selectedOrder.mrn);
  };

  const simulateDrugScan = () => {
    if (!selectedOrder) return;
    setScannedDrugBarcode(`MED-${selectedOrder.drugName.replace(/\s+/g, '-').toUpperCase()}-LOT7741`);
  };

  const handleConfirmAdministration = () => {
    if (!selectedOrder) return;

    // Verify 5 Rights
    if (scannedWristband !== selectedOrder.mrn) {
      alert('SAFETY LOCK: Scanned wristband MRN does NOT match current patient prescription!');
      return;
    }
    if (!scannedDrugBarcode) {
      alert('SAFETY LOCK: Drug packaging barcode must be scanned prior to administration!');
      return;
    }

    // If controlled substance, check witness sign
    if (selectedOrder.isControlledSubstance) {
      if (!witnessName || !witnessBadge) {
        setShowNarcoticModal(true);
        return;
      }
    }

    // Complete administration record
    const record: EmarAdminRecord = {
      id: `ADMIN-${Date.now()}`,
      emarOrderId: selectedOrder.id,
      patientId: selectedOrder.patientId,
      mrn: selectedOrder.mrn,
      bedNumber: selectedOrder.bedNumber,
      drugName: selectedOrder.drugName,
      doseGiven: selectedOrder.dosage,
      route: selectedOrder.route,
      administeredAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      administeredByBadge: 'RN-8812',
      administeredByName: 'Nurse Iniobong Akpan, RN',
      verifiedViaBarcode: true,
      patientBarcodeScanned: scannedWristband,
      drugBarcodeScanned: scannedDrugBarcode,
      vitalsAtAdministration: {
        systolicBp: parseInt(preAdminSystolic) || undefined,
        heartRate: parseInt(preAdminHeartRate) || undefined,
      },
      isControlledSubstance: selectedOrder.isControlledSubstance,
      witnessBadge: selectedOrder.isControlledSubstance ? witnessBadge : undefined,
      witnessName: selectedOrder.isControlledSubstance ? witnessName : undefined,
      narcoticBatchNumber: selectedOrder.isControlledSubstance ? narcoticBatch : undefined,
      remainingAmpoulesOrTablets: selectedOrder.isControlledSubstance ? remainingAmpoules - 1 : undefined,
    };

    setAdminHistory([record, ...adminHistory]);

    // Update order status
    setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, status: 'GIVEN' } : o));

    // If controlled substance, update DDR
    if (selectedOrder.isControlledSubstance) {
      const ddrEntry: ControlledSubstanceRegisterEntry = {
        id: `DDR-${Date.now()}`,
        drugName: selectedOrder.drugName,
        strength: selectedOrder.dosage,
        facilityId: 'FAC-001',
        wardId: selectedOrder.bedNumber,
        batchNumber: narcoticBatch,
        expiryDate: '2027-08-31',
        startingBalance: remainingAmpoules,
        quantityAdministered: 1,
        remainingBalance: remainingAmpoules - 1,
        patientName: selectedOrder.patientName,
        mrn: selectedOrder.mrn,
        prescribedByDoctor: selectedOrder.prescribedBy,
        primaryNurseName: 'Nurse Iniobong Akpan, RN (RN-8812)',
        witnessNurseName: witnessName,
        timestamp: new Date().toISOString(),
        verified: true,
      };
      setDdrLedger([ddrEntry, ...ddrLedger]);
      setRemainingAmpoules(remainingAmpoules - 1);
    }

    setIsScanning(false);
    setSelectedOrder(null);
    setShowNarcoticModal(false);
    setWitnessBadge('');
    setWitnessName('');
    showNotification(`✓ BCMA Verified: ${record.drugName} ${record.doseGiven} administered to ${selectedOrder.patientName}.`);
  };

  const handleHoldMedication = (orderId: string, reason: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'HELD', holdingReason: reason } : o));
    showNotification(`Medication placed on HOLD: ${reason}`);
  };

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

      {/* Header Telemetry */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Bedside BCMA Verification</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38BDF8' }}>100% Barcode</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Zero-Tolerance Drug Admin Safety</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #F59E0B' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>DUE Dose Passes</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#FBBF24' }}>
              {orders.filter(o => o.status === 'DUE').length} Pending
            </span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Scheduled within current shift window</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #EC4899' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Dangerous Drugs Register (DDR)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#F472B6' }}>Dual-Sign Lock</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Schedule II & III Narcotic Audits</span>
        </div>
      </div>

      {/* Main eMAR Orders Table */}
      <div className="os-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Pill size={18} color="#38BDF8" />
              Bedside Electronic Medication Administration Record (eMAR)
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--os-text-dim)' }}>
              Verify the 5 Rights of Medication Administration prior to administering any oral, IV, or IM dose.
            </p>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--os-border)', color: 'var(--os-text-dim)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>Bed / Patient</th>
                <th style={{ padding: '10px 12px' }}>Medication & Dose</th>
                <th style={{ padding: '10px 12px' }}>Route / Frequency</th>
                <th style={{ padding: '10px 12px' }}>Scheduled</th>
                <th style={{ padding: '10px 12px' }}>Classification</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 700, color: '#F1F5F9' }}>{order.patientName}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)' }}>{order.bedNumber} • {order.mrn}</div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 700, color: '#38BDF8' }}>{order.drugName}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{order.dosage}</div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div>{order.route}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)' }}>{order.frequency}</div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#E2E8F0' }}>
                      <Clock size={12} color="#FBBF24" /> {order.scheduledTime}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {order.isControlledSubstance ? (
                      <span style={{
                        background: 'rgba(236,72,153,0.15)', color: '#F472B6', border: '1px solid #EC4899',
                        padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700
                      }}>
                        CONTROLLED (DDR)
                      </span>
                    ) : (
                      <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Standard Rx</span>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {order.status === 'GIVEN' && (
                      <span style={{ color: '#34D399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle2 size={14} /> Given
                      </span>
                    )}
                    {order.status === 'DUE' && (
                      <span style={{ color: '#FBBF24', fontWeight: 700 }}>Due Now</span>
                    )}
                    {order.status === 'HELD' && (
                      <span style={{ color: '#EF4444', fontWeight: 700 }}>Held ({order.holdingReason})</span>
                    )}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    {order.status === 'DUE' && (
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          onClick={() => handleStartAdministration(order)}
                          className="os-btn"
                          style={{
                            background: '#10B981', color: '#FFF', padding: '6px 12px', fontSize: '0.75rem',
                            display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 6
                          }}
                        >
                          <QrCode size={14} /> Scan & Administer
                        </button>
                        <button
                          onClick={() => handleHoldMedication(order.id, 'Clinical vitals contraindication')}
                          className="os-btn"
                          style={{
                            background: '#334155', color: '#94A3B8', padding: '6px 10px', fontSize: '0.75rem',
                            borderRadius: 6
                          }}
                        >
                          Hold
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* BCMA Bedside Scanning Modal */}
      {isScanning && selectedOrder && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#0F172A', border: '1px solid #38BDF8', borderRadius: 12,
            width: '100%', maxWidth: 640, padding: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <QrCode size={24} color="#38BDF8" />
                <h3 style={{ margin: 0, color: '#F8FAFC', fontSize: '1.15rem' }}>
                  Point-of-Care Barcode Medication Verification
                </h3>
              </div>
              <button onClick={() => setIsScanning(false)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>

            <div style={{ background: '#1E293B', padding: 14, borderRadius: 8, marginBottom: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '0.82rem' }}>
                <div><strong style={{ color: '#94A3B8' }}>Patient:</strong> <span style={{ color: '#F8FAFC' }}>{selectedOrder.patientName}</span></div>
                <div><strong style={{ color: '#94A3B8' }}>MRN:</strong> <span style={{ color: '#38BDF8' }}>{selectedOrder.mrn}</span></div>
                <div><strong style={{ color: '#94A3B8' }}>Medication:</strong> <span style={{ color: '#F8FAFC' }}>{selectedOrder.drugName} {selectedOrder.dosage}</span></div>
                <div><strong style={{ color: '#94A3B8' }}>Route:</strong> <span style={{ color: '#F8FAFC' }}>{selectedOrder.route}</span></div>
              </div>
            </div>

            {/* Step 1: Scan Patient Wristband */}
            <div style={{
              padding: 14, borderRadius: 8, marginBottom: 14,
              border: scannedWristband === selectedOrder.mrn ? '1px solid #10B981' : '1px dashed #64748B',
              background: scannedWristband === selectedOrder.mrn ? 'rgba(16,185,129,0.08)' : 'transparent'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#F1F5F9', fontSize: '0.88rem' }}>1. Scan Patient Wristband Barcode</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--os-text-dim)' }}>Target MRN: {selectedOrder.mrn}</div>
                </div>
                {scannedWristband === selectedOrder.mrn ? (
                  <span style={{ color: '#10B981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={16} /> Patient Verified
                  </span>
                ) : (
                  <button
                    onClick={simulateWristbandScan}
                    className="os-btn"
                    style={{ background: '#2563EB', color: '#FFF', fontSize: '0.75rem', padding: '6px 12px' }}
                  >
                    Simulate Wristband Scan
                  </button>
                )}
              </div>
            </div>

            {/* Step 2: Scan Medication Vial/Pack */}
            <div style={{
              padding: 14, borderRadius: 8, marginBottom: 14,
              border: scannedDrugBarcode ? '1px solid #10B981' : '1px dashed #64748B',
              background: scannedDrugBarcode ? 'rgba(16,185,129,0.08)' : 'transparent'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#F1F5F9', fontSize: '0.88rem' }}>2. Scan Drug Packaging 2D Barcode</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--os-text-dim)' }}>Confirms correct formulation, lot number & unexpired date</div>
                </div>
                {scannedDrugBarcode ? (
                  <span style={{ color: '#10B981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={16} /> Medication Verified
                  </span>
                ) : (
                  <button
                    onClick={simulateDrugScan}
                    className="os-btn"
                    style={{ background: '#2563EB', color: '#FFF', fontSize: '0.75rem', padding: '6px 12px' }}
                  >
                    Simulate Med Scan
                  </button>
                )}
              </div>
            </div>

            {/* Step 3: Bedside Vitals Confirmation */}
            <div style={{ background: '#1E293B', padding: 14, borderRadius: 8, marginBottom: 18 }}>
              <div style={{ fontWeight: 700, color: '#F1F5F9', fontSize: '0.85rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={16} color="#38BDF8" /> Pre-Administration Vital Signs Check
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Systolic BP (mmHg)</label>
                  <input
                    type="number"
                    value={preAdminSystolic}
                    onChange={(e) => setPreAdminSystolic(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', background: '#0F172A', border: '1px solid #334155', color: '#FFF', borderRadius: 6 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Pulse (bpm)</label>
                  <input
                    type="number"
                    value={preAdminHeartRate}
                    onChange={(e) => setPreAdminHeartRate(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', background: '#0F172A', border: '1px solid #334155', color: '#FFF', borderRadius: 6 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Resp Rate (/min)</label>
                  <input
                    type="number"
                    value={preAdminRespRate}
                    onChange={(e) => setPreAdminRespRate(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', background: '#0F172A', border: '1px solid #334155', color: '#FFF', borderRadius: 6 }}
                  />
                </div>
              </div>
            </div>

            {/* If Controlled Substance Warning */}
            {selectedOrder.isControlledSubstance && (
              <div style={{
                background: 'rgba(236,72,153,0.1)', border: '1px solid #EC4899', borderRadius: 8, padding: 12, marginBottom: 18,
                display: 'flex', alignItems: 'center', gap: 10
              }}>
                <ShieldAlert size={20} color="#F472B6" />
                <div style={{ fontSize: '0.78rem', color: '#FBCFE8' }}>
                  <strong>SCHEDULE II NARCOTIC:</strong> Dangerous Drugs Register rules mandate a secondary independent nurse witness sign-off and ampoule count reconciliation.
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setIsScanning(false)}
                className="os-btn"
                style={{ background: '#334155', color: '#FFF', padding: '8px 16px', borderRadius: 6 }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAdministration}
                disabled={!scannedWristband || !scannedDrugBarcode}
                className="os-btn"
                style={{
                  background: scannedWristband && scannedDrugBarcode ? '#10B981' : '#475569',
                  color: '#FFF', padding: '8px 20px', borderRadius: 6, fontWeight: 700,
                  cursor: scannedWristband && scannedDrugBarcode ? 'pointer' : 'not-allowed'
                }}
              >
                {selectedOrder.isControlledSubstance ? 'Proceed to Dual Witness Sign-Off' : 'Confirm Administration & Sign eMAR'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controlled Substance Dual Witness Modal */}
      {showNarcoticModal && selectedOrder && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#0F172A', border: '2px solid #EC4899', borderRadius: 12,
            width: '100%', maxWidth: 520, padding: 24, boxShadow: '0 25px 50px -12px rgba(236,72,153,0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Lock size={22} color="#EC4899" />
              <h3 style={{ margin: 0, color: '#F8FAFC', fontSize: '1.15rem' }}>
                Controlled Substance Dual Witness Sign-Off
              </h3>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#94A3B8', marginBottom: 16 }}>
              A second registered nurse or medical officer must independently verify drug ampoule, dosage, patient identity, and remaining safe balance.
            </p>

            <div style={{ background: '#1E293B', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#94A3B8' }}>Drug / Strength:</span>
                <strong style={{ color: '#F472B6' }}>{selectedOrder.drugName} {selectedOrder.dosage}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#94A3B8' }}>Batch / Lot:</span>
                <span style={{ color: '#E2E8F0' }}>{narcoticBatch}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Vault Balance Before / After:</span>
                <strong style={{ color: '#38BDF8' }}>{remainingAmpoules} → {remainingAmpoules - 1} Ampoules</strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'block', marginBottom: 4 }}>
                  Witness Nurse Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sister Mercy Udoh, RN"
                  value={witnessName}
                  onChange={(e) => setWitnessName(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', background: '#1E293B', border: '1px solid #334155', color: '#FFF', borderRadius: 6 }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'block', marginBottom: 4 }}>
                  Witness Staff Badge ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. RN-4491"
                  value={witnessBadge}
                  onChange={(e) => setWitnessBadge(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', background: '#1E293B', border: '1px solid #334155', color: '#FFF', borderRadius: 6 }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'block', marginBottom: 4 }}>
                  Witness Security PIN
                </label>
                <input
                  type="password"
                  placeholder="••••"
                  value={witnessPin}
                  onChange={(e) => setWitnessPin(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', background: '#1E293B', border: '1px solid #334155', color: '#FFF', borderRadius: 6 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowNarcoticModal(false)}
                className="os-btn"
                style={{ background: '#334155', color: '#FFF', padding: '8px 16px', borderRadius: 6 }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAdministration}
                disabled={!witnessName || !witnessBadge}
                className="os-btn"
                style={{
                  background: witnessName && witnessBadge ? '#EC4899' : '#475569',
                  color: '#FFF', padding: '8px 20px', borderRadius: 6, fontWeight: 700
                }}
              >
                Sign Controlled Drug Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dangerous Drugs Register (DDR) Audit Trail */}
      {ddrLedger.length > 0 && (
        <div className="os-card" style={{ borderLeft: '4px solid #EC4899' }}>
          <h4 style={{ margin: '0 0 10px', color: '#F472B6', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileCheck size={16} /> Dangerous Drugs Register (DDR) Live Audit Ledger
          </h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ color: 'var(--os-text-dim)', textAlign: 'left', borderBottom: '1px solid var(--os-border)' }}>
                <th style={{ padding: '6px' }}>Time</th>
                <th style={{ padding: '6px' }}>Drug</th>
                <th style={{ padding: '6px' }}>Patient</th>
                <th style={{ padding: '6px' }}>Primary Nurse</th>
                <th style={{ padding: '6px' }}>Witness</th>
                <th style={{ padding: '6px' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {ddrLedger.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '6px' }}>{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={{ padding: '6px', color: '#F472B6', fontWeight: 600 }}>{entry.drugName} {entry.strength}</td>
                  <td style={{ padding: '6px' }}>{entry.patientName} ({entry.mrn})</td>
                  <td style={{ padding: '6px' }}>{entry.primaryNurseName}</td>
                  <td style={{ padding: '6px', color: '#38BDF8' }}>{entry.witnessNurseName}</td>
                  <td style={{ padding: '6px', fontWeight: 700, color: '#10B981' }}>{entry.remainingBalance} left</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
