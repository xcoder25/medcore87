'use client';

/**
 * Staff enrolment — creates auth identity + issues Staff ID card in one step.
 * Card is readable on Hospital OS and MedCore Clinic (same badgeId).
 */
import React, { useMemo, useState } from 'react';
import { UserPlus, IdCard, CheckCircle2 } from 'lucide-react';
import { HOSPITALS } from '../auth/AuthScreen';
import { enrolStaffAndIssueCard, listStaffCards, getStaffCard } from '../../lib/staffCardStore';
import { StaffIdCardView } from './StaffIdCardView';
import type { StaffCardRecord } from '@medcore/types';

const ROLE_OPTIONS = [
  { roleKey: 'doctor', role: 'Medical Officer', title: 'Medical Officer', shortRole: 'Doctor', clearanceLevel: 4, clearanceLabel: 'L4 Clinical', department: 'Internal Medicine' },
  { roleKey: 'nurse', role: 'Nursing Officer', title: 'Senior Nursing Officer', shortRole: 'Nurse', clearanceLevel: 3, clearanceLabel: 'L3 Nursing', department: 'Inpatient Wards' },
  { roleKey: 'surgeon', role: 'Consultant Surgeon', title: 'Consultant Surgeon', shortRole: 'Surgeon', clearanceLevel: 5, clearanceLabel: 'L5 Consultant', department: 'Surgery & Theatre' },
  { roleKey: 'pharmacist', role: 'Pharmacist', title: 'Pharmacist', shortRole: 'Pharmacist', clearanceLevel: 3, clearanceLabel: 'L3 Pharmacy', department: 'Pharmacy' },
  { roleKey: 'lab', role: 'Lab Scientist', title: 'Lab Scientist', shortRole: 'Lab', clearanceLevel: 3, clearanceLabel: 'L3 Lab', department: 'Pathology' },
  { roleKey: 'radiologist', role: 'Radiologist', title: 'Consultant Radiologist', shortRole: 'Radiology', clearanceLevel: 5, clearanceLabel: 'L5 Radiology', department: 'Radiology' },
  { roleKey: 'records', role: 'Records Officer', title: 'Health Records Officer', shortRole: 'Records', clearanceLevel: 2, clearanceLabel: 'L2 Records', department: 'Medical Records' },
  { roleKey: 'accountant', role: 'Finance Officer', title: 'Finance Officer', shortRole: 'Accounts', clearanceLevel: 3, clearanceLabel: 'L3 Finance', department: 'Billing & Finance' },
  { roleKey: 'hospital_admin', role: 'Hospital Administrator', title: 'Hospital Administrator', shortRole: 'Admin', clearanceLevel: 5, clearanceLabel: 'L5 Executive', department: 'Administration' },
  { roleKey: 'sysadmin', role: 'ICT / System Admin', title: 'System Administrator', shortRole: 'SysAdmin', clearanceLevel: 6, clearanceLabel: 'L6 SysAdmin', department: 'ICT' },
];

export const StaffEnrolment: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [roleKey, setRoleKey] = useState('doctor');
  const [facilityId, setFacilityId] = useState(HOSPITALS[0]?.id || 'IGH-EKT');
  const [pin, setPin] = useState('1234');
  const [issued, setIssued] = useState<StaffCardRecord | null>(null);
  const [error, setError] = useState('');
  const [cards, setCards] = useState<StaffCardRecord[]>(() =>
    typeof window !== 'undefined' ? listStaffCards() : []
  );

  const roleMeta = useMemo(
    () => ROLE_OPTIONS.find((r) => r.roleKey === roleKey) || ROLE_OPTIONS[0],
    [roleKey]
  );
  const facility = HOSPITALS.find((h) => h.id === facilityId) || HOSPITALS[0];

  const handleEnrol = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim()) {
      setError('Enter staff full name.');
      return;
    }
    const { card } = enrolStaffAndIssueCard({
      fullName: fullName.trim(),
      role: roleMeta.role,
      roleKey: roleMeta.roleKey,
      title: roleMeta.title,
      department: roleMeta.department,
      facilityId: facility.id,
      facilityName: facility.name,
      clearanceLevel: roleMeta.clearanceLevel,
      clearanceLabel: roleMeta.clearanceLabel,
      pin,
      shortRole: roleMeta.shortRole,
      permissions: ['dashboard'],
    });
    setIssued(card);
    setCards(listStaffCards());
    setFullName('');
  };

  return (
    <div className="os-module-layout">
      <div className="os-insight-banner">
        <IdCard size={18} style={{ color: '#0066FF', flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.88rem', marginBottom: 4 }}>
            Staff enrolment · ID card + auth in one step
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: 1.55 }}>
            Issuing a card creates the login identity (<strong>badge ID</strong>). The same card appears on{' '}
            <strong>Hospital OS</strong> and <strong>MedCore Clinic</strong> staff app.
          </div>
        </div>
      </div>

      <div className="os-split-2">
        <form className="os-panel" onSubmit={handleEnrol}>
          <div className="os-panel-header">
            <div className="os-panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserPlus size={16} color="#0066FF" /> Enrol new staff
            </div>
          </div>
          <div className="os-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>
              Full name
              <input
                className="os-search-input"
                style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px' }}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Dr. Uduak Essien"
              />
            </label>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>
              Role
              <select
                className="os-form-select"
                style={{ display: 'block', width: '100%', marginTop: 6 }}
                value={roleKey}
                onChange={(e) => setRoleKey(e.target.value)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.roleKey} value={r.roleKey}>
                    {r.title} ({r.clearanceLabel})
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>
              Facility
              <select
                className="os-form-select"
                style={{ display: 'block', width: '100%', marginTop: 6 }}
                value={facilityId}
                onChange={(e) => setFacilityId(e.target.value)}
              >
                {HOSPITALS.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>
              Initial PIN (auth)
              <input
                className="os-search-input"
                style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px' }}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={8}
              />
            </label>
            {error && (
              <div style={{ color: '#EF4444', fontSize: '0.8rem', fontWeight: 600 }}>{error}</div>
            )}
            <button type="submit" className="os-action-btn-primary" style={{ marginTop: 4 }}>
              <UserPlus size={16} /> Enrol & issue staff ID card
            </button>
          </div>
        </form>

        <div>
          {issued ? (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 12,
                  color: '#16A34A',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                }}
              >
                <CheckCircle2 size={18} /> Card issued — use badge ID to sign in on OS & Clinic
              </div>
              <StaffIdCardView card={issued} />
              <p style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 12, lineHeight: 1.5 }}>
                Login: badge <strong style={{ fontFamily: 'monospace' }}>{issued.badgeId}</strong> · PIN set at
                enrolment. Clinic app shows the same card under <strong>My Staff ID</strong>.
              </p>
            </div>
          ) : (
            <div className="os-card" style={{ padding: 24, color: '#64748B', fontSize: '0.88rem' }}>
              Complete enrolment to preview the staff ID card here. Existing cards are listed below.
            </div>
          )}
        </div>
      </div>

      {cards.length > 0 && (
        <div className="os-panel">
          <div className="os-panel-header">
            <div className="os-panel-title">Issued cards ({cards.length})</div>
          </div>
          <div className="os-panel-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {cards.map((c) => (
              <div key={c.badgeId} onClick={() => setIssued(getStaffCard(c.badgeId) || c)} style={{ cursor: 'pointer' }}>
                <StaffIdCardView card={c} compact />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffEnrolment;
