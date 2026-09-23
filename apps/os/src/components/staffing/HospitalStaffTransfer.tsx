'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2, ArrowRight, Users, CheckCircle2, Clock, AlertCircle,
  Search, Filter, Send, X, RefreshCw, ChevronDown, Calendar,
  UserCheck, Loader, History, TrendingUp, Plus, Zap
} from 'lucide-react';
import { HOSPITALS, UserSession } from '../auth/AuthScreen';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffMember {
  id: string;
  name: string;
  role: string;
  roleKey: string;
  department: string;
  hospitalId: string;
  hospitalName: string;
  status: 'active' | 'on-leave' | 'pending-transfer';
  joinDate: string;
  avatarInitials: string;
  accentColor: string;
}

interface TransferRecord {
  id: string;
  staffId: string;
  staffName: string;
  role: string;
  fromHospitalId: string;
  fromHospitalName: string;
  toHospitalId: string;
  toHospitalName: string;
  effectiveDate: string;
  requestedBy: string;
  status: 'pending' | 'approved' | 'completed' | 'rejected';
  reason: string;
  requestedAt: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const INITIAL_STAFF: StaffMember[] = [
  { id: 'LIGH-DOC-001', name: 'Dr. Amara Okafor',      role: 'Medical Officer',         roleKey: 'doctor',       department: 'Internal Medicine',  hospitalId: 'ISH-001', hospitalName: 'Ibom Specialist Hospital, Uyo',   status: 'active',   joinDate: '2024-03-01', avatarInitials: 'AO', accentColor: '#0284C7' },
  { id: 'LUTH-SUR-002', name: 'Dr. Emeka Adeyemi',     role: 'Consultant Surgeon',      roleKey: 'surgeon',      department: 'Surgery',            hospitalId: 'UUTH-002', hospitalName: 'University of Uyo Teaching Hospital (UUTH)', status: 'active',   joinDate: '2022-06-15', avatarInitials: 'EA', accentColor: '#DC2626' },
  { id: 'UCH-NUR-003',  name: 'Nurse Aisha Bello',     role: 'Senior Nursing Officer',  roleKey: 'nurse',        department: 'Female Medical Ward', hospitalId: 'GHI-003',  hospitalName: 'General Hospital, Ikot Ekpene',        status: 'active',   joinDate: '2023-01-10', avatarInitials: 'AB', accentColor: '#7C3AED' },
  { id: 'LIGH-ADM-004', name: 'Adm. Ngozi Eze',        role: 'Hospital Administrator',  roleKey: 'hospital_admin', department: 'Administration',    hospitalId: 'ISH-001', hospitalName: 'Ibom Specialist Hospital, Uyo',   status: 'active',   joinDate: '2021-09-20', avatarInitials: 'NE', accentColor: '#D97706' },
  { id: 'AKTH-PHA-005', name: 'Pharm. Chidi Otu',      role: 'Chief Pharmacist',        roleKey: 'pharmacist',   department: 'Pharmacy',           hospitalId: 'GHE-004', hospitalName: 'General Hospital, Eket',       status: 'active',   joinDate: '2023-07-05', avatarInitials: 'CO', accentColor: '#059669' },
  { id: 'LIGH-LAB-006', name: 'Kelechi Obiora',        role: 'Senior Lab Scientist',    roleKey: 'lab',          department: 'Laboratory',         hospitalId: 'ISH-001', hospitalName: 'Ibom Specialist Hospital, Uyo',   status: 'active',   joinDate: '2024-01-15', avatarInitials: 'KO', accentColor: '#0891B2' },
  { id: 'LUTH-RAD-007', name: 'Dr. Fatima Al-Hassan',  role: 'Consultant Radiologist',  roleKey: 'radiologist',  department: 'Radiology',          hospitalId: 'UUTH-002', hospitalName: 'University of Uyo Teaching Hospital (UUTH)', status: 'on-leave', joinDate: '2022-11-01', avatarInitials: 'FA', accentColor: '#6D28D9' },
  { id: 'UCH-REC-008',  name: 'Bisi Adewale',          role: 'Health Records Officer',  roleKey: 'records',      department: 'Medical Records',    hospitalId: 'ISH-001',  hospitalName: 'Ibom Specialist Hospital, Uyo',        status: 'active',   joinDate: '2023-05-22', avatarInitials: 'BA', accentColor: '#0F766E' },
  { id: 'LIGH-ACC-009', name: 'Amaka Oguike',          role: 'Finance Officer',         roleKey: 'accountant',   department: 'Finance & Accounts', hospitalId: 'ISH-001', hospitalName: 'Ibom Specialist Hospital, Uyo',   status: 'active',   joinDate: '2023-02-14', avatarInitials: 'AO', accentColor: '#B45309' },
  { id: 'MHQB-ICT-010', name: 'Ola Bankole',           role: 'Chief Information Officer', roleKey: 'sysadmin',   department: 'IT & Infrastructure', hospitalId: 'MHQB', hospitalName: 'MedCore HQ — Operations',         status: 'active',   joinDate: '2020-08-01', avatarInitials: 'OB', accentColor: '#374151' },
  { id: 'ISTH-NUR-011', name: 'Nurse Chioma Eze',      role: 'Staff Nurse',             roleKey: 'nurse',        department: 'Surgical Ward',      hospitalId: 'ISTH', hospitalName: 'Irrua Specialist Teaching Hospital',  status: 'active',   joinDate: '2025-01-10', avatarInitials: 'CE', accentColor: '#7C3AED' },
  { id: 'UCH-DOC-012',  name: 'Dr. Biodun Salami',     role: 'Senior Registrar',        roleKey: 'doctor',       department: 'Paediatrics',        hospitalId: 'UCH',  hospitalName: 'University College Hospital',        status: 'active',   joinDate: '2024-06-01', avatarInitials: 'BS', accentColor: '#0284C7' },
];

const INITIAL_TRANSFERS: TransferRecord[] = [
  {
    id: 'TRF-0091', staffId: 'LUTH-RAD-007', staffName: 'Dr. Fatima Al-Hassan', role: 'Consultant Radiologist',
    fromHospitalId: 'UUTH-002', fromHospitalName: 'University of Uyo Teaching Hospital (UUTH)', toHospitalId: 'UCH', toHospitalName: 'University College Hospital',
    effectiveDate: '2026-10-01', requestedBy: 'Adm. Ngozi Eze', status: 'pending',
    reason: 'UCH Radiology dept critically understaffed', requestedAt: '2026-09-20',
  },
  {
    id: 'TRF-0088', staffId: 'LIGH-DOC-001', staffName: 'Dr. Amara Okafor', role: 'Medical Officer',
    fromHospitalId: 'AKTH', fromHospitalName: 'Aminu Kano Teaching Hospital', toHospitalId: 'ISH-001', toHospitalName: 'Ibom Specialist Hospital, Uyo',
    effectiveDate: '2026-09-01', requestedBy: 'MOH Director', status: 'completed',
    reason: 'Zonal rotation — national redeployment programme', requestedAt: '2026-08-12',
  },
  {
    id: 'TRF-0085', staffId: 'ISTH-NUR-011', staffName: 'Nurse Chioma Eze', role: 'Staff Nurse',
    fromHospitalId: 'ISH-001', fromHospitalName: 'Ibom Specialist Hospital, Uyo', toHospitalId: 'ISTH', toHospitalName: 'Irrua Specialist Teaching Hospital',
    effectiveDate: '2026-08-15', requestedBy: 'Adm. Ngozi Eze', status: 'completed',
    reason: 'Specialist support for new surgical ward opening', requestedAt: '2026-08-01',
  },
];

const TRANSFER_REASONS = [
  'Understaffing at destination hospital',
  'Zonal rotation — national redeployment',
  'Specialist support request',
  'Staff personal request (approved)',
  'New department/ward opening',
  'Disciplinary reposting',
  'MOH strategic reallocation',
];

const STATUS_CONFIG = {
  active: { color: '#059669', label: 'Active', bg: 'rgba(5,150,105,0.1)' },
  'on-leave': { color: '#D97706', label: 'On Leave', bg: 'rgba(217,119,6,0.1)' },
  'pending-transfer': { color: '#0052D4', label: 'Transfer Pending', bg: 'rgba(0,82,212,0.1)' },
  pending: { color: '#0052D4', label: 'Pending', bg: 'rgba(0,82,212,0.1)' },
  approved: { color: '#7C3AED', label: 'Approved', bg: 'rgba(124,58,237,0.1)' },
  completed: { color: '#059669', label: 'Completed', bg: 'rgba(5,150,105,0.1)' },
  rejected: { color: '#DC2626', label: 'Rejected', bg: 'rgba(220,38,38,0.1)' },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  session?: UserSession;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const HospitalStaffTransfer: React.FC<Props> = ({ session }) => {
  const [staff, setStaff] = useState<StaffMember[]>(INITIAL_STAFF);
  const [transfers, setTransfers] = useState<TransferRecord[]>(INITIAL_TRANSFERS);
  const [activeTab, setActiveTab] = useState<'roster' | 'pending' | 'history'>('roster');
  const [search, setSearch] = useState('');
  const [filterHospital, setFilterHospital] = useState('all');

  // Transfer modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [targetHospitalId, setTargetHospitalId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Sync with localStorage on mount
  useEffect(() => {
    try {
      const savedStaff = localStorage.getItem('medcore_os_staff_registry');
      if (savedStaff) {
        setStaff(JSON.parse(savedStaff));
      }
      const savedTransfers = localStorage.getItem('medcore_os_transfers');
      if (savedTransfers) {
        setTransfers(JSON.parse(savedTransfers));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const persistData = (updatedStaff: StaffMember[], updatedTransfers: TransferRecord[]) => {
    try {
      localStorage.setItem('medcore_os_staff_registry', JSON.stringify(updatedStaff));
      localStorage.setItem('medcore_os_transfers', JSON.stringify(updatedTransfers));
    } catch (e) {
      console.error(e);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const openTransferModal = (member: StaffMember) => {
    setSelectedStaff(member);
    setTargetHospitalId('');
    setEffectiveDate(new Date().toISOString().split('T')[0]);
    setTransferReason(TRANSFER_REASONS[0]);
    setModalOpen(true);
  };

  const confirmTransfer = (immediate: boolean = false) => {
    if (!selectedStaff || !targetHospitalId || !effectiveDate || !transferReason) return;
    setTransferring(true);
    setTimeout(() => {
      const targetHosp = HOSPITALS.find(h => h.id === targetHospitalId)!;
      const newTransfer: TransferRecord = {
        id: `TRF-${String(transfers.length + 92).padStart(4, '0')}`,
        staffId: selectedStaff.id,
        staffName: selectedStaff.name,
        role: selectedStaff.role,
        fromHospitalId: selectedStaff.hospitalId,
        fromHospitalName: selectedStaff.hospitalName,
        toHospitalId: targetHospitalId,
        toHospitalName: targetHosp.name,
        effectiveDate,
        requestedBy: session?.name || 'Hospital Administrator',
        status: immediate ? 'completed' : 'pending',
        reason: transferReason,
        requestedAt: new Date().toISOString().split('T')[0],
      };

      const updatedTransfers = [newTransfer, ...transfers];
      const updatedStaff = staff.map(s => {
        if (s.id === selectedStaff.id) {
          if (immediate) {
            return {
              ...s,
              hospitalId: targetHospitalId,
              hospitalName: targetHosp.name,
              status: 'active' as const,
            };
          } else {
            return { ...s, status: 'pending-transfer' as const };
          }
        }
        return s;
      });

      setTransfers(updatedTransfers);
      setStaff(updatedStaff);
      persistData(updatedStaff, updatedTransfers);

      setTransferring(false);
      setModalOpen(false);
      if (immediate) {
        showToast(`Instant Transfer Complete! ${selectedStaff.name} is now transferred to ${targetHosp.name}. They can log in immediately.`);
      } else {
        showToast(`Transfer initiated for ${selectedStaff.name} → ${targetHosp.name}`);
      }
    }, 900);
  };

  const approveTransfer = (transferId: string) => {
    const targetTransfer = transfers.find(t => t.id === transferId);
    if (!targetTransfer) return;

    const updatedTransfers = transfers.map(t =>
      t.id === transferId ? { ...t, status: 'completed' as const } : t
    );

    const updatedStaff = staff.map(s =>
      s.id === targetTransfer.staffId
        ? { ...s, hospitalId: targetTransfer.toHospitalId, hospitalName: targetTransfer.toHospitalName, status: 'active' as const }
        : s
    );

    setTransfers(updatedTransfers);
    setStaff(updatedStaff);
    persistData(updatedStaff, updatedTransfers);
    showToast(`Transfer ${transferId} approved — ${targetTransfer.staffName} is now assigned to ${targetTransfer.toHospitalName}. Staff can now sign in.`);
  };

  const rejectTransfer = (transferId: string) => {
    const updatedTransfers = transfers.map(t =>
      t.id === transferId ? { ...t, status: 'rejected' as const } : t
    );
    const targetTransfer = transfers.find(t => t.id === transferId);
    const updatedStaff = staff.map(s =>
      s.id === targetTransfer?.staffId ? { ...s, status: 'active' as const } : s
    );

    setTransfers(updatedTransfers);
    setStaff(updatedStaff);
    persistData(updatedStaff, updatedTransfers);
    showToast(`Transfer ${transferId} rejected`);
  };

  // Filtered staff
  const filteredStaff = staff.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q) || s.department.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
    const matchHosp = filterHospital === 'all' || s.hospitalId === filterHospital;
    return matchSearch && matchHosp;
  });

  const pendingTransfers = transfers.filter(t => t.status === 'pending');
  const historyTransfers = transfers.filter(t => t.status !== 'pending');

  const isAdmin = !session || ['hospital_admin', 'sysadmin', 'medical_director'].includes(session.roleKey);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`
        .transfer-row:hover { background: #F8FAFC !important; }
        .transfer-card:hover { border-color: #00BFA5 !important; transform: translateY(-1px); }
        .transfer-card { transition: all 0.15s; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: '#FFFFFF', color: '#0052D4',
          border: '1px solid #0052D4', borderRadius: 10,
          padding: '12px 18px', boxShadow: '0 10px 25px rgba(0,82,212,0.15)',
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: '0.85rem', fontWeight: 600, animation: 'fadeUp 0.2s ease',
        }}>
          <CheckCircle2 size={16} color="#00BFA5" />
          {toast}
        </div>
      )}

      {/* Access Guard */}
      {!isAdmin && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 12, padding: '16px 20px',
          display: 'flex', alignItems: 'center', gap: 12,
          color: '#FCA5A5', fontSize: '0.88rem',
        }}>
          <AlertCircle size={18} color="#EF4444" />
          <div>
            <strong>Access Restricted</strong> — Staff transfers can only be initiated by Hospital Administrators, Medical Directors, or System Admins.
          </div>
        </div>
      )}

      {/* KPI Ribbon */}
      <div className="os-metrics-ribbon">
        <div className="metric-box alert-green">
          <span className="metric-label"><Users size={13} style={{ display: 'inline', marginRight: 4 }} />Total Staff on Network</span>
          <span className="metric-val">{staff.length} Officers</span>
          <span className="metric-sub">Across {HOSPITALS.length} hospitals</span>
        </div>
        <div className="metric-box alert-yellow">
          <span className="metric-label"><Clock size={13} style={{ display: 'inline', marginRight: 4 }} />Pending Transfers</span>
          <span className="metric-val">{pendingTransfers.length} Active</span>
          <span className="metric-sub">Awaiting approval</span>
        </div>
        <div className="metric-box">
          <span className="metric-label"><CheckCircle2 size={13} style={{ display: 'inline', marginRight: 4 }} />Completed Transfers</span>
          <span className="metric-val">{historyTransfers.filter(t => t.status === 'completed').length} Total</span>
          <span className="metric-sub">This year</span>
        </div>
        <div className="metric-box">
          <span className="metric-label"><TrendingUp size={13} style={{ display: 'inline', marginRight: 4 }} />On Leave</span>
          <span className="metric-val">{staff.filter(s => s.status === 'on-leave').length} Staff</span>
          <span className="metric-sub">Currently away</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['roster', 'pending', 'history'] as const).map(tab => (
          <button key={tab} className="os-ghost-btn" onClick={() => setActiveTab(tab)}
            style={{
              background: activeTab === tab ? 'linear-gradient(90deg, rgba(0,82,212,0.12) 0%, rgba(0,191,165,0.12) 100%)' : undefined,
              borderColor: activeTab === tab ? '#0052D4' : undefined,
              color: activeTab === tab ? '#0052D4' : undefined,
              textTransform: 'capitalize',
              fontWeight: activeTab === tab ? 700 : 600,
            }}>
            {tab === 'roster' ? '👥 Staff Roster' : tab === 'pending' ? `⏳ Pending (${pendingTransfers.length})` : '📋 Transfer History'}
          </button>
        ))}
      </div>

      {/* ── ROSTER TAB ── */}
      {activeTab === 'roster' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <Search size={14} color="#4B5563" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search staff by name, role, department…"
                style={{
                  width: '100%', paddingLeft: 34, padding: '9px 12px 9px 34px',
                  background: '#FFFFFF', border: '1px solid #E2E8F0',
                  borderRadius: 9, color: '#0A2540', fontSize: '0.85rem', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <select
              value={filterHospital}
              onChange={e => setFilterHospital(e.target.value)}
              style={{
                padding: '9px 12px', background: '#FFFFFF',
                border: '1px solid #E2E8F0', borderRadius: 9,
                color: '#0A2540', fontSize: '0.83rem', outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="all">All Hospitals</option>
              {HOSPITALS.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>

          {/* Staff Table */}
          <div className="os-table-wrap">
            <table className="os-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Role / Department</th>
                  <th>Current Hospital</th>
                  <th>Status</th>
                  <th>Joined</th>
                  {isAdmin && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map(member => {
                  const sc = STATUS_CONFIG[member.status];
                  return (
                    <tr key={member.id} className="transfer-row" style={{ background: 'transparent', transition: 'background 0.15s' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: 9,
                            background: `${member.accentColor}18`,
                            border: `1px solid ${member.accentColor}44`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: member.accentColor, fontSize: '0.72rem', fontWeight: 800, flexShrink: 0,
                          }}>
                            {member.avatarInitials}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.85rem' }}>{member.name}</div>
                            <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontFamily: 'monospace' }}>{member.id}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.83rem', color: '#334155' }}>{member.role}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{member.department}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Building2 size={12} color="#4B5563" />
                          <span style={{ fontSize: '0.82rem', color: '#94A3B8' }}>
                            {member.hospitalId}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#4B5563', marginTop: 2 }}>
                          {member.hospitalName.length > 30 ? member.hospitalName.slice(0, 30) + '…' : member.hospitalName}
                        </div>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 700,
                          color: sc.color, background: sc.bg,
                          padding: '3px 8px', borderRadius: 6,
                          border: `1px solid ${sc.color}30`,
                        }}>
                          {sc.label}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: '#64748B', fontFamily: 'monospace' }}>{member.joinDate}</td>
                      {isAdmin && (
                        <td>
                          {member.status !== 'pending-transfer' ? (
                            <button
                              className="os-ghost-btn"
                              onClick={() => openTransferModal(member)}
                              style={{ fontSize: '0.75rem', padding: '5px 11px', display: 'flex', alignItems: 'center', gap: 5 }}
                            >
                              <ArrowRight size={13} /> Transfer
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: '#60A5FA', fontStyle: 'italic' }}>Transfer pending…</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── PENDING TAB ── */}
      {activeTab === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pendingTransfers.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '48px 20px',
              color: '#4B5563', fontSize: '0.9rem',
            }}>
              <CheckCircle2 size={36} color="#22C55E" style={{ marginBottom: 12 }} />
              <div style={{ fontWeight: 600, color: '#6B7280' }}>No pending transfers</div>
              <div style={{ fontSize: '0.78rem', marginTop: 4 }}>All transfer requests have been resolved</div>
            </div>
          ) : pendingTransfers.map(t => (
            <div key={t.id} className="os-card transfer-card" style={{
              padding: '18px 20px',
              borderLeft: '3px solid #60A5FA',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#60A5FA', background: 'rgba(96,165,250,0.1)', padding: '2px 7px', borderRadius: 4 }}>{t.id}</span>
                    <span style={{ fontSize: '0.72rem', color: '#4B5563' }}>Requested {t.requestedAt}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0A2540' }}>{t.staffName}</div>
                  <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: 2 }}>{t.role}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'rgba(15,23,42,0.8)', border: '1px solid #E2E8F0',
                    borderRadius: 8, padding: '6px 12px', fontSize: '0.8rem',
                  }}>
                    <span style={{ color: '#94A3B8', fontWeight: 600 }}>{t.fromHospitalId}</span>
                    <ArrowRight size={14} color="#4B5563" />
                    <span style={{ color: '#2DD4BF', fontWeight: 700 }}>{t.toHospitalId}</span>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.78rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={12} color="#4B5563" />
                <span>Effective: <strong style={{ color: '#94A3B8' }}>{t.effectiveDate}</strong></span>
                <span style={{ marginLeft: 8 }}>• Requested by: <strong style={{ color: '#94A3B8' }}>{t.requestedBy}</strong></span>
              </div>

              <div style={{
                background: '#F8FAFC', border: '1px solid #E2E8F0',
                borderRadius: 7, padding: '8px 12px', fontSize: '0.78rem', color: '#94A3B8',
              }}>
                <strong style={{ color: '#64748B' }}>Reason:</strong> {t.reason}
              </div>

              {isAdmin && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="os-primary-btn"
                    onClick={() => approveTransfer(t.id)}
                    style={{ fontSize: '0.8rem', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <CheckCircle2 size={14} /> Approve & Execute
                  </button>
                  <button
                    className="os-ghost-btn"
                    onClick={() => rejectTransfer(t.id)}
                    style={{ fontSize: '0.8rem', padding: '7px 14px', color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <X size={14} /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && (
        <div className="os-table-wrap">
          <table className="os-table">
            <thead>
              <tr>
                <th>Transfer ID</th>
                <th>Staff Member</th>
                <th>From → To</th>
                <th>Effective Date</th>
                <th>Requested By</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {historyTransfers.map(t => {
                const sc = STATUS_CONFIG[t.status];
                return (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#0052D4' }}>{t.id}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0A2540', fontSize: '0.85rem' }}>{t.staffName}</div>
                      <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>{t.role}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.82rem' }}>
                        <span style={{ color: '#64748B' }}>{t.fromHospitalId}</span>
                        <ArrowRight size={12} color="#CBD5E1" />
                        <span style={{ color: '#0052D4', fontWeight: 600 }}>{t.toHospitalId}</span>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#94A3B8' }}>{t.effectiveDate}</td>
                    <td style={{ fontSize: '0.8rem', color: '#64748B' }}>{t.requestedBy}</td>
                    <td>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 700,
                        color: sc.color, background: sc.bg,
                        padding: '3px 8px', borderRadius: 6,
                        border: `1px solid ${sc.color}30`,
                      }}>{sc.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Transfer Modal ── */}
      {modalOpen && selectedStaff && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(10,37,64,0.55)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{
            background: '#FFFFFF', border: '1px solid #E2E8F0',
            borderRadius: 16, width: '100%', maxWidth: 520,
            boxShadow: '0 32px 80px rgba(0,82,212,0.15)',
            animation: 'fadeUp 0.2s ease',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0A2540', fontFamily: 'Outfit, sans-serif' }}>
                  Initiate Staff Transfer
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 2 }}>
                  Reassign staff member to another hospital
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Staff Info */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: '#F8FAFC', border: '1px solid #E2E8F0',
                borderRadius: 10, padding: '12px 14px',
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 11,
                  background: `${selectedStaff.accentColor}18`, border: `1px solid ${selectedStaff.accentColor}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: selectedStaff.accentColor, fontWeight: 800, fontSize: '0.9rem', flexShrink: 0,
                }}>
                  {selectedStaff.avatarInitials}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.92rem' }}>{selectedStaff.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{selectedStaff.role} · {selectedStaff.department}</div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Building2 size={11} />
                    Currently at: <strong style={{ color: '#0052D4' }}>{selectedStaff.hospitalId}</strong>
                  </div>
                </div>
              </div>

              {/* Destination Hospital */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748B', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Transfer To Hospital
                </label>
                <select
                  value={targetHospitalId}
                  onChange={e => setTargetHospitalId(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px',
                    background: '#FFFFFF', border: '1px solid #E2E8F0',
                    borderRadius: 9, color: targetHospitalId ? '#0A2540' : '#94A3B8',
                    fontSize: '0.88rem', outline: 'none', cursor: 'pointer',
                  }}
                >
                  <option value="">Select destination hospital…</option>
                  {HOSPITALS.filter(h => h.id !== selectedStaff.hospitalId).map(h => (
                    <option key={h.id} value={h.id}>{h.name} — {h.location}</option>
                  ))}
                </select>
              </div>

              {/* Effective Date */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#9CA3AF', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Effective Date
                </label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={e => setEffectiveDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  style={{
                    width: '100%', padding: '10px 12px',
                    background: '#FFFFFF', border: '1px solid #CBD5E1',
                    borderRadius: 9, color: '#0A2540', fontSize: '0.88rem', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Reason */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#9CA3AF', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Transfer Reason
                </label>
                <select
                  value={transferReason}
                  onChange={e => setTransferReason(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px',
                    background: '#FFFFFF', border: '1px solid #CBD5E1',
                    borderRadius: 9, color: transferReason ? '#0A2540' : '#94A3B8',
                    fontSize: '0.88rem', outline: 'none', cursor: 'pointer', marginBottom: 8,
                  }}
                >
                  <option value="">Select reason…</option>
                  {TRANSFER_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px 20px',
              borderTop: '1px solid #E2E8F0',
              display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap',
            }}>
              <button className="os-ghost-btn" onClick={() => setModalOpen(false)} style={{ fontSize: '0.82rem' }}>Cancel</button>
              <button
                type="button"
                className="os-ghost-btn"
                onClick={() => confirmTransfer(false)}
                disabled={!targetHospitalId || !effectiveDate || !transferReason || transferring}
                style={{
                  fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6,
                  borderColor: '#0052D4', color: '#0052D4',
                  opacity: (!targetHospitalId || !effectiveDate || !transferReason) ? 0.5 : 1,
                }}
              >
                <Send size={13} /> Queue for Approval
              </button>
              <button
                type="button"
                className="os-primary-btn"
                onClick={() => confirmTransfer(true)}
                disabled={!targetHospitalId || !effectiveDate || !transferReason || transferring}
                style={{
                  fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6,
                  background: 'linear-gradient(90deg, #0052D4 0%, #00BFA5 100%)',
                  opacity: (!targetHospitalId || !effectiveDate || !transferReason) ? 0.5 : 1,
                }}
              >
                {transferring ? (
                  <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFF', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Transferring...</>
                ) : (
                  <><Zap size={14} /> Deploy & Transfer Now</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HospitalStaffTransfer;
