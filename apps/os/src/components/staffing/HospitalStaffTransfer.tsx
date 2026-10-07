'use client';
import { pushActivity, getAccessRecords, setAccessRecords } from '../../lib/adminRealtimeStore';

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

const INITIAL_STAFF: StaffMember[] = [];

const INITIAL_TRANSFERS: TransferRecord[] = [];

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
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'roster' | 'pending' | 'incoming' | 'history'>('roster');
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

  // Normalize registry / card shapes into StaffMember (prevents crash on missing fields)
  const normalizeStaff = (raw: Record<string, unknown>): StaffMember => {
    const name = String(raw.name || raw.fullName || 'Staff');
    const initials =
      String(raw.avatarInitials || raw.initials || '') ||
      name
        .split(/\s+/)
        .map((p) => p[0] || '')
        .join('')
        .slice(0, 2)
        .toUpperCase() ||
      'ST';
    const statusRaw = String(raw.status || 'active').toLowerCase();
    const status: StaffMember['status'] =
      statusRaw === 'on-leave' || statusRaw === 'pending-transfer' ? (statusRaw as StaffMember['status']) : 'active';
    return {
      id: String(raw.id || raw.badgeId || `STF-${Math.random().toString(36).slice(2, 8)}`),
      name,
      role: String(raw.role || raw.title || 'Staff'),
      roleKey: String(raw.roleKey || ''),
      department: String(raw.department || '—'),
      hospitalId: String(raw.hospitalId || raw.facilityId || ''),
      hospitalName: String(raw.hospitalName || raw.facilityName || '—'),
      status,
      joinDate: String(raw.joinDate || raw.issuedAt || raw.registeredAt || '—'),
      avatarInitials: initials.slice(0, 2),
      accentColor: String(raw.accentColor || raw.color || '#0052D4'),
    };
  };

  // Sync with localStorage on mount + live cross-facility transfer snapshot
  useEffect(() => {
    const loadLocal = () => {
      try {
        const savedStaff = localStorage.getItem('medcore_os_staff_registry');
        if (savedStaff) {
          const parsed = JSON.parse(savedStaff);
          const list = Array.isArray(parsed) ? parsed : [];
          setStaff(list.map((r: Record<string, unknown>) => normalizeStaff(r || {})));
        }
        const savedTransfers = localStorage.getItem('medcore_os_transfers');
        if (savedTransfers) {
          const parsed = JSON.parse(savedTransfers);
          setTransfers(Array.isArray(parsed) ? parsed : []);
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadLocal();

    const onSync = () => loadLocal();
    window.addEventListener('medcore-admin-sync', onSync);
    window.addEventListener('medcore-transfers-updated', onSync);
    window.addEventListener('storage', onSync);

    let stopCloud = () => {};
    void (async () => {
      try {
        const { firestoreSubscribeNetworkTransfers } = await import('../../lib/firebase');
        stopCloud = firestoreSubscribeNetworkTransfers((rows) => {
          try {
            const remote = (rows || []).map((r) => ({
              id: String(r.id || ''),
              staffId: String(r.staffId || ''),
              staffName: String(r.staffName || ''),
              role: String(r.role || ''),
              fromHospitalId: String(r.fromHospitalId || ''),
              fromHospitalName: String(r.fromHospitalName || ''),
              toHospitalId: String(r.toHospitalId || ''),
              toHospitalName: String(r.toHospitalName || ''),
              effectiveDate: String(r.effectiveDate || ''),
              requestedBy: String(r.requestedBy || ''),
              status: (r.status as TransferRecord['status']) || 'pending',
              reason: String(r.reason || ''),
              requestedAt: String(r.requestedAt || ''),
            })).filter((tr) => tr.id);
            if (!remote.length) return;
            setTransfers((prev) => {
              const byId = new Map<string, TransferRecord>();
              for (const tr of prev) byId.set(tr.id, tr);
              for (const tr of remote) {
                const old = byId.get(tr.id);
                // Prefer remote when status advanced or newer request
                if (!old || (tr.requestedAt || '') >= (old.requestedAt || '') || tr.status !== old.status) {
                  byId.set(tr.id, { ...old, ...tr });
                }
              }
              const next = Array.from(byId.values());
              try {
                localStorage.setItem('medcore_os_transfers', JSON.stringify(next));
              } catch { /* ignore */ }
              return next;
            });
          } catch (e) {
            console.error(e);
          }
        });
      } catch { /* offline */ }
    })();

    return () => {
      window.removeEventListener('medcore-admin-sync', onSync);
      window.removeEventListener('medcore-transfers-updated', onSync);
      window.removeEventListener('storage', onSync);
      stopCloud();
    };
  }, []);

  const persistData = (updatedStaff: StaffMember[], updatedTransfers: TransferRecord[]) => {
    try {
      localStorage.setItem('medcore_os_staff_registry', JSON.stringify(updatedStaff));
      localStorage.setItem('medcore_os_transfers', JSON.stringify(updatedTransfers));
      window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: 'transfers' } }));
    } catch (e) {
      console.error(e);
    }
  };

  /** Notify destination facility admin (local inbox + Firestore when available) */
  const notifyDestination = async (tr: TransferRecord) => {
    try {
      const key = `medcore_os_transfer_inbox_${tr.toHospitalId}`;
      const raw = localStorage.getItem(key);
      const list = raw ? JSON.parse(raw) : [];
      const next = [tr, ...list.filter((x: TransferRecord) => x.id !== tr.id)];
      localStorage.setItem(key, JSON.stringify(next));
      localStorage.setItem('medcore_os_transfers', JSON.stringify([tr, ...transfers.filter((x) => x.id !== tr.id)]));
    } catch { /* ignore */ }
    // Live notification to BOTH hospitals (snapshot, no reload)
    try {
      const { pushNotificationCrossFacility } = await import('../../lib/notificationEngine');
      pushNotificationCrossFacility(
        {
          facilityId: tr.toHospitalId,
          level: 'important',
          title: 'Incoming staff transfer',
          body: `${tr.staffName} (${tr.role}) from ${tr.fromHospitalName} → ${tr.toHospitalName}. Effective ${tr.effectiveDate}.`,
          module: 'transfer',
          roleHint: 'hospital_admin',
          fromFacilityId: tr.fromHospitalId,
          toFacilityId: tr.toHospitalId,
        } as any,
        [tr.fromHospitalId, tr.toHospitalId].filter(Boolean)
      );
    } catch { /* ignore */ }
    try {
      const { firestoreWriteFacility, firestoreUpsertNetworkTransfer } = await import('../../lib/firebase');
      await firestoreWriteFacility(tr.toHospitalId, {
        transferInbox: {
          [tr.id]: { ...tr, notifiedAt: new Date().toISOString() },
        },
      });
      if (tr.fromHospitalId) {
        await firestoreWriteFacility(tr.fromHospitalId, {
          transferInbox: {
            [tr.id]: { ...tr, notifiedAt: new Date().toISOString() },
          },
        });
      }
      await firestoreUpsertNetworkTransfer({ ...tr });
    } catch { /* offline */ }
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
      const targetHosp = HOSPITALS.find(h => h.id === targetHospitalId);
      if (!targetHosp) { showToast('Select a destination hospital'); setTransferring(false); return; }
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
      void notifyDestination(newTransfer);

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
    pushActivity(`Transfer approved: ${targetTransfer.staffName}`);
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

  const myHospitalId = session?.hospitalId || '';

  /** Destination admin grants login at this facility */
  const grantIncomingAccess = (transferId: string) => {
    const tr = transfers.find((t) => t.id === transferId);
    if (!tr) return;
    const updatedTransfers = transfers.map((t) =>
      t.id === transferId ? { ...t, status: 'completed' as const } : t
    );
    const updatedStaff = staff.map((s) =>
      s.id === tr.staffId || s.name === tr.staffName
        ? {
            ...s,
            hospitalId: tr.toHospitalId,
            hospitalName: tr.toHospitalName,
            status: 'active' as const,
          }
        : s
    );
    // Ensure staff appears at destination registry
    const exists = updatedStaff.some((s) => s.id === tr.staffId);
    const withStaff = exists
      ? updatedStaff
      : [
          {
            id: tr.staffId,
            name: tr.staffName,
            role: tr.role,
            roleKey: (tr as any).roleKey || 'doctor',
            department: 'Transferred',
            hospitalId: tr.toHospitalId,
            hospitalName: tr.toHospitalName,
            status: 'active' as const,
            joinDate: new Date().toISOString().slice(0, 10),
            avatarInitials: tr.staffName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase(),
            accentColor: '#0052D4',
          },
          ...updatedStaff,
        ];

    setTransfers(updatedTransfers);
    setStaff(withStaff);
    persistData(withStaff, updatedTransfers);

    // Access row so they can log in here
    try {
      const row = {
        id: tr.staffId,
        name: tr.staffName,
        role: tr.role,
        department: 'Transferred in',
        clearance: 3,
        status: 'active' as const,
        lastLogin: 'Never',
        permissions: ['dashboard'],
      };
      setAccessRecords([row, ...getAccessRecords().filter((r: any) => r.id !== tr.staffId)]);
    } catch { /* ignore */ }

    showToast(`Login access granted for ${tr.staffName} at this hospital`);
  };

  // Incoming transfers for this admin's hospital
  const incomingTransfers = transfers.filter(
    (t) =>
      t.status === 'pending' &&
      myHospitalId &&
      t.toHospitalId === myHospitalId &&
      t.fromHospitalId !== myHospitalId
  );

  // Filtered staff
  const filteredStaff = staff.filter(s => {
    const q = search.toLowerCase();
    const name = (s.name || '').toLowerCase();
    const role = (s.role || '').toLowerCase();
    const dept = (s.department || '').toLowerCase();
    const id = (s.id || '').toLowerCase();
    const matchSearch = !q || name.includes(q) || role.includes(q) || dept.includes(q) || id.includes(q);
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
        {(['roster', 'pending', 'incoming', 'history'] as const).map(tab => (
          <button key={tab} className="os-ghost-btn" onClick={() => setActiveTab(tab)}
            style={{
              background: activeTab === tab ? 'linear-gradient(90deg, rgba(0,82,212,0.12) 0%, rgba(0,191,165,0.12) 100%)' : undefined,
              borderColor: activeTab === tab ? '#0052D4' : undefined,
              color: activeTab === tab ? '#0052D4' : undefined,
              textTransform: 'capitalize',
              fontWeight: activeTab === tab ? 700 : 600,
            }}>
            {tab === 'roster' ? '👥 Staff Roster' : tab === 'pending' ? `⏳ Outgoing (${pendingTransfers.length})` : tab === 'incoming' ? `📥 Incoming (${incomingTransfers.length})` : '📋 Transfer History'}
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
                  const sc = STATUS_CONFIG[member.status] || STATUS_CONFIG.active;
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
                          {(member.hospitalName || '—').length > 30 ? (member.hospitalName || '').slice(0, 30) + '…' : (member.hospitalName || '—')}
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
      
      {activeTab === 'incoming' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="os-insight-banner">
            <div style={{ fontSize: '0.84rem', color: '#64748B', lineHeight: 1.5 }}>
              Transfers <strong>into your hospital</strong>. Grant login access so the staff member can use their badge on this facility&apos;s role dashboard.
            </div>
          </div>
          {incomingTransfers.length === 0 && (
            <div className="os-card" style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>
              No incoming transfer requests for this hospital.
            </div>
          )}
          {incomingTransfers.map((tr) => (
            <div key={tr.id} className="os-card" style={{ padding: 16, borderLeft: '3px solid #00BFA5' }}>
              <div style={{ fontWeight: 800 }}>{tr.staffName}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 4 }}>
                {tr.role} · from {tr.fromHospitalName} → {tr.toHospitalName}
              </div>
              <div style={{ fontSize: '0.78rem', marginTop: 8 }}>Reason: {tr.reason}</div>
              <button
                type="button"
                className="os-primary-btn"
                style={{ marginTop: 12 }}
                onClick={() => grantIncomingAccess(tr.id)}
              >
                Grant login access at this hospital
              </button>
            </div>
          ))}
        </div>
      )}

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
