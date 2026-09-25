'use client';

import React, { useState } from 'react';
import { 
  X, 
  ArrowRightLeft, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Building2, 
  User, 
  ShieldCheck, 
  FileText, 
  Check, 
  Users, 
  Bed, 
  Plus,
  Send,
  AlertOctagon,
  Calendar,
  Lock,
  ArrowRight
} from 'lucide-react';

/* =========================================================================
   1. TRANSFER REVIEW DRAWER
   ========================================================================= */
interface TransferReviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  transferData?: {
    id: string;
    staffName: string;
    role: string;
    sourceHospital: string;
    targetHospital: string;
    date: string;
    status: 'Pending' | 'Completed' | 'Rejected';
    reason: string;
    urgency: string;
  };
  onApprove: (id: string, staffName: string) => void;
  onReject: (id: string, staffName: string) => void;
}

export const TransferReviewDrawer: React.FC<TransferReviewDrawerProps> = ({
  isOpen,
  onClose,
  transferData,
  onApprove,
  onReject,
}) => {
  const [notes, setNotes] = useState('');

  if (!isOpen || !transferData) return null;

  return (
    <div className="ha-drawer-backdrop" onClick={onClose}>
      <aside className="ha-drawer" onClick={(e) => e.stopPropagation()} style={{ width: 520 }}>
        <div className="ha-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F59E0B'
            }}>
              <ArrowRightLeft size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
                Transfer Review #{transferData.id}
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                Inter-facility Staff Transfer Directive
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div className="ha-drawer-body">
          {/* Status Alert Banner */}
          <div style={{
            padding: '14px 16px',
            borderRadius: 10,
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Clock size={16} color="#F59E0B" />
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#FFFFFF' }}>
                  Awaiting Administrative Sign-off
                </div>
                <div style={{ fontSize: '0.72rem', color: '#F59E0B' }}>
                  Submitted 8 minutes ago · Urgency: {transferData.urgency}
                </div>
              </div>
            </div>
            <span className="ha-status-badge pending">
              {transferData.status}
            </span>
          </div>

          {/* Practitioner Dossier */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: 12,
            padding: '16px'
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 12 }}>
              Practitioner Details
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0066FF, #00D4A8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFF',
                fontWeight: 700,
                fontSize: '1rem'
              }}>
                {transferData.staffName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
                  {transferData.staffName}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#38BDF8' }}>
                  {transferData.role}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem' }}>From Facility</span>
                <strong style={{ color: '#FFFFFF' }}>{transferData.sourceHospital}</strong>
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem' }}>Destination Facility</span>
                <strong style={{ color: '#00D4A8' }}>{transferData.targetHospital}</strong>
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem' }}>Effective Date</span>
                <strong style={{ color: '#FFFFFF' }}>{transferData.date}</strong>
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem' }}>License Validation</span>
                <strong style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ShieldCheck size={14} /> MDCN Verified
                </strong>
              </div>
            </div>
          </div>

          {/* Clinical Justification */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: 12,
            padding: '16px'
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8 }}>
              Reason for Transfer
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#E2E8F0', lineHeight: 1.5 }}>
              {transferData.reason}
            </p>
          </div>

          {/* Administrative notes */}
          <div>
            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>
              Administrator Decision Notes (Audit Trail)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Sponsoring hospital confirmed housing and roster inclusion..."
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                padding: '10px 12px',
                color: '#FFF',
                fontSize: '0.82rem',
                outline: 'none',
                resize: 'none'
              }}
            />
          </div>
        </div>

        <div className="ha-drawer-footer">
          <button
            type="button"
            className="ha-action-ghost-btn"
            onClick={() => onReject(transferData.id, transferData.staffName)}
            style={{ color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            Decline Transfer
          </button>
          <button
            type="button"
            className="ha-action-pill-btn primary"
            onClick={() => onApprove(transferData.id, transferData.staffName)}
          >
            <Check size={16} />
            Approve & Dispatch
          </button>
        </div>
      </aside>
    </div>
  );
};

/* =========================================================================
   2. ACCESS REVIEW DRAWER
   ========================================================================= */
interface AccessReviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onGrantAccess: (id: string, user: string, role: string) => void;
  onRevokeAccess: (id: string, user: string) => void;
}

export const AccessReviewDrawer: React.FC<AccessReviewDrawerProps> = ({
  isOpen,
  onClose,
  onGrantAccess,
  onRevokeAccess,
}) => {
  const [requests, setRequests] = useState([
    {
      id: 'req-1',
      user: 'Nurse Chidinma Eze',
      department: 'Pharmacy Dispensary',
      requestedRole: 'Pharmacy Dispense Override',
      riskLevel: 'Medium',
      submittedAt: '14 min ago',
      reason: 'Required for nocturnal emergency dispensation authorization.'
    },
    {
      id: 'req-2',
      user: 'Dr. Kevin Nwosu',
      department: 'Intensive Care Unit (ICU)',
      requestedRole: 'ICU Telemetry Read/Write',
      riskLevel: 'High',
      submittedAt: '45 min ago',
      reason: 'Rotational assignment into trauma wing step-down beds.'
    },
    {
      id: 'req-3',
      user: 'Sarah Johnson',
      department: 'Human Resources',
      requestedRole: 'Mass Payroll Audit Export',
      riskLevel: 'Low',
      submittedAt: '2 hours ago',
      reason: 'Monthly statutory compliance report submission.'
    }
  ]);

  if (!isOpen) return null;

  return (
    <div className="ha-drawer-backdrop" onClick={onClose}>
      <aside className="ha-drawer" onClick={(e) => e.stopPropagation()} style={{ width: 500 }}>
        <div className="ha-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#EF4444'
            }}>
              <Lock size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
                Pending Access Requests
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                3 Security and Permission Change Requests
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div className="ha-drawer-body">
          {requests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94A3B8' }}>
              <CheckCircle2 size={40} color="#10B981" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ margin: '0 0 6px', color: '#FFFFFF' }}>All Access Requests Resolved</h4>
              <p style={{ margin: 0, fontSize: '0.8rem' }}>No pending clearance elevations or role changes.</p>
            </div>
          ) : (
            requests.map((req) => (
              <div
                key={req.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#FFFFFF' }}>
                      {req.user}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
                      {req.department} · {req.submittedAt}
                    </div>
                  </div>
                  <span className={`ha-priority-pill ${req.riskLevel.toLowerCase()}`}>
                    ● {req.riskLevel} Risk
                  </span>
                </div>

                <div style={{
                  padding: '10px 12px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  borderRadius: 8,
                  fontSize: '0.78rem'
                }}>
                  <div style={{ color: '#64748B', fontSize: '0.7rem' }}>Requested Privilege</div>
                  <div style={{ color: '#38BDF8', fontWeight: 600, marginTop: 2 }}>{req.requestedRole}</div>
                  <div style={{ color: '#E2E8F0', marginTop: 4, fontStyle: 'italic' }}>&ldquo;{req.reason}&rdquo;</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => {
                      onRevokeAccess(req.id, req.user);
                      setRequests(prev => prev.filter(r => r.id !== req.id));
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#EF4444',
                      padding: '6px 14px',
                      borderRadius: 6,
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Deny
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onGrantAccess(req.id, req.user, req.requestedRole);
                      setRequests(prev => prev.filter(r => r.id !== req.id));
                    }}
                    style={{
                      background: '#0066FF',
                      border: 'none',
                      color: '#FFFFFF',
                      padding: '6px 14px',
                      borderRadius: 6,
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Check size={14} />
                    Grant Access
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
};

/* =========================================================================
   3. COMPLIANCE DRAWER
   ========================================================================= */
interface ComplianceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduleAudit: () => void;
}

export const ComplianceDrawer: React.FC<ComplianceDrawerProps> = ({
  isOpen,
  onClose,
  onScheduleAudit,
}) => {
  if (!isOpen) return null;

  const records = [
    {
      title: 'Pharmacy Cold-Chain & Vaccine Verification',
      department: 'Pharmacy Dispensary',
      expiresIn: 'Expires in 7 days',
      urgency: 'high',
      status: 'Action Needed'
    },
    {
      title: 'Radiation Protection & Lead Shielding Certificate',
      department: 'Radiology & Imaging',
      expiresIn: 'Expires in 21 days',
      urgency: 'medium',
      status: 'Renewal Pending'
    },
    {
      title: 'Hospital Waste Management & Incineration Permit',
      department: 'Sanitation & Infection Control',
      expiresIn: 'Expires in 42 days',
      urgency: 'low',
      status: 'Compliant'
    }
  ];

  return (
    <div className="ha-drawer-backdrop" onClick={onClose}>
      <aside className="ha-drawer" onClick={(e) => e.stopPropagation()} style={{ width: 500 }}>
        <div className="ha-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10B981'
            }}>
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
                Compliance & Accreditation Health
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                92% Institutional Overall Score · 2 Documents Expiring
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div className="ha-drawer-body">
          <div style={{
            background: 'linear-gradient(135deg, rgba(0, 102, 255, 0.12), rgba(0, 212, 168, 0.08))',
            border: '1px solid rgba(0, 102, 255, 0.25)',
            borderRadius: 12,
            padding: '16px'
          }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#FFFFFF' }}>92%</div>
            <div style={{ fontSize: '0.8rem', color: '#00D4A8', fontWeight: 600 }}>Operational Health Grade A+</div>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 4 }}>
              Complies with Akwa Ibom State Ministry of Health & NDHA National Standards.
            </div>
          </div>

          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginTop: 8 }}>
            Upcoming Document Renewals & Inspections
          </div>

          {records.map((rec, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                borderRadius: 10,
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12
              }}
            >
              <div>
                <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#FFFFFF' }}>{rec.title}</div>
                <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: 2 }}>{rec.department}</div>
                <div style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: rec.urgency === 'high' ? '#EF4444' : rec.urgency === 'medium' ? '#F59E0B' : '#10B981',
                  marginTop: 4
                }}>
                  ● {rec.expiresIn}
                </div>
              </div>
              <button
                type="button"
                onClick={onScheduleAudit}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#38BDF8',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Renew →
              </button>
            </div>
          ))}
        </div>

        <div className="ha-drawer-footer">
          <button type="button" className="ha-action-pill-btn primary" onClick={onScheduleAudit}>
            Schedule Re-Accreditation Audit
          </button>
        </div>
      </aside>
    </div>
  );
};

/* =========================================================================
   4. STAFF DIRECTORY DRAWER
   ========================================================================= */
interface StaffDirectoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddStaff: () => void;
}

export const StaffDirectoryDrawer: React.FC<StaffDirectoryDrawerProps> = ({
  isOpen,
  onClose,
  onAddStaff,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');

  if (!isOpen) return null;

  const staffMembers = [
    { name: 'Dr. Fatima Al-Hassan', role: 'Senior Obstetrician', dept: 'Nursing & Maternal', status: 'Active', shifts: 'Morning' },
    { name: 'Dr. Amara Okafor', role: 'Chief Pediatric Surgeon', dept: 'Surgery', status: 'Active', shifts: 'On-Call' },
    { name: 'Dr. Ibrahim Musa', role: 'Head of Anesthesiology', dept: 'Surgery', status: 'Active', shifts: 'Night' },
    { name: 'Sarah Johnson', role: 'HR Operations Manager', dept: 'Administration', status: 'Active', shifts: 'General' },
    { name: 'Michael Okafor', role: 'Chief Security Officer', dept: 'IT & Security', status: 'Active', shifts: 'General' },
    { name: 'Amina Bello', role: 'Senior Pharmacist', dept: 'Pharmacy', status: 'Active', shifts: 'Morning' },
    { name: 'James Bassey', role: 'Ward Charge Nurse', dept: 'Nursing', status: 'Active', shifts: 'Night' },
    { name: 'Grace Archibong', role: 'Senior Radiographer', dept: 'Radiology', status: 'Active', shifts: 'Afternoon' },
  ];

  const filtered = staffMembers.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDept = selectedDept === 'All' || s.dept.includes(selectedDept);
    return matchSearch && matchDept;
  });

  return (
    <div className="ha-drawer-backdrop" onClick={onClose}>
      <aside className="ha-drawer" onClick={(e) => e.stopPropagation()} style={{ width: 560 }}>
        <div className="ha-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: 'rgba(0, 102, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38BDF8'
            }}>
              <Users size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
                Hospital Staff Directory
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                87 Total Staff Registered at Immanuel General Hospital
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', gap: 10 }}>
          <input
            type="text"
            placeholder="Search staff by name or specialty..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              padding: '8px 12px',
              color: '#FFF',
              fontSize: '0.82rem',
              outline: 'none'
            }}
          />
          <button
            type="button"
            className="ha-action-pill-btn primary"
            onClick={onAddStaff}
            style={{ padding: '8px 14px' }}
          >
            <Plus size={15} />
            Add Staff
          </button>
        </div>

        <div className="ha-drawer-body">
          {filtered.map((s, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0066FF, #38BDF8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFF',
                  fontWeight: 700,
                  fontSize: '0.82rem'
                }}>
                  {s.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#FFFFFF' }}>{s.name}</div>
                  <div style={{ fontSize: '0.74rem', color: '#94A3B8' }}>{s.role} · {s.dept}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="ha-status-badge active">● {s.shifts}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
};

/* =========================================================================
   5. QUICK ACTION MODALS (Add Staff, New Transfer, Create Roster, Report Incident, Assign Bed)
   ========================================================================= */

export const QuickAddStaffModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (staff: { name: string; role: string; dept: string; license: string }) => void;
}> = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('Medical Officer');
  const [dept, setDept] = useState('Nursing');
  const [license, setLicense] = useState('');

  if (!isOpen) return null;

  return (
    <div className="ha-modal-backdrop" onClick={onClose}>
      <div className="ha-modal-window" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="ha-drawer-header">
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
            + Add Staff Member
          </h3>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onSubmit({ name, role, dept, license: license || 'MDCN-PENDING' });
          onClose();
        }} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>Full Name & Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Dr. Ngozi Adeleke"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#FFF', fontSize: '0.86rem', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>Department</label>
              <select
                value={dept}
                onChange={(e) => setDept(e.target.value)}
                style={{ width: '100%', background: '#0F1A34', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#FFF', fontSize: '0.84rem' }}
              >
                <option value="Nursing">Nursing</option>
                <option value="Internal Medicine">Internal Medicine</option>
                <option value="Radiology">Radiology</option>
                <option value="Surgery">Surgery</option>
                <option value="Pharmacy">Pharmacy</option>
                <option value="Pediatrics">Pediatrics</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>Clinical Role</label>
              <input
                type="text"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Consultant Surgeon"
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#FFF', fontSize: '0.84rem', outline: 'none' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>MDCN / NMCN License ID</label>
            <input
              type="text"
              placeholder="e.g. MDCN/AKS/2026/894"
              value={license}
              onChange={(e) => setLicense(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#FFF', fontSize: '0.86rem', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} className="ha-action-ghost-btn">Cancel</button>
            <button type="submit" className="ha-action-pill-btn primary">
              <Plus size={16} /> Save Staff Member
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const QuickTransferModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (transfer: { staffName: string; from: string; to: string; date: string }) => void;
}> = ({ isOpen, onClose, onSubmit }) => {
  const [staffName, setStaffName] = useState('Dr. Fatima Al-Hassan');
  const [from, setFrom] = useState('Immanuel General Hospital, Eket');
  const [to, setTo] = useState('University College Hospital (UCH)');
  const [date, setDate] = useState('2026-10-01');

  if (!isOpen) return null;

  return (
    <div className="ha-modal-backdrop" onClick={onClose}>
      <div className="ha-modal-window" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="ha-drawer-header">
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
            + New Staff Transfer
          </h3>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ staffName, from, to, date });
          onClose();
        }} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>Practitioner Name</label>
            <input
              type="text"
              required
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#FFF', fontSize: '0.86rem', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>Origin Facility</label>
              <input
                type="text"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#FFF', fontSize: '0.82rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>Target Facility</label>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#FFF', fontSize: '0.82rem' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>Target Effective Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#FFF', fontSize: '0.84rem' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} className="ha-action-ghost-btn">Cancel</button>
            <button type="submit" className="ha-action-pill-btn primary">
              <ArrowRightLeft size={16} /> Dispatch Transfer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const QuickCreateRosterModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (roster: { dept: string; period: string; coordinator: string }) => void;
}> = ({ isOpen, onClose, onSubmit }) => {
  const [dept, setDept] = useState('Nursing');
  const [period, setPeriod] = useState('October 2026 Roster');
  const [coordinator, setCoordinator] = useState('James Bassey');

  if (!isOpen) return null;

  return (
    <div className="ha-modal-backdrop" onClick={onClose}>
      <div className="ha-modal-window" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="ha-drawer-header">
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
            + Create Department Roster
          </h3>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ dept, period, coordinator });
          onClose();
        }} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>Department</label>
            <select
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              style={{ width: '100%', background: '#0F1A34', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#FFF', fontSize: '0.84rem' }}
            >
              <option value="Nursing">Nursing (34 Staff)</option>
              <option value="Internal Medicine">Internal Medicine (14 Staff)</option>
              <option value="Radiology">Radiology (11 Staff)</option>
              <option value="Surgery">Surgery (9 Staff)</option>
              <option value="Pharmacy">Pharmacy (6 Staff)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>Roster Period</label>
            <input
              type="text"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#FFF', fontSize: '0.84rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>Shift Lead / Coordinator</label>
            <input
              type="text"
              value={coordinator}
              onChange={(e) => setCoordinator(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#FFF', fontSize: '0.84rem' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} className="ha-action-ghost-btn">Cancel</button>
            <button type="submit" className="ha-action-pill-btn primary">
              <Calendar size={16} /> Publish Roster
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const QuickIncidentModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (incident: { title: string; severity: string; details: string }) => void;
}> = ({ isOpen, onClose, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState('Medium');
  const [details, setDetails] = useState('');

  if (!isOpen) return null;

  return (
    <div className="ha-modal-backdrop" onClick={onClose}>
      <div className="ha-modal-window" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="ha-drawer-header">
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
            ▷ Report Operational Incident
          </h3>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onSubmit({ title, severity, details });
          onClose();
        }} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>Incident Summary</label>
            <input
              type="text"
              required
              placeholder="e.g. Cold-chain storage power fluctuation"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#FFF', fontSize: '0.84rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>Severity Level</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              style={{ width: '100%', background: '#0F1A34', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#FFF', fontSize: '0.84rem' }}
            >
              <option value="Critical">Critical (Immediate Patient / Safety Threat)</option>
              <option value="High">High (Service Disruption)</option>
              <option value="Medium">Medium (Operational Hazard)</option>
              <option value="Low">Low (Maintenance / Routine Notice)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>Mitigation & Notes</label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe containment actions underway..."
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#FFF', fontSize: '0.82rem', resize: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} className="ha-action-ghost-btn">Cancel</button>
            <button type="submit" className="ha-action-pill-btn" style={{ background: '#EF4444' }}>
              <AlertTriangle size={16} /> Log Incident
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const QuickAssignBedModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (assignment: { ward: string; bed: string; patient: string }) => void;
}> = ({ isOpen, onClose, onSubmit }) => {
  const [ward, setWard] = useState('Ward B - Male Medical');
  const [bed, setBed] = useState('Bed 14');
  const [patient, setPatient] = useState('');

  if (!isOpen) return null;

  return (
    <div className="ha-modal-backdrop" onClick={onClose}>
      <div className="ha-modal-window" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="ha-drawer-header">
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
            Assign Hospital Bed
          </h3>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => {
          e.preventDefault();
          if (!patient.trim()) return;
          onSubmit({ ward, bed, patient });
          onClose();
        }} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>Patient ID or Name</label>
            <input
              type="text"
              required
              placeholder="e.g. PAT-2026-0814 or Emmanuel James"
              value={patient}
              onChange={(e) => setPatient(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#FFF', fontSize: '0.84rem' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>Ward</label>
              <select
                value={ward}
                onChange={(e) => setWard(e.target.value)}
                style={{ width: '100%', background: '#0F1A34', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#FFF', fontSize: '0.82rem' }}
              >
                <option value="Ward B - Male Medical">Ward B - Male Medical</option>
                <option value="Ward A - Female Surgical">Ward A - Female Surgical</option>
                <option value="ICU Wing">ICU Wing</option>
                <option value="Pediatrics Ward">Pediatrics Ward</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>Bed Slot</label>
              <input
                type="text"
                value={bed}
                onChange={(e) => setBed(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#FFF', fontSize: '0.82rem' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} className="ha-action-ghost-btn">Cancel</button>
            <button type="submit" className="ha-action-pill-btn primary">
              <Bed size={16} /> Confirm Bed Allocation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
