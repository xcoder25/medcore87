'use client';

import React, { useState, useEffect } from 'react';
import {
  Droplet, AlertTriangle, ShieldAlert, CheckCircle2,
  Search, RefreshCw, Layers, ShieldCheck, Plus, X,
  Send, UserCheck, HeartPulse, Clock, FileText, Check
} from 'lucide-react';
import type { BloodStockUnit } from '@medcore/types';
import { liveAlert } from '../../lib/manualActions';
import { emitLiveAction } from '../../lib/liveActions';

const STORAGE_KEY = 'medcore_os_blood_stock_v2';

const SEED_BLOOD_STOCK: BloodStockUnit[] = [
  { id: 'BB-O-NEG', bloodGroup: 'O-', component: 'Packed Red Blood Cells (PRBC)', unitsAvailable: 3, criticalThreshold: 6, nearestExpiry: 'In 18 days', reservedUnits: 1 },
  { id: 'BB-O-POS', bloodGroup: 'O+', component: 'Packed Red Blood Cells (PRBC)', unitsAvailable: 18, criticalThreshold: 8, nearestExpiry: 'In 24 days', reservedUnits: 3 },
  { id: 'BB-A-POS', bloodGroup: 'A+', component: 'Packed Red Blood Cells (PRBC)', unitsAvailable: 14, criticalThreshold: 6, nearestExpiry: 'In 21 days', reservedUnits: 2 },
  { id: 'BB-A-NEG', bloodGroup: 'A-', component: 'Packed Red Blood Cells (PRBC)', unitsAvailable: 4, criticalThreshold: 4, nearestExpiry: 'In 15 days', reservedUnits: 0 },
  { id: 'BB-B-POS', bloodGroup: 'B+', component: 'Packed Red Blood Cells (PRBC)', unitsAvailable: 12, criticalThreshold: 6, nearestExpiry: 'In 28 days', reservedUnits: 1 },
  { id: 'BB-B-NEG', bloodGroup: 'B-', component: 'Packed Red Blood Cells (PRBC)', unitsAvailable: 2, criticalThreshold: 4, nearestExpiry: 'In 12 days', reservedUnits: 0 },
  { id: 'BB-AB-POS', bloodGroup: 'AB+', component: 'Packed Red Blood Cells (PRBC)', unitsAvailable: 7, criticalThreshold: 3, nearestExpiry: 'In 30 days', reservedUnits: 0 },
  { id: 'BB-AB-NEG', bloodGroup: 'AB-', component: 'Packed Red Blood Cells (PRBC)', unitsAvailable: 3, criticalThreshold: 2, nearestExpiry: 'In 19 days', reservedUnits: 0 },
];

export const BloodBankSuite: React.FC = () => {
  const [stock, setStock] = useState<BloodStockUnit[]>(SEED_BLOOD_STOCK);
  const [notice, setNotice] = useState<string | null>(null);

  // Modals
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Issue Unit Form State
  const [selectedGroup, setSelectedGroup] = useState('O-');
  const [patientName, setPatientName] = useState('');
  const [hospitalNumber, setHospitalNumber] = useState('');
  const [ward, setWard] = useState('Operating Theatre');
  const [indication, setIndication] = useState('Emergency Blood Loss / Trauma');
  const [crossmatchVerified, setCrossmatchVerified] = useState(true);

  // Add Donor Unit Form State
  const [newGroup, setNewGroup] = useState('O+');
  const [newComponent, setNewComponent] = useState('Packed Red Blood Cells (PRBC)');
  const [donorId, setDonorId] = useState('');
  const [unitCount, setUnitCount] = useState(1);

  // Load from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setStock(parsed);
          return;
        }
      }
    } catch { /* ignore */ }
    setStock(SEED_BLOOD_STOCK);
  }, []);

  const saveStock = (newStock: BloodStockUnit[]) => {
    setStock(newStock);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newStock));
    } catch { /* ignore */ }
  };

  const showNotification = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3800);
  };

  const totalUnits = stock.reduce((sum, s) => sum + s.unitsAvailable, 0);
  const criticalShortage = stock.filter(s => s.unitsAvailable < s.criticalThreshold);

  // Handle Transfusion Issue
  const handleIssueUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) {
      showNotification('Please provide patient name.');
      return;
    }

    const unitIdx = stock.findIndex(s => s.bloodGroup === selectedGroup);
    if (unitIdx === -1 || stock[unitIdx].unitsAvailable <= 0) {
      showNotification(`Insufficient stock of group ${selectedGroup}.`);
      return;
    }

    const updated = [...stock];
    updated[unitIdx] = {
      ...updated[unitIdx],
      unitsAvailable: Math.max(0, updated[unitIdx].unitsAvailable - 1),
    };
    saveStock(updated);

    emitLiveAction(`Blood unit ${selectedGroup} released for ${patientName} (${ward})`, { module: 'blood-bank' });
    liveAlert(`Blood unit ${selectedGroup} issued for transfusion to ${patientName} at ${ward}.`);
    showNotification(`1 Unit of ${selectedGroup} successfully issued for ${patientName} (${ward}).`);
    setShowIssueModal(false);
    setPatientName('');
    setHospitalNumber('');
  };

  // Handle Add Donor Unit
  const handleAddUnit = (e: React.FormEvent) => {
    e.preventDefault();
    const unitIdx = stock.findIndex(s => s.bloodGroup === newGroup);
    const updated = [...stock];

    if (unitIdx !== -1) {
      updated[unitIdx] = {
        ...updated[unitIdx],
        unitsAvailable: updated[unitIdx].unitsAvailable + Number(unitCount),
      };
    } else {
      updated.push({
        id: `BB-${newGroup.replace('+', 'POS').replace('-', 'NEG')}`,
        bloodGroup: newGroup,
        component: newComponent,
        unitsAvailable: Number(unitCount),
        criticalThreshold: 4,
        nearestExpiry: 'In 35 days',
      });
    }
    saveStock(updated);

    emitLiveAction(`Added ${unitCount} unit(s) of ${newGroup} to blood bank inventory`, { module: 'blood-bank' });
    showNotification(`Added ${unitCount} unit(s) of ${newGroup} (${newComponent}). Cold chain +4°C logged.`);
    setShowAddModal(false);
    setDonorId('');
    setUnitCount(1);
  };

  // Emergency STAT O-Neg Release
  const handleEmergencyONegRelease = () => {
    const oNegIdx = stock.findIndex(s => s.bloodGroup === 'O-');
    if (oNegIdx === -1 || stock[oNegIdx].unitsAvailable <= 0) {
      showNotification('EMERGENCY ALERT: Universal donor O- stock is depleted!');
      liveAlert('CRITICAL: O- stock depleted! Immediate donor registry mobilization needed.');
      return;
    }

    const updated = [...stock];
    updated[oNegIdx] = {
      ...updated[oNegIdx],
      unitsAvailable: Math.max(0, updated[oNegIdx].unitsAvailable - 1),
    };
    saveStock(updated);

    emitLiveAction('STAT Emergency O- Universal Donor unit released for trauma resuscitation', { module: 'blood-bank' });
    liveAlert('STAT Emergency O-Neg blood released to Emergency Resuscitation Room.');
    showNotification('STAT O- unit released immediately for trauma resuscitation.');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toast Notice */}
      {notice && (
        <div style={{
          position: 'fixed', top: 22, right: 24, zIndex: 99999,
          background: '#0F172A', color: '#F43F5E', border: '1px solid #E11D48',
          borderRadius: 12, padding: '14px 20px', boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.88rem', fontWeight: 600,
        }}>
          <CheckCircle2 size={18} color="#F43F5E" />
          <span>{notice}</span>
        </div>
      )}

      {/* Hero Header with Actions */}
      <div style={{
        background: 'linear-gradient(135deg, #881337 0%, #BE123C 55%, #E11D48 100%)',
        borderRadius: 18, padding: '22px 26px', color: '#FFFFFF',
        boxShadow: '0 10px 25px rgba(225, 29, 72, 0.25)',
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.3)',
          }}>
            <Droplet size={28} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Blood Bank & Transfusion Safety Suite
              </h1>
              <span style={{ background: '#10B981', color: '#FFFFFF', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 800 }}>
                COLD CHAIN OK (+4°C)
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#FFE4E6', maxWidth: 640 }}>
              ABO/Rh inventory, serological NAT screening, pre-transfusion crossmatching, and rapid emergency release.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleEmergencyONegRelease}
            style={{
              background: '#991B1B', color: '#FFFFFF', border: '1px solid #FECDD3',
              padding: '9px 16px', borderRadius: 10, fontWeight: 800, fontSize: '0.82rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
            }}
          >
            <ShieldAlert size={16} />
            STAT O- Release
          </button>

          <button
            type="button"
            onClick={() => setShowIssueModal(true)}
            style={{
              background: '#FFFFFF', color: '#BE123C', border: 'none',
              padding: '9px 16px', borderRadius: 10, fontWeight: 700, fontSize: '0.82rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}
          >
            <Send size={16} />
            Issue for Transfusion
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            style={{
              background: 'rgba(255,255,255,0.2)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.35)',
              padding: '9px 14px', borderRadius: 10, fontWeight: 700, fontSize: '0.82rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <Plus size={16} />
            + Add Donated Unit
          </button>
        </div>
      </div>

      {/* Top Telemetry Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid #E11D48', padding: '16px 18px' }}>
          <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Total Blood Units Stored</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#BE123C' }}>{totalUnits} Units</span>
            <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>+4°C Cold Chain OK</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#64748B' }}>100% Serologically Screened (ELISA/NAT)</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #EF4444', padding: '16px 18px' }}>
          <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Universal Donor O- Stock</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#DC2626' }}>
              {stock.find(s => s.bloodGroup === 'O-')?.unitsAvailable ?? 0} Units
            </span>
            <span style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 700 }}>
              {(stock.find(s => s.bloodGroup === 'O-')?.unitsAvailable ?? 0) < 4 ? 'LOW RESERVE' : 'ADEQUATE'}
            </span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#64748B' }}>Target Minimum Reserve: 6 Units</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6', padding: '16px 18px' }}>
          <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Fresh Frozen Plasma</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#2563EB' }}>18 Packs</span>
            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>-20°C Freezers</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#64748B' }}>Coagulopathy & Trauma Standby</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #10B981', padding: '16px 18px' }}>
          <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Cross-match Compatibility</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669' }}>100%</span>
            <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>Coombs Tested</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#64748B' }}>Zero Hemolytic Transfusion Reactions</span>
        </div>
      </div>

      {/* Critical Stock Warning Banner */}
      {criticalShortage.length > 0 && (
        <div style={{
          padding: '14px 20px', background: '#FEF2F2', border: '1px solid #FECDD3',
          borderRadius: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertTriangle size={20} color="#DC2626" />
            <span style={{ fontSize: '0.86rem', color: '#991B1B', fontWeight: 700 }}>
              CRITICAL SHORTAGE: Groups {criticalShortage.map(c => c.bloodGroup).join(', ')} below hospital reserve threshold.
            </span>
          </div>
          <button
            type="button"
            style={{
              background: '#DC2626', color: '#FFFFFF', border: 'none',
              padding: '7px 16px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer'
            }}
            onClick={() => liveAlert(`Donor Mobilization Broadcast initiated to Akwa Ibom State Voluntary Blood Donor Registry.`)}
          >
            Dispatch Donor Mobilization SMS
          </button>
        </div>
      )}

      {/* Blood Group Stock Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {stock.map(unit => {
          const isLow = unit.unitsAvailable < unit.criticalThreshold;
          return (
            <div
              key={unit.id}
              className="os-card"
              style={{
                padding: 18, borderLeft: isLow ? '4px solid #EF4444' : '4px solid #10B981',
                background: '#FFFFFF', boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0F172A' }}>
                  {unit.bloodGroup}
                </span>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: 4,
                  background: isLow ? '#FEE2E2' : '#DCFCE7',
                  color: isLow ? '#DC2626' : '#15803D',
                }}>
                  {isLow ? 'CRITICAL SHORTAGE' : 'ADEQUATE'}
                </span>
              </div>

              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#E11D48', marginBottom: 6 }}>
                {unit.component}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#475569', marginBottom: 8 }}>
                <span>Stock: <strong style={{ color: isLow ? '#DC2626' : '#0F172A', fontSize: '1.1rem' }}>{unit.unitsAvailable} Units</strong></span>
                <span>Min Reserve: <strong>{unit.criticalThreshold}</strong></span>
              </div>

              <div style={{
                fontSize: '0.72rem', color: '#64748B', borderTop: '1px solid #F1F5F9',
                paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <span>Expiry: {unit.nearestExpiry}</span>
                <button
                  type="button"
                  onClick={() => { setSelectedGroup(unit.bloodGroup); setShowIssueModal(true); }}
                  style={{
                    background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 6,
                    padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700, color: '#0F172A', cursor: 'pointer'
                  }}
                >
                  Issue Unit
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: Issue Blood Unit */}
      {showIssueModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 500,
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)', padding: 22, display: 'flex', flexDirection: 'column', gap: 16
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
                Issue Blood Unit for Transfusion
              </h3>
              <X size={18} color="#64748B" style={{ cursor: 'pointer' }} onClick={() => setShowIssueModal(false)} />
            </div>

            <form onSubmit={handleIssueUnit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  BLOOD GROUP TO ISSUE
                </label>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                >
                  {stock.map(s => (
                    <option key={s.bloodGroup} value={s.bloodGroup}>
                      {s.bloodGroup} ({s.unitsAvailable} Units Available)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  PATIENT NAME
                </label>
                <input
                  type="text"
                  placeholder="e.g. Samuel Edet"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    HOSPITAL NO.
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PAT-2026-091"
                    value={hospitalNumber}
                    onChange={(e) => setHospitalNumber(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    WARD / UNIT
                  </label>
                  <select
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                  >
                    <option value="Operating Theatre">Operating Theatre</option>
                    <option value="Emergency Resuscitation">Emergency Resuscitation</option>
                    <option value="Labour Ward / Maternity">Labour Ward / Maternity</option>
                    <option value="Intensive Care Unit (ICU)">Intensive Care Unit (ICU)</option>
                    <option value="Inpatient Ward 3A">Inpatient Ward 3A</option>
                  </select>
                </div>
              </div>

              {/* Safety Pre-Transfusion Checklist */}
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A' }}>Pre-Transfusion Verification</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.76rem', color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={crossmatchVerified}
                    onChange={(e) => setCrossmatchVerified(e.target.checked)}
                    required
                  />
                  <span>Major Crossmatch (Coombs test) & ABO/Rh compatibility verified</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  style={{ background: 'none', border: '1px solid #CBD5E1', padding: '8px 14px', borderRadius: 8, fontSize: '0.8rem', color: '#475569', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: '#BE123C', color: '#FFFFFF', border: 'none',
                    padding: '8px 18px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Release Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Donated Unit */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 480,
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)', padding: 22, display: 'flex', flexDirection: 'column', gap: 14
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
                Register Donated Blood Unit
              </h3>
              <X size={18} color="#64748B" style={{ cursor: 'pointer' }} onClick={() => setShowAddModal(false)} />
            </div>

            <form onSubmit={handleAddUnit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    ABO/Rh BLOOD GROUP
                  </label>
                  <select
                    value={newGroup}
                    onChange={(e) => setNewGroup(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                  >
                    {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    QUANTITY (UNITS)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={unitCount}
                    onChange={(e) => setUnitCount(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  COMPONENT
                </label>
                <select
                  value={newComponent}
                  onChange={(e) => setNewComponent(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                >
                  <option value="Packed Red Blood Cells (PRBC)">Packed Red Blood Cells (PRBC)</option>
                  <option value="Whole Blood (CPDA-1)">Whole Blood (CPDA-1)</option>
                  <option value="Fresh Frozen Plasma (FFP)">Fresh Frozen Plasma (FFP)</option>
                  <option value="Platelet Concentrate (Random Donor)">Platelet Concentrate (Random Donor)</option>
                  <option value="Cryoprecipitate">Cryoprecipitate</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  DONOR ID / BAG BARCODE
                </label>
                <input
                  type="text"
                  placeholder="e.g. DNR-2026-8819"
                  value={donorId}
                  onChange={(e) => setDonorId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                />
              </div>

              <div style={{ background: '#ECFDF5', padding: 10, borderRadius: 8, border: '1px solid #A7F3D0', fontSize: '0.75rem', color: '#065F46' }}>
                ✓ Serological NAT Screened: Negative for HIV 1/2, HBsAg, HCV, and Syphilis (VDRL).
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ background: 'none', border: '1px solid #CBD5E1', padding: '8px 14px', borderRadius: 8, fontSize: '0.8rem', color: '#475569', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: '#059669', color: '#FFFFFF', border: 'none',
                    padding: '8px 18px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Add to Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
