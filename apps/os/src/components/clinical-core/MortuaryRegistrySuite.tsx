'use client';

/**
 * MortuaryRegistrySuite — Hospital Pathology, Mortuary & Deceased Body Tracking.
 * Deceased body intake logs, Cold chamber bay slot allocation, Embalming procedure logs,
 * Autopsy / Post-Mortem documentation, and Next-of-Kin Release verification checklist.
 */

import React, { useState } from 'react';
import {
  Shield, Plus, Search, Printer, CheckCircle2, AlertTriangle,
  User, Clock, Calendar, MapPin, FileText, Check, Lock, ChevronRight
} from 'lucide-react';
import type { UserSession } from '../auth/AuthScreen';

export interface DeceasedRecord {
  id: string;
  tagNumber: string;
  deceasedName: string;
  hospitalNumber?: string;
  age: number;
  sex: 'Male' | 'Female';
  dateOfDeath: string;
  timeOfDeath: string;
  placeOfDeath: string; // e.g. "Male Medical Ward", "Brought In Dead (BID) A&E"
  chamberNumber: string;
  baySlot: string;
  status: 'In Storage' | 'Embalmed' | 'Autopsy Scheduled' | 'Autopsy Completed' | 'Released';
  embalmingDate?: string;
  autopsyFindings?: string;
  coronerCase: boolean;
  policeClearanceReceived: boolean;
  mortuaryBillSettled: boolean;
  nextOfKinName: string;
  nextOfKinPhone: string;
  releaseDate?: string;
  receivingUndertaker?: string;
}

interface Props {
  session?: UserSession;
  onNavigate?: (key: string) => void;
}

export const MortuaryRegistrySuite: React.FC<Props> = ({ session, onNavigate }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';

  const [records, setRecords] = useState<DeceasedRecord[]>([
    {
      id: 'MOR-101',
      tagNumber: 'MOR-2026-0041',
      deceasedName: 'Elder Bassey Udo Akpan',
      hospitalNumber: 'IGH-2025-1092',
      age: 76,
      sex: 'Male',
      dateOfDeath: '2026-11-12',
      timeOfDeath: '18:40',
      placeOfDeath: 'ICU Bed 3',
      chamberNumber: 'Cold Chamber Unit 1',
      baySlot: 'Bay B-04',
      status: 'In Storage',
      coronerCase: false,
      policeClearanceReceived: true,
      mortuaryBillSettled: false,
      nextOfKinName: 'Mr. Eno Bassey Akpan (Son)',
      nextOfKinPhone: '+234 812 345 6789',
    },
    {
      id: 'MOR-102',
      tagNumber: 'MOR-2026-0040',
      deceasedName: 'John Chukwuma Eze',
      hospitalNumber: 'IGH-2026-BID-09',
      age: 42,
      sex: 'Male',
      dateOfDeath: '2026-11-11',
      timeOfDeath: '22:15',
      placeOfDeath: 'Brought In Dead (RTA Eket-Ikot Abasi Rd)',
      chamberNumber: 'Cold Chamber Unit 2',
      baySlot: 'Bay A-02',
      status: 'Autopsy Completed',
      coronerCase: true,
      policeClearanceReceived: true,
      mortuaryBillSettled: true,
      autopsyFindings: 'Traumatic Hemothorax secondary to blunt thoracic injury. No foul play detected.',
      nextOfKinName: 'Mrs. Chinyere Eze (Wife)',
      nextOfKinPhone: '+234 803 111 2233',
    },
  ]);

  const [selectedRecordId, setSelectedRecordId] = useState<string>('MOR-101');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewIntakeModal, setShowNewIntakeModal] = useState(false);

  // New Intake Form
  const [newName, setNewName] = useState('');
  const [newHospitalNo, setNewHospitalNo] = useState('');
  const [newAge, setNewAge] = useState(60);
  const [newSex, setNewSex] = useState<'Male' | 'Female'>('Male');
  const [newPlace, setNewPlace] = useState('Male Surgical Ward');
  const [newChamber, setNewChamber] = useState('Cold Chamber Unit 1');
  const [newBay, setNewBay] = useState('Bay C-01');
  const [newNok, setNewNok] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const selectedRecord = records.find((r) => r.id === selectedRecordId) || records[0];

  const handleAddIntake = () => {
    if (!newName.trim()) return;
    const newRec: DeceasedRecord = {
      id: `MOR-${Date.now()}`,
      tagNumber: `MOR-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      deceasedName: newName,
      hospitalNumber: newHospitalNo || undefined,
      age: newAge,
      sex: newSex,
      dateOfDeath: new Date().toISOString().split('T')[0],
      timeOfDeath: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      placeOfDeath: newPlace,
      chamberNumber: newChamber,
      baySlot: newBay,
      status: 'In Storage',
      coronerCase: false,
      policeClearanceReceived: false,
      mortuaryBillSettled: false,
      nextOfKinName: newNok || 'Next of Kin Pending',
      nextOfKinPhone: newPhone || '+234 800 000 0000',
    };
    setRecords([newRec, ...records]);
    setSelectedRecordId(newRec.id);
    setShowNewIntakeModal(false);
  };

  const handleToggleClearance = (field: 'policeClearanceReceived' | 'mortuaryBillSettled') => {
    if (!selectedRecord) return;
    setRecords((prev) =>
      prev.map((r) =>
        r.id === selectedRecord.id ? { ...r, [field]: !r[field] } : r
      )
    );
  };

  const handleReleaseBody = () => {
    if (!selectedRecord) return;
    if (!selectedRecord.mortuaryBillSettled || !selectedRecord.policeClearanceReceived) {
      alert('Cannot release deceased body: Verify Police Clearance and Mortuary Bill settlement first.');
      return;
    }
    setRecords((prev) =>
      prev.map((r) =>
        r.id === selectedRecord.id
          ? { ...r, status: 'Released', releaseDate: new Date().toISOString().split('T')[0] }
          : r
      )
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '24px 28px', color: '#0F172A', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F1F5F9', color: '#475569', padding: '3px 10px', borderRadius: 999, fontSize: '0.74rem', fontWeight: 700, marginBottom: 4 }}>
            <Shield size={14} /> Hospital Pathology & Cold Storage Registry
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0, color: '#0F172A' }}>
            Mortuary & Deceased Body Management Suite
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748B' }}>
            Chamber Bay Slots · Autopsy & Post-Mortem Records · Coroner Clearance & Body Release
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowNewIntakeModal(true)}
          style={{ padding: '9px 18px', borderRadius: 10, background: '#334155', color: '#FFF', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Plus size={16} /> New Deceased Intake
        </button>
      </div>

      {/* Grid: Register List | Inspection & Release Card */}
      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 20 }}>
        {/* Left Column: Intake Register */}
        <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 18 }}>
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Search by name, tag number, or hospital no…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.8rem' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 600, overflowY: 'auto' }}>
            {records
              .filter(
                (r) =>
                  r.deceasedName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  r.tagNumber.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((r) => {
                const isSelected = r.id === selectedRecordId;
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRecordId(r.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: isSelected ? '2px solid #334155' : '1px solid #E2E8F0',
                      background: isSelected ? '#F8FAFC' : '#FFF',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.74rem', fontFamily: 'monospace', fontWeight: 800, color: '#0369A1' }}>
                        {r.tagNumber}
                      </span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontWeight: 700,
                          background: r.status === 'Released' ? '#ECFDF5' : '#F1F5F9',
                          color: r.status === 'Released' ? '#065F46' : '#475569',
                        }}
                      >
                        {r.status}
                      </span>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0F172A' }}>{r.deceasedName}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 4 }}>
                      {r.chamberNumber} · {r.baySlot} · Age: {r.age} ({r.sex})
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Right Column: Selected Case Details & Release Checklist */}
        {selectedRecord && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Record Overview */}
            <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #F1F5F9', paddingBottom: 14, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: '0.74rem', color: '#64748B' }}>OFFICIAL MORTUARY INTAKE FILE</div>
                  <h2 style={{ margin: '2px 0 0', fontSize: '1.3rem', fontWeight: 900, color: '#0F172A' }}>
                    {selectedRecord.deceasedName}
                  </h2>
                  <div style={{ fontSize: '0.8rem', color: '#0369A1', fontWeight: 700, marginTop: 2 }}>
                    Tag: {selectedRecord.tagNumber} · Hospital No: {selectedRecord.hospitalNumber || 'N/A (BID)'}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ padding: '6px 14px', borderRadius: 10, background: '#334155', color: '#FFF', fontWeight: 800, fontSize: '0.84rem' }}>
                    {selectedRecord.chamberNumber} : {selectedRecord.baySlot}
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', fontSize: '0.82rem', marginBottom: 16 }}>
                <div><strong>Date & Time of Death:</strong> {selectedRecord.dateOfDeath} @ {selectedRecord.timeOfDeath}</div>
                <div><strong>Place of Demise:</strong> {selectedRecord.placeOfDeath}</div>
                <div><strong>Next of Kin:</strong> {selectedRecord.nextOfKinName}</div>
                <div><strong>Next of Kin Phone:</strong> {selectedRecord.nextOfKinPhone}</div>
                <div><strong>Coroner's Case:</strong> {selectedRecord.coronerCase ? 'YES (Police / Medical Examiner Notice)' : 'No (Natural Death in Ward)'}</div>
                <div><strong>Status:</strong> {selectedRecord.status}</div>
              </div>

              {selectedRecord.autopsyFindings && (
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                    Pathologist Autopsy Findings
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#1E293B' }}>{selectedRecord.autopsyFindings}</p>
                </div>
              )}

              {/* Release Checklist */}
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 16 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 12 }}>
                  Official Body Release Protocol Checklist
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div
                    onClick={() => handleToggleClearance('policeClearanceReceived')}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      border: selectedRecord.policeClearanceReceived ? '1.5px solid #059669' : '1px solid #CBD5E1',
                      background: selectedRecord.policeClearanceReceived ? '#ECFDF5' : '#FFF',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: selectedRecord.policeClearanceReceived ? '#059669' : '#CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF' }}>
                      {selectedRecord.policeClearanceReceived ? <Check size={16} /> : null}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0F172A' }}>Police & Coroner Clearance</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Form C / Legal certification on file</div>
                    </div>
                  </div>

                  <div
                    onClick={() => handleToggleClearance('mortuaryBillSettled')}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      border: selectedRecord.mortuaryBillSettled ? '1.5px solid #059669' : '1px solid #CBD5E1',
                      background: selectedRecord.mortuaryBillSettled ? '#ECFDF5' : '#FFF',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: selectedRecord.mortuaryBillSettled ? '#059669' : '#CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF' }}>
                      {selectedRecord.mortuaryBillSettled ? <Check size={16} /> : null}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0F172A' }}>Mortuary Bill Settled</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Storage & embalming receipt verified</div>
                    </div>
                  </div>
                </div>

                {selectedRecord.status !== 'Released' ? (
                  <button
                    type="button"
                    onClick={handleReleaseBody}
                    style={{
                      width: '100%',
                      padding: '12px 18px',
                      borderRadius: 10,
                      border: 'none',
                      background: '#0F172A',
                      color: '#FFF',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <CheckCircle2 size={16} /> Execute Deceased Release to Next of Kin
                  </button>
                ) : (
                  <div style={{ padding: 12, background: '#F0FDF4', borderRadius: 10, border: '1px solid #BBF7D0', color: '#166534', fontWeight: 700, fontSize: '0.84rem', textAlign: 'center' }}>
                    Body Officially Released to Family on {selectedRecord.releaseDate}. File archived in HIM.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: New Intake */}
      {showNewIntakeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#FFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 520, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>
              Log Deceased Patient Intake
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.82rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Deceased Full Name *</label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Hospital Folder No</label>
                  <input type="text" value={newHospitalNo} onChange={(e) => setNewHospitalNo(e.target.value)} placeholder="e.g. IGH-2026-..." style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Age & Sex</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="number" value={newAge} onChange={(e) => setNewAge(parseInt(e.target.value, 10))} style={{ width: 70, padding: '8px 8px', borderRadius: 8, border: '1px solid #CBD5E1' }} />
                    <select value={newSex} onChange={(e) => setNewSex(e.target.value as any)} style={{ flex: 1, padding: '8px 8px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFF' }}>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Cold Chamber</label>
                  <select value={newChamber} onChange={(e) => setNewChamber(e.target.value)} style={{ width: '100%', padding: '8px 8px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFF' }}>
                    <option value="Cold Chamber Unit 1">Chamber Unit 1</option>
                    <option value="Cold Chamber Unit 2">Chamber Unit 2</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Bay Slot</label>
                  <input type="text" value={newBay} onChange={(e) => setNewBay(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Next of Kin Name & Phone</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <input type="text" placeholder="Name" value={newNok} onChange={(e) => setNewNok(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1' }} />
                  <input type="text" placeholder="Phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1' }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button
                type="button"
                onClick={() => setShowNewIntakeModal(false)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFF', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddIntake}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#334155', color: '#FFF', fontWeight: 700, cursor: 'pointer' }}
              >
                Confirm Intake
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MortuaryRegistrySuite;

