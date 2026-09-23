'use client';

import React, { useState } from 'react';
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
const INITIAL_PRESCRIPTIONS: PrescriptionOrder[] = [
  {
    id: 'RX-2026-8801', patientId: 'PAT-AK-4421', patientName: 'Idongesit Aniefiok Udo',
    medication: 'IV Ceftriaxone', dosage: '2g', frequency: 'Once Daily (OD)', route: 'Intravenous',
    duration: '5 Days', prescribingDoctor: 'Dr. Emeka Adeyemi (Surgeon)', status: 'pending',
    orderedAt: '09:15', interactionAlert: 'High protein-binding: Verify co-administration with IV Calcium salts.',
  },
  {
    id: 'RX-2026-8802', patientId: 'PAT-AK-3109', patientName: 'Ekaette Nsikak Peters',
    medication: 'Artemether + Lumefantrine (Coartem)', dosage: '80/480mg', frequency: 'BD (twice daily with meals)',
    route: 'Oral', duration: '3 Days', prescribingDoctor: 'Dr. Evelyn Vance (Internal Med)', status: 'verified', orderedAt: '09:22',
  },
  {
    id: 'RX-2026-8803', patientId: 'PAT-AK-1102', patientName: 'Mfoniso Uwem Akpabio',
    medication: 'Enoxaparin (Clexane)', dosage: '40mg (4000 IU)', frequency: 'OD Subcutaneous', route: 'Subcutaneous',
    duration: '7 Days', prescribingDoctor: 'Dr. Kufre Etim (Orthopaedics)', status: 'pending', orderedAt: '09:30',
  },
  {
    id: 'RX-2026-8804', patientId: 'PAT-AK-9043', patientName: 'Godwin Archibong',
    medication: 'Metformin HCl', dosage: '500mg', frequency: 'TDS (Three times daily)', route: 'Oral',
    duration: '30 Days', prescribingDoctor: 'Dr. S. Okoro (Endocrinology)', status: 'dispensed', orderedAt: '08:10',
  },
];

const INITIAL_FORMULARY: FormularyItem[] = [
  { id: 'FORM-01', code: 'MED-CEF-2G', name: 'Ceftriaxone Powder for Injection', category: 'Antibiotics', stockOnHand: 340, unit: 'Vials', minimumThreshold: 100, expiryDate: '2027-08-31', unitPriceNgn: 1850 },
  { id: 'FORM-02', code: 'MED-ACT-80', name: 'Artemether/Lumefantrine Dispersible', category: 'Antimalarials', stockOnHand: 890, unit: 'Packs', minimumThreshold: 250, expiryDate: '2026-12-15', unitPriceNgn: 1200 },
  { id: 'FORM-03', code: 'MED-ENOX-40', name: 'Enoxaparin Sodium Prefilled Syringe', category: 'Anticoagulants', stockOnHand: 42, unit: 'Syringes', minimumThreshold: 50, expiryDate: '2026-11-30', unitPriceNgn: 4500 },
  { id: 'FORM-04', code: 'MED-MET-500', name: 'Metformin HCl 500mg Tablets', category: 'Antidiabetics', stockOnHand: 2400, unit: 'Tablets', minimumThreshold: 600, expiryDate: '2028-03-31', unitPriceNgn: 45 },
  { id: 'FORM-05', code: 'MED-PAR-1G', name: 'Paracetamol IV Infusion 10mg/mL', category: 'Analgesics', stockOnHand: 18, unit: 'Bottles', minimumThreshold: 60, expiryDate: '2026-10-01', unitPriceNgn: 950 },
  { id: 'FORM-06', code: 'MED-OXY-10', name: 'Oxytocin Injection 10 IU/mL', category: 'O&G Labour', stockOnHand: 145, unit: 'Ampoules', minimumThreshold: 40, expiryDate: '2027-05-15', unitPriceNgn: 800 },
];

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

export const PharmacyDispensingSuite: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'scan' | 'queue' | 'formulary'>('scan');
  const [prescriptions, setPrescriptions] = useState<PrescriptionOrder[]>(INITIAL_PRESCRIPTIONS);
  const [formulary] = useState<FormularyItem[]>(INITIAL_FORMULARY);
  const [search, setSearch] = useState('');

  // Patient scanner state
  const [scanInput, setScanInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<LivePrescription[] | null>(null);
  const [scanError, setScanError] = useState('');
  const [dispensingId, setDispensingId] = useState<string | null>(null);
  const [expandedRx, setExpandedRx] = useState<string | null>(null);

  const handleLegacyDispense = (id: string) => {
    setPrescriptions(prev => prev.map(p => p.id === id ? { ...p, status: 'dispensed' } : p));
  };

  const pendingCount = prescriptions.filter(p => p.status === 'pending').length;
  const lowStockCount = formulary.filter(f => f.stockOnHand <= f.minimumThreshold).length;

  // --- Live Patient Scan ----------------------------------------------------
  const handleScan = async () => {
    const query = scanInput.trim();
    if (!query) return;
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
      setScanError('Cannot reach MedCore API. Check server is running on port 4000.');
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
      // silently retry
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid var(--ak-orange)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Prescriptions in Queue</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--ak-orange-light)' }}>{pendingCount}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--os-text-muted)' }}>Pending Pharmacist Verification</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Avg Verification Time: 3.5 min</span>
        </div>
        <div className="os-card" style={{ borderLeft: '4px solid #F87171' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Critical / Low Stock Items</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#F87171' }}>{lowStockCount} Items</span>
            <span style={{ fontSize: '0.75rem', color: '#FCA5A5' }}>Below Threshold</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Paracetamol IV & Enoxaparin 40mg</span>
        </div>
        <div className="os-card" style={{ borderLeft: '4px solid #34D399' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Formulary Items Active</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34D399' }}>1,420</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--os-text-dim)' }}>Essential Medicines List</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>WHO / NAFDAC Approved</span>
        </div>
        <div className="os-card" style={{ borderLeft: '4px solid #60A5FA' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>e-Prescription System</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#60A5FA' }}>LIVE</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>Digital Audit Trail</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Scan Patient ID to Verify Rx</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { id: 'scan', label: 'Patient ID Scanner', Icon: UserSearch },
            { id: 'queue', label: `General Queue (${prescriptions.length})`, Icon: Clock },
            { id: 'formulary', label: `Formulary & Stock (${formulary.length})`, Icon: Package },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className="os-ghost-btn"
              onClick={() => setActiveTab(id as any)}
              style={{
                background: activeTab === id ? 'rgba(234,88,12,0.15)' : undefined,
                borderColor: activeTab === id ? 'var(--ak-orange)' : undefined,
                color: activeTab === id ? '#FFF' : undefined,
                fontWeight: 700,
              }}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        {activeTab !== 'scan' && (
          <div className="os-search-wrap" style={{ minWidth: 280 }}>
            <Search size={14} />
            <input
              className="os-search-input"
              placeholder={activeTab === 'queue' ? 'Search patient, doctor, drug...' : 'Search medicine name or SKU...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        )}
      </div>

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
          {prescriptions
            .filter(rx => !search || rx.patientName.toLowerCase().includes(search.toLowerCase()) || rx.medication.toLowerCase().includes(search.toLowerCase()))
            .map(rx => (
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
                      <button type="button" className="os-action-btn-primary" onClick={() => handleLegacyDispense(rx.id)}>
                        <Barcode size={14} /> Scan & Dispense Drug
                      </button>
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
      {activeTab === 'formulary' && (
        <div className="os-table-wrap">
          <table className="os-table">
            <thead>
              <tr>
                <th>Item Code</th><th>Drug Description</th><th>Category</th>
                <th>Stock on Hand</th><th>Min Threshold</th><th>Expiry Date</th>
                <th>Unit Price</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {formulary
                .filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.code.toLowerCase().includes(search.toLowerCase()))
                .map(item => {
                  const isLow = item.stockOnHand <= item.minimumThreshold;
                  return (
                    <tr key={item.id}>
                      <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.75rem', color: 'var(--os-text-dim)' }}>{item.code}</td>
                      <td style={{ fontWeight: 700, color: '#0A2540' }}>{item.name}</td>
                      <td>{item.category}</td>
                      <td style={{ fontWeight: 800, color: isLow ? '#F87171' : '#34D399' }}>{item.stockOnHand} {item.unit}</td>
                      <td>{item.minimumThreshold} {item.unit}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--os-text-dim)' }}>{item.expiryDate}</td>
                      <td style={{ fontWeight: 600 }}>?{item.unitPriceNgn.toLocaleString()}</td>
                      <td>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: isLow ? 'rgba(239,68,68,0.15)' : 'rgba(5,150,105,0.1)', color: isLow ? '#F87171' : '#34D399' }}>
                          {isLow ? 'REORDER' : 'IN STOCK'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
